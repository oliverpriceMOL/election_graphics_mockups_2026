/**
 * Change Columns Chart — shared core
 * Renders a vertical diverging bar chart showing +/- change per party.
 * Each bar shows the change label (▲5 / ▼3) and the total in brackets.
 * options.seatsOnly — if true, renders simple upward bars of d.total with no change labels.
 * Requires: d3.js, party-config.js, utils.js
 *
 * options.parties — [{name, change, total, ...}] sorted; change = primary value
 */
function changeColumnsChart(containerEl, options) {
  var parties = options.parties;
  var seatsOnly = options.seatsOnly || false;

  var el = d3.select(containerEl);
  el.selectAll("*").remove();

  if (!parties || parties.length === 0) return;

  if (seatsOnly) return _renderSeatsOnly(el, parties);

  // SVG dimensions — extra top/bottom margin for two-line labels
  var margin = { top: 38, right: 12, bottom: 32, left: 40 };
  var width = 600;
  var height = 280;
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = el.append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  var g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // X scale
  var x = d3.scaleBand()
    .domain(parties.map(function (p) { return p.name; }))
    .range([0, innerW])
    .padding(0.12);

  // Y domain
  var maxAbs = Math.max.apply(null, parties.map(function (p) { return Math.abs(p.change); }).concat(1));
  var domainMax = nextCleanScale(maxAbs);
  var yScale = d3.scaleLinear()
    .domain([-domainMax, domainMax])
    .range([innerH, 0]);
  var zeroY = yScale(0);

  // Y-axis
  var halfStep = domainMax / 2;
  var yAxis = d3.axisLeft(yScale)
    .tickValues([-domainMax, -halfStep, 0, halfStep, domainMax])
    .tickFormat(function (d) { return d === 0 ? "" : (d > 0 ? "+" : "") + d; });
  g.append("g")
    .call(yAxis)
    .call(function (gg) { gg.select(".domain").remove(); })
    .call(function (gg) { gg.selectAll(".tick line").attr("stroke", "#e0e0e4").attr("x2", innerW); })
    .call(function (gg) { gg.selectAll(".tick text").attr("font-family", "'Inter', sans-serif").attr("font-size", 11).attr("fill", "#888"); });

  // Zero line
  g.append("line")
    .attr("x1", 0).attr("x2", innerW)
    .attr("y1", zeroY).attr("y2", zeroY)
    .attr("stroke", "#999").attr("stroke-width", 1);

  function valLabel(v) {
    if (v > 0) return "▲" + v;
    if (v < 0) return "▼" + Math.abs(v);
    return "—";
  }

  function valColour(v) {
    return v > 0 ? "#1a7f37" : v < 0 ? "#d1242f" : "#888";
  }

  // ── Bars ──
  g.selectAll(".col-bar")
    .data(parties).join("rect")
      .attr("class", "col-bar")
      .attr("x", function (d) { return x(d.name); })
      .attr("width", x.bandwidth())
      .attr("y", function (d) { return d.change >= 0 ? yScale(d.change) : zeroY; })
      .attr("height", function (d) { return Math.abs(yScale(d.change) - zeroY); })
      .attr("rx", 2).attr("fill", function (d) { return partyColour(d.name); });

  // ── Change labels (▲5 / ▼3) ──
  g.selectAll(".col-val")
    .data(parties).join("text")
      .attr("class", "col-val")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", function (d) {
        if (d.change >= 0) return yScale(d.change) - 5;
        var below = yScale(d.change) + 14;
        return below > innerH - 18 ? yScale(d.change) - 4 : below;
      })
      .attr("text-anchor", "middle").attr("font-size", 13).attr("font-weight", 700)
      .attr("font-family", "'Inter', sans-serif")
      .attr("fill", function (d) {
        if (d.change >= 0) return valColour(d.change);
        var below = yScale(d.change) + 14;
        return below > innerH - 18 ? textColourForBg(partyColour(d.name)) : valColour(d.change);
      })
      .style("pointer-events", "none")
      .text(function (d) { return valLabel(d.change); });

  // ── Total labels in brackets — above positive bars, below negative bars ──
  g.selectAll(".col-total")
    .data(parties).join("text")
      .attr("class", "col-total")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", function (d) {
        if (d.change >= 0) return yScale(d.change) - 19;
        var below = yScale(d.change) + 28;
        return below > innerH - 4 ? yScale(d.change) - 18 : below;
      })
      .attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 500)
      .attr("font-family", "'Inter', sans-serif")
      .attr("fill", function (d) {
        if (d.change >= 0) return "#666";
        var below = yScale(d.change) + 28;
        return below > innerH - 4 ? textColourForBg(partyColour(d.name)) : "#666";
      })
      .style("pointer-events", "none")
      .text(function (d) { return d.total != null ? "(" + d.total + ")" : ""; });

  // Party labels at bottom
  g.selectAll(".col-label")
    .data(parties).join("text")
      .attr("class", "col-label")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", innerH + 16)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600)
      .attr("font-family", "'Inter', sans-serif").attr("fill", "#444")
      .style("pointer-events", "none")
      .text(function (d) { return partyShortName(d.name); });
}

/**
 * Seats-only bar chart — simple upward bars from 0 with count above each bar.
 * Used for Wales where no previous-election data exists.
 */
function _renderSeatsOnly(el, parties) {
  var margin = { top: 28, right: 12, bottom: 32, left: 40 };
  var width = 600;
  var height = 240;
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = el.append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  var g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var x = d3.scaleBand()
    .domain(parties.map(function (p) { return p.name; }))
    .range([0, innerW])
    .padding(0.12);

  var maxVal = Math.max.apply(null, parties.map(function (p) { return p.total || 0; }).concat(1));
  var domainMax = nextCleanScale(maxVal);
  var yScale = d3.scaleLinear()
    .domain([0, domainMax])
    .range([innerH, 0]);

  // Y-axis
  var halfStep = domainMax / 2;
  var yAxis = d3.axisLeft(yScale)
    .tickValues([0, halfStep, domainMax])
    .tickFormat(function (d) { return d; });
  g.append("g")
    .call(yAxis)
    .call(function (gg) { gg.select(".domain").remove(); })
    .call(function (gg) { gg.selectAll(".tick line").attr("stroke", "#e0e0e4").attr("x2", innerW); })
    .call(function (gg) { gg.selectAll(".tick text").attr("font-family", "'Inter', sans-serif").attr("font-size", 11).attr("fill", "#888"); });

  // Bars
  g.selectAll(".col-bar")
    .data(parties).join("rect")
      .attr("class", "col-bar")
      .attr("x", function (d) { return x(d.name); })
      .attr("width", x.bandwidth())
      .attr("y", function (d) { return yScale(d.total || 0); })
      .attr("height", function (d) { return innerH - yScale(d.total || 0); })
      .attr("rx", 2).attr("fill", function (d) { return partyColour(d.name); });

  // Seat count labels above bars
  g.selectAll(".col-val")
    .data(parties).join("text")
      .attr("class", "col-val")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", function (d) { return yScale(d.total || 0) - 6; })
      .attr("text-anchor", "middle").attr("font-size", 13).attr("font-weight", 700)
      .attr("font-family", "'Inter', sans-serif").attr("fill", "#444")
      .style("pointer-events", "none")
      .text(function (d) { return d.total || 0; });

  // Party labels at bottom
  g.selectAll(".col-label")
    .data(parties).join("text")
      .attr("class", "col-label")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", innerH + 16)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600)
      .attr("font-family", "'Inter', sans-serif").attr("fill", "#444")
      .style("pointer-events", "none")
      .text(function (d) { return partyShortName(d.name); });
}
