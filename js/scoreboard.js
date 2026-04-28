/**
 * Election Scoreboard — shared core
 * Renders a party scoreboard table with configurable columns.
 * Each nation provides its own data aggregation + column render functions.
 * Requires: d3.js, party-config.js, utils.js
 *
 * options.title        — string (e.g. "England council results")
 * options.declaredText — HTML string for declared count
 * options.columns      — [{header, render(td, row)}] where td is a D3 selection
 * options.partyRows    — [{name, ...data}] sorted array
 * options.nocRow       — optional object with same shape as partyRows entries
 */
function electionScoreboard(container, options) {
  const { title, declaredText, columns, partyRows, nocRow } = options;

  const el = d3.select(container);
  el.selectAll("*").remove();

  const board = el.append("div").attr("class", "scoreboard");

  // Header
  const header = board.append("div").attr("class", "scoreboard__header");
  header.append("div").append("h2")
    .attr("class", "scoreboard__title")
    .text(title);
  board.append("div")
    .attr("class", "scoreboard__declared" + (options.allDeclared ? " scoreboard__declared--complete" : ""))
    .html(declaredText);

  // Table
  const table = board.append("table").attr("class", "scoreboard__table");
  const thead = table.append("thead").append("tr");
  thead.append("th"); // blank for party column
  for (const col of columns) thead.append("th").text(col.header);
  const tbody = table.append("tbody");

  function renderPartyCell(row, name) {
    const nameCell = row.append("td").attr("class", "scoreboard__party-cell");
    const inner = nameCell.append("div").attr("class", "scoreboard__party-inner");
    const hex = partyColour(name);
    const logo = inner.append("span")
      .attr("class", "party-logo")
      .style("background", hex)
      .style("color", textColourForBg(hex));
    logo.append("span").text(partyShortName(name));
    inner.append("span")
      .attr("class", "scoreboard__party-name scoreboard__party-name--full")
      .text(partyName(name));
    inner.append("span")
      .attr("class", "scoreboard__party-name scoreboard__party-name--short")
      .text(partyShortName(name));
  }

  for (const p of partyRows) {
    const row = tbody.append("tr");
    renderPartyCell(row, p.name);
    for (const col of columns) {
      col.render(row.append("td").attr("class", "scoreboard__num-cell"), p);
    }
  }

  // NOC row (optional, England only)
  if (nocRow) {
    const row = tbody.append("tr");
    renderPartyCell(row, "NOC");
    for (const col of columns) {
      col.render(row.append("td").attr("class", "scoreboard__num-cell"), nocRow);
    }
  }

  // Aggregate turnout bar (Scotland/Wales)
  if (options.turnout) {
    turnoutBar(board.node(), options.turnout);
  }
}

/**
 * England Party Scoreboard — thin wrapper
 * Aggregates council/councillor data and passes to electionScoreboard
 */
function partyScoreboard(container, results) {
  const deduped = dedupByRevision(results);

  // Aggregate seats and councils
  const partyTotals = {};
  for (const r of deduped) {
    for (const p of (r.newCouncil || [])) {
      if (!partyTotals[p.name]) {
        partyTotals[p.name] = { name: p.name, seats: 0, councils: 0, change: 0, councilChange: 0 };
      }
      partyTotals[p.name].seats += p.seats;
    }
    for (const c of (r.changes || [])) {
      if (partyTotals[c.name]) partyTotals[c.name].change += c.change;
    }
    if (r.winningParty && r.winningParty !== "NOC") {
      if (!partyTotals[r.winningParty]) {
        partyTotals[r.winningParty] = { name: r.winningParty, seats: 0, councils: 0, change: 0, councilChange: 0 };
      }
      partyTotals[r.winningParty].councils++;
    }
    if (r.gainOrHold === "gain" && r.winningParty && r.sittingParty) {
      if (partyTotals[r.winningParty]) partyTotals[r.winningParty].councilChange++;
      if (!partyTotals[r.sittingParty]) {
        partyTotals[r.sittingParty] = { name: r.sittingParty, seats: 0, councils: 0, change: 0, councilChange: 0 };
      }
      partyTotals[r.sittingParty].councilChange--;
    } else if (r.gainOrHold === "lose to NOC" && r.sittingParty) {
      if (!partyTotals[r.sittingParty]) {
        partyTotals[r.sittingParty] = { name: r.sittingParty, seats: 0, councils: 0, change: 0, councilChange: 0 };
      }
      partyTotals[r.sittingParty].councilChange--;
    }
  }

  const sorted = Object.values(partyTotals)
    .filter(p => p.name !== "NOC")
    .sort((a, b) => b.seats - a.seats);
  const nocCount = deduped.filter(r => r.winningParty === "NOC").length;

  function renderNumChange(td, value, change) {
    td.append("div").attr("class", "scoreboard__num").text(value);
    const fmt = formatChange(change);
    td.append("div").attr("class", "scoreboard__change")
      .style("color", fmt.colour).text(fmt.text);
  }

  const nocData = nocCount > 0 ? {
    name: "NOC",
    councils: nocCount,
    councilChange: (partyTotals["NOC"] && partyTotals["NOC"].councilChange) || 0,
    seats: null
  } : null;

  electionScoreboard(container, {
    title: "England council results",
    declaredText: `<strong>${deduped.length}</strong> of <strong>136</strong> councils declared`,
    allDeclared: deduped.length >= 136,
    columns: [
      {
        header: "Councils",
        render: function (td, p) {
          renderNumChange(td, p.councils || "—", p.councilChange);
        }
      },
      {
        header: "Councillors",
        render: function (td, p) {
          if (p.seats == null) {
            td.append("div").attr("class", "scoreboard__num").text("—");
            return;
          }
          renderNumChange(td, p.seats.toLocaleString(), p.change);
        }
      }
    ],
    partyRows: sorted,
    nocRow: nocData
  });
}
