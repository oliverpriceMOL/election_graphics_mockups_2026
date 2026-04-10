/**
 * Change Columns Chart — shared core
 * Renders a vertical diverging bar chart showing +/- change per party.
 * Supports single-bar and split (constituency/regional) modes.
 * Requires: d3.js, party-config.js, utils.js
 *
 * options.parties        — [{name, change, ...}] sorted; change = primary value
 * options.tooltipHtml    — function(d) → HTML string
 * options.split          — optional: {getConst(d)→num, getReg(d)→num} for paired bars
 */
function changeColumnsChart(containerEl, options) {
  var parties = options.parties;
  var tooltipHtml = options.tooltipHtml;
  var split = options.split || null;

  var el = d3.select(containerEl);
  el.selectAll("*").remove();

  if (!parties || parties.length === 0) return;

  // SVG dimensions
  var margin = { top: 24, right: 12, bottom: 32, left: 40 };
  var width = 600;
  var height = 260;
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

  // For split view, inner scale
  var xSub;
  if (split) {
    xSub = d3.scaleBand()
      .domain(["const", "reg"])
      .range([0, x.bandwidth()])
      .padding(0.02);
  }

  // Y domain
  var maxAbs;
  if (split) {
    maxAbs = Math.max.apply(null, parties.map(function (p) {
      return Math.max(Math.abs(split.getConst(p)), Math.abs(split.getReg(p)));
    }).concat(1));
  } else {
    maxAbs = Math.max.apply(null, parties.map(function (p) { return Math.abs(p.change); }).concat(1));
  }
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

  var tipId = "change-col-tooltip";

  var hitPad = x.step() * x.padding() / 2;

  function valLabel(v) {
    if (v > 0) return "▲" + v;
    if (v < 0) return "▼" + Math.abs(v);
    return "—";
  }

  function valColour(v) {
    return v > 0 ? "#1a7f37" : v < 0 ? "#d1242f" : "#888";
  }

  if (split) {
    // ── Split view: paired bars (constituency solid + regional striped) ──
    var defs = svg.append("defs");
    var stripeSize = 10;
    parties.forEach(function (p) {
      var pid = "stripe-" + p.name.replace(/[^a-zA-Z0-9]/g, "");
      var stripeColour = textColourForBg(partyColour(p.name));
      var pat = defs.append("pattern")
        .attr("id", pid)
        .attr("width", stripeSize).attr("height", stripeSize)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(45)");
      pat.append("rect").attr("width", stripeSize / 2).attr("height", stripeSize).attr("fill", partyColour(p.name));
      pat.append("rect").attr("x", stripeSize / 2).attr("width", stripeSize / 2).attr("height", stripeSize)
        .attr("fill", stripeColour);
    });

    // Constituency bars
    g.selectAll(".col-bar-const")
      .data(parties).join("rect")
        .attr("class", "col-bar-const")
        .attr("x", function (d) { return x(d.name) + xSub("const"); })
        .attr("width", xSub.bandwidth())
        .attr("y", function (d) { var v = split.getConst(d); return v >= 0 ? yScale(v) : zeroY; })
        .attr("height", function (d) { return Math.abs(yScale(split.getConst(d)) - zeroY); })
        .attr("rx", 2).attr("fill", function (d) { return partyColour(d.name); });

    // Regional bars (striped)
    g.selectAll(".col-bar-reg")
      .data(parties).join("rect")
        .attr("class", "col-bar-reg")
        .attr("x", function (d) { return x(d.name) + xSub("reg"); })
        .attr("width", xSub.bandwidth())
        .attr("y", function (d) { var v = split.getReg(d); return v >= 0 ? yScale(v) : zeroY; })
        .attr("height", function (d) { return Math.abs(yScale(split.getReg(d)) - zeroY); })
        .attr("rx", 2)
        .attr("fill", function (d) { return "url(#stripe-" + d.name.replace(/[^a-zA-Z0-9]/g, "") + ")"; })
        .attr("stroke", function (d) { return partyColour(d.name); })
        .attr("stroke-width", 2.5);

    // Value labels — constituency
    g.selectAll(".col-val-const")
      .data(parties).join("text")
        .attr("class", "col-val-const")
        .attr("x", function (d) { return x(d.name) + xSub("const") + xSub.bandwidth() / 2; })
        .attr("y", function (d) {
          var v = split.getConst(d);
          if (v >= 0) return yScale(v) - 4;
          var below = yScale(v) + 13;
          return below > innerH - 4 ? yScale(v) - 4 : below;
        })
        .attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700)
        .attr("font-family", "'Inter', sans-serif")
        .attr("fill", function (d) {
          var v = split.getConst(d);
          if (v >= 0) return valColour(v);
          var below = yScale(v) + 13;
          return below > innerH - 4 ? textColourForBg(partyColour(d.name)) : valColour(v);
        })
        .style("pointer-events", "none")
        .text(function (d) { return valLabel(split.getConst(d)); });

    // Value labels — regional
    g.selectAll(".col-val-reg")
      .data(parties).join("text")
        .attr("class", "col-val-reg")
        .attr("x", function (d) { return x(d.name) + xSub("reg") + xSub.bandwidth() / 2; })
        .attr("y", function (d) {
          var v = split.getReg(d);
          if (v >= 0) return yScale(v) - 4;
          var below = yScale(v) + 13;
          return below > innerH - 4 ? yScale(v) - 4 : below;
        })
        .attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700)
        .attr("font-family", "'Inter', sans-serif")
        .attr("fill", function (d) {
          var v = split.getReg(d);
          if (v >= 0) return valColour(v);
          var below = yScale(v) + 13;
          return below > innerH - 4 ? textColourForBg(partyColour(d.name)) : valColour(v);
        })
        .style("pointer-events", "none")
        .text(function (d) { return valLabel(split.getReg(d)); });

    // Hit areas
    g.selectAll(".col-hit")
      .data(parties).join("rect")
        .attr("class", "col-hit")
        .attr("x", function (d) { return x(d.name) - hitPad; })
        .attr("width", x.step()).attr("y", 0).attr("height", innerH)
        .attr("fill", "transparent").style("cursor", "pointer")
        .on("mouseenter", function (event, d) {
          g.selectAll(".col-bar-const,.col-bar-reg").filter(function (b) { return b.name === d.name; });
          Tooltip.show(tipId, tooltipHtml(d), event.clientX, event.clientY);
        })
        .on("mousemove", function (event) {
          var el = document.getElementById(tipId);
          if (el) Tooltip.position(el, event.clientX, event.clientY);
        })
        .on("mouseleave", function (event, d) {
          g.selectAll(".col-bar-const,.col-bar-reg").filter(function (b) { return b.name === d.name; });
          Tooltip.hide(tipId);
        });

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

  } else {
    // ── Single-bar view ──
    g.selectAll(".col-bar")
      .data(parties).join("rect")
        .attr("class", "col-bar")
        .attr("x", function (d) { return x(d.name); })
        .attr("width", x.bandwidth())
        .attr("y", function (d) { return d.change >= 0 ? yScale(d.change) : zeroY; })
        .attr("height", function (d) { return Math.abs(yScale(d.change) - zeroY); })
        .attr("rx", 2).attr("fill", function (d) { return partyColour(d.name); });

    // Hit areas
    g.selectAll(".col-hit")
      .data(parties).join("rect")
        .attr("class", "col-hit")
        .attr("x", function (d) { return x(d.name) - hitPad; })
        .attr("width", x.step()).attr("y", 0).attr("height", innerH)
        .attr("fill", "transparent").style("cursor", "pointer")
        .on("mouseenter", function (event, d) {
          g.selectAll(".col-bar").filter(function (b) { return b.name === d.name; });
          Tooltip.show(tipId, tooltipHtml(d), event.clientX, event.clientY);
        })
        .on("mousemove", function (event) {
          var el = document.getElementById(tipId);
          if (el) Tooltip.position(el, event.clientX, event.clientY);
        })
        .on("mouseleave", function (event, d) {
          g.selectAll(".col-bar").filter(function (b) { return b.name === d.name; });
          Tooltip.hide(tipId);
        });

    // Value labels
    g.selectAll(".col-val")
      .data(parties).join("text")
        .attr("class", "col-val")
        .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
        .attr("y", function (d) {
          if (d.change >= 0) return yScale(d.change) - 5;
          var below = yScale(d.change) + 14;
          return below > innerH - 4 ? yScale(d.change) - 4 : below;
        })
        .attr("text-anchor", "middle").attr("font-size", 13).attr("font-weight", 700)
        .attr("font-family", "'Inter', sans-serif")
        .attr("fill", function (d) {
          if (d.change >= 0) return valColour(d.change);
          var below = yScale(d.change) + 14;
          return below > innerH - 4 ? textColourForBg(partyColour(d.name)) : valColour(d.change);
        })
        .style("pointer-events", "none")
        .text(function (d) { return valLabel(d.change); });

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
}
