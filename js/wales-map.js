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

  // Deduplicate results by highest revision
  var byName = {};
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!byName[r.name] || (r.revision || 0) > (byName[r.name].revision || 0)) {
      byName[r.name] = r;
    }
  }

  // Map GeoJSON name → result
  var constMap = {};
  for (var i = 0; i < constGeo.features.length; i++) {
    var feat = constGeo.features[i];
    var nm = feat.properties.SENEDD_NM;
    if (byName[nm]) constMap[nm] = byName[nm];
  }

  // Build nomination lookup (for distinguishing "awaiting" from "no election")
  var constNomSet = {};
  var wNoms = options.nominations || [];
  function normWales(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  for (var ni = 0; ni < wNoms.length; ni++) {
    var wnNorm = normWales(wNoms[ni].name);
    for (var fi = 0; fi < constGeo.features.length; fi++) {
      if (normWales(constGeo.features[fi].properties.SENEDD_NM) === wnNorm) {
        constNomSet[constGeo.features[fi].properties.SENEDD_NM] = true;
        break;
      }
    }
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

  // ── Search ──
  setupMapSearch(m.searchInput, m.dropdown, m.searchWrap,
    function onNameSearch(query) {
      var q = query.toLowerCase();
      var matches = searchIndex.filter(function (s) {
        return s.label.toLowerCase().indexOf(q) >= 0;
      }).slice(0, 8);
      showMapSearchResults(m.dropdown, matches.map(function (s) {
        return {
          label: s.label,
          typesText: null,
          onClick: function () {
            m.dropdown.style("display", "none");
            m.searchInput.property("value", s.label);
            showWalesOverlay(s.result);
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
                  m.searchInput.property("value", nm);
                  m.dropdown.style("display", "none");
                  showWalesOverlay(constMap[nm]);
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
      return constNomSet[nm] ? "url(#crosshatch)" : "#f0f0f2";
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
        mapBounds = getMapBounds();
        Tooltip.show("map-tooltip", html, event.clientX, event.clientY, mapBounds);
      } else if (constNomSet[nm]) {
        mapBounds = getMapBounds();
        Tooltip.show("map-tooltip", "<strong>" + nm + "</strong><br><span style=\"color:#888\">Awaiting declaration</span>", event.clientX, event.clientY, mapBounds);
      } else { return; }
      d3.select(this).attr("stroke", "#222").attr("stroke-width", 1.5).raise();
    })
    .on("mousemove", function (event) {
      var el = document.getElementById("map-tooltip");
      if (el) Tooltip.position(el, event.clientX, event.clientY, mapBounds);
    })
    .on("mouseleave", function () {
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);
      Tooltip.hide("map-tooltip");
    })
    .on("click", function (event, d) {
      var r = constMap[d.properties.SENEDD_NM];
      if (r) showWalesOverlay(r);
    });

  // ── Overlay ──
  function showWalesOverlay(result) {
    createMapOverlay([{
      tabLabel: result.name,
      renderPanel: function (panel) {
        var cardContainer = panel.append("div");
        listResultCard(cardContainer.node(), result);
        cardContainer.select(".council-card__name").remove();
      }
    }]);
  }

  return m.svg.node();
}
