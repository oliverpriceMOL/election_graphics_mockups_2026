/**
 * Scottish Parliament Scoreboard — thin wrapper
 * Aggregates constituency/regional seat data and passes to electionScoreboard
 * Requires: d3.js, party-config.js, utils.js, scoreboard.js
 */
function scottishScoreboard(container, constituencyResults, regionalResults) {
  const constDeduped = dedupByRevision(constituencyResults);
  const regDeduped = dedupByRevision(regionalResults);

  // Aggregate constituency seats + changes
  const partyTotals = {};
  function ensure(name) {
    if (!partyTotals[name]) {
      partyTotals[name] = { name: name, constSeats: 0, regSeats: 0, total: 0,
                            constChange: 0, regChange: 0, totalChange: 0 };
    }
  }

  for (const r of constDeduped) {
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

  // Aggregate regional seats + changes from elected candidates
  for (const r of regDeduped) {
    const currentCounts = {};
    for (const c of (r.candidates || [])) {
      if (c.elected === "*") {
        const abbr = c.party.abbreviation;
        ensure(abbr);
        partyTotals[abbr].regSeats++;
        currentCounts[abbr] = (currentCounts[abbr] || 0) + 1;
      }
    }
    const prev = (r.previousElections || [])[0];
    if (prev && prev.constituencies) {
      const prevCounts = {};
      for (const pc of prev.constituencies) {
        for (const c of (pc.candidates || [])) {
          if (c.elected === "*") {
            const abbr = c.party.abbreviation;
            prevCounts[abbr] = (prevCounts[abbr] || 0) + 1;
          }
        }
      }
      const allAbbrs = new Set([...Object.keys(currentCounts), ...Object.keys(prevCounts)]);
      for (const abbr of allAbbrs) {
        ensure(abbr);
        partyTotals[abbr].regChange += (currentCounts[abbr] || 0) - (prevCounts[abbr] || 0);
      }
    }
  }

  // Calculate totals
  for (const p of Object.values(partyTotals)) {
    p.total = p.constSeats + p.regSeats;
    p.totalChange = p.constChange + p.regChange;
  }

  const sorted = Object.values(partyTotals).sort((a, b) => b.total - a.total);

  function renderNumChange(td, value, change) {
    td.append("div").attr("class", "scoreboard__num").text(value || "—");
    const fmt = formatChange(change);
    td.append("div").attr("class", "scoreboard__change")
      .style("color", fmt.colour).text(fmt.text);
  }

  // Aggregate turnout from constituency results
  var totalVotes = 0, totalElectorate = 0, turnoutSum = 0, turnoutCount = 0;
  for (const r of constDeduped) {
    if (r.percentageTurnout != null) {
      turnoutSum += r.percentageTurnout;
      turnoutCount++;
    }
    totalElectorate += (r.electorate || 0);
    var rv = (r.candidates || []).reduce(function (s, c) { return s + (c.party && c.party.votes || 0); }, 0);
    totalVotes += rv;
  }
  var avgTurnout = turnoutCount ? (turnoutSum / turnoutCount) : 0;

  electionScoreboard(container, {
    title: "Scottish Parliament",
    declaredText: "<strong>" + constDeduped.length + "</strong> of 73 constituencies, <strong>" + regDeduped.length + "</strong> of 8 regions declared",
    allDeclared: constDeduped.length >= 73 && regDeduped.length >= 8,
    turnout: (totalVotes || avgTurnout) ? { turnout: avgTurnout, totalVotes: totalVotes, electorate: totalElectorate } : null,
    columns: [
      {
        header: "Constituency",
        render: function (td, p) { renderNumChange(td, p.constSeats, p.constChange); }
      },
      {
        header: "Regional",
        render: function (td, p) { renderNumChange(td, p.regSeats, p.regChange); }
      },
      {
        header: "Total",
        render: function (td, p) {
          td.append("div").attr("class", "scoreboard__num")
            .style("font-size", "22px").text(p.total);
          const fmt = formatChange(p.totalChange);
          td.append("div").attr("class", "scoreboard__change")
            .style("color", fmt.colour).text(fmt.text);
        }
      }
    ],
    partyRows: sorted
  });
}
