/**
 * Devolved Parliament Change Columns — thin wrapper
 * Aggregates constituency/regional seat changes and passes to changeColumnsChart
 * Scotland: total/split toggle; Wales: total only
 * Requires: d3.js, party-config.js, utils.js, change-columns.js
 */
function devolvedChangeColumns(container, constituencyResults, regionalResults, options) {
  options = options || {};
  var nation = options.nation || "scotland";
  var isScotland = nation === "scotland";

  var el = d3.select(container);

  var constDeduped = dedupByRevision(constituencyResults);
  var regDeduped = dedupByRevision(regionalResults);

  // Aggregate
  var partyTotals = {};
  function ensure(name) {
    if (!partyTotals[name]) {
      partyTotals[name] = { name: name, constSeats: 0, regSeats: 0, total: 0,
                            constChange: 0, regChange: 0, totalChange: 0 };
    }
  }

  if (isScotland) {
    for (var i = 0; i < constDeduped.length; i++) {
      var r = constDeduped[i];
      if (r.winningParty) {
        ensure(r.winningParty);
        partyTotals[r.winningParty].constSeats++;
      }
      if (r.gainOrHold === "gain" && r.winningParty && r.sittingParty) {
        ensure(r.winningParty);
        ensure(r.sittingParty);
        partyTotals[r.winningParty].constChange++;
        partyTotals[r.sittingParty].constChange--;
      }
    }
  } else {
    for (var i2 = 0; i2 < constDeduped.length; i2++) {
      var r2 = constDeduped[i2];
      for (var j = 0; j < (r2.candidates || []).length; j++) {
        var c = r2.candidates[j];
        if (c.elected === "*") {
          ensure(c.party.abbreviation);
          partyTotals[c.party.abbreviation].constSeats++;
        }
      }
    }
  }

  for (var ri = 0; ri < regDeduped.length; ri++) {
    var rr = regDeduped[ri];
    var currentCounts = {};
    for (var ci = 0; ci < (rr.candidates || []).length; ci++) {
      var cand = rr.candidates[ci];
      if (cand.elected === "*") {
        var abbr = cand.party.abbreviation;
        ensure(abbr);
        partyTotals[abbr].regSeats++;
        currentCounts[abbr] = (currentCounts[abbr] || 0) + 1;
      }
    }
    var prev = (rr.previousElections || [])[0];
    if (prev && prev.constituencies) {
      var prevCounts = {};
      for (var pi = 0; pi < prev.constituencies.length; pi++) {
        var pc = prev.constituencies[pi];
        for (var pci = 0; pci < (pc.candidates || []).length; pci++) {
          var pcand = pc.candidates[pci];
          if (pcand.elected === "*") {
            var pabbr = pcand.party.abbreviation;
            prevCounts[pabbr] = (prevCounts[pabbr] || 0) + 1;
          }
        }
      }
      var allAbbrs = new Set([].concat(Object.keys(currentCounts), Object.keys(prevCounts)));
      allAbbrs.forEach(function (a) {
        ensure(a);
        partyTotals[a].regChange += (currentCounts[a] || 0) - (prevCounts[a] || 0);
      });
    }
  }

  var vals = Object.values(partyTotals);
  for (var vi = 0; vi < vals.length; vi++) {
    vals[vi].total = vals[vi].constSeats + vals[vi].regSeats;
    vals[vi].totalChange = vals[vi].constChange + vals[vi].regChange;
  }

  // Toggle state
  var currentView = "total";

  function fmtChangeHtml(v) {
    if (v > 0) return '<span style="color:#4caf50">▲' + v + '</span>';
    if (v < 0) return '<span style="color:#ef5350">▼' + Math.abs(v) + '</span>';
    return '<span style="color:#aaa">—</span>';
  }

  function buildTooltip(d) {
    return "<strong>" + partyName(d.name) + "</strong><br>" +
      "Constituency: " + fmtChangeHtml(d.constChange) + "<br>" +
      "Regional: " + fmtChangeHtml(d.regChange) + "<br>" +
      "Total: " + fmtChangeHtml(d.totalChange);
  }

  function renderChart() {
    el.selectAll("*").remove();

    // Toggle row (recreated each render since el is cleared)
    if (isScotland) {
      var toggleRow = el.append("div")
        .attr("class", "party-strip-toggle")
        .style("margin-bottom", "8px");
      function makeBtn(label, value) {
        toggleRow.append("button")
          .attr("class", "party-strip-toggle__btn" + (value === currentView ? " party-strip-toggle__btn--active" : ""))
          .text(label)
          .on("click", function () {
            if (currentView === value) return;
            currentView = value;
            renderChart();
          });
      }
      makeBtn("Total", "total");
      var splitBtn = toggleRow.append("button")
        .attr("class", "party-strip-toggle__btn" + ("split" === currentView ? " party-strip-toggle__btn--active" : ""))
        .on("click", function () {
          if (currentView === "split") return;
          currentView = "split";
          renderChart();
        });
      splitBtn.append("span").attr("class", "toggle-swatch toggle-swatch--solid");
      splitBtn.append("span").text("Constituency").style("margin-right", "6px");
      splitBtn.append("span").attr("class", "toggle-swatch toggle-swatch--striped");
      splitBtn.append("span").text("Region");
    }

    var chartContainer = el.append("div");

    var parties = Object.values(partyTotals).sort(function (a, b) { return b.total - a.total; });

    // Cull
    var maxP = maxPartySlots(el.node());
    if (parties.length > maxP) {
      var visible = parties.slice(0, maxP - 1);
      var rest = parties.slice(maxP - 1);
      var other = { name: "Other", constSeats: 0, regSeats: 0, total: 0,
                    constChange: 0, regChange: 0, totalChange: 0 };
      for (var z = 0; z < rest.length; z++) {
        other.constSeats += rest[z].constSeats;
        other.regSeats += rest[z].regSeats;
        other.total += rest[z].total;
        other.constChange += rest[z].constChange;
        other.regChange += rest[z].regChange;
        other.totalChange += rest[z].totalChange;
      }
      parties = visible.concat(other);
    }

    if (parties.length === 0) return;

    var isSplit = currentView === "split";

    // Map to shared format
    var mapped = parties.map(function (p) {
      return {
        name: p.name, change: p.totalChange,
        constChange: p.constChange, regChange: p.regChange, totalChange: p.totalChange
      };
    });

    changeColumnsChart(chartContainer.node(), {
      parties: mapped,
      tooltipHtml: buildTooltip,
      split: isSplit ? {
        getConst: function (d) { return d.constChange; },
        getReg: function (d) { return d.regChange; }
      } : null
    });
  }

  renderChart();
  onResize(renderChart);
}
