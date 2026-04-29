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

  // Toggle row (no buttons for devolved — callers may append progress counters)
  el.selectAll("*").remove();
  el.append("div").attr("class", "party-strip-toggle-row");
  var chartContainer = el.append("div");

  // Toggle state
  function renderChart() {
    chartContainer.selectAll("*").remove();

    var parties = Object.values(partyTotals).sort(function (a, b) { return b.total - a.total; });

    // Group minor parties into Other
    var minorNames = isScotland ? MINOR_PARTIES_SCOTLAND : MINOR_PARTIES_WALES;
    parties = groupMinorParties(parties, minorNames);

    if (parties.length === 0) return;

    // Map to shared format
    var mapped = parties.map(function (p) {
      return {
        name: p.name, change: p.totalChange, total: p.total
      };
    });

    changeColumnsChart(chartContainer.node(), {
      parties: mapped,
      seatsOnly: !isScotland
    });
  }

  renderChart();
}
