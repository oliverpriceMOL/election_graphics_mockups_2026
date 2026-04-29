/**
 * Wales Senedd Map — D3 SVG Choropleth
 * Single layer: 16 Senedd constituencies (proportional/list results).
 * Requires: d3.js, party-config.js, election-map.js, list-card.js
 */
function walesMap(container, results, constGeo, options) {
  options = options || {};
  var width = options.width || 450;
  var height = options.height || 550;

  var m = createMapScaffold(container, width, height, constGeo, "Search constituency or postcode...");

  // Deduplicate results (prefer result over rush, then highest revision)
  var dedupArr = dedupByRevision(results);
  var byName = {};
  for (var i = 0; i < dedupArr.length; i++) byName[dedupArr[i].name] = dedupArr[i];

  // Build ONS code → GeoJSON name reverse index
  var walesCodeToName = {};
  for (var i = 0; i < constGeo.features.length; i++) {
    var p = constGeo.features[i].properties;
    walesCodeToName[p.SENEDD_CD] = p.SENEDD_NM;
  }

  // Resolve a Welsh result/nomination to GeoJSON name via PA_ONS_LOOKUP, fallback to exact name
  function resolveWelsh(item) {
    if (typeof PA_ONS_LOOKUP !== "undefined" && item.number != null && PA_ONS_LOOKUP.welshConstituencies[item.number]) {
      var onsCode = PA_ONS_LOOKUP.welshConstituencies[item.number];
      if (walesCodeToName[onsCode]) return walesCodeToName[onsCode];
    }
    // Exact name fallback
    for (var i = 0; i < constGeo.features.length; i++) {
      if (constGeo.features[i].properties.SENEDD_NM === item.name) {
        console.warn("Map: fuzzy fallback for Welsh", item.name);
        return item.name;
      }
    }
    return null;
  }

  // Map GeoJSON name → result (via ID lookup)
  var constMap = {};
  for (var key in byName) {
    var geoName = resolveWelsh(byName[key]);
    if (geoName) constMap[geoName] = byName[key];
  }

  // Build nomination lookup via ID, fallback to fuzzy
  var constNomSet = {};
  var wNoms = options.nominations || [];
  for (var ni = 0; ni < wNoms.length; ni++) {
    var gn = resolveWelsh(wNoms[ni]);
    if (gn) constNomSet[gn] = true;
  }

  function constWinningParty(result) {
    if (!result || !result.candidates) return null;
    var counts = {};
    for (var i = 0; i < result.candidates.length; i++) {
      var c = result.candidates[i];
      if (c.elected === "true" || c.elected === true || c.elected === "*") {
        var abbr = c.party ? c.party.abbreviation : "Other";
        counts[abbr] = (counts[abbr] || 0) + 1;
      }
    }
    var best = null, bestCount = 0;
    for (var abbr in counts) {
      if (counts[abbr] > bestCount) { bestCount = counts[abbr]; best = abbr; }
    }
    return best;
  }

  // Search index
  var searchIndex = [];
  for (var nm in constMap) {
    searchIndex.push({ label: nm, result: constMap[nm] });
  }
  // Add nominated-but-no-result constituencies so they are searchable
  for (var nm in constNomSet) {
    if (!constMap[nm]) {
      searchIndex.push({ label: nm, _awaiting: true });
    }
  }

  // ── Search ──
  setupMapSearch(m.searchInput, m.dropdown, m.searchWrap,
    function onNameSearch(query) {
      var matches = rankSearchMatches(searchIndex, query);
      showMapSearchResults(m.dropdown, matches.map(function (s) {
        return {
          label: s.label,
          typesText: null,
          onClick: function () {
            m.dropdown.style("display", "none");
            m.searchInput.property("value", s.label);
            var feature = findWalesFeature(s.label);
            if (s._awaiting) {
              walesZoomThenOverlay(feature, function () { showAwaitingOverlay(s.label); });
            } else {
              walesZoomThenOverlay(feature, function () { showWalesOverlay(s.result); });
            }
          }
        };
      }));
    },
    function onPostcode(postcode) {
      var clean = postcode.replace(/\s+/g, "");
      m.dropdown.style("display", "block")
        .html('<div class="map-search__item map-search__item--empty">Looking up postcode...</div>');

      fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(clean))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.status !== 200 || !data.result) {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">Postcode not found</div>');
            return;
          }
          var pc = data.result;
          if (pc.longitude && pc.latitude) {
            var pt = [pc.longitude, pc.latitude];
            for (var i = 0; i < constGeo.features.length; i++) {
              var feat = constGeo.features[i];
              if (d3.geoContains(feat, pt)) {
                var nm = feat.properties.SENEDD_NM;
                if (constMap[nm]) {
                  showMapSearchResults(m.dropdown, [{
                    label: nm,
                    typesText: null,
                    onClick: function () {
                      m.dropdown.style("display", "none");
                      m.searchInput.property("value", nm);
                      walesZoomThenOverlay(feat, function () { showWalesOverlay(constMap[nm]); });
                    }
                  }]);
                  return;
                }
                if (constNomSet[nm]) {
                  showMapSearchResults(m.dropdown, [{
                    label: nm,
                    typesText: "Awaiting declaration",
                    onClick: function () {
                      m.dropdown.style("display", "none");
                      m.searchInput.property("value", nm);
                      walesZoomThenOverlay(feat, function () { showAwaitingOverlay(nm); });
                    }
                  }]);
                  return;
                }
              }
            }
          }
          m.dropdown.html('<div class="map-search__item map-search__item--empty">No Senedd constituency found for this postcode</div>');
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
          // Use latitude/longitude to find which Senedd constituency contains the outcode centroid
          var dropdownItems = [];
          if (data.result.latitude && data.result.longitude) {
            var pt = [data.result.longitude, data.result.latitude];
            for (var i = 0; i < constGeo.features.length; i++) {
              var feat = constGeo.features[i];
              if (d3.geoContains(feat, pt)) {
                var nm = feat.properties.SENEDD_NM;
                if (constMap[nm]) {
                  dropdownItems.push({
                    label: nm,
                    typesText: null,
                    onClick: (function (name, f) {
                      return function () {
                        m.dropdown.style("display", "none");
                        m.searchInput.property("value", name);
                        walesZoomThenOverlay(f, function () { showWalesOverlay(constMap[name]); });
                      };
                    })(nm, feat)
                  });
                } else if (constNomSet[nm]) {
                  dropdownItems.push({
                    label: nm,
                    typesText: "Awaiting declaration",
                    onClick: (function (name, f) {
                      return function () {
                        m.dropdown.style("display", "none");
                        m.searchInput.property("value", name);
                        walesZoomThenOverlay(f, function () { showAwaitingOverlay(name); });
                      };
                    })(nm, feat)
                  });
                }
                break;
              }
            }
          }
          if (dropdownItems.length > 0) {
            showMapSearchResults(m.dropdown, dropdownItems);
          } else {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">No Senedd constituency found for ' + clean + '</div>');
          }
        })
        .catch(function () {
          m.dropdown.html('<div class="map-search__item map-search__item--empty">Outcode lookup failed</div>');
        });
    }
  );

  // ── Render ──
  var mapBounds;
  function getMapBounds() {
    var rect = m.svg.node().getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }
  m.zoomGroup.append("g")
    .attr("class", "map-const-layer")
    .selectAll("path")
    .data(constGeo.features)
    .join("path")
    .attr("d", m.path)
    .attr("fill", function (d) {
      var nm = d.properties.SENEDD_NM;
      var r = constMap[nm];
      var wp = constWinningParty(r);
      if (wp) return partyColour(wp);
      return constNomSet[nm] ? "url(#crosshatch)" : "#fff";
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .attr("class", function (d) {
      var nm = d.properties.SENEDD_NM;
      if (constMap[nm]) return "map-area map-area--has-result";
      if (constNomSet[nm]) return "map-area map-area--awaiting";
      return "map-area";
    })
    .on("mouseenter", function (event, d) {
      var nm = d.properties.SENEDD_NM;
      var r = constMap[nm];
      if (r) {
        var html = "<strong>" + r.name + "</strong><br>";
        var tally = seatTallyHtml(r);
        if (tally) html += tally;
        html += '<div style="color:#888;font-size:11px;font-style:italic;margin-top:4px">Click for full results</div>';
        mapBounds = getMapBounds();
        Tooltip.show("map-tooltip", html, event.clientX, event.clientY, mapBounds);
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
      var nm = d.properties.SENEDD_NM;
      var feature = d;
      var r = constMap[nm];
      if (r) {
        walesZoomThenOverlay(feature, function () { showWalesOverlay(r); });
        return;
      }
      if (constNomSet[nm]) {
        walesZoomThenOverlay(feature, function () { showAwaitingOverlay(nm); });
      }
    });

  // ── Legend ──
  function getWalesVisibleParties() {
    var counts = {};
    for (var nm in constMap) {
      var wp = constWinningParty(constMap[nm]);
      if (wp) counts[wp] = (counts[wp] || 0) + 1;
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

  function updateWalesLegend() {
    var parties = getWalesVisibleParties();
    buildMapLegend(m.wrapper, parties, { hideGain: true, hideNoElection: true });
  }
  updateWalesLegend();

  // ── Feature lookup for zoom ──
  function findWalesFeature(name) {
    for (var i = 0; i < constGeo.features.length; i++) {
      if (constGeo.features[i].properties.SENEDD_NM === name) return constGeo.features[i];
    }
    // Reverse: result name → geo name
    for (var gn in constMap) {
      if (constMap[gn].name === name) {
        for (var ci = 0; ci < constGeo.features.length; ci++) {
          if (constGeo.features[ci].properties.SENEDD_NM === gn) return constGeo.features[ci];
        }
      }
    }
    return null;
  }

  function walesZoomThenOverlay(feature, overlayFn) {
    if (!feature) { overlayFn(); return; }
    var pathEl = m.zoomGroup.selectAll(".map-area").filter(function (d) { return d === feature; }).node();
    dimOtherAreas(m.zoomGroup, pathEl);
    zoomToFeature(m.svg, m.zoom, m.path, feature, { onEnd: overlayFn });
  }

  // ── Overlay ──
  var walesOverlayApi = null;

  // Click-away: clicking empty map background closes overlay
  m.svg.on("click", function (event) {
    if (!walesOverlayApi) return;
    var target = event.target;
    if (!target.classList || !target.classList.contains("map-area")) {
      walesOverlayApi.close();
      walesOverlayApi = null;
    }
  });

  function showAwaitingOverlay(label) {
    walesOverlayApi = createMapOverlay([{
      tabLabel: label,
      renderPanel: function (panel) {
        panel.append("div")
          .style("padding", "24px 16px")
          .style("text-align", "center")
          .style("color", "#888")
          .text("Awaiting declaration");
      }
    }], { container: m.el, onClose: function () {
      walesOverlayApi = null;
      resetAreaDim(m.zoomGroup);
    }});
  }

  function showWalesOverlay(result) {
    walesOverlayApi = createMapOverlay([{
      tabLabel: result.name,
      renderPanel: function (panel) {
        var card = panel.append("div");

        var parties = (result.parties || []).slice().sort(function (a, b) {
          return b.percentageShare - a.percentageShare;
        }).filter(function (p) { return p.percentageShare >= 0.5; });
        var totalVotes = (result.parties || []).reduce(function (s, p) { return s + (p.votes || 0); }, 0);

        // ── Toggle: MSs elected / Vote share ──
        var toggleRow = card.append("div")
          .attr("class", "party-strip-toggle")
          .style("width", "100%")
          .style("margin-top", "8px")
          .style("margin-bottom", "10px");

        var electedBtn = toggleRow.append("button")
          .attr("class", "party-strip-toggle__btn party-strip-toggle__btn--active")
          .style("flex", "1")
          .text("MSs elected");

        var voteBtn = toggleRow.append("button")
          .attr("class", "party-strip-toggle__btn")
          .style("flex", "1")
          .text("Vote share");

        var contentArea = card.append("div");

        function showElected() {
          electedBtn.classed("party-strip-toggle__btn--active", true);
          voteBtn.classed("party-strip-toggle__btn--active", false);
          contentArea.html("");
          var elected = (result.candidates || []).filter(function (c) { return c.elected === "*"; });
          renderElectedPills(contentArea.node(), elected, { winningParty: result.winningParty });
        }

        function showVoteShare() {
          voteBtn.classed("party-strip-toggle__btn--active", true);
          electedBtn.classed("party-strip-toggle__btn--active", false);
          contentArea.html("");
          if (parties.length) {
            var maxShare = parties[0].percentageShare;
            var barsWrap = contentArea.append("div").attr("class", "fptp-card__bars");

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

            // Collapse to top 6 if more parties
            var MAX_VISIBLE = 6;
            var allRows = barsWrap.selectAll(".fptp-card__bar-row").nodes();
            if (allRows.length > MAX_VISIBLE) {
              for (var h = MAX_VISIBLE; h < allRows.length; h++) {
                d3.select(allRows[h]).style("display", "none");
              }
              var expandBtn = contentArea.append("button")
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
                requestAnimationFrame(function () { repositionBarLabels(barsWrap.node()); });
              });
            }

            requestAnimationFrame(function () {
              repositionBarLabels(barsWrap.node());
            });
          }
        }

        electedBtn.on("click", showElected);
        voteBtn.on("click", showVoteShare);
        showElected();

        // ── Turnout bar ──
        if (result.percentageTurnout != null || totalVotes) {
          turnoutBar(card.node(), {
            turnout: result.percentageTurnout || 0,
            totalVotes: totalVotes,
            electorate: result.electorate || 0
          });
        }

        // ── Declaration time ──
        if (result.declarationTime) {
          var t = new Date(result.declarationTime);
          var dateStr = t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          var timeStr = t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          card.append("div")
            .attr("class", "council-card__declared")
            .text("Declared " + timeStr + ", " + dateStr);
        }
      }
    }], { container: m.el, onClose: function () {
      walesOverlayApi = null;
      resetAreaDim(m.zoomGroup);
    }});
  }

  return m.svg.node();
}
