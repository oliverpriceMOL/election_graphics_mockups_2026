/**
 * FPTP Result Card Component
 * Unified card for mayoral results (England) and constituency results (Scotland FPTP)
 * Requires: d3.js, party-config.js, badge.js, utils.js
 */
function fptpResultCard(container, result, options) {
  if (!options) options = {};
  var showDeclarationTime = options.showDeclarationTime || false;

  var el = d3.select(container);
  el.selectAll("*").remove();

  var card = el.append("div").attr("class", "fptp-card");

  // Header
  var header = card.append("div").attr("class", "fptp-card__header council-card__header");
  header.append("h3").attr("class", "council-card__name").text(result.name);

  // Winner highlight
  var winner = result.candidates.find(function (c) { return c.elected === "*"; });
  if (winner) {
    var winWrap = card.append("div").attr("class", "fptp-card__winner");
    var hex = partyColour(winner.party.abbreviation);
    var avatar = winWrap.append("div").attr("class", "fptp-card__avatar")
      .style("background", hex)
      .style("color", textColourForBg(hex));
    avatar.append("span").text(winner.firstName[0] + winner.surname[0]);

    var info = winWrap.append("div");
    info.append("div").attr("class", "fptp-card__winner-name")
      .text(winner.firstName + " " + winner.surname);
    var winBadge = info.append("div").attr("class", "fptp-card__winner-party");
    gainHoldBadge(winBadge.node(), {
      winningParty: result.winningParty,
      gainOrHold: result.gainOrHold === "hold" ? "no change" : result.gainOrHold,
      sittingParty: result.sittingParty,
    });
    if (result.majority != null) {
      winBadge.append("span").attr("class", "majority-badge")
        .text("Majority: " + (result.majority || 0).toLocaleString());
    }
  }

  // Candidate bars
  var maxVotes = Math.max.apply(null, result.candidates.map(function (c) { return c.party.votes || 0; }));
  var barsWrap = card.append("div").attr("class", "fptp-card__bars");

  var sortedCandidates = result.candidates.slice().sort(function (a, b) {
    return (b.party.votes || 0) - (a.party.votes || 0);
  });

  for (var i = 0; i < sortedCandidates.length; i++) {
    var c = sortedCandidates[i];
    var row = barsWrap.append("div").attr("class", "fptp-card__bar-row fptp-card__bar-row--two-col");

    row.append("div")
      .attr("class", "fptp-card__bar-name")
      .text(c.firstName + " " + c.surname);

    var hex = partyColour(c.party.abbreviation);
    var barWrap = row.append("div").attr("class", "fptp-card__bar-wrap");
    barWrap.append("div")
      .attr("class", "fptp-card__bar-fill")
      .style("width", ((c.party.votes / maxVotes) * 90) + "%")
      .style("background", hex);
    var labelText = (c.party.votes || 0).toLocaleString() + " (" + formatPct(c.party.percentageShare) + "%)";
    barWrap.append("span")
      .attr("class", "fptp-card__bar-label")
      .attr("data-party-colour", hex)
      .text(labelText);

    var pctChg = formatPercentageChange(c.party.percentageShareChange);
    var chgText = pctChg ? pctChg.text : "";
    var chgColour = pctChg ? pctChg.colour : "#888";
    barWrap.append("span")
      .attr("class", "fptp-card__bar-change-inline")
      .style("color", chgColour)
      .text(chgText);
  }

  // Size name column to fit longest name, then position labels
  requestAnimationFrame(function () {
    // Measure natural width of each name, find the max (capped)
    var maxNameW = 0;
    var containerW = barsWrap.node().getBoundingClientRect().width;
    var cap = Math.min(containerW * 0.45, 160); // never more than 45% of card or 160px
    barsWrap.selectAll(".fptp-card__bar-name").each(function () {
      var el = this;
      // Temporarily remove grid constraint to measure natural width
      var origW = el.style.width;
      el.style.width = "max-content";
      var w = el.getBoundingClientRect().width;
      el.style.width = origW;
      if (w > maxNameW) maxNameW = w;
    });
    var nameCol = Math.ceil(Math.min(maxNameW, cap)) + 1;
    barsWrap.selectAll(".fptp-card__bar-row").each(function () {
      this.style.setProperty("--name-col", nameCol + "px");
    });

    barsWrap.selectAll(".fptp-card__bar-wrap").each(function () {
      var wrap = this;
      var fill = wrap.querySelector(".fptp-card__bar-fill");
      var label = wrap.querySelector(".fptp-card__bar-label");
      var change = wrap.querySelector(".fptp-card__bar-change-inline");
      if (!fill || !label) return;
      var fillW = fill.getBoundingClientRect().width;
      var labelW = label.getBoundingClientRect().width;
      var hex = label.getAttribute("data-party-colour");
      if (labelW + 10 <= fillW) {
        // Fits inside: right-align within bar, use contrast colour
        label.style.left = (fillW - labelW - 5) + "px";
        label.style.color = textColourForBg(hex);
        // Change just outside bar
        if (change) {
          change.style.left = (fillW + 4) + "px";
        }
      } else {
        // Outside: position just past the bar end, use dark text
        label.style.left = (fillW + 4) + "px";
        label.style.color = "#1a1a2e";
        // Change just after label
        if (change) {
          change.style.left = (fillW + 4 + labelW + 4) + "px";
        }
      }
    });
  });

  // Turnout bar
  var totalVotesFptp = result.candidates.reduce(function (s, c) { return s + (c.party.votes || 0); }, 0);
  if (result.percentageTurnout != null || totalVotesFptp) {
    turnoutBar(card.node(), {
      turnout: result.percentageTurnout || 0,
      totalVotes: totalVotesFptp,
      electorate: result.electorate || 0
    });
  }

  // Declaration time (mayoral results only)
  if (showDeclarationTime && result.declarationTime) {
    var t = new Date(result.declarationTime);
    var dateStr = t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    var timeStr = t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    card.append("div")
      .attr("class", "council-card__declared")
      .text("Declared " + timeStr + ", " + dateStr);
  }
}

// Backwards-compatible aliases
function mayoralResultCard(container, result) {
  fptpResultCard(container, result, { showDeclarationTime: true });
}

function constituencyResultCard(container, result) {
  fptpResultCard(container, result);
}
