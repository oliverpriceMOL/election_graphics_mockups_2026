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

  var sorted = Object.values(partyTotals).sort((a, b) => b.seats - a.seats);

  // Group sub-1% zero-seat parties into Other (keep Ind and Alba always)
  var keepNames = ["Ind", "Alba"];
  var minorNames = [];
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    if (keepNames.indexOf(s.name) === -1 && s.seats === 0 && s.voteShare < 1) {
      minorNames.push(s.name);
    }
  }
  if (minorNames.length) {
    sorted = groupMinorParties(sorted, minorNames);
    // Recalculate vote share for grouped Other entry
    for (var j = 0; j < sorted.length; j++) {
      if (sorted[j].name === "Other") {
        sorted[j].voteShare = totalVotes ? (sorted[j].votes / totalVotes * 100) : 0;
      }
    }
  }

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
          var barWrap = td.append("div").attr("class", "scoreboard__vs-bar-wrap")
            .style("position", "relative").style("height", "20px")
            .style("min-width", "0");
          barWrap.append("div").attr("class", "scoreboard__vs-bar-fill")
            .style("width", (p.voteShare / maxVoteShare * 100) + "%")
            .style("height", "100%").style("background", hex)
            .style("border-radius", "3px");
          barWrap.append("span").attr("class", "scoreboard__vs-bar-label")
            .attr("data-party-colour", hex)
            .style("position", "absolute").style("top", "50%")
            .style("transform", "translateY(-50%)")
            .style("font-size", "11px").style("font-weight", "600")
            .style("font-variant-numeric", "tabular-nums")
            .style("white-space", "nowrap").style("pointer-events", "none")
            .text(formatPct(p.voteShare) + "%");
          // Total votes below bar
          td.append("div")
            .style("font-size", "10px").style("color", "#666")
            .style("text-align", "left")
            .text("(" + p.votes.toLocaleString() + ")");
        }
      }
    ],
    partyRows: sorted.filter(p => p.seats > 0 || p.votes > 0)
  });

  // Position labels inside/outside bars (FPTP style) + reposition on resize
  function positionBarLabels() {
    d3.select(container).selectAll(".scoreboard__vs-bar-wrap").each(function () {
      var wrap = this;
      var fill = wrap.querySelector(".scoreboard__vs-bar-fill");
      var label = wrap.querySelector(".scoreboard__vs-bar-label");
      if (!fill || !label) return;
      var fillW = fill.getBoundingClientRect().width;
      var labelW = label.getBoundingClientRect().width;
      var hex = label.getAttribute("data-party-colour");
      if (labelW + 8 <= fillW) {
        label.style.left = (fillW - labelW - 4) + "px";
        label.style.color = textColourForBg(hex);
      } else {
        label.style.left = (fillW + 4) + "px";
        label.style.color = "#1a1a2e";
      }
    });
  }
  requestAnimationFrame(positionBarLabels);
  onResize(positionBarLabels);
}
