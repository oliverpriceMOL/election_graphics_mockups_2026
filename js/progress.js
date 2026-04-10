/**
 * Progress Counter Component
 * Requires: d3.js
 */
function progressCounter(container, { declared, total, label = "councils" }) {
  const el = d3.select(container);
  el.selectAll("*").remove();

  const wrap = el.append("div").attr("class", "progress-counter");

  const barWrap = wrap.append("div").attr("class", "progress-bar");
  barWrap.append("div")
    .attr("class", "progress-bar__fill")
    .style("width", ((declared / total) * 100) + "%");
  barWrap.append("span")
    .attr("class", "progress-bar__text")
    .text(`${declared}/${total} ${label}`);
}
