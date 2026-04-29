/**
 * Party Strip — shared core
 * Horizontal party totals with optional toggle and fixed minor-party grouping.
 * Requires: d3.js, party-config.js, utils.js
 *
 * options.toggleLabels   — string[] toggle button labels (empty = no buttons)
 * options.getData        — function(modeIndex) → {
 *     parties: [{name, value, change}],  sorted
 *     showChange: boolean,
 *     groupIntoOther: string[]  — party names folded into Other
 *   }
 */
function partyStrip(container, options) {
  const { toggleLabels = [], getData } = options;

  const el = d3.select(container);
  el.selectAll("*").remove();

  // Toggle row (always created — callers may append progress counters)
  const toggleRow = el.append("div").attr("class", "party-strip-toggle-row");

  let currentMode = 0;

  if (toggleLabels.length > 1) {
    const toggleWrap = toggleRow.append("div").attr("class", "party-strip-toggle");
    toggleLabels.forEach(function (label, i) {
      toggleWrap.append("button")
        .attr("class", "party-strip-toggle__btn" + (i === 0 ? " party-strip-toggle__btn--active" : ""))
        .text(label)
        .on("click", function () {
          toggleWrap.selectAll(".party-strip-toggle__btn").classed("party-strip-toggle__btn--active", false);
          d3.select(this).classed("party-strip-toggle__btn--active", true);
          currentMode = i;
          render();
        });
    });
  }

  const stripContainer = el.append("div");

  function render() {
    stripContainer.selectAll("*").remove();
    const data = getData(currentMode);
    var parties = data.parties.slice();

    var table = stripContainer.append("div").attr("class", "party-strip");

    // Group minor parties into Other
    parties = groupMinorParties(parties, data.groupIntoOther || []);

    // Force NOC to the very end (after Other)
    var nocIdx = -1;
    for (var ni = 0; ni < parties.length; ni++) {
      if (parties[ni].name === "NOC") { nocIdx = ni; break; }
    }
    if (nocIdx >= 0) {
      var nocItem = parties.splice(nocIdx, 1)[0];
      parties.push(nocItem);
    }

    // Row 1: party names
    var nameRow = table.append("div").attr("class", "party-strip__row party-strip__row--name");
    for (var i = 0; i < parties.length; i++) {
      var hex = partyColour(parties[i].name);
      nameRow.append("div")
        .attr("class", "party-strip__cell")
        .style("background", hex)
        .style("color", textColourForBg(hex))
        .text(partyShortName(parties[i].name));
    }

    // Row 2: counts
    var countRow = table.append("div").attr("class", "party-strip__row party-strip__row--seats");
    for (var j = 0; j < parties.length; j++) {
      countRow.append("div")
        .attr("class", "party-strip__cell")
        .style("background", d3.color(partyColour(parties[j].name)).copy({opacity: 0.15}))
        .text(parties[j].value.toLocaleString());
    }

    // Row 3: change (optional)
    if (data.showChange) {
      var changeRow = table.append("div").attr("class", "party-strip__row party-strip__row--change");
      for (var m = 0; m < parties.length; m++) {
        var fmt = formatChange(parties[m].change);
        changeRow.append("div")
          .attr("class", "party-strip__cell")
          .style("background", d3.color(partyColour(parties[m].name)).copy({opacity: 0.08}))
          .style("color", fmt.colour)
          .text(fmt.text);
      }
    }
  }

  render();
}

/**
 * England Party Totals Strip — thin wrapper
 * Aggregates councillor/council data and passes to partyStrip
 */
function partyTotalsStrip(container, results) {
  var deduped = dedupByRevision(results);

  var partyTotals = {};
  for (var i = 0; i < deduped.length; i++) {
    var r = deduped[i];
    for (var j = 0; j < (r.newCouncil || []).length; j++) {
      var p = r.newCouncil[j];
      if (!partyTotals[p.name]) partyTotals[p.name] = { name: p.name, seats: 0, change: 0, councils: 0, councilChange: 0 };
      partyTotals[p.name].seats += p.seats;
    }
    for (var k = 0; k < (r.changes || []).length; k++) {
      var c = r.changes[k];
      if (partyTotals[c.name]) partyTotals[c.name].change += c.change;
    }
    if (r.winningParty) {
      if (!partyTotals[r.winningParty]) partyTotals[r.winningParty] = { name: r.winningParty, seats: 0, change: 0, councils: 0, councilChange: 0 };
      partyTotals[r.winningParty].councils++;
    }
    if (r.gainOrHold === "gain" && r.winningParty && r.sittingParty) {
      if (partyTotals[r.winningParty]) partyTotals[r.winningParty].councilChange++;
      if (!partyTotals[r.sittingParty]) partyTotals[r.sittingParty] = { name: r.sittingParty, seats: 0, change: 0, councils: 0, councilChange: 0 };
      partyTotals[r.sittingParty].councilChange--;
    } else if (r.gainOrHold === "lose to NOC" && r.sittingParty) {
      if (!partyTotals[r.sittingParty]) partyTotals[r.sittingParty] = { name: r.sittingParty, seats: 0, change: 0, councils: 0, councilChange: 0 };
      partyTotals[r.sittingParty].councilChange--;
    }
  }

  var sorted = Object.values(partyTotals).sort(function (a, b) { return b.seats - a.seats; });

  partyStrip(container, {
    toggleLabels: ["Councillors", "Councils"],
    getData: function (modeIndex) {
      var isCouncils = modeIndex === 1;
      var parties;
      if (isCouncils) {
        var nocEntry = sorted.find(function (p) { return p.name === "NOC"; });
        parties = sorted.slice().filter(function (p) { return p.name !== "NOC"; })
          .sort(function (a, b) { return b.councils - a.councils; })
          .map(function (p) { return { name: p.name, value: p.councils, change: p.councilChange }; });
        if (nocEntry) {
          parties.push({ name: nocEntry.name, value: nocEntry.councils, change: nocEntry.councilChange });
        }
      } else {
        parties = sorted.filter(function (p) { return p.name !== "NOC"; })
          .map(function (p) { return { name: p.name, value: p.seats, change: p.change }; });
      }
      return {
        parties: parties,
        showChange: true,
        groupIntoOther: MINOR_PARTIES_ENGLAND
      };
    }
  });
}
