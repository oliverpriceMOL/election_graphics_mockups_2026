/**
 * Scotland Election Map — D3 SVG Choropleth
 * Constituencies coloured by FPTP winner, region borders overlaid.
 * Click shows both constituency and parent region results.
 * Requires: d3.js, party-config.js, election-map.js, fptp-card.js, list-card.js
 */
function scotlandMap(container, constResults, regResults, constGeo, regGeo, options) {
  options = options || {};
  var width = options.width || 500;
  var height = options.height || 700;

  var m = createMapScaffold(container, width, height, constGeo, "Search constituency or region...");

  // Deduplicate results by highest revision
  function dedup(arr) {
    var byName = {};
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      if (!byName[r.name] || (r.revision || 0) > (byName[r.name].revision || 0)) {
        byName[r.name] = r;
      }
    }
    return byName;
  }

  var constByName = dedup(constResults);
  var regByName = dedup(regResults);

  // Map constituency GeoJSON name → result
  var constMap = {};
  for (var i = 0; i < constGeo.features.length; i++) {
    var feat = constGeo.features[i];
    var nm = feat.properties.SPC_NM;
    if (constByName[nm]) constMap[nm] = constByName[nm];
  }

  // Map region GeoJSON name → result
  var regMap = {};
  for (var i = 0; i < regGeo.features.length; i++) {
    var feat = regGeo.features[i];
    var nm = feat.properties.SPR_NM;
    if (regByName[nm]) regMap[nm] = regByName[nm];
  }

  // Build constituency → region lookup
  function normRegion(s) {
    return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).sort().join(" ");
  }
  var regNormLookup = {};
  for (var i = 0; i < regGeo.features.length; i++) {
    regNormLookup[normRegion(regGeo.features[i].properties.SPR_NM)] = regGeo.features[i].properties.SPR_NM;
  }
  var constToRegion = {};
  for (var i = 0; i < constGeo.features.length; i++) {
    var f = constGeo.features[i];
    if (f.properties.SPR_NM) {
      var canonical = regNormLookup[normRegion(f.properties.SPR_NM)] || f.properties.SPR_NM;
      constToRegion[f.properties.SPC_NM] = canonical;
    }
  }

  // Build region → constituencies reverse lookup
  var regionToConsts = {};
  for (var cName in constToRegion) {
    var rName = constToRegion[cName];
    if (!regionToConsts[rName]) regionToConsts[rName] = [];
    regionToConsts[rName].push(cName);
  }

  /**
   * Compute combined MSP tally for a region (constituency + additional).
   * Returns sorted array: [{abbr, constSeats, listSeats, total, regionVoteShare}]
   */
  function regionTotalTally(regionName) {
    var counts = {}; // abbr → {constSeats, listSeats, regionVoteShare}
    // Constituency winners in this region
    var consts = regionToConsts[regionName] || [];
    for (var i = 0; i < consts.length; i++) {
      var cr = constMap[consts[i]];
      if (cr && cr.winningParty) {
        if (!counts[cr.winningParty]) counts[cr.winningParty] = { constSeats: 0, listSeats: 0, regionVoteShare: 0 };
        counts[cr.winningParty].constSeats++;
      }
    }
    // Additional members from regional result
    var rr = regMap[regionName];
    if (rr && rr.candidates) {
      for (var j = 0; j < rr.candidates.length; j++) {
        var c = rr.candidates[j];
        if (c.elected === "true" || c.elected === true || c.elected === "*") {
          var abbr = c.party ? c.party.abbreviation : "Other";
          if (!counts[abbr]) counts[abbr] = { constSeats: 0, listSeats: 0, regionVoteShare: 0 };
          counts[abbr].listSeats++;
        }
      }
    }
    // Regional vote share for tiebreaker
    if (rr && rr.parties) {
      for (var k = 0; k < rr.parties.length; k++) {
        var p = rr.parties[k];
        if (counts[p.abbreviation]) {
          counts[p.abbreviation].regionVoteShare = p.percentageShare || 0;
        }
      }
    }
    var parties = [];
    for (var a in counts) {
      var d = counts[a];
      parties.push({ abbr: a, constSeats: d.constSeats, listSeats: d.listSeats, total: d.constSeats + d.listSeats, regionVoteShare: d.regionVoteShare });
    }
    parties.sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return b.regionVoteShare - a.regionVoteShare;
    });
    return parties;
  }

  function regionWinningParty(regionName) {
    var tally = regionTotalTally(regionName);
    return tally.length > 0 ? tally[0].abbr : null;
  }

  /**
   * Build stacked tooltip HTML for a region: constituency (solid) + additional (striped) bars.
   */
  function regionTallyHtml(regionName) {
    var parties = regionTotalTally(regionName);
    if (parties.length === 0) return "";
    var maxTotal = parties[0].total;
    return '<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">' +
      parties.map(function (p) {
        var bg = partyColour(p.abbr);
        var fg = textColourForBg(bg);
        var totalPct = Math.round((p.total / maxTotal) * 100);
        var constPct = p.total > 0 ? Math.round((p.constSeats / p.total) * 100) : 0;
        var small = totalPct < 55;
        // Lighter shade for additional portion
        var addBg = bg + "99";
        var divider = (p.constSeats > 0 && p.listSeats > 0) ? '<span style="width:2px;height:100%;background:#fff;flex-shrink:0"></span>' : '';
        return '<div style="display:flex;align-items:center;gap:0;position:relative;height:22px">' +
          '<span style="display:inline-flex;align-items:center;height:100%;width:' + totalPct + '%;min-width:18px;border-radius:3px;overflow:hidden;box-sizing:border-box">' +
            (p.constSeats > 0 ? '<span style="width:' + constPct + '%;height:100%;background:' + bg + ';flex-shrink:0"></span>' : '') +
            divider +
            (p.listSeats > 0 ? '<span style="flex:1;height:100%;background:' + addBg + '"></span>' : '') +
          '</span>' +
          '<span style="position:absolute;left:4px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:' + fg + ';white-space:nowrap;pointer-events:none">' + partyShortName(p.abbr) + '</span>' +
          (small
            ? '<span style="font-size:11px;font-weight:400;color:#444;margin-left:4px;flex-shrink:0">' + p.total + '</span>'
            : '<span style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:400;color:' + fg + ';pointer-events:none">' + p.total + '</span>'
          ) +
          '</div>';
      }).join("") + "</div>";
  }

  // Search index
  var searchIndex = [];
  var indexByNorm = {};

  function normName(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function addToSearch(label, result, elType) {
    var norm = normName(label);
    if (!indexByNorm[norm]) {
      indexByNorm[norm] = { label: label, elections: [] };
      searchIndex.push(indexByNorm[norm]);
    }
    indexByNorm[norm].elections.push({ result: result, type: elType });
  }

  for (var nm in constMap) addToSearch(nm, constMap[nm], "constituency");
  for (var nm2 in regMap) addToSearch(nm2, regMap[nm2], "region");

  function findAllElections(constName) {
    var elections = [];
    var cr = constMap[constName];
    if (cr) elections.push({ result: cr, type: "constituency" });
    var regionName = constToRegion[constName];
    if (regionName && regMap[regionName]) {
      elections.push({ result: regMap[regionName], type: "region" });
    }
    return elections;
  }

  // ── Search ──
  setupMapSearch(m.searchInput, m.dropdown, m.searchWrap,
    function onNameSearch(query) {
      var q = query.toLowerCase();
      var matches = searchIndex.filter(function (s) {
        return s.label.toLowerCase().indexOf(q) >= 0;
      }).slice(0, 8);
      showMapSearchResults(m.dropdown, matches.map(function (s) {
        var types = s.elections.map(function (e) { return e.type === "region" ? "Region" : "Constituency"; }).join(", ");
        return {
          label: s.label,
          typesText: types,
          onClick: function () {
            m.dropdown.style("display", "none");
            m.searchInput.property("value", s.label);
            showScotlandOverlay(s.elections);
          }
        };
      }));
    },
    function onPostcode(postcode) {
      var clean = postcode.replace(/\s+/g, "");
      m.dropdown.style("display", "block")
        .html('<div class="map-search__item map-search__item--empty">Looking up postcode...</div>');

      fetch("https://api.postcodes.io/scotland/postcodes/" + encodeURIComponent(clean))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.status !== 200 || !data.result) {
            return fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(clean))
              .then(function (r) { return r.json(); });
          }
          return data;
        })
        .then(function (data) {
          if (data.status !== 200 || !data.result) {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">Postcode not found</div>');
            return;
          }
          var pc = data.result;
          var constName = pc.scottish_parliamentary_constituency || pc.parliamentary_constituency || "";
          var elections = [];
          if (constName) {
            var normQ = normName(constName);
            var bestMatch = null;
            for (var nm in constMap) {
              var normN = normName(nm);
              if (normN === normQ || normN.indexOf(normQ) >= 0 || normQ.indexOf(normN) >= 0) {
                bestMatch = nm;
                break;
              }
            }
            if (bestMatch) elections = findAllElections(bestMatch);
          }
          if (elections.length > 0) {
            m.searchInput.property("value", elections[0].result.name);
            m.dropdown.style("display", "none");
            showScotlandOverlay(elections);
          } else {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">No elections found for ' + (constName || postcode) + '</div>');
          }
        })
        .catch(function () {
          m.dropdown.html('<div class="map-search__item map-search__item--empty">Postcode lookup failed</div>');
        });
    }
  );

  // Track active filter mode
  var activeMode = "constituency";

  // ── Filter tabs ──
  var filters = [
    { key: "constituency", label: "Constituency" },
    { key: "region", label: "Region" },
  ];

  m.searchWrap.classed("map-search--has-filters", true);
  var filterBar = m.el.insert("div", ".map-wrapper").attr("class", "map-filters");
  filters.forEach(function (f) {
    filterBar.append("button")
      .attr("class", "map-filter" + (f.key === "constituency" ? " map-filter--active" : ""))
      .attr("data-filter", f.key)
      .text(f.label)
      .on("click", function () {
        filterBar.selectAll(".map-filter").classed("map-filter--active", false);
        d3.select(this).classed("map-filter--active", true);
        activeMode = f.key;
        renderView(f.key);
      });
  });

  // ── Render ──
  var mapBounds;
  function getMapBounds() {
    var rect = m.svg.node().getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }
  function renderView(mode) {
    m.zoomGroup.selectAll("*").remove();

    if (mode === "region") {
      // Region view: colour regions by largest party
      m.zoomGroup.append("g")
        .attr("class", "map-region-layer")
        .selectAll("path")
        .data(regGeo.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", function (d) {
          var wp = regionWinningParty(d.properties.SPR_NM);
          return wp ? partyColour(wp) : "#e8e8e8";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .attr("class", function (d) {
          return regMap[d.properties.SPR_NM] ? "map-area map-area--has-result" : "map-area";
        })
        .on("mouseenter", function (event, d) {
          var r = regMap[d.properties.SPR_NM];
          if (!r) return;
          var html = "<strong>" + r.name + " Region</strong><br>";
          var tally = regionTallyHtml(d.properties.SPR_NM);
          if (tally) html += tally;
          mapBounds = getMapBounds();
          Tooltip.show("map-tooltip", html, event.clientX, event.clientY, mapBounds);
          d3.select(this).attr("stroke", "#222").attr("stroke-width", 2).raise();
        })
        .on("mousemove", function (event) {
          var el = document.getElementById("map-tooltip");
          if (el) Tooltip.position(el, event.clientX, event.clientY, mapBounds);
        })
        .on("mouseleave", function () {
          d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1);
          Tooltip.hide("map-tooltip");
        })
        .on("click", function (event, d) {
          var rName = d.properties.SPR_NM;
          if (regMap[rName]) showRegionOverlay(rName);
        });
    } else {
      // Constituency view: colour by FPTP winner
      m.zoomGroup.append("g")
        .attr("class", "map-const-layer")
        .selectAll("path")
        .data(constGeo.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", function (d) {
          var r = constMap[d.properties.SPC_NM];
          return r ? partyColour(r.winningParty) : "#e8e8e8";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.3)
        .attr("class", function (d) {
          return constMap[d.properties.SPC_NM] ? "map-area map-area--has-result" : "map-area";
        })
        .on("mouseenter", function (event, d) {
          var r = constMap[d.properties.SPC_NM];
          if (!r) return;
          mapBounds = getMapBounds();
          var el = Tooltip.show("map-tooltip", "<strong>" + r.name + "</strong><br>", event.clientX, event.clientY, mapBounds);
          if (r.winningParty) {
            var badgeSpan = d3.select(el).append("span");
            gainHoldBadge(badgeSpan.node(), {
              winningParty: r.winningParty,
              gainOrHold: r.gainOrHold === "hold" ? "no change" : r.gainOrHold,
              sittingParty: r.sittingParty,
            });
            Tooltip.position(el, event.clientX, event.clientY, mapBounds);
          }
          d3.select(this).attr("stroke", "#222").attr("stroke-width", 1.5).raise();
        })
        .on("mousemove", function (event) {
          var el = document.getElementById("map-tooltip");
          if (el) Tooltip.position(el, event.clientX, event.clientY, mapBounds);
        })
        .on("mouseleave", function () {
          d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.3);
          Tooltip.hide("map-tooltip");
        })
        .on("click", function (event, d) {
          var r = constMap[d.properties.SPC_NM];
          if (r) showScotlandOverlay(findAllElections(d.properties.SPC_NM));
        });

      // Region borders overlay
      m.zoomGroup.append("g")
        .attr("class", "map-region-borders")
        .selectAll("path")
        .data(regGeo.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", "none")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .style("pointer-events", "none");
    }
  }

  // ── Overlay ──
  var overlayApi = null;

  function showScotlandOverlay(elections) {
    // If only a region result, use the dedicated region overlay
    if (elections.length === 1 && elections[0].type === "region") {
      var regionName = elections[0].result.name;
      for (var rk in regMap) {
        if (regMap[rk] === elections[0].result) { regionName = rk; break; }
      }
      showRegionOverlay(regionName);
      return;
    }

    var sorted = elections.slice().sort(function (a, b) {
      if (a.type === "constituency" && b.type !== "constituency") return -1;
      if (b.type === "constituency" && a.type !== "constituency") return 1;
      return 0;
    });

    overlayApi = createMapOverlay(sorted.map(function (e) {
      return {
        tabLabel: e.type === "region" ? e.result.name + " Region" : e.result.name,
        tabKey: e.type === "region" ? "region" : "constituency",
        renderPanel: function (panel) {
          if (e.type === "region") {
            var regionKey = e.result.name;
            for (var rk in regMap) {
              if (regMap[rk] === e.result) { regionKey = rk; break; }
            }
            var consts = regionToConsts[regionKey] || [];
            var tally = regionTotalTally(regionKey);
            renderRegionPanel(panel, regionKey, e.result, consts, tally);
          } else {
            var cardContainer = panel.append("div");
            constituencyResultCard(cardContainer.node(), e.result);
            cardContainer.append("div")
              .attr("class", "map-overlay__footer")
              .text("Vote share change vs notional 2021 results on 2026 boundaries (Hanretty)");
            cardContainer.select(".council-card__name").remove();
          }
        }
      };
    }));
  }

  function showRegionOverlay(regionName) {
    var rr = regMap[regionName];
    if (!rr) return;
    var consts = regionToConsts[regionName] || [];
    var tally = regionTotalTally(regionName);

    overlayApi = createMapOverlay([{
      tabLabel: rr.name + " Region",
      tabKey: "region",
      renderPanel: function (panel) {
        renderRegionPanel(panel, regionName, rr, consts, tally);
      }
    }]);
  }

  function renderRegionPanel(panel, regionName, rr, consts, tally) {
    var card = panel.append("div").attr("class", "region-overlay");

    // ── Regional vote share bars ──
    var parties = (rr.parties || []).slice().sort(function (a, b) {
      return b.percentageShare - a.percentageShare;
    }).filter(function (p) { return p.percentageShare >= 0.5; });
    var totalVotes = (rr.parties || []).reduce(function (s, p) { return s + (p.votes || 0); }, 0);

    if (parties.length) {
      var section = card.append("div").attr("class", "map-overlay__section");
      section.append("div").attr("class", "map-overlay__title").text("Regional vote share");

      var maxShare = parties[0].percentageShare;
      var barsWrap = section.append("div").attr("class", "fptp-card__bars");

      for (var pi = 0; pi < parties.length; pi++) {
        var p = parties[pi];
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

      requestAnimationFrame(function () { repositionBarLabels(barsWrap.node()); });
    }

    // ── Hemicycle ──
    var hemiParties = [];
    for (var i = 0; i < tally.length; i++) {
      var t = tally[i];
      // Constituency seats (solid)
      if (t.constSeats > 0) {
        hemiParties.push({ name: t.abbr, seats: t.constSeats, striped: false });
      }
      // Additional seats (striped)
      if (t.listSeats > 0) {
        hemiParties.push({ name: t.abbr, seats: t.listSeats, striped: true });
      }
    }
    var totalMSPs = tally.reduce(function (s, t) { return s + t.total; }, 0);
    if (totalMSPs > 0) {
      var hemiWrap = card.append("div")
        .attr("class", "region-overlay__hemicycle")
        .style("max-width", "340px")
        .style("margin", "0 auto 12px");
      hemicycle(hemiWrap.node(), hemiParties, {
        width: 340,
        showMajorityLine: false,
        showLabels: true,
        labelMinSeats: 1
      });
    }

    // ── Turnout bar ──
    if (rr.percentageTurnout != null || totalVotes) {
      turnoutBar(card.node(), {
        turnout: rr.percentageTurnout || 0,
        totalVotes: totalVotes,
        electorate: rr.electorate || 0
      });
    }

    // ── Elected toggle: Additional vs Constituency ──
    var electedSection = card.append("div").attr("class", "map-overlay__section");

    var totalElected = tally.reduce(function (s, t) { return s + t.total; }, 0);
    electedSection.append("div").attr("class", "map-overlay__title")
      .style("margin-bottom", "8px")
      .text("MSPs elected (" + totalElected + ")");

    var toggleRow = electedSection.append("div")
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

    var electedContent = electedSection.append("div").attr("class", "region-overlay__elected-content");

    function showAdditionalMembers() {
      addBtn.classed("party-strip-toggle__btn--active", true);
      constBtn.classed("party-strip-toggle__btn--active", false);
      electedContent.html("");
      renderAdditionalMembers(electedContent, rr);
    }

    function showConstituencyMSPs() {
      constBtn.classed("party-strip-toggle__btn--active", true);
      addBtn.classed("party-strip-toggle__btn--active", false);
      electedContent.html("");
      renderConstituencyBadges(electedContent, consts, regionName);
    }

    addBtn.on("click", showAdditionalMembers);
    constBtn.on("click", showConstituencyMSPs);

    // Default: show Additional Members
    showAdditionalMembers();
  }

  function renderAdditionalMembers(container, rr) {
    var elected = (rr.candidates || []).filter(function (c) { return c.elected === "*"; });
    renderElectedPills(container.node(), elected, { winningParty: rr.winningParty });
  }

  function renderConstituencyBadges(container, consts, regionName) {
    if (!consts.length) {
      container.append("div")
        .style("color", "#888").style("font-size", "13px").style("padding", "8px 0")
        .text("No constituency results yet");
      return;
    }

    // Sort by constituency name
    var sorted = consts.slice().sort(function (a, b) { return a.localeCompare(b); });

    // Group by winning party
    var groups = {};
    var partyOrder = [];
    for (var i = 0; i < sorted.length; i++) {
      var cr = constMap[sorted[i]];
      var abbr = cr ? cr.winningParty || "Other" : "Other";
      if (!groups[abbr]) { groups[abbr] = []; partyOrder.push(abbr); }
      groups[abbr].push({ name: sorted[i], result: cr });
    }
    partyOrder.sort(function (a, b) { return groups[b].length - groups[a].length; });

    var wrap = container.append("div").attr("class", "elected-pills");
    for (var gi = 0; gi < partyOrder.length; gi++) {
      var abbr = partyOrder[gi];
      var items = groups[abbr];
      var hex = partyColour(abbr);
      var fg = textColourForBg(hex);
      var row = wrap.append("div").attr("class", "elected-pills__row");
      for (var bi = 0; bi < items.length; bi++) {
        (function (item) {
          // Find the winning candidate name
          var winner = null;
          if (item.result && item.result.candidates) {
            for (var ci = 0; ci < item.result.candidates.length; ci++) {
              if (item.result.candidates[ci].elected === "*") { winner = item.result.candidates[ci]; break; }
            }
          }
          var mpName = winner ? winner.firstName + " " + winner.surname : item.name;
          var badge = row.append("div")
            .attr("class", "elected-pills__cell elected-pills__cell--clickable")
            .style("background", hex)
            .style("color", fg);
          var badgeText = badge.append("span").attr("class", "elected-pills__text")
            .text(mpName);
          badge
            .on("mouseenter", function () { badgeText.text(item.name); })
            .on("mouseleave", function () { badgeText.text(mpName); });
          badge.on("click", function () {
            if (!overlayApi || !item.result) return;
            overlayApi.addOrReplaceTab("constituency", item.name, function (panel) {
              var cardContainer = panel.append("div");
              constituencyResultCard(cardContainer.node(), item.result);
              cardContainer.append("div")
                .attr("class", "map-overlay__footer")
                .text("Vote share change vs notional 2021 results on 2026 boundaries (Hanretty)");
              cardContainer.select(".council-card__name").remove();
            });
          });
        })(items[bi]);
      }
    }
    _fitElectedPills(wrap);
  }

  renderView("constituency");
  return m.svg.node();
}
