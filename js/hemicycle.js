/**
 * Hemicycle Component
 * EU Parliament–style: concentric arcs of small circles
 * Requires: d3.js, party-config.js
 */
function hemicycle(container, parties, options = {}) {
  const {
    width = 400,
    outerRadius = null,
    showMajorityLine = true,
    showLabels = true,
    labelMinSeats = 3,
  } = options;

  const totalSeats = parties.reduce((s, p) => s + p.seats, 0);
  const majorityLine = Math.floor(totalSeats / 2) + 1;

  const r = outerRadius || width * 0.45;
  const height = r * 1.15;
  const cx = width / 2;
  const cy = height * 0.92;

  // Determine ring layout
  const numRings = totalSeats <= 35 ? 3 : totalSeats <= 60 ? 4 : totalSeats <= 80 ? 5 : 6;
  const innerRadiusFrac = 0.45;
  const ringGap = (r - r * innerRadiusFrac) / numRings;

  // Distribute seats across rings (outer rings get more seats — wider arc)
  const ringRadii = [];
  const ringSeatCounts = [];
  let assignedTotal = 0;

  for (let i = 0; i < numRings; i++) {
    const ringR = r * innerRadiusFrac + ringGap * (i + 0.5);
    ringRadii.push(ringR);
    ringSeatCounts.push(ringR);
  }
  const totalWeight = ringSeatCounts.reduce((a, b) => a + b, 0);

  const ringSeats = ringSeatCounts.map(w => Math.round((w / totalWeight) * totalSeats));
  let diff = totalSeats - ringSeats.reduce((a, b) => a + b, 0);
  for (let i = ringSeats.length - 1; diff !== 0; i = (i - 1 + ringSeats.length) % ringSeats.length) {
    if (diff > 0) { ringSeats[i]++; diff--; }
    else { ringSeats[i]--; diff++; }
  }

  // Create flat list of seat positions
  const padding = Math.PI * 0.04;
  const seats = [];
  for (let ring = 0; ring < numRings; ring++) {
    const ringR = ringRadii[ring];
    const n = ringSeats[ring];
    for (let j = 0; j < n; j++) {
      const angle = Math.PI - padding - (j / (n - 1 || 1)) * (Math.PI - 2 * padding);
      seats.push({
        x: cx + ringR * Math.cos(angle),
        y: cy - ringR * Math.sin(angle),
        ring,
        indexInRing: j,
      });
    }
  }

  seats.sort((a, b) => a.x - b.x || b.y - a.y);

  // Assign party colours to seats
  let seatIdx = 0;
  for (const party of parties) {
    for (let j = 0; j < party.seats; j++) {
      if (seatIdx < seats.length) {
        seats[seatIdx].party = party.name;
        seats[seatIdx].colour = partyColour(party.name);
        seats[seatIdx].striped = !!party.striped;
        seatIdx++;
      }
    }
  }

  const circleR = Math.min(
    ringGap * 0.35,
    (Math.PI * ringRadii[0]) / (ringSeats[0] * 2.5)
  );

  // Clear and create SVG
  const el = d3.select(container);
  el.selectAll("*").remove();

  const svg = el.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("max-width", "100%");

  // Draw seat circles (handlers added after text elements are created)
  svg.selectAll("circle.seat")
    .data(seats)
    .join("circle")
    .attr("class", "seat")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", circleR)
    .attr("fill", d => d.striped ? "#fff" : (d.colour || "#ddd"))
    .attr("stroke", d => d.striped ? (d.colour || "#ddd") : "#fff")
    .attr("stroke-width", d => d.striped ? circleR * 0.4 : circleR * 0.15);

  // Majority line — curved path threading between the correct seats on each ring
  // After sorting, seats[majorityLine-1] is the last seat in the majority half
  // and seats[majorityLine] is the first seat outside. We find which ring-local
  // seats straddle that boundary on each ring.
  if (showMajorityLine && totalSeats > 1) {
    const clearance = circleR * 1.5;

    // Tag each seat with its sorted global index
    seats.forEach((s, i) => { s.globalIdx = i; });

    // For each ring, collect the seats sorted by their global index
    // and find which pair straddles the majority boundary
    const ringGapAngles = [];
    for (let ring = 0; ring < numRings; ring++) {
      const ringR = ringRadii[ring];
      const n = ringSeats[ring];

      // Get seats on this ring, sorted by global index (left-to-right)
      const ringSeatsArr = seats.filter(s => s.ring === ring).sort((a, b) => a.globalIdx - b.globalIdx);

      // Find the split point: which local index does the majority boundary fall at?
      // Count how many seats on this ring are in the majority half (globalIdx < majorityLine)
      const countInMajority = ringSeatsArr.filter(s => s.globalIdx < majorityLine).length;

      // The gap is between local seat [countInMajority - 1] and [countInMajority]
      let gapAngle;
      if (countInMajority <= 0) {
        // All seats on this ring are outside majority — line goes to the far left
        const firstAngle = Math.PI - padding - (0 / (n - 1 || 1)) * (Math.PI - 2 * padding);
        gapAngle = firstAngle + (Math.PI - 2 * padding) / (n - 1 || 1) * 0.5;
      } else if (countInMajority >= n) {
        // All seats on this ring are in majority — line goes to the far right
        const lastAngle = Math.PI - padding - ((n - 1) / (n - 1 || 1)) * (Math.PI - 2 * padding);
        gapAngle = lastAngle - (Math.PI - 2 * padding) / (n - 1 || 1) * 0.5;
      } else {
        // Normal case: gap between seat countInMajority-1 and countInMajority
        const seatLeft = ringSeatsArr[countInMajority - 1];
        const seatRight = ringSeatsArr[countInMajority];
        // Recover their angles from indexInRing
        const a1 = Math.PI - padding - (seatLeft.indexInRing / (n - 1 || 1)) * (Math.PI - 2 * padding);
        const a2 = Math.PI - padding - (seatRight.indexInRing / (n - 1 || 1)) * (Math.PI - 2 * padding);
        gapAngle = (a1 + a2) / 2;
      }

      ringGapAngles.push({ ringR, gapAngle });
    }

    const gapPoints = [];

    // Point just inside inner ring
    const preR = ringGapAngles[0].ringR - clearance;
    gapPoints.push([cx + preR * Math.cos(ringGapAngles[0].gapAngle), cy - preR * Math.sin(ringGapAngles[0].gapAngle)]);

    // Point on each ring
    for (const { ringR, gapAngle } of ringGapAngles) {
      gapPoints.push([cx + ringR * Math.cos(gapAngle), cy - ringR * Math.sin(gapAngle)]);
    }

    // Point just outside outer ring
    const lastGap = ringGapAngles[ringGapAngles.length - 1];
    const postR = lastGap.ringR + clearance;
    gapPoints.push([cx + postR * Math.cos(lastGap.gapAngle), cy - postR * Math.sin(lastGap.gapAngle)]);

    const line = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
    svg.append("path")
      .attr("d", line(gapPoints))
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,3")
      .attr("opacity", 0.5);
  }

  // Centre text — anchored to bottom of arc hollow
  const bigFont = Math.max(14, width * 0.055);
  const smallFont = Math.max(9, width * 0.028);
  const textBaseY = cy - bigFont * 0.3;

  // "X for maj" — above (only when majority line is shown)
  const majText = svg.append("text")
    .attr("class", "hemi-label hemi-label--maj")
    .attr("x", cx)
    .attr("y", textBaseY - bigFont * 1.05)
    .attr("text-anchor", "middle")
    .attr("font-size", smallFont)
    .attr("fill", "#888")
    .attr("font-family", "'Inter', sans-serif")
    .text(showMajorityLine ? `${majorityLine} for maj` : "");

  // "X seats" — below (bottom-aligned)
  const seatsText = svg.append("text")
    .attr("class", "hemi-label hemi-label--seats")
    .attr("x", cx)
    .attr("y", textBaseY)
    .attr("text-anchor", "middle")
    .attr("font-size", bigFont)
    .attr("font-weight", "bold")
    .attr("fill", "#222")
    .attr("font-family", "'Inter', sans-serif")
    .text(`${totalSeats} seats`);

  // ── Hover / tap interactivity ──
  // Build invisible convex-hull hit-areas per party so hovering the
  // combined zone (including gaps between circles) triggers highlight.
  const allCircles = svg.selectAll("circle.seat");

  // Group seat positions by party
  const partySeatsMap = {};
  for (const s of seats) {
    if (!s.party) continue;
    if (!partySeatsMap[s.party]) partySeatsMap[s.party] = [];
    partySeatsMap[s.party].push([s.x, s.y]);
  }

  // Create a hit-area group rendered behind the circles
  const hitGroup = svg.insert("g", "circle.seat").attr("class", "hit-areas");

  for (const [partyAbbr, points] of Object.entries(partySeatsMap)) {
    if (points.length < 3) {
      // For tiny parties (1-2 seats), use inflated circles as hit area
      for (const pt of points) {
        hitGroup.append("circle")
          .attr("cx", pt[0])
          .attr("cy", pt[1])
          .attr("r", circleR * 2.2)
          .attr("fill", "transparent")
          .style("cursor", "pointer")
          .datum(partyAbbr)
          .on("mouseenter", function(event, d) { showPartyHighlight(d); })
          .on("mouseleave", resetHighlight)
          .on("touchstart", function(event, d) { event.preventDefault(); showPartyHighlight(d); })
          .on("touchend", function() { setTimeout(resetHighlight, 1500); });
      }
    } else {
      // Compute convex hull and pad it outward
      const hull = d3.polygonHull(points);
      if (!hull) continue;

      // Expand hull outward by circleR so gaps between circles are covered
      const centroid = d3.polygonCentroid(hull);
      const expanded = hull.map(pt => {
        const dx = pt[0] - centroid[0];
        const dy = pt[1] - centroid[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = (dist + circleR * 1.5) / dist;
        return [centroid[0] + dx * scale, centroid[1] + dy * scale];
      });

      hitGroup.append("polygon")
        .attr("points", expanded.map(p => p.join(",")).join(" "))
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .datum(partyAbbr)
        .on("mouseenter", function(event, d) { showPartyHighlight(d); })
        .on("mouseleave", resetHighlight)
        .on("touchstart", function(event, d) { event.preventDefault(); showPartyHighlight(d); })
        .on("touchend", function() { setTimeout(resetHighlight, 1500); });
    }
  }

  function showPartyHighlight(partyAbbr) {
    allCircles
      .attr("opacity", d => d.party === partyAbbr ? 1 : 0.2);

    // Sum all entries for this party (solid + hollow may be separate)
    const count = parties.reduce((s, p) => p.name === partyAbbr ? s + p.seats : s, 0);

    majText
      .text(partyShortName(partyAbbr))
      .attr("fill", partyColour(partyAbbr))
      .attr("font-weight", "bold");

    seatsText
      .text(`${count} seats`);
  }

  function resetHighlight() {
    allCircles.attr("opacity", 1);
    majText
      .text(showMajorityLine ? `${majorityLine} for maj` : "")
      .attr("fill", "#888")
      .attr("font-weight", "normal");
    seatsText
      .text(`${totalSeats} seats`);
  }

  // Attach handlers to the seat circles as well (hulls cover gaps, circles cover dots)
  allCircles
    .style("cursor", "pointer")
    .on("mouseenter", function(event, d) { showPartyHighlight(d.party); })
    .on("mouseleave", resetHighlight)
    .on("touchstart", function(event, d) { event.preventDefault(); showPartyHighlight(d.party); })
    .on("touchend", function() { setTimeout(resetHighlight, 1500); });

  return svg.node();
}
