/**
 * Hemicycle Component
 * EU Parliament–style: concentric arcs of small circles
 * Requires: d3.js, party-config.js
 */

/**
 * Compute hemicycle layout geometry from arc angle and radius.
 * @param {number} arcAngle - Total arc sweep in degrees (e.g. 200)
 * @param {number} r - Outer radius in px
 * @param {number} width - SVG width in px
 * @returns {{ height, cx, cy, padding }}
 */
function hemicycleLayout(arcAngle, r, width) {
  const arcRad = arcAngle * Math.PI / 180;
  const padding = (Math.PI - arcRad) / 2;

  // How far the arc endpoints dip below the center line
  const dipBelow = arcRad > Math.PI ? r * Math.sin(Math.abs(padding)) : 0;

  // Vertical space: top margin + arc height + dip below horizontal + dot overflow
  const topMargin = r * 0.05;
  const dotPadding = r * 0.06;
  const height = topMargin + r + dipBelow + dotPadding;
  const cx = width / 2;
  const cy = topMargin + r;

  return { height, cx, cy, padding };
}

function hemicycle(container, parties, options = {}) {
  const {
    width = 400,
    outerRadius = null,
    arcAngle = 200,
    showMajorityLine = true,
    showLabels = true,
    labelMinSeats = 3,
  } = options;

  const totalSeats = parties.reduce((s, p) => s + p.seats, 0);
  const majorityLine = Math.floor(totalSeats / 2) + 1;

  const r = outerRadius || width * 0.45;
  const { height, cx, cy, padding } = hemicycleLayout(arcAngle, r, width);

  // Determine ring layout — pick smallest numRings where ideal packing fits totalSeats
  const innerRadiusFrac = 0.38;
  const usableArc = Math.PI - 2 * padding; // arc sweep in radians
  let numRings = 3;
  for (let n = 3; n <= 8; n++) {
    const gap = r * (1 - innerRadiusFrac) / n;
    let ideal = 0;
    for (let i = 0; i < n; i++) {
      ideal += (r * innerRadiusFrac + gap * (i + 0.5)) * usableArc / gap;
    }
    numRings = n;
    if (ideal >= totalSeats) break;
  }
  const ringGap = (r - r * innerRadiusFrac) / numRings;

  // Distribute seats so angular spacing ≈ radial spacing on each ring
  const ringRadii = [];
  const idealSeats = [];

  for (let i = 0; i < numRings; i++) {
    const ringR = r * innerRadiusFrac + ringGap * (i + 0.5);
    ringRadii.push(ringR);
    idealSeats.push(ringR * usableArc / ringGap);
  }
  const idealTotal = idealSeats.reduce((a, b) => a + b, 0);

  const ringSeats = idealSeats.map(s => Math.round((s / idealTotal) * totalSeats));
  let diff = totalSeats - ringSeats.reduce((a, b) => a + b, 0);
  for (let i = ringSeats.length - 1; diff !== 0; i = (i - 1 + ringSeats.length) % ringSeats.length) {
    if (diff > 0) { ringSeats[i]++; diff--; }
    else { ringSeats[i]--; diff++; }
  }

  // Create flat list of seat positions
  const seats = [];
  for (let ring = 0; ring < numRings; ring++) {
    const ringR = ringRadii[ring];
    const n = ringSeats[ring];
    for (let j = 0; j < n; j++) {
      const angle = Math.PI - padding - (j / (n - 1 || 1)) * (Math.PI - 2 * padding);
      seats.push({
        x: cx + ringR * Math.cos(angle),
        y: cy - ringR * Math.sin(angle),
        angle,
        ring,
        indexInRing: j,
      });
    }
  }

  // Sort by angle (descending) for left-to-right party assignment
  seats.sort((a, b) => b.angle - a.angle || a.ring - b.ring);

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
    ringGap * 0.50,
    (Math.PI * ringRadii[0]) / (ringSeats[0] * 2.0)
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
  // The line is drawn at the halfway mark (majorityLine - 1 seats before it),
  // so that the majorityLine-th seat is the first one visually past the line.
  if (showMajorityLine && totalSeats > 1) {
    const clearance = circleR * 1.5;
    const majLineIdx = majorityLine - 1; // line sits between seat majLineIdx-1 and majLineIdx

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

      // Count seats on this ring before the line (globalIdx < majLineIdx)
      const countInMajority = ringSeatsArr.filter(s => s.globalIdx < majLineIdx).length;

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
      .attr("stroke", "#181818")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,3")
      .attr("opacity", 0.7);
  }

  // Centre text — anchored so bottom text aligns with inner row bottom
  const bigFont = Math.max(14, width * 0.055);
  const smallFont = Math.max(9, width * 0.028);
  // Bottom of innermost ring = y of endpoint dots (where arc meets baseline)
  const innerBottomY = cy - ringRadii[0] * Math.sin(padding) + circleR;
  const textBaseY = innerBottomY;
  const majTextY = cy - ringRadii[0] + circleR + smallFont * 2.5;

  // "X for majority" — fixed at top of hollow (just below inner ring)
  const majText = svg.append("text")
    .attr("class", "hemi-label hemi-label--maj")
    .attr("x", cx)
    .attr("y", majTextY)
    .attr("text-anchor", "middle")
    .attr("font-size", smallFont)
    .attr("fill", "#888")
    .attr("font-family", "'Inter', sans-serif");

  if (showMajorityLine) {
    if (width >= 250) {
      majText.text(`${majorityLine} for majority`);
    } else {
      majText.append("tspan").attr("x", cx).text(`${majorityLine}`);
      majText.append("tspan").attr("x", cx).attr("dy", smallFont * 1.2).text("for majority");
    }
  }

  // Party name — shown on hover (just above seats text)
  const partyFont = Math.max(12, width * 0.038);
  const partyText = svg.append("text")
    .attr("class", "hemi-label hemi-label--party")
    .attr("x", cx)
    .attr("y", textBaseY - bigFont * 1.05)
    .attr("text-anchor", "middle")
    .attr("font-size", partyFont)
    .attr("fill", "#888")
    .attr("font-family", "'Inter', sans-serif");

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

  function labelFillForParty(partyAbbr) {
    const hex = partyColour(partyAbbr);
    const col = d3.color(hex);
    if (!col) return "#222";
    const luminance = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
    return luminance > 160 ? "#222" : hex;
  }

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

    partyText
      .text(partyShortName(partyAbbr))
      .attr("fill", labelFillForParty(partyAbbr))
      .attr("font-weight", "bold");

    seatsText
      .text(`${count} seats`);
  }

  function resetHighlight() {
    allCircles.attr("opacity", 1);
    partyText
      .text("")
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
