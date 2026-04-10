/**
 * Change Bar Chart Component
 * Full-width horizontal pos/neg bar chart with 0 centred
 * Requires: d3.js, party-config.js
 */
function changeBarChart(container, changes, options = {}) {
  const {
    barHeight = 28,
    gap = 6,
  } = options;

  const el = d3.select(container);
  el.selectAll("*").remove();

  if (!changes || changes.length === 0) return;

  // Sort: biggest positive first, then biggest negative
  const sorted = [...changes].sort((a, b) => b.change - a.change);

  const maxAbs = Math.max(...sorted.map(c => Math.abs(c.change)), 1);
  const labelWidth = 50;
  const width = 600; // viewBox width, scales to 100%
  const chartWidth = width - labelWidth * 2;
  const midX = width / 2;
  const height = sorted.length * (barHeight + gap) + gap;

  const svg = el.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Centre line
  svg.append("line")
    .attr("x1", midX)
    .attr("y1", 0)
    .attr("x2", midX)
    .attr("y2", height)
    .attr("stroke", "#ccc")
    .attr("stroke-width", 1);

  sorted.forEach((c, i) => {
    const y = gap + i * (barHeight + gap);
    const barW = Math.max((Math.abs(c.change) / maxAbs) * (chartWidth / 2), 1);
    const isPositive = c.change >= 0;
    const barX = isPositive ? midX : midX - barW;

    // Party label (left side for negative, right side for positive — outside the bar)
    svg.append("text")
      .attr("x", isPositive ? midX - 6 : midX + 6)
      .attr("y", y + barHeight / 2)
      .attr("text-anchor", isPositive ? "end" : "start")
      .attr("dominant-baseline", "central")
      .attr("font-size", 15)
      .attr("font-weight", 600)
      .attr("fill", "#444")
      .attr("font-family", "'Inter', sans-serif")
      .text(partyShortName(c.name));

    // Bar
    svg.append("rect")
      .attr("x", barX)
      .attr("y", y)
      .attr("width", barW)
      .attr("height", barHeight)
      .attr("rx", 2)
      .attr("fill", partyColour(c.name))
      .attr("opacity", 0.85);

    // Value label inside bar at the edge
    if (c.change !== 0) {
      const arrow = c.change > 0 ? "\u25B2" : "\u25BC";
      const valText = `${arrow}${Math.abs(c.change)}`;
      const textX = isPositive ? barX + barW - 5 : barX + 5;
      const anchor = isPositive ? "end" : "start";
      // Only show inside if bar is wide enough
      const minBarForLabel = 30;
      if (barW >= minBarForLabel) {
        // Pick white or black for contrast against party colour
        const col = d3.color(partyColour(c.name));
        const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
        const textFill = lum > 160 ? "#222" : "#fff";
        svg.append("text")
          .attr("x", textX)
          .attr("y", y + barHeight / 2)
          .attr("text-anchor", anchor)
          .attr("dominant-baseline", "central")
          .attr("font-size", 14)
          .attr("font-weight", 700)
          .attr("fill", textFill)
          .attr("font-family", "'Inter', sans-serif")
          .text(valText);
      } else {
        // Show outside the bar in black
        const outsideX = isPositive ? barX + barW + 5 : barX - 5;
        const outsideAnchor = isPositive ? "start" : "end";
        svg.append("text")
          .attr("x", outsideX)
          .attr("y", y + barHeight / 2)
          .attr("text-anchor", outsideAnchor)
          .attr("dominant-baseline", "central")
          .attr("font-size", 14)
          .attr("font-weight", 700)
          .attr("fill", "#444")
          .attr("font-family", "'Inter', sans-serif")
          .text(valText);
      }
    }
  });

  return svg.node();
}
