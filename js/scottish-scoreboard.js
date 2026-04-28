/**
 * Scottish Parliament Scoreboard — thin wrapper
 * Aggregates constituency/regional seat data + vote share and passes to electionScoreboard
 * Requires: d3.js, party-config.js, utils.js, scoreboard.js
 */

// 2021 Scottish Parliament constituency vote share (%)
// Source: https://en.wikipedia.org/wiki/2021_Scottish_Parliament_election#Results
var SCOTLAND_2021_CONST_VOTE_SHARE = {
  SNP: 47.7, C: 21.9, Lab: 21.6, LD: 5.8, Green: 1.3, Alba: 0.0, Reform: 0.0
};
// 2021 Scottish Parliament regional vote share (%)
var SCOTLAND_2021_REG_VOTE_SHARE = {
  SNP: 40.3, C: 23.5, Lab: 17.9, Green: 8.1, LD: 5.1, Alba: 1.7, Reform: 0.0
};

function scottishScoreboard(container, constituencyResults, regionalResults) {
  const constDeduped = dedupByRevision(constituencyResults);
  const regDeduped = dedupByRevision(regionalResults);

  // Aggregate constituency seats + changes
  const partyTotals = {};
  function ensure(name) {
    if (!partyTotals[name]) {
      partyTotals[name] = { name: name, constSeats: 0, regSeats: 0, total: 0,
                            constChange: 0, regChange: 0, totalChange: 0,
                            constVotes: 0, regVotes: 0 };
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
    // Sum constituency votes per party
    for (const c of (r.candidates || [])) {
      if (c.party && c.party.abbreviation) {
        ensure(c.party.abbreviation);
        partyTotals[c.party.abbreviation].constVotes += (c.party.votes || 0);
      }
    }
  }

  // Aggregate regional seats + changes + votes from elected candidates
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
    // Sum regional votes per party
    for (const p of (r.parties || [])) {
      ensure(p.abbreviation);
      partyTotals[p.abbreviation].regVotes += (p.votes || 0);
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

  // Group sub-1% zero-seat parties into Other (keep Ind and Alba always)
  var keepNames = ["Ind", "Alba"];
  var minorNames = [];
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    if (keepNames.indexOf(s.name) === -1 && s.total === 0 && s.constVoteShare < 1 && s.regVoteShare < 1) {
      minorNames.push(s.name);
    }
  }
  if (minorNames.length) {
    sorted = groupMinorParties(sorted, minorNames);
    // Recalculate vote shares for grouped Other entry
    for (var j = 0; j < sorted.length; j++) {
      if (sorted[j].name === "Other") {
        sorted[j].constVoteShare = constTotalVotes ? (sorted[j].constVotes / constTotalVotes * 100) : 0;
        sorted[j].regVoteShare = regTotalVotes ? (sorted[j].regVotes / regTotalVotes * 100) : 0;
        sorted[j].constVoteShareChange = sorted[j].constVoteShare;
        sorted[j].regVoteShareChange = sorted[j].regVoteShare;
      }
    }
  }

  var maxConstVoteShare = Math.max(...sorted.map(p => p.constVoteShare), 1);
  var maxRegVoteShare = Math.max(...sorted.map(p => p.regVoteShare), 1);

  function renderNumChange(td, value, change) {
    td.append("div").attr("class", "scoreboard__num").text(value || "—");
    const fmt = formatChange(change);
    td.append("div").attr("class", "scoreboard__change")
      .style("color", fmt.colour).text(fmt.text);
  }

  function renderVoteShareCell(td, p, voteShare, maxShare, ppChange, votes) {
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
      .style("font-size", "11px").style("font-weight", "600")
      .style("font-variant-numeric", "tabular-nums")
      .style("white-space", "nowrap").style("pointer-events", "none")
      .text(formatPct(voteShare) + "%");
    // pp change — absolutely positioned, placed by rAF right after label
    if (ppChange != null) {
      var arrow = ppChange > 0 ? "\u25B2" : ppChange < 0 ? "\u25BC" : "";
      var ppCol = ppChange > 0 ? "#2e7d32" : ppChange < 0 ? "#c62828" : "#999";
      var ppText = ppChange === 0 ? "—" : arrow + formatPct(Math.abs(ppChange));
      barWrap.append("span").attr("class", "scoreboard__vs-bar-change")
        .style("position", "absolute").style("top", "0")
        .style("line-height", "20px")
        .style("font-size", "11px").style("font-weight", "600")
        .style("white-space", "nowrap").style("pointer-events", "none")
        .style("color", ppCol)
        .text(ppText);
    }
    // Total votes below
    td.append("div")
      .style("font-size", "10px").style("color", "#666")
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
  var declaredStr = "<strong>" + constDeduped.length + "</strong> of 73 constituencies, <strong>" + regDeduped.length + "</strong> of 8 regions declared";
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
        renderVoteShareCell(td, p, p.constVoteShare, maxConstVoteShare, p.constVoteShareChange, p.constVotes);
      }
    },
    {
      header: "Regional",
      render: function (td, p) {
        renderVoteShareCell(td, p, p.regVoteShare, maxRegVoteShare, p.regVoteShareChange, p.regVotes);
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

    electionScoreboard(container, {
      title: "Scottish Parliament",
      declaredText: declaredStr,
      allDeclared: allDeclaredFlag,
      turnout: turnoutData,
      columns: columns,
      partyRows: sorted
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
