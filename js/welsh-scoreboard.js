/**
 * Welsh Parliament (Senedd) Scoreboard — thin wrapper
 * Aggregates seats + vote share and passes to electionScoreboard
 * Requires: d3.js, party-config.js, utils.js, scoreboard.js
 */
function welshScoreboard(container, results) {
  const deduped = dedupByRevision(results);

  // Aggregate seats from elected candidates + vote totals
  const partyTotals = {};
  function ensure(name) {
    if (!partyTotals[name]) {
      partyTotals[name] = { name: name, seats: 0, votes: 0 };
    }
  }

  for (const r of deduped) {
    for (const c of (r.candidates || [])) {
      if (c.elected === "*") {
        ensure(c.party.abbreviation);
        partyTotals[c.party.abbreviation].seats++;
      }
    }
    for (const p of (r.parties || [])) {
      ensure(p.abbreviation);
      partyTotals[p.abbreviation].votes += (p.votes || 0);
    }
  }

  // Calculate vote share
  const totalVotes = Object.values(partyTotals).reduce((s, p) => s + p.votes, 0);
  for (const p of Object.values(partyTotals)) {
    p.voteShare = totalVotes ? (p.votes / totalVotes * 100) : 0;
  }

  const sorted = Object.values(partyTotals).sort((a, b) => b.seats - a.seats);
  const maxVoteShare = Math.max(...sorted.map(p => p.voteShare), 1);

  // Aggregate turnout
  var totalElectorate = 0, turnoutSum = 0, turnoutCount = 0;
  for (const r of deduped) {
    if (r.percentageTurnout != null) {
      turnoutSum += r.percentageTurnout;
      turnoutCount++;
    }
    totalElectorate += (r.electorate || 0);
  }
  var avgTurnout = turnoutCount ? (turnoutSum / turnoutCount) : 0;

  electionScoreboard(container, {
    title: "Welsh Parliament (Senedd)",
    declaredText: "<strong>" + deduped.length + "</strong> of <strong>16</strong> constituencies declared",
    allDeclared: deduped.length >= 16,
    turnout: (totalVotes || avgTurnout) ? { turnout: avgTurnout, totalVotes: totalVotes, electorate: totalElectorate } : null,
    columns: [
      {
        header: "Seats",
        render: function (td, p) {
          td.append("div").attr("class", "scoreboard__num").text(p.seats || "—");
        }
      },
      {
        header: "Vote share",
        render: function (td, p) {
          if (p.seats === 0 && p.votes === 0) {
            td.append("div").attr("class", "scoreboard__num").text("—");
            return;
          }
          const hex = partyColour(p.name);
          const vsWrap = td.append("div")
            .style("display", "flex").style("align-items", "center")
            .style("gap", "8px").style("justify-content", "flex-end");
          vsWrap.append("div")
            .style("width", "80px").style("height", "14px")
            .style("background", "#f0f0f4").style("border-radius", "3px")
            .style("overflow", "hidden").style("flex-shrink", "0")
            .append("div")
              .style("width", (p.voteShare / maxVoteShare * 100) + "%")
              .style("height", "100%").style("background", hex)
              .style("border-radius", "3px");
          vsWrap.append("span")
            .style("font-size", "13px").style("font-weight", "600")
            .style("font-variant-numeric", "tabular-nums")
            .style("min-width", "42px").style("text-align", "right")
            .text(formatPct(p.voteShare) + "%");
        }
      }
    ],
    partyRows: sorted.filter(p => p.seats > 0 || p.votes > 0)
  });
}
