/**
 * Scottish Parliament Scoreboard — thin wrapper
 * Aggregates constituency/regional seat data + vote share and passes to electionScoreboard
 * Requires: d3.js, party-config.js, utils.js, scoreboard.js
 */

// 2021 Scottish Parliament constituency vote share (%)
// Source: https://en.wikipedia.org/wiki/2021_Scottish_Parliament_election#Results
var SCOTLAND_2021_CONST_VOTE_SHARE = {
  snp: 47.7, con: 21.9, lab: 21.6, ld: 5.8, green: 1.3, alba: 0.0, reform: 0.0
};
// 2021 Scottish Parliament regional vote share (%)
var SCOTLAND_2021_REG_VOTE_SHARE = {
  snp: 40.3, con: 23.5, lab: 17.9, green: 8.1, ld: 5.1, alba: 1.7, reform: 0.2
};

// Parties that are genuinely new to each ballot type (did not stand at all in 2021)
var SCOTLAND_NEW_TO_CONSTITUENCY = ["reform"];
var SCOTLAND_NEW_TO_REGIONAL = [];

function scottishScoreboard(container, constituencyResults, regionalResults) {
  const constDeduped = dedupByRevision(constituencyResults);
  const regDeduped = dedupByRevision(regionalResults);

  // Aggregate constituency seats + changes (keyed by canonical party key)
  const partyTotals = {};
  function ensure(key) {
    if (!partyTotals[key]) {
      partyTotals[key] = { name: key, constSeats: 0, regSeats: 0, total: 0,
                            constChange: 0, regChange: 0, totalChange: 0,
                            constVotes: 0, regVotes: 0,
                            constCandidates: 0, regCandidates: 0 };
    }
  }

  for (const r of constDeduped) {
    var wpKey = r.winningParty ? resolvePartyKey(null, r.winningParty) : null;
    var spKey = r.sittingParty ? resolvePartyKey(null, r.sittingParty) : null;
    if (wpKey) {
      ensure(wpKey);
      partyTotals[wpKey].constSeats++;
    }
    if (r.gainOrHold === "gain" && wpKey && spKey) {
      ensure(wpKey);
      ensure(spKey);
      partyTotals[wpKey].constChange++;
      partyTotals[spKey].constChange--;
    }
    // Sum constituency votes per party + count candidates
    for (const c of (r.candidates || [])) {
      if (c.party && c.party.key) {
        ensure(c.party.key);
        partyTotals[c.party.key].constVotes += (c.party.votes || 0);
        partyTotals[c.party.key].constCandidates++;
      }
    }
  }

  // Aggregate regional seats + changes + votes from elected candidates
  for (const r of regDeduped) {
    const currentCounts = {};
    for (const c of (r.candidates || [])) {
      if (c.elected === "*") {
        const key = c.party.key;
        ensure(key);
        partyTotals[key].regSeats++;
        currentCounts[key] = (currentCounts[key] || 0) + 1;
      }
    }
    // Sum regional votes per party + count candidates
    for (const p of (r.parties || [])) {
      ensure(p.key);
      partyTotals[p.key].regVotes += (p.votes || 0);
      partyTotals[p.key].regCandidates++;
    }
    const prev = (r.previousElections || [])[0];
    if (prev && prev.constituencies) {
      const prevCounts = {};
      for (const pc of prev.constituencies) {
        for (const c of (pc.candidates || [])) {
          if (c.elected === "*") {
            const key = c.party.key;
            prevCounts[key] = (prevCounts[key] || 0) + 1;
          }
        }
      }
      const allKeys = new Set([...Object.keys(currentCounts), ...Object.keys(prevCounts)]);
      for (const key of allKeys) {
        ensure(key);
        partyTotals[key].regChange += (currentCounts[key] || 0) - (prevCounts[key] || 0);
      }
    }
  }

  // Calculate totals + vote shares
  var constTotalVotes = 0, regTotalVotes = 0;
  for (const p of Object.values(partyTotals)) {
    p.total = p.constSeats + p.regSeats;
    p.totalChange = p.constChange + p.regChange;
    constTotalVotes += p.constVotes;
    regTotalVotes += p.regVotes;
  }
  for (const p of Object.values(partyTotals)) {
    p.constVoteShare = constTotalVotes ? (p.constVotes / constTotalVotes * 100) : 0;
    p.regVoteShare = regTotalVotes ? (p.regVotes / regTotalVotes * 100) : 0;
    p.constVoteShareChange = p.constVoteShare - (SCOTLAND_2021_CONST_VOTE_SHARE[p.name] || 0);
    p.regVoteShareChange = p.regVoteShare - (SCOTLAND_2021_REG_VOTE_SHARE[p.name] || 0);
  }

  var sorted = Object.values(partyTotals).sort((a, b) => b.total - a.total);

  // Determine cutoff: parties with 0 seats AND <1% vote share in both ballots are hidden behind "Show more"
  var maxVisibleRows = sorted.length;
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    if (s.name !== "ind" && s.name !== "alba" && s.total === 0 && s.constVoteShare < 1 && s.regVoteShare < 1) {
      maxVisibleRows = i;
      break;
    }
  }

  // Seats view: only show major parties + any party that won at least 1 seat
  var seatsRows = sorted.filter(function (p) {
    return MAJOR_PARTIES_SCOTLAND.indexOf(p.name) !== -1 || p.total > 0;
  });

  var maxConstVoteShare = Math.max(...sorted.map(p => p.constVoteShare), 1);
  var maxRegVoteShare = Math.max(...sorted.map(p => p.regVoteShare), 1);

  function renderNumChange(td, value, change) {
    td.append("div").attr("class", "scoreboard__num").text(value != null ? value : "—");
    const fmt = formatChange(change);
    td.append("div").attr("class", "scoreboard__change")
      .style("color", fmt.colour).text(fmt.text);
  }

  function renderVoteShareCell(td, p, voteShare, maxShare, ppChange, votes, candidateCount, isNewParty) {
    // DNS: party had no candidates at all in this ballot
    if (!candidateCount) {
      td.append("div")
        .style("font-size", "12px").style("font-weight", "400")
        .style("font-style", "italic").style("color", "#999")
        .style("line-height", "20px").style("text-align", "left")
        .text("DNS");
      return;
    }
    if (!votes) { td.append("div").attr("class", "scoreboard__num").text("—"); return; }
    td.style("padding-right", "44px");
    var hex = partyColour(p.name);
    var barWrap = td.append("div").attr("class", "scoreboard__vs-bar-wrap")
      .style("position", "relative").style("height", "20px")
      .style("min-width", "0").style("overflow", "visible");
    barWrap.append("div").attr("class", "scoreboard__vs-bar-fill")
      .style("width", (voteShare / maxShare * 100) + "%")
      .style("height", "100%").style("background", hex)
      .style("border-radius", "3px");
    barWrap.append("span").attr("class", "scoreboard__vs-bar-label")
      .attr("data-party-colour", hex)
      .style("position", "absolute").style("top", "0")
      .style("line-height", "20px")
      .style("font-size", "12px").style("font-weight", "600")
      .style("font-variant-numeric", "tabular-nums")
      .style("white-space", "nowrap").style("pointer-events", "none")
      .text(formatPct(voteShare) + "%");
    // pp change — absolutely positioned, placed by rAF right after label
    if (isNewParty) {
      barWrap.append("span").attr("class", "scoreboard__vs-bar-change")
        .style("position", "absolute").style("top", "2px")
        .style("line-height", "16px")
        .style("font-size", "10px").style("font-weight", "600")
        .style("white-space", "nowrap").style("pointer-events", "none")
        .style("color", "#fff").style("background", "#181818")
        .style("padding", "0 5px").style("border-radius", "3px")
        .text("NEW");
    } else if (ppChange != null) {
      var roundedPP = Math.round(Math.abs(ppChange) * 10) / 10;
      var arrow = ppChange > 0 ? "\u25B2" : ppChange < 0 ? "\u25BC" : "";
      var ppCol = ppChange > 0 ? "#007F67" : ppChange < 0 ? "#AD0025" : "#595959";
      var ppText = roundedPP === 0 ? "—" : arrow + formatPct(Math.abs(ppChange));
      var ppCol2 = roundedPP === 0 ? "#595959" : ppCol;
      barWrap.append("span").attr("class", "scoreboard__vs-bar-change")
        .style("position", "absolute").style("top", "0")
        .style("line-height", "20px")
        .style("font-size", "12px").style("font-weight", "600")
        .style("white-space", "nowrap").style("pointer-events", "none")
        .style("color", ppCol2)
        .text(ppText);
    }
    // Total votes below
    td.append("div")
      .style("font-size", "12px").style("color", "#666")
      .style("text-align", "left")
      .text("(" + votes.toLocaleString() + ")");
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

  var turnoutData = (totalVotes || avgTurnout) ? { turnout: avgTurnout, totalVotes: totalVotes, electorate: totalElectorate } : null;
  var declaredStr = "<strong>" + constDeduped.length + "</strong> of <strong>73</strong> constituencies, <strong>" + regDeduped.length + "</strong> of <strong>8</strong> regions declared";
  var allDeclaredFlag = constDeduped.length >= 73 && regDeduped.length >= 8;

  // Seats columns
  var seatsColumns = [
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
        td.append("div").attr("class", "scoreboard__num scoreboard__num--total")
          .text(p.total);
        const fmt = formatChange(p.totalChange);
        td.append("div").attr("class", "scoreboard__change")
          .style("color", fmt.colour).text(fmt.text);
      }
    }
  ];

  // Vote share columns
  var voteShareColumns = [
    {
      header: "Constituency",
      render: function (td, p) {
        var isNew = SCOTLAND_NEW_TO_CONSTITUENCY.indexOf(p.name) !== -1;
        renderVoteShareCell(td, p, p.constVoteShare, maxConstVoteShare, p.constVoteShareChange, p.constVotes, p.constCandidates, isNew);
      }
    },
    {
      header: "Regional",
      render: function (td, p) {
        var isNew = SCOTLAND_NEW_TO_REGIONAL.indexOf(p.name) !== -1;
        renderVoteShareCell(td, p, p.regVoteShare, maxRegVoteShare, p.regVoteShareChange, p.regVotes, p.regCandidates, isNew);
      }
    }
  ];

  var currentMode = "seats";
  var removeResizeListener = null;

  function positionBarLabels() {
    d3.select(container).selectAll(".scoreboard__vs-bar-wrap").each(function () {
      var wrap = this;
      var fill = wrap.querySelector(".scoreboard__vs-bar-fill");
      var label = wrap.querySelector(".scoreboard__vs-bar-label");
      var change = wrap.querySelector(".scoreboard__vs-bar-change");
      if (!fill || !label) return;
      var fillW = fill.getBoundingClientRect().width;
      var labelW = label.getBoundingClientRect().width;
      var hex = label.getAttribute("data-party-colour");
      var labelInside = (labelW + 8 <= fillW);
      if (labelInside) {
        label.style.left = (fillW - labelW - 4) + "px";
        label.style.color = textColourForBg(hex);
      } else {
        label.style.left = (fillW + 4) + "px";
        label.style.color = "#1a1a2e";
      }
      if (change) {
        if (labelInside) {
          change.style.left = (fillW + 4) + "px";
        } else {
          change.style.left = (fillW + 4 + labelW + 4) + "px";
        }
      }
    });
  }

  function render() {
    // Clean up previous resize listener
    if (removeResizeListener) { removeResizeListener(); removeResizeListener = null; }

    var columns = currentMode === "seats" ? seatsColumns : voteShareColumns;
    var rows = currentMode === "seats" ? seatsRows : sorted;
    var visibleLimit = currentMode === "votes" && maxVisibleRows < sorted.length ? maxVisibleRows : undefined;

    electionScoreboard(container, {
      title: "Scottish Parliament",
      declaredText: declaredStr,
      allDeclared: allDeclaredFlag,
      turnout: turnoutData,
      columns: columns,
      partyRows: rows,
      maxVisibleRows: visibleLimit,
      onExpandToggle: currentMode === "votes" ? function () { requestAnimationFrame(positionBarLabels); } : undefined
    });

    // Insert toggle between declared text and table
    var scoreboard = d3.select(container).select(".scoreboard");
    var toggleRow = scoreboard.insert("div", ".scoreboard__table")
      .attr("class", "scoreboard__mode-toggle");

    var toggle = toggleRow.append("div")
      .attr("class", "party-strip-toggle");

    toggle.append("button")
      .attr("class", "party-strip-toggle__btn" + (currentMode === "seats" ? " party-strip-toggle__btn--active" : ""))
      .text("Seats")
      .on("click", function () { currentMode = "seats"; render(); });

    toggle.append("button")
      .attr("class", "party-strip-toggle__btn" + (currentMode === "votes" ? " party-strip-toggle__btn--active" : ""))
      .text("Vote share")
      .on("click", function () { currentMode = "votes"; render(); });

    // Position labels inside/outside bars (FPTP style) + reposition on resize
    if (currentMode === "votes") {
      requestAnimationFrame(positionBarLabels);
      removeResizeListener = onResize(positionBarLabels);
    }
  }

  render();
}
