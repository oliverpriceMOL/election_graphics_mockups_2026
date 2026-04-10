/**
 * Council Result Card Component
 * Requires: d3.js, party-config.js, hemicycle.js, badge.js
 */
function councilResultCard(container, council, options = {}) {
  const { size = "full" } = options;
  const el = d3.select(container);
  el.selectAll("*").remove();

  const card = el.append("div")
    .attr("class", `council-card council-card--${size}`);

  // Header: council name
  const header = card.append("div").attr("class", "council-card__header");

  header.append("h3")
    .attr("class", "council-card__name")
    .text(council.name);

  // Gain/hold badge (below header)
  const badgeEl = card.append("div").attr("class", "council-card__badge");
  gainHoldBadge(badgeEl.node(), council, { fullNames: size === "full" });

  // Hemicycle
  const hemiEl = card.append("div").attr("class", "council-card__hemicycle");
  const containerWidth = hemiEl.node().getBoundingClientRect().width;
  const hemiWidth = size === "mini"
    ? Math.min(200, Math.max(120, containerWidth * 0.9))
    : Math.min(320, Math.max(180, containerWidth * 0.8));

  const sortedParties = [...(council.newCouncil || [])].sort((a, b) => b.seats - a.seats);
  hemicycle(hemiEl.node(), sortedParties, {
    width: hemiWidth,
    showLabels: size === "full",
    showMajorityLine: true,
  });

  // Change bar chart (full size only)
  if (size === "full" && council.changes) {
    const barEl = card.append("div").style("margin-top", "12px");
    changeBarChart(barEl.node(), council.changes);
  }

  return card.node();
}
