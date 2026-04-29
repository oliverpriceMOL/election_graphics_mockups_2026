/**
 * England Party Change Columns — thin wrapper
 * Aggregates councillor/council change data and passes to changeColumnsChart
 * Toggle between Councillors and Councils views
 * Requires: d3.js, party-config.js, utils.js, change-columns.js
 */
function partyChangeColumns(container, results) {
  var el = d3.select(container);
  var deduped = dedupByRevision(results);

  // Aggregate
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

  var currentMode = "councillors";

  // Toggle row (created once — callers may append progress counters)
  el.selectAll("*").remove();
  var toggleRow = el.append("div").attr("class", "party-strip-toggle-row");
  var toggleWrap = toggleRow.append("div").attr("class", "party-strip-toggle");
  function makeBtn(label, value) {
    toggleWrap.append("button")
      .attr("class", "party-strip-toggle__btn" + (value === currentMode ? " party-strip-toggle__btn--active" : ""))
      .text(label)
      .on("click", function () {
        if (currentMode === value) return;
        currentMode = value;
        toggleWrap.selectAll(".party-strip-toggle__btn").classed("party-strip-toggle__btn--active", false);
        d3.select(this).classed("party-strip-toggle__btn--active", true);
        render();
      });
  }
  makeBtn("Councillors", "councillors");
  makeBtn("Councils", "councils");

  var chartContainer = el.append("div");

  function render() {
    chartContainer.selectAll("*").remove();

    var isCouncils = currentMode === "councils";
    var changeKey = isCouncils ? "councilChange" : "change";
    var sortKey = isCouncils ? "councils" : "seats";
    var totalLabel = isCouncils ? "Councils" : "Councillors";
    var totalKey = isCouncils ? "councils" : "seats";

    var sorted = Object.values(partyTotals)
      .filter(function (p) { return p.name !== "NOC"; })
      .sort(function (a, b) { return b[sortKey] - a[sortKey]; });

    // NOC entry (appended after grouping so it's never collapsed into Other)
    var nocEntry = partyTotals["NOC"];

    // Group minor parties into Other
    sorted = groupMinorParties(sorted, MINOR_PARTIES_ENGLAND);

    if (nocEntry && isCouncils) {
      sorted.push(nocEntry);
    }

    var parties = sorted.map(function (p) {
      return { name: p.name, change: p[changeKey], total: p[totalKey] };
    });

    changeColumnsChart(chartContainer.node(), {
      parties: parties
    });
  }

  render();
}
