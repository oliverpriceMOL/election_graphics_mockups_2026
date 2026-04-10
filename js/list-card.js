/**
 * List Result Card Component
 * For proportional/regional results (Scottish regions, Welsh Senedd constituencies)
 * Shows party vote shares as horizontal bars + elected member pills
 * Requires: d3.js, party-config.js, utils.js
 */
function listResultCard(container, result, options) {
  if (!options) options = {};
  var el = d3.select(container);
  el.selectAll("*").remove();

  var typeLabel = options.typeLabel || "";
  var card = el.append("div").attr("class", "list-card");

  // Header
  var header = card.append("div").attr("class", "list-card__header council-card__header");
  header.append("h3").attr("class", "council-card__name").text(result.name);
  if (typeLabel) {
    header.append("span").attr("class", "council-card__type").text(typeLabel);
  }

  // Party bars
  var parties = (result.parties || []).slice().sort(function (a, b) {
    return b.percentageShare - a.percentageShare;
  }).filter(function (p) { return p.percentageShare >= 0.5; });

  var totalVotes = (result.parties || []).reduce(function (s, p) { return s + (p.votes || 0); }, 0);

  if (parties.length) {
    var maxShare = parties[0].percentageShare;
    var barsWrap = card.append("div").attr("class", "fptp-card__bars");

    for (var i = 0; i < parties.length; i++) {
      var p = parties[i];
      var hex = partyColour(p.abbreviation);
      var row = barsWrap.append("div").attr("class", "fptp-card__bar-row fptp-card__bar-row--two-col");

      row.append("div")
        .attr("class", "fptp-card__bar-name")
        .text(partyShortName(p.abbreviation));

      var barWrap = row.append("div").attr("class", "fptp-card__bar-wrap");
      barWrap.append("div")
        .attr("class", "fptp-card__bar-fill")
        .style("width", ((p.percentageShare / maxShare) * 90) + "%")
        .style("background", hex);
      var labelText = (p.votes || 0).toLocaleString() + " (" + formatPct(p.percentageShare) + "%)";
      barWrap.append("span")
        .attr("class", "fptp-card__bar-label")
        .attr("data-party-colour", hex)
        .text(labelText);

      var pctChg = formatPercentageChange(p.percentageShareChange);
      var chgText = pctChg ? pctChg.text : "";
      var chgColour = pctChg ? pctChg.colour : "#888";
      barWrap.append("span")
        .attr("class", "fptp-card__bar-change-inline")
        .style("color", chgColour)
        .text(chgText);
    }

    // Smart label + change placement
    requestAnimationFrame(function () {
      var containerW = barsWrap.node().getBoundingClientRect().width;
      var nameCol = Math.min(60, Math.ceil(containerW * 0.15));
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
        var changeW = change ? change.getBoundingClientRect().width : 0;
        var hex = label.getAttribute("data-party-colour");

        if (labelW + 10 <= fillW) {
          // Label inside bar
          label.style.left = (fillW - labelW - 5) + "px";
          label.style.color = textColourForBg(hex);
          // Change just outside bar
          if (change) {
            change.style.left = (fillW + 4) + "px";
          }
        } else {
          // Label outside bar
          label.style.left = (fillW + 4) + "px";
          label.style.color = "#1a1a2e";
          // Change just after label
          if (change) {
            change.style.left = (fillW + 4 + labelW + 4) + "px";
          }
        }
      });
    });
  }

  // Elected members
  var elected = (result.candidates || []).filter(function (c) { return c.elected === "*"; });
  var constResults = options.constituencies || [];

  if (elected.length || constResults.length) {
    var membersWrap = card.append("div").attr("class", "list-card__members");

    // Total count: additional + constituency MSPs
    var constWinners = [];
    for (var ci = 0; ci < constResults.length; ci++) {
      var cr = constResults[ci];
      if (cr.candidates) {
        for (var cj = 0; cj < cr.candidates.length; cj++) {
          if (cr.candidates[cj].elected === "*") { constWinners.push(cr.candidates[cj]); break; }
        }
      }
    }
    var totalElected = elected.length + constWinners.length;

    membersWrap.append("div").attr("class", "list-card__members-label")
      .text((constResults.length ? "MSPs" : "Members") + " elected (" + totalElected + ")");

    if (constResults.length) {
      // Toggle: Additional Members / Constituency MSPs
      var toggleRow = d3.select(membersWrap.node()).append("div")
        .attr("class", "party-strip-toggle")
        .style("width", "100%")
        .style("margin-bottom", "10px");

      var addBtn = toggleRow.append("button")
        .attr("class", "party-strip-toggle__btn party-strip-toggle__btn--active")
        .style("flex", "1")
        .text("Additional Members");

      var constBtn = toggleRow.append("button")
        .attr("class", "party-strip-toggle__btn")
        .style("flex", "1")
        .text("Constituency MSPs");

      var electedContent = d3.select(membersWrap.node()).append("div");

      function showAdd() {
        addBtn.classed("party-strip-toggle__btn--active", true);
        constBtn.classed("party-strip-toggle__btn--active", false);
        electedContent.html("");
        renderElectedPills(electedContent.node(), elected, { winningParty: result.winningParty });
      }
      function showConst() {
        constBtn.classed("party-strip-toggle__btn--active", true);
        addBtn.classed("party-strip-toggle__btn--active", false);
        electedContent.html("");
        renderElectedPills(electedContent.node(), constWinners, { winningParty: result.winningParty, showRank: false });
      }
      addBtn.on("click", showAdd);
      constBtn.on("click", showConst);
      showAdd();
    } else {
      renderElectedPills(membersWrap.node(), elected, { winningParty: result.winningParty });
    }
  }

  // Turnout bar
  if (result.percentageTurnout != null || totalVotes) {
    turnoutBar(card.node(), {
      turnout: result.percentageTurnout || 0,
      totalVotes: totalVotes,
      electorate: result.electorate || 0
    });
  }
}

/**
 * Shared elected pills renderer — bar-chart grouped by party
 * Renders one row per party, uniform cell width across all rows.
 *   container: DOM element to append into
 *   candidates: array of elected candidate objects [{firstName, surname, party: {abbreviation}, partyListRank}]
 *   options.winningParty: party abbreviation to sort first
 */
function renderElectedPills(container, candidates, options) {
  if (!options) options = {};
  var el = d3.select(container);
  if (!candidates || !candidates.length) {
    el.append("div")
      .style("color", "#888").style("font-size", "13px").style("padding", "8px 0")
      .text("No members elected yet");
    return;
  }

  // Group by party
  var groups = {};
  var partyOrder = [];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var abbr = c.party ? c.party.abbreviation : "Other";
    if (!groups[abbr]) { groups[abbr] = []; partyOrder.push(abbr); }
    groups[abbr].push(c);
  }
  // Sort: winning party first, then by count desc
  var wp = options.winningParty;
  partyOrder.sort(function (a, b) {
    if (wp && a === wp) return -1;
    if (wp && b === wp) return 1;
    return groups[b].length - groups[a].length;
  });

  var showRank = options.showRank !== false;
  var wrap = el.append("div").attr("class", "elected-pills");
  var counter = 0;
  for (var gi = 0; gi < partyOrder.length; gi++) {
    var abbr = partyOrder[gi];
    var members = groups[abbr];
    var hex = partyColour(abbr);
    var fg = textColourForBg(hex);
    members.sort(function (a, b) { return (a.partyListRank || 0) - (b.partyListRank || 0); });

    var row = wrap.append("div").attr("class", "elected-pills__row");
    for (var mi = 0; mi < members.length; mi++) {
      counter++;
      var m = members[mi];
      var pill = row.append("div")
        .attr("class", "elected-pills__cell")
        .style("background", hex)
        .style("color", fg);
      if (showRank) {
        pill.append("span").attr("class", "elected-pills__rank").text(counter);
      }
      pill.append("span").attr("class", "elected-pills__text")
        .text(m.firstName + " " + m.surname);
    }
  }
  _fitElectedPills(wrap);
}

/** Uniform cell width + dynamic font across all rows */
function _fitElectedPills(wrap) {
  requestAnimationFrame(function () {
    var rows = wrap.selectAll(".elected-pills__row");
    if (rows.empty()) return;
    var maxCount = 0;
    rows.each(function () {
      var n = this.querySelectorAll(".elected-pills__cell").length;
      if (n > maxCount) maxCount = n;
    });
    if (maxCount === 0) return;
    var containerW = wrap.node().getBoundingClientRect().width;
    var gap = 3;
    var cellW = (containerW - gap * (maxCount - 1)) / maxCount;

    var minSize = 12;
    wrap.selectAll(".elected-pills__cell").each(function () {
      this.style.width = cellW + "px";
      this.style.height = "auto";
      this.style.fontSize = "12px";
    });
    wrap.selectAll(".elected-pills__cell").each(function () {
      var size = 12;
      while (this.scrollHeight > this.clientHeight + 1 && size > 7) {
        size -= 0.5;
        this.style.fontSize = size + "px";
      }
      if (size < minSize) minSize = size;
    });
    var pillH = 0;
    // Minimum height = 2 lines of text + padding (ensures consistent height even if all single-line)
    var twoLineH = Math.ceil(minSize * 1.15 * 2) + 4; // 2 lines * lineHeight + top/bottom padding
    wrap.selectAll(".elected-pills__cell").each(function () {
      this.style.fontSize = minSize + "px";
      var h = this.getBoundingClientRect().height;
      if (h > pillH) pillH = h;
    });
    if (pillH < twoLineH) pillH = twoLineH;
    wrap.selectAll(".elected-pills__cell").each(function () {
      this.style.height = pillH + "px";
    });
  });
}
