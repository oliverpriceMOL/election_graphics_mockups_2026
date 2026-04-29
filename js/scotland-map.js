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

  // Deduplicate results (prefer result over rush, then highest revision)
  function dedup(arr) {
    var items = dedupByRevision(arr);
    var byName = {};
    for (var i = 0; i < items.length; i++) byName[items[i].name] = items[i];
    return byName;
  }

  var constByName = dedup(constResults);
  var regByName = dedup(regResults);

  // Build ONS code → GeoJSON name reverse indices
  var constCodeToName = {};
  for (var i = 0; i < constGeo.features.length; i++) {
    var p = constGeo.features[i].properties;
    constCodeToName[p.SPC_CD] = p.SPC_NM;
  }
  var regCodeToName = {};
  for (var i = 0; i < regGeo.features.length; i++) {
    var p = regGeo.features[i].properties;
    regCodeToName[p.SPR_CD] = p.SPR_NM;
  }

  // Resolve constituency result to GeoJSON name via PA_ONS_LOOKUP, fallback to exact name
  function resolveConst(item) {
    if (typeof PA_ONS_LOOKUP !== "undefined" && item.number != null && PA_ONS_LOOKUP.scottishConstituencies[item.number]) {
      var onsCode = PA_ONS_LOOKUP.scottishConstituencies[item.number];
      if (constCodeToName[onsCode]) return constCodeToName[onsCode];
    }
    // Exact name fallback
    for (var i = 0; i < constGeo.features.length; i++) {
      if (constGeo.features[i].properties.SPC_NM === item.name) {
        console.warn("Map: fuzzy fallback for Scottish const", item.name);
        return item.name;
      }
    }
    return null;
  }
  function resolveReg(item) {
    if (typeof PA_ONS_LOOKUP !== "undefined" && item.number != null && PA_ONS_LOOKUP.scottishRegions[item.number]) {
      var onsCode = PA_ONS_LOOKUP.scottishRegions[item.number];
      if (regCodeToName[onsCode]) return regCodeToName[onsCode];
    }
    // Exact name fallback
    for (var i = 0; i < regGeo.features.length; i++) {
      if (regGeo.features[i].properties.SPR_NM === item.name) {
        console.warn("Map: fuzzy fallback for Scottish region", item.name);
        return item.name;
      }
    }
    return null;
  }

  // Map constituency GeoJSON name → result (via ID lookup)
  var constMap = {};
  for (var key in constByName) {
    var geoName = resolveConst(constByName[key]);
    if (geoName) constMap[geoName] = constByName[key];
  }

  // Map region GeoJSON name → result (via ID lookup)
  var regMap = {};
  for (var key in regByName) {
    var geoName = resolveReg(regByName[key]);
    if (geoName) regMap[geoName] = regByName[key];
  }

  // Build nomination lookups via ID, fallback to fuzzy name
  var constNomSet = {};  // geoName → true
  var regNomSet = {};
  var constNoms = options.constNominations || [];
  var regNoms = options.regNominations || [];
  for (var ni = 0; ni < constNoms.length; ni++) {
    var gn = resolveConst(constNoms[ni]);
    if (gn) constNomSet[gn] = true;
  }
  for (var ni2 = 0; ni2 < regNoms.length; ni2++) {
    var gn2 = resolveReg(regNoms[ni2]);
    if (gn2) regNomSet[gn2] = true;
  }

  // All GeoJSON constituencies/regions are contested — ensure they're in nom sets
  // even if test nomination data is incomplete
  for (var gi = 0; gi < constGeo.features.length; gi++) {
    var geoNm = constGeo.features[gi].properties.SPC_NM;
    if (!constNomSet[geoNm]) constNomSet[geoNm] = true;
  }
  for (var gi2 = 0; gi2 < regGeo.features.length; gi2++) {
    var geoNm2 = regGeo.features[gi2].properties.SPR_NM;
    if (!regNomSet[geoNm2]) regNomSet[geoNm2] = true;
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
  // Nominated-but-no-result constituencies/regions (for search)
  for (var cnm in constNomSet) {
    if (!constMap[cnm]) addToSearch(cnm, { name: cnm, _awaiting: true }, "constituency");
  }
  for (var rnm in regNomSet) {
    if (!regMap[rnm]) addToSearch(rnm, { name: rnm, _awaiting: true }, "region");
  }

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

  function resolvePostcodeElections(cName) {
    var elections = findAllElections(cName);
    if (elections.length === 0 && constNomSet[cName]) {
      elections = [{ result: { name: cName, _awaiting: true }, type: "constituency" }];
    }
    return elections;
  }

  // ── Search ──
  var switchFilter = null; // assigned after filter tabs are built

  // Switch filter if elections don't match current view
  function ensureFilterForElection(elType) {
    var needed = elType === "region" ? "region" : "constituency";
    if (needed !== activeMode && switchFilter) switchFilter(needed);
  }

  setupMapSearch(m.searchInput, m.dropdown, m.searchWrap,
    function onNameSearch(query) {
      var matches = rankSearchMatches(searchIndex, query);
      showMapSearchResults(m.dropdown, matches.map(function (s) {
        var types = s.elections.map(function (e) { return e.type === "region" ? "Region" : "Constituency"; }).join(", ");
        return {
          label: s.label,
          typesText: types,
          onClick: function () {
            m.dropdown.style("display", "none");
            m.searchInput.property("value", s.label);
            if (s.elections.length > 0) ensureFilterForElection(s.elections[0].type);
            var feature = findScotlandFeature(s.label);
            scotlandZoomThenOverlay(feature, function () { showScotlandOverlay(s.elections); });
          }
        };
      }));
    },
    function onPostcode(postcode) {
      var clean = postcode.replace(/\s+/g, "");
      m.dropdown.style("display", "block")
        .html('<div class="map-search__item map-search__item--empty">Looking up postcode...</div>');

      // Try Scotland-specific endpoint first (returns constituency name directly)
      fetch("https://api.postcodes.io/scotland/postcodes/" + encodeURIComponent(clean))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.status === 200 && data.result && data.result.scottish_parliamentary_constituency) {
            var constName = data.result.scottish_parliamentary_constituency;
            var elections = resolvePostcodeElections(constName);
            if (elections.length > 0) {
              showMapSearchResults(m.dropdown, elections.map(function (e) {
                return {
                  label: e.result.name,
                  typesText: e.type === "region" ? "Region" : "Constituency",
                  onClick: function () {
                    m.dropdown.style("display", "none");
                    m.searchInput.property("value", e.result.name);
                    ensureFilterForElection(e.type);
                    var feature = findScotlandFeature(e.result.name);
                    scotlandZoomThenOverlay(feature, function () { showScotlandOverlay([e]); });
                  }
                };
              }));
              return;
            }
          }
          // Fall back to general endpoint for geometric lookup
          return fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(clean))
            .then(function (r) { return r.json(); })
            .then(function (genData) {
              if (genData.status !== 200 || !genData.result) {
                m.dropdown.html('<div class="map-search__item map-search__item--empty">Postcode not found</div>');
                return;
              }
              var pc = genData.result;
              var elections = [];
              if (pc.longitude && pc.latitude) {
                var pt = [pc.longitude, pc.latitude];
                for (var i = 0; i < constGeo.features.length; i++) {
                  if (d3.geoContains(constGeo.features[i], pt)) {
                    elections = resolvePostcodeElections(constGeo.features[i].properties.SPC_NM);
                    break;
                  }
                }
              }
              if (elections.length > 0) {
                showMapSearchResults(m.dropdown, elections.map(function (e) {
                  return {
                    label: e.result.name,
                    typesText: e.type === "region" ? "Region" : "Constituency",
                    onClick: function () {
                      m.dropdown.style("display", "none");
                      m.searchInput.property("value", e.result.name);
                      ensureFilterForElection(e.type);
                      var feature = findScotlandFeature(e.result.name);
                      scotlandZoomThenOverlay(feature, function () { showScotlandOverlay([e]); });
                    }
                  };
                }));
              } else {
                m.dropdown.html('<div class="map-search__item map-search__item--empty">No elections found for ' + (pc.scottish_parliamentary_constituency || postcode) + '</div>');
              }
            });
        })
        .catch(function () {
          m.dropdown.html('<div class="map-search__item map-search__item--empty">Postcode lookup failed</div>');
        });
    },
    function onOutcode(outcode) {
      var clean = outcode.replace(/\s+/g, "").toUpperCase();
      m.dropdown.style("display", "block")
        .html('<div class="map-search__item map-search__item--empty">Looking up ' + clean + '...</div>');

      fetch("https://api.postcodes.io/outcodes/" + encodeURIComponent(clean))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.status !== 200 || !data.result) {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">No areas found for ' + clean + '</div>');
            return;
          }
          // Use admin_district names to find matching constituencies via searchIndex
          var districts = data.result.admin_district || [];
          var dropdownItems = [];
          var seen = {};
          searchIndex.forEach(function (s) {
            for (var i = 0; i < districts.length; i++) {
              if (s.label.toLowerCase().indexOf(districts[i].toLowerCase()) >= 0 ||
                  districts[i].toLowerCase().indexOf(s.label.toLowerCase()) >= 0) {
                if (!seen[s.label]) {
                  seen[s.label] = true;
                  var types = s.elections.map(function (e) { return e.type === "region" ? "Region" : "Constituency"; }).join(", ");
                  dropdownItems.push({
                    label: s.label,
                    typesText: types,
                    onClick: function () {
                      m.dropdown.style("display", "none");
                      m.searchInput.property("value", s.label);
                      if (s.elections.length > 0) ensureFilterForElection(s.elections[0].type);
                      var feature = findScotlandFeature(s.label);
                      scotlandZoomThenOverlay(feature, function () { showScotlandOverlay(s.elections); });
                    }
                  });
                }
                break;
              }
            }
          });
          if (dropdownItems.length > 0) {
            showMapSearchResults(m.dropdown, dropdownItems.slice(0, 8));
          } else {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">No constituencies found for ' + clean + '</div>');
          }
        })
        .catch(function () {
          m.dropdown.html('<div class="map-search__item map-search__item--empty">Outcode lookup failed</div>');
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

  switchFilter = function (mode) {
    activeMode = mode;
    filterBar.selectAll(".map-filter").classed("map-filter--active", false);
    filterBar.select('[data-filter="' + mode + '"]').classed("map-filter--active", true);
    renderView(mode);
  };

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
          var nm = d.properties.SPR_NM;
          var wp = regionWinningParty(nm);
          if (wp) return partyColour(wp);
          return regNomSet[nm] ? "url(#crosshatch)" : "#fff";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .attr("class", function (d) {
          var nm = d.properties.SPR_NM;
          if (regMap[nm]) return "map-area map-area--has-result";
          if (regNomSet[nm]) return "map-area map-area--awaiting";
          return "map-area";
        })
        .on("mouseenter", function (event, d) {
          var nm = d.properties.SPR_NM;
          var r = regMap[nm];
          if (r) {
            var html = "<strong>" + r.name + "</strong><br>";
            var tally = regionTallyHtml(nm);
            if (tally) html += tally;
            html += '<div style="color:#888;font-size:11px;font-style:italic;margin-top:4px">Click for full results</div>';
            mapBounds = getMapBounds();
            Tooltip.show("map-tooltip", html, event.clientX, event.clientY, mapBounds);
          } else if (regNomSet[nm]) {
            mapBounds = getMapBounds();
            Tooltip.show("map-tooltip", "<strong>" + nm + "</strong><br><span style=\"color:#888\">Awaiting declaration</span>", event.clientX, event.clientY, mapBounds);
          } else { return; }
        })
        .on("mousemove", function (event) {
          var el = document.getElementById("map-tooltip");
          if (el) Tooltip.position(el, event.clientX, event.clientY, mapBounds);
        })
        .on("mouseleave", function () {
          Tooltip.hide("map-tooltip");
        })
        .on("click", function (event, d) {
          var rName = d.properties.SPR_NM;
          var feature = d;
          if (regMap[rName]) {
            scotlandZoomThenOverlay(feature, function () { showRegionOverlay(rName); });
          } else if (regNomSet[rName]) {
            scotlandZoomThenOverlay(feature, function () { showAwaitingOverlay(rName); });
          }
        });
    } else {
      // Constituency view: colour by FPTP winner
      var constPaths = m.zoomGroup.append("g")
        .attr("class", "map-const-layer")
        .selectAll("path")
        .data(constGeo.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", function (d) {
          var nm = d.properties.SPC_NM;
          var r = constMap[nm];
          if (r) return partyColour(r.winningParty);
          return constNomSet[nm] ? "url(#crosshatch)" : "#fff";
        })
        .attr("stroke", function (d) {
          var r = constMap[d.properties.SPC_NM];
          return (r && r.gainOrHold === "gain") ? "#000" : "#fff";
        })
        .attr("stroke-width", function (d) {
          var r = constMap[d.properties.SPC_NM];
          return (r && r.gainOrHold === "gain") ? 1 : 0.3;
        })
        .attr("class", function (d) {
          var nm = d.properties.SPC_NM;
          var r = constMap[nm];
          if (r) return "map-area map-area--has-result";
          if (constNomSet[nm]) return "map-area map-area--awaiting";
          return "map-area";
        })
        .on("mouseenter", function (event, d) {
          var nm = d.properties.SPC_NM;
          var r = constMap[nm];
          if (r) {
            mapBounds = getMapBounds();
            var el = Tooltip.show("map-tooltip", "<strong>" + r.name + "</strong><br>", event.clientX, event.clientY, mapBounds);
            if (r.winningParty) {
              var badgeSpan = d3.select(el).append("span");
              gainHoldBadge(badgeSpan.node(), {
                winningParty: r.winningParty,
                gainOrHold: r.gainOrHold === "hold" ? "no change" : r.gainOrHold,
                sittingParty: r.sittingParty,
              });
            }
            d3.select(el).append("div").style("color", "#888").style("font-size", "11px").style("font-style", "italic").style("margin-top", "4px").text("Click for full results");
            Tooltip.position(el, event.clientX, event.clientY, mapBounds);
          } else if (constNomSet[nm]) {
            mapBounds = getMapBounds();
            Tooltip.show("map-tooltip", "<strong>" + nm + "</strong><br><span style=\"color:#888\">Awaiting declaration</span>", event.clientX, event.clientY, mapBounds);
          } else { return; }
        })
        .on("mousemove", function (event) {
          var el = document.getElementById("map-tooltip");
          if (el) Tooltip.position(el, event.clientX, event.clientY, mapBounds);
        })
        .on("mouseleave", function () {
          Tooltip.hide("map-tooltip");
        })
        .on("click", function (event, d) {
          var nm = d.properties.SPC_NM;
          var r = constMap[nm];
          var feature = d;
          if (r) {
            scotlandZoomThenOverlay(feature, function () { showScotlandOverlay(findAllElections(nm)); });
          } else if (constNomSet[nm]) {
            scotlandZoomThenOverlay(feature, function () { showAwaitingOverlay(nm); });
          }
        });
      constPaths.filter(function (d) {
        var r = constMap[d.properties.SPC_NM];
        return r && r.gainOrHold === "gain";
      }).raise();

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

      // Gain borders on top of region borders
      var gainFeatures = constGeo.features.filter(function (f) {
        var r = constMap[f.properties.SPC_NM];
        return r && r.gainOrHold === "gain";
      });
      if (gainFeatures.length) {
        m.zoomGroup.append("g")
          .attr("class", "gain-border-layer")
          .style("pointer-events", "none")
          .selectAll("path")
          .data(gainFeatures)
          .join("path")
          .attr("d", m.path)
          .attr("fill", "none")
          .attr("stroke", "#000")
          .attr("stroke-width", 1);
      }
    }

    // Rebuild legend for current view
    updateScotlandLegend(mode);

    // Zoom to fit visible areas
    var visibleFeatures = mode === "region" ? regGeo.features : constGeo.features;
    zoomToFeatures(m.svg, m.zoom, m.path, visibleFeatures, { duration: 600 });
  }

  // ── Legend ──
  function getScotlandVisibleParties(mode) {
    var counts = {};
    if (mode === "region") {
      for (var nm in regMap) {
        var wp = regionWinningParty(nm);
        if (wp) counts[wp] = (counts[wp] || 0) + 1;
      }
    } else {
      for (var nm in constMap) {
        var wp = constMap[nm].winningParty;
        if (wp) counts[wp] = (counts[wp] || 0) + 1;
      }
    }
    var parties = Object.keys(counts)
      .filter(function (n) { return n !== "NOC"; })
      .map(function (name) {
        return { name: name, colour: partyColour(name), count: counts[name] };
      });
    parties.sort(function (a, b) { return b.count - a.count; });
    if (counts["NOC"]) parties.push({ name: "NOC", colour: partyColour("NOC"), count: counts["NOC"] });
    return parties;
  }

  function updateScotlandLegend(mode) {
    var parties = getScotlandVisibleParties(mode);
    buildMapLegend(m.wrapper, parties);
  }

  // ── Feature lookup for zoom ──
  function findScotlandFeature(name) {
    for (var i = 0; i < constGeo.features.length; i++) {
      if (constGeo.features[i].properties.SPC_NM === name) return constGeo.features[i];
    }
    for (var i = 0; i < regGeo.features.length; i++) {
      if (regGeo.features[i].properties.SPR_NM === name) return regGeo.features[i];
    }
    // Reverse: result name → geo name
    for (var gn in constMap) {
      if (constMap[gn].name === name) {
        for (var ci = 0; ci < constGeo.features.length; ci++) {
          if (constGeo.features[ci].properties.SPC_NM === gn) return constGeo.features[ci];
        }
      }
    }
    for (var gn in regMap) {
      if (regMap[gn].name === name) {
        for (var ri = 0; ri < regGeo.features.length; ri++) {
          if (regGeo.features[ri].properties.SPR_NM === gn) return regGeo.features[ri];
        }
      }
    }
    return null;
  }

  function scotlandZoomThenOverlay(feature, overlayFn) {
    if (!feature) { overlayFn(); return; }
    var pathEl = m.zoomGroup.selectAll(".map-area").filter(function (d) { return d === feature; }).node();
    dimOtherAreas(m.zoomGroup, pathEl);
    zoomToFeature(m.svg, m.zoom, m.path, feature, { onEnd: overlayFn });
  }

  // ── Overlay ──
  var overlayApi = null;

  // Click-away: clicking empty map background closes overlay
  m.svg.on("click", function (event) {
    if (!overlayApi) return;
    var target = event.target;
    if (!target.classList || !target.classList.contains("map-area")) {
      overlayApi.close();
      overlayApi = null;
    }
  });

  function showAwaitingOverlay(label) {
    overlayApi = createMapOverlay([{
      tabLabel: label,
      renderPanel: function (panel) {
        panel.append("div")
          .html("<p style=\"color:#888; text-align:center; padding:40px 20px; font-size:15px;\">Awaiting declaration</p>");
      }
    }], { container: m.el, onClose: function () {
      overlayApi = null;
      resetAreaDim(m.zoomGroup);
    }});
  }

  function showScotlandOverlay(elections) {
    // If all awaiting, show awaiting panel
    var allAwaiting = elections.every(function (e) { return e.result._awaiting; });
    if (allAwaiting && elections.length > 0) {
      var label = elections[0].type === "region" ? elections[0].result.name + " Region" : elections[0].result.name;
      showAwaitingOverlay(label);
      return;
    }
    var declared = elections.filter(function (e) { return !e.result._awaiting; });

    // If only a region result, use the dedicated region overlay
    if (declared.length === 1 && declared[0].type === "region") {
      var regionName = declared[0].result.name;
      for (var rk in regMap) {
        if (regMap[rk] === declared[0].result) { regionName = rk; break; }
      }
      showRegionOverlay(regionName);
      return;
    }

    var sorted = declared.slice().sort(function (a, b) {
      if (a.type === "constituency" && b.type !== "constituency") return -1;
      if (b.type === "constituency" && a.type !== "constituency") return 1;
      return 0;
    });

    overlayApi = createMapOverlay(sorted.map(function (e) {
      return {
        tabLabel: e.result.name,
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
            fptpResultCard(cardContainer.node(), e.result, { showDeclarationTime: true });
            cardContainer.append("div")
              .attr("class", "map-overlay__footer")
              .text("Vote share change vs notional 2021 results on 2026 boundaries (Hanretty)");
            cardContainer.select(".council-card__name").remove();
          }
        }
      };
    }), { container: m.el, onClose: function () {
      overlayApi = null;
      resetAreaDim(m.zoomGroup);
    }});
  }

  function showRegionOverlay(regionName) {
    var rr = regMap[regionName];
    if (!rr) return;
    var consts = regionToConsts[regionName] || [];
    var tally = regionTotalTally(regionName);

    overlayApi = createMapOverlay([{
      tabLabel: rr.name,
      tabKey: "region",
      renderPanel: function (panel) {
        renderRegionPanel(panel, regionName, rr, consts, tally);
      }
    }], { container: m.el, onClose: function () {
      overlayApi = null;
      resetAreaDim(m.zoomGroup);
    }});
  }

  function renderRegionPanel(panel, regionName, rr, consts, tally) {
    var card = panel.append("div").attr("class", "region-overlay");

    var parties = (rr.parties || []).slice().sort(function (a, b) {
      return b.percentageShare - a.percentageShare;
    }).filter(function (p) { return p.percentageShare >= 0.5; });
    var totalVotes = (rr.parties || []).reduce(function (s, p) { return s + (p.votes || 0); }, 0);

    // ── Toggle: MSPs elected / Vote share ──
    var toggleRow = card.append("div")
      .attr("class", "party-strip-toggle")
      .style("width", "100%")
      .style("margin-top", "8px")
      .style("margin-bottom", "10px");

    var electedBtn = toggleRow.append("button")
      .attr("class", "party-strip-toggle__btn party-strip-toggle__btn--active")
      .style("flex", "1")
      .text("MSPs elected");

    var voteBtn = toggleRow.append("button")
      .attr("class", "party-strip-toggle__btn")
      .style("flex", "1")
      .text("Vote share");

    var contentArea = card.append("div");

    function showElected() {
      electedBtn.classed("party-strip-toggle__btn--active", true);
      voteBtn.classed("party-strip-toggle__btn--active", false);
      contentArea.html("");
      var electedContent = contentArea.append("div").attr("class", "region-overlay__elected-content");
      renderAdditionalMembers(electedContent, rr);
    }

    function showVoteShare() {
      voteBtn.classed("party-strip-toggle__btn--active", true);
      electedBtn.classed("party-strip-toggle__btn--active", false);
      contentArea.html("");
      if (parties.length) {
        var section = contentArea.append("div");
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

        // Collapse to top 6 if more parties
        var MAX_VISIBLE = 6;
        var allRows = barsWrap.selectAll(".fptp-card__bar-row").nodes();
        if (allRows.length > MAX_VISIBLE) {
          for (var h = MAX_VISIBLE; h < allRows.length; h++) {
            d3.select(allRows[h]).style("display", "none");
          }
          var expandBtn = section.append("button")
            .attr("class", "map-overlay__expand-btn")
            .text("Show all " + allRows.length + " parties \u25BE");
          expandBtn.on("click", function () {
            var expanded = expandBtn.classed("map-overlay__expand-btn--expanded");
            if (!expanded) {
              for (var j = MAX_VISIBLE; j < allRows.length; j++) {
                d3.select(allRows[j]).style("display", null);
              }
              expandBtn.text("Show fewer \u25B4").classed("map-overlay__expand-btn--expanded", true);
            } else {
              for (var j = MAX_VISIBLE; j < allRows.length; j++) {
                d3.select(allRows[j]).style("display", "none");
              }
              expandBtn.text("Show all " + allRows.length + " parties \u25BE").classed("map-overlay__expand-btn--expanded", false);
            }
            requestAnimationFrame(function () { repositionBarLabels(section.node()); });
          });
        }

        requestAnimationFrame(function () { repositionBarLabels(section.node()); });
      }
    }

    electedBtn.on("click", showElected);
    voteBtn.on("click", showVoteShare);
    showElected();

    // ── Turnout bar ──
    if (rr.percentageTurnout != null || totalVotes) {
      turnoutBar(card.node(), {
        turnout: rr.percentageTurnout || 0,
        totalVotes: totalVotes,
        electorate: rr.electorate || 0
      });
    }

    // ── Declaration time ──
    if (rr.declarationTime) {
      var t = new Date(rr.declarationTime);
      var dateStr = t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      var timeStr = t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      card.append("div")
        .attr("class", "council-card__declared")
        .text("Declared " + timeStr + ", " + dateStr);
    }
  }

  function renderAdditionalMembers(container, rr) {
    var elected = (rr.candidates || []).filter(function (c) { return c.elected === "*"; });
    renderElectedPills(container.node(), elected, { winningParty: rr.winningParty });
  }

  renderView("constituency");
  return m.svg.node();
}
