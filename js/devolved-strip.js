/**
 * Devolved Parliament Party Strip — thin wrapper
 * Aggregates constituency/regional seats and passes to partyStrip
 * Requires: d3.js, party-config.js, utils.js, party-strip.js
 */
function devolvedPartyStrip(container, constituencyResults, regionalResults, options) {
  options = options || {};
  var nation = options.nation || "scotland";
  var isScotland = nation === "scotland";

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

  if (isScotland) {
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
  }

  var vals = Object.values(partyTotals);
  for (var vi = 0; vi < vals.length; vi++) {
    vals[vi].total = vals[vi].constSeats + vals[vi].regSeats;
    vals[vi].totalChange = vals[vi].constChange + vals[vi].regChange;
  }

  var sorted = vals.sort(function (a, b) { return b.total - a.total; });

  partyStrip(container, {
    toggleLabels: [],
    getData: function () {
      return {
        parties: sorted.map(function (p) { return { name: p.name, value: p.total, change: p.totalChange }; }),
        showChange: isScotland
      };
    }
  });
}
