/**
 * England Election Map — D3 SVG Choropleth
 * Three views: District (LAD), County, Mayoral — toggled via filter tabs.
 * Requires: d3.js, party-config.js, election-map.js, council-lookup.js
 */

// Councils with special official names (Royal Boroughs, City status)
var SPECIAL_COUNCIL_NAMES = {
  "Greenwich": "Royal Borough of Greenwich",
  "Kensington & Chelsea": "Royal Borough of Kensington and Chelsea",
  "Kingston upon Thames": "Royal Borough of Kingston upon Thames",
  "Westminster": "City of Westminster",
  "Windsor and Maidenhead": "Royal Borough of Windsor and Maidenhead",
};

var SECTION_TITLES = {
  "Metro": "Metropolitan Borough Council",
  "Non-Met": "District Council",
  "London": "Borough Council",
  "Unitary": "Unitary Authority",
  "England": "County Council",
};

function englandMap(container, results, ladGeo, countyGeo, mayoralResults, options) {
  options = options || {};
  var width = options.width || 600;
  var height = options.height || 650;

  // Filter to England only (LAD codes starting with E)
  var englandLad = {
    type: "FeatureCollection",
    features: ladGeo.features.filter(function (f) {
      return f.properties.LAD25CD && f.properties.LAD25CD.startsWith("E");
    })
  };

  var m = createMapScaffold(container, width, height, englandLad, "Search area or postcode...");

  // Deduplicate local results (prefer result over rush, then highest revision)
  var deduped = dedupByRevision(results);
  var byName = {};
  for (var i = 0; i < deduped.length; i++) byName[deduped[i].name] = deduped[i];

  // Build ONS code → GeoJSON feature name reverse indices
  var ladCodeToName = {};
  for (var i = 0; i < englandLad.features.length; i++) {
    var p = englandLad.features[i].properties;
    ladCodeToName[p.LAD25CD] = p.LAD25NM;
  }
  var countyCodeToName = {};
  for (var i = 0; i < countyGeo.features.length; i++) {
    var p = countyGeo.features[i].properties;
    countyCodeToName[p.CTY24CD] = p.CTY24NM;
  }

  // Fuzzy fallback lookup (kept for unmatched entries)
  var ladNames = englandLad.features.map(function (f) { return f.properties.LAD25NM; });
  var countyNames = countyGeo.features.map(function (f) { return f.properties.CTY24NM; });
  var lookup = buildCouncilLookup(ladNames, countyNames);

  // Resolve a local result to { geoName, layer } via PA_ONS_LOOKUP, fallback to fuzzy
  function resolveLocal(result) {
    if (typeof PA_ONS_LOOKUP !== "undefined" && result.paId && PA_ONS_LOOKUP.localCouncils[result.paId]) {
      var onsCode = PA_ONS_LOOKUP.localCouncils[result.paId];
      if (ladCodeToName[onsCode]) return { geoName: ladCodeToName[onsCode], layer: "lad" };
      if (countyCodeToName[onsCode]) return { geoName: countyCodeToName[onsCode], layer: "county" };
    }
    // Fuzzy fallback
    var match = lookup.resolve(result);
    if (match) console.warn("Map: fuzzy fallback for", result.name, "(paId " + result.paId + ")");
    return match;
  }

  // Resolve a mayoral/nomination by number via PA_ONS_LOOKUP, fallback to fuzzy
  function resolveMayoral(item) {
    if (typeof PA_ONS_LOOKUP !== "undefined" && item.number != null && PA_ONS_LOOKUP.mayoralAreas[item.number]) {
      var onsCode = PA_ONS_LOOKUP.mayoralAreas[item.number];
      if (ladCodeToName[onsCode]) return ladCodeToName[onsCode];
    }
    // Fuzzy name fallback
    var norm = normaliseName(item.name);
    for (var i = 0; i < englandLad.features.length; i++) {
      if (normaliseName(englandLad.features[i].properties.LAD25NM) === norm) {
        console.warn("Map: fuzzy fallback for mayoral", item.name);
        return englandLad.features[i].properties.LAD25NM;
      }
    }
    return null;
  }

  // Map result → geo feature name, split by layer
  var ladResults = {};
  var countyResults = {};
  var unmatched = [];

  for (var i = 0; i < deduped.length; i++) {
    var match = resolveLocal(deduped[i]);
    if (match) {
      if (match.layer === "county") {
        countyResults[match.geoName] = deduped[i];
      } else {
        ladResults[match.geoName] = deduped[i];
      }
    } else {
      unmatched.push(deduped[i].name);
    }
  }

  if (unmatched.length > 0) {
    console.warn("Map: unmatched councils:", unmatched);
  }

  // Deduplicate mayoral results
  var mayoralByName = {};
  var mayoralArr = mayoralResults || [];
  for (var i = 0; i < mayoralArr.length; i++) {
    var mr = mayoralArr[i];
    if (mr.fileType !== "result") continue;
    if (!mayoralByName[mr.name] || (mr.revision || 0) > (mayoralByName[mr.name].revision || 0)) {
      mayoralByName[mr.name] = mr;
    }
  }
  // Map mayoral results to LAD features via ID lookup
  var mayoralLadResults = {};
  var mayoralVals = Object.values(mayoralByName);
  for (var mi = 0; mi < mayoralVals.length; mi++) {
    var mv = mayoralVals[mi];
    var geoName = resolveMayoral(mv);
    if (geoName) mayoralLadResults[geoName] = mv;
  }

  // Build nomination lookups (for distinguishing "awaiting" from "no election")
  var ladNominations = {};   // geoName → nomination
  var countyNominations = {};
  var mayoralLadNominations = {};
  var localNoms = options.localNominations || [];
  var mayoralNoms = options.mayoralNominations || [];

  for (var ni = 0; ni < localNoms.length; ni++) {
    var nom = localNoms[ni];
    var nomMatch = resolveLocal(nom);
    if (nomMatch) {
      if (nomMatch.layer === "county") {
        countyNominations[nomMatch.geoName] = nom;
      } else {
        ladNominations[nomMatch.geoName] = nom;
      }
    }
  }
  for (var mi2 = 0; mi2 < mayoralNoms.length; mi2++) {
    var mn = mayoralNoms[mi2];
    var geoName = resolveMayoral(mn);
    if (geoName) mayoralLadNominations[geoName] = mn;
  }

  // Build a searchable index: normalised name → { label, elections: [{result, type}] }
  var searchIndex = [];
  var indexByNorm = {};
  function addToIndex(label, result, electionType) {
    var norm = normaliseName(label);
    if (!indexByNorm[norm]) {
      indexByNorm[norm] = { label: label, elections: [] };
      searchIndex.push(indexByNorm[norm]);
    }
    indexByNorm[norm].elections.push({ result: result, type: electionType });
  }
  // District councils
  var ladKeys = Object.keys(ladResults);
  for (var i = 0; i < ladKeys.length; i++) {
    addToIndex(ladResults[ladKeys[i]].name, ladResults[ladKeys[i]], "council");
  }
  // County councils
  var ctyKeys = Object.keys(countyResults);
  for (var i = 0; i < ctyKeys.length; i++) {
    addToIndex(countyResults[ctyKeys[i]].name, countyResults[ctyKeys[i]], "council");
  }
  // Mayoral results
  for (var mi = 0; mi < mayoralVals.length; mi++) {
    var mnorm = normaliseName(mayoralVals[mi].name);
    if (indexByNorm[mnorm]) {
      indexByNorm[mnorm].elections.push({ result: mayoralVals[mi], type: "mayoral" });
    } else {
      addToIndex(mayoralVals[mi].name, mayoralVals[mi], "mayoral");
    }
  }
  // Nominated-but-no-result councils (for search)
  var ladNomKeys = Object.keys(ladNominations);
  for (var ni = 0; ni < ladNomKeys.length; ni++) {
    var gnm = ladNomKeys[ni];
    if (!ladResults[gnm]) {
      var nom = ladNominations[gnm];
      addToIndex(nom.name, { name: nom.name, type: nom.type, _awaiting: true }, "council");
    }
  }
  var ctyNomKeys = Object.keys(countyNominations);
  for (var ni2 = 0; ni2 < ctyNomKeys.length; ni2++) {
    var gnm2 = ctyNomKeys[ni2];
    if (!countyResults[gnm2]) {
      var nom2 = countyNominations[gnm2];
      addToIndex(nom2.name, { name: nom2.name, type: nom2.type, _awaiting: true }, "council");
    }
  }
  var mayNomKeys = Object.keys(mayoralLadNominations);
  for (var ni3 = 0; ni3 < mayNomKeys.length; ni3++) {
    var gnm3 = mayNomKeys[ni3];
    if (!mayoralLadResults[gnm3]) {
      var nom3 = mayoralLadNominations[gnm3];
      var mnorm2 = normaliseName(nom3.name);
      if (!indexByNorm[mnorm2]) {
        addToIndex(nom3.name, { name: nom3.name, _awaiting: true }, "mayoral");
      }
    }
  }

  // Build a LAD→county mapping (which county contains each LAD centroid)
  var ladToCounty = {};
  for (var li = 0; li < englandLad.features.length; li++) {
    var centroid = d3.geoCentroid(englandLad.features[li]);
    for (var ci = 0; ci < countyGeo.features.length; ci++) {
      if (d3.geoContains(countyGeo.features[ci], centroid)) {
        ladToCounty[englandLad.features[li].properties.LAD25NM] = countyGeo.features[ci].properties.CTY24NM;
        break;
      }
    }
  }

  // Helper: find all elections for an area by name (includes county + mayoral)
  function findAllElections(areaName) {
    var elections = [];
    var seen = {};
    var norm = normaliseName(areaName);
    var entry = indexByNorm[norm];
    if (entry) {
      for (var i = 0; i < entry.elections.length; i++) {
        var key = entry.elections[i].result.name + "|" + entry.elections[i].type;
        if (!seen[key]) { seen[key] = true; elections.push(entry.elections[i]); }
      }
    }
    var countyName = ladToCounty[areaName];
    if (countyName) {
      var countyEntry = indexByNorm[normaliseName(countyName)];
      if (countyEntry) {
        for (var i = 0; i < countyEntry.elections.length; i++) {
          var key = countyEntry.elections[i].result.name + "|" + countyEntry.elections[i].type;
          if (!seen[key]) { seen[key] = true; elections.push(countyEntry.elections[i]); }
        }
      }
    }
    return elections;
  }

  // Track current active filter mode
  var activeMode = "district";
  var switchFilter = null; // assigned after filter tabs are built

  // Resolve the best filter mode for a name and switch if needed
  function findFeatureAndSwitch(name) {
    var feature = findFeature(name, activeMode);
    if (feature) return feature;
    var modes = ["district", "county", "mayoral"];
    for (var i = 0; i < modes.length; i++) {
      if (modes[i] === activeMode) continue;
      feature = findFeature(name, modes[i]);
      if (feature) {
        if (switchFilter) switchFilter(modes[i]);
        return feature;
      }
    }
    return null;
  }

  // ── Search ──
  setupMapSearch(m.searchInput, m.dropdown, m.searchWrap,
    function onNameSearch(query) {
      var matches = rankSearchMatches(searchIndex, query);
      showMapSearchResults(m.dropdown, matches.map(function (s) {
        var types = s.elections.map(function (e) {
          return e.type === "mayoral" ? "Mayoral" : "Council";
        }).join(", ");
        return {
          label: s.label,
          typesText: types,
          onClick: function () {
            m.dropdown.style("display", "none");
            m.searchInput.property("value", s.label);
            var feature = findFeatureAndSwitch(s.label);
            zoomThenOverlay(feature, function () { showOverlay(s.elections); });
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
          // Geometric lookup: find which LAD and county contain this coordinate
          var allElections = [];
          var seen = {};
          if (pc.longitude && pc.latitude) {
            var pt = [pc.longitude, pc.latitude];
            // Check LAD features
            for (var i = 0; i < englandLad.features.length; i++) {
              if (d3.geoContains(englandLad.features[i], pt)) {
                var ladName = englandLad.features[i].properties.LAD25NM;
                var ladEntry = indexByNorm[normaliseName(ladName)];
                if (ladEntry) {
                  for (var j = 0; j < ladEntry.elections.length; j++) {
                    var key = ladEntry.elections[j].result.name + "|" + ladEntry.elections[j].type;
                    if (!seen[key]) { seen[key] = true; allElections.push(ladEntry.elections[j]); }
                  }
                }
                break;
              }
            }
            // Check county features
            for (var ci = 0; ci < countyGeo.features.length; ci++) {
              if (d3.geoContains(countyGeo.features[ci], pt)) {
                var ctyName = countyGeo.features[ci].properties.CTY24NM;
                var ctyEntry = indexByNorm[normaliseName(ctyName)];
                if (ctyEntry) {
                  for (var j = 0; j < ctyEntry.elections.length; j++) {
                    var key = ctyEntry.elections[j].result.name + "|" + ctyEntry.elections[j].type;
                    if (!seen[key]) { seen[key] = true; allElections.push(ctyEntry.elections[j]); }
                  }
                }
                break;
              }
            }
          }
          if (allElections.length > 0) {
            // Group elections by area name for dropdown items
            var areaMap = {};
            allElections.forEach(function (e) {
              var name = e.result.name;
              if (!areaMap[name]) areaMap[name] = [];
              areaMap[name].push(e);
            });
            var dropdownItems = Object.keys(areaMap).map(function (name) {
              var elecs = areaMap[name];
              var types = elecs.map(function (e) {
                return e.type === "mayoral" ? "Mayoral" : "Council";
              }).join(", ");
              return {
                label: name,
                typesText: types,
                onClick: function () {
                  m.dropdown.style("display", "none");
                  m.searchInput.property("value", name);
                  var feature = findFeatureAndSwitch(name);
                  zoomThenOverlay(feature, function () { showOverlay(elecs); });
                }
              };
            });
            showMapSearchResults(m.dropdown, dropdownItems);
          } else {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">No elections found for ' + (pc.admin_district || postcode) + '</div>');
          }
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
          var districts = data.result.admin_district || [];
          var counties = data.result.admin_county || [];
          var allNames = districts.concat(counties);
          var seen = {};
          var dropdownItems = [];
          allNames.forEach(function (name) {
            if (!name || seen[name]) return;
            seen[name] = true;
            var entry = indexByNorm[normaliseName(name)];
            if (entry) {
              var types = entry.elections.map(function (e) {
                return e.type === "mayoral" ? "Mayoral" : "Council";
              }).join(", ");
              dropdownItems.push({
                label: entry.label,
                typesText: types,
                onClick: function () {
                  m.dropdown.style("display", "none");
                  m.searchInput.property("value", entry.label);
                  var feature = findFeatureAndSwitch(entry.label);
                  zoomThenOverlay(feature, function () { showOverlay(entry.elections); });
                }
              });
            }
          });
          if (dropdownItems.length > 0) {
            showMapSearchResults(m.dropdown, dropdownItems);
          } else {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">No elections found for ' + clean + '</div>');
          }
        })
        .catch(function () {
          m.dropdown.html('<div class="map-search__item map-search__item--empty">Outcode lookup failed</div>');
        });
    }
  );

  // ── Filter tabs ──
  var filters = [
    { key: "district", label: "District" },
    { key: "county", label: "County" },
    { key: "mayoral", label: "Mayoral" },
  ];

  var filterBar = m.el.insert("div", ".map-wrapper").attr("class", "map-filters");
  filters.forEach(function (f) {
    filterBar.append("button")
      .attr("class", "map-filter" + (f.key === "district" ? " map-filter--active" : ""))
      .attr("data-filter", f.key)
      .text(f.label)
      .on("click", function () {
        filterBar.selectAll(".map-filter").classed("map-filter--active", false);
        d3.select(this).classed("map-filter--active", true);
        activeMode = f.key;
        renderView(f.key);
      });
  });

  // Wire up filter switching for search
  switchFilter = function (mode) {
    activeMode = mode;
    filterBar.selectAll(".map-filter").classed("map-filter--active", false);
    filterBar.select('[data-filter="' + mode + '"]').classed("map-filter--active", true);
    renderView(mode);
  };

  // ── Tooltip helper ──
  var mapBounds;
  function getMapBounds() {
    var rect = m.svg.node().getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }
  function showEnglandTooltip(event, result) {
    mapBounds = getMapBounds();
    var el = Tooltip.show("map-tooltip", "<strong>" + result.name + "</strong><br>", event.clientX, event.clientY, mapBounds);
    var badgeContainer = d3.select(el).append("span");
    gainHoldBadge(badgeContainer.node(), {
      winningParty: result.winningParty,
      gainOrHold: result.gainOrHold === "hold" ? "no change" : result.gainOrHold,
      sittingParty: result.sittingParty,
    });
    d3.select(el).append("div").style("color", "#888").style("font-size", "11px").style("font-style", "italic").style("margin-top", "4px").text("Click for full results");
    Tooltip.position(el, event.clientX, event.clientY, mapBounds);
  }
  function showAwaitingTooltip(event, name) {
    mapBounds = getMapBounds();
    Tooltip.show("map-tooltip", "<strong>" + name + "</strong><br><span style=\"color:#888\">Awaiting declaration</span>", event.clientX, event.clientY, mapBounds);
  }

  function areaStrokeColour(result, hasNomination) {
    if (result && result.gainOrHold === "gain") return "#000";
    if (!result && !hasNomination) return "#d1d1d1";
    return "#fff";
  }

  // ── Render view ──
  function renderView(mode) {
    m.zoomGroup.selectAll("*").remove();

    if (mode === "county") {
      // Grey LAD backdrop (borderless) so non-county areas still show England's shape
      m.zoomGroup.append("g")
        .attr("class", "map-lad-layer")
        .selectAll("path")
        .data(englandLad.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", "#fff")
        .attr("stroke", "none")
        .attr("stroke-width", 0)
        .attr("class", "map-area");

      // County boundaries on top
      var countyPaths = m.zoomGroup.append("g")
        .attr("class", "map-county-layer")
        .selectAll("path")
        .data(countyGeo.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", function (d) {
          var r = countyResults[d.properties.CTY24NM];
          if (r) return partyColour(r.winningParty);
          return countyNominations[d.properties.CTY24NM] ? "url(#crosshatch)" : "#fff";
        })
        .attr("stroke", function (d) {
          var nm = d.properties.CTY24NM;
          var r = countyResults[d.properties.CTY24NM];
          return areaStrokeColour(r, countyNominations[nm]);
        })
        .attr("stroke-width", function (d) {
          var r = countyResults[d.properties.CTY24NM];
          return (r && r.gainOrHold === "gain") ? 1 : 0.5;
        })
        .attr("class", function (d) {
          var nm = d.properties.CTY24NM;
          var r = countyResults[nm];
          if (r) return "map-area map-area--has-result";
          if (countyNominations[nm]) return "map-area map-area--awaiting";
          return "map-area";
        })
        .on("mouseenter", function (event, d) {
          var nm = d.properties.CTY24NM;
          var r = countyResults[nm];
          if (r) {
            showEnglandTooltip(event, r);
          } else if (countyNominations[nm]) {
            showAwaitingTooltip(event, nm);
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
          var nm = d.properties.CTY24NM;
          var r = countyResults[nm];
          var feature = d;
          if (r) {
            zoomThenOverlay(feature, function () { showOverlay(findAllElections(r.name)); });
          } else if (countyNominations[nm]) {
            zoomThenOverlay(feature, function () { showAwaitingOverlay(countyNominations[nm].name, countyNominations[nm].type); });
          }
        });
      countyPaths.filter(function (d) {
        var r = countyResults[d.properties.CTY24NM];
        return r && r.gainOrHold === "gain";
      }).raise();
    } else {
      // District / Mayoral mode – LAD layer
      var ladPaths = m.zoomGroup.append("g")
        .attr("class", "map-lad-layer")
        .selectAll("path")
        .data(englandLad.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", function (d) {
          var name = d.properties.LAD25NM;
          if (mode === "district") {
            var r = ladResults[name];
            if (r) return partyColour(r.winningParty);
            return ladNominations[name] ? "url(#crosshatch)" : "#fff";
          } else if (mode === "mayoral") {
            var mr = mayoralLadResults[name];
            if (mr) return partyColour(mr.winningParty);
            return mayoralLadNominations[name] ? "url(#crosshatch)" : "#fff";
          }
          return "#fff";
        })
        .attr("stroke", function (d) {
          var name = d.properties.LAD25NM;
          var r = mode === "district" ? ladResults[name] : mode === "mayoral" ? mayoralLadResults[name] : null;
          var hasNom = mode === "district" ? ladNominations[name] : mode === "mayoral" ? mayoralLadNominations[name] : null;
          return areaStrokeColour(r, hasNom);
        })
        .attr("stroke-width", function (d) {
          var name = d.properties.LAD25NM;
          var r = mode === "district" ? ladResults[name] : mode === "mayoral" ? mayoralLadResults[name] : null;
          return (r && r.gainOrHold === "gain") ? 1 : 0.3;
        })
        .attr("class", function (d) {
          var name = d.properties.LAD25NM;
          if (mode === "district") {
            var r = ladResults[name];
            if (r) return "map-area map-area--has-result";
            if (ladNominations[name]) return "map-area map-area--awaiting";
          } else if (mode === "mayoral") {
            var mr = mayoralLadResults[name];
            if (mr) return "map-area map-area--has-result";
            if (mayoralLadNominations[name]) return "map-area map-area--awaiting";
          }
          return "map-area";
        })
        .on("mouseenter", function (event, d) {
          var name = d.properties.LAD25NM;
          var r = mode === "district" ? ladResults[name] : mode === "mayoral" ? mayoralLadResults[name] : null;
          if (r) {
            showEnglandTooltip(event, r);
          } else {
            var hasNom = mode === "district" ? ladNominations[name] : mode === "mayoral" ? mayoralLadNominations[name] : null;
            if (!hasNom) return;
            showAwaitingTooltip(event, name);
          }
        })
        .on("mousemove", function (event) {
          var el = document.getElementById("map-tooltip");
          if (el) Tooltip.position(el, event.clientX, event.clientY, mapBounds);
        })
        .on("mouseleave", function () {
          Tooltip.hide("map-tooltip");
        })
        .on("click", function (event, d) {
          var name = d.properties.LAD25NM;
          var feature = d;
          if (mode === "district") {
            var r = ladResults[name];
            if (r) { zoomThenOverlay(feature, function () { showOverlay(findAllElections(r.name)); }); }
            else if (ladNominations[name]) { zoomThenOverlay(feature, function () { showAwaitingOverlay(ladNominations[name].name, ladNominations[name].type); }); }
          } else if (mode === "mayoral") {
            var mr = mayoralLadResults[name];
            if (mr) { zoomThenOverlay(feature, function () { showOverlay(findAllElections(mr.name)); }); }
            else if (mayoralLadNominations[name]) { zoomThenOverlay(feature, function () { showAwaitingOverlay(mayoralLadNominations[name].name, "Mayoral"); }); }
          }
        });
      ladPaths.filter(function (d) {
        var name = d.properties.LAD25NM;
        var r = mode === "district" ? ladResults[name] : mode === "mayoral" ? mayoralLadResults[name] : null;
        return r && r.gainOrHold === "gain";
      }).raise();
    }

    // Rebuild legend for current view
    updateLegend(mode);

    // Zoom to fit visible areas
    var visibleFeatures = getVisibleFeatures(mode);
    if (visibleFeatures.length > 0) {
      zoomToFeatures(m.svg, m.zoom, m.path, visibleFeatures, { duration: 600 });
    } else {
      m.svg.transition().duration(600).call(m.zoom.transform, d3.zoomIdentity);
    }
  }

  // ── Legend ──
  function getVisibleParties(mode) {
    var counts = {};
    var results;
    if (mode === "county") results = countyResults;
    else if (mode === "mayoral") results = mayoralLadResults;
    else results = ladResults;

    for (var key in results) {
      var wp = results[key].winningParty;
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

  function getVisibleFeatures(mode) {
    if (mode === "county") {
      return countyGeo.features.filter(function (f) {
        return countyResults[f.properties.CTY24NM] || countyNominations[f.properties.CTY24NM];
      });
    } else if (mode === "mayoral") {
      return englandLad.features.filter(function (f) {
        return mayoralLadResults[f.properties.LAD25NM] || mayoralLadNominations[f.properties.LAD25NM];
      });
    } else {
      return englandLad.features.filter(function (f) {
        return ladResults[f.properties.LAD25NM] || ladNominations[f.properties.LAD25NM];
      });
    }
  }

  function updateLegend(mode) {
    var parties = getVisibleParties(mode);
    buildMapLegend(m.wrapper, parties);
  }

  // ── Feature lookup for zoom ──
  // Finds a GeoJSON feature by geo name or result name
  function findFeature(name, mode) {
    // Direct geo name match
    if (mode === "county") {
      for (var i = 0; i < countyGeo.features.length; i++) {
        if (countyGeo.features[i].properties.CTY24NM === name) return countyGeo.features[i];
      }
    }
    for (var i = 0; i < englandLad.features.length; i++) {
      if (englandLad.features[i].properties.LAD25NM === name) return englandLad.features[i];
    }
    // Reverse lookup: result name → geo name
    if (mode === "county") {
      for (var gn in countyResults) {
        if (countyResults[gn].name === name) {
          for (var ci = 0; ci < countyGeo.features.length; ci++) {
            if (countyGeo.features[ci].properties.CTY24NM === gn) return countyGeo.features[ci];
          }
        }
      }
    }
    for (var gn in ladResults) {
      if (ladResults[gn].name === name) {
        for (var li = 0; li < englandLad.features.length; li++) {
          if (englandLad.features[li].properties.LAD25NM === gn) return englandLad.features[li];
        }
      }
    }
    for (var gn in mayoralLadResults) {
      if (mayoralLadResults[gn].name === name) {
        for (var mi = 0; mi < englandLad.features.length; mi++) {
          if (englandLad.features[mi].properties.LAD25NM === gn) return englandLad.features[mi];
        }
      }
    }
    return null;
  }

  // Helper: zoom to a feature then open an overlay
  function zoomThenOverlay(feature, overlayFn) {
    if (!feature) { overlayFn(); return; }
    // Dim other areas to highlight the selected one
    var pathEl = m.zoomGroup.selectAll(".map-area").filter(function (d) { return d === feature; }).node();
    dimOtherAreas(m.zoomGroup, pathEl);
    zoomToFeature(m.svg, m.zoom, m.path, feature, {
      onEnd: overlayFn
    });
  }

  // ── Overlay ──
  var englandOverlayApi = null;

  // Click-away: clicking empty map background closes overlay
  m.svg.on("click", function (event) {
    if (!englandOverlayApi) return;
    var target = event.target;
    if (!target.classList || !target.classList.contains("map-area")) {
      englandOverlayApi.close();
      englandOverlayApi = null;
    }
  });

  function showOverlay(elections) {
    // If all elections are awaiting, show awaiting overlay
    var allAwaiting = elections.every(function (e) { return e.result._awaiting; });
    if (allAwaiting && elections.length > 0) {
      var first = elections[0].result;
      showAwaitingOverlay(first.name, first.type);
      return;
    }
    // Filter to only declared results
    var declared = elections.filter(function (e) { return !e.result._awaiting; });
    var modeType = activeMode === "mayoral" ? "mayoral" : "council";
    var sorted = declared.slice().sort(function (a, b) {
      if (a.type === modeType && b.type !== modeType) return -1;
      if (b.type === modeType && a.type !== modeType) return 1;
      return 0;
    });

    var items = sorted.map(function (e) {
      var tabLabel = e.type === "mayoral"
        ? e.result.name + " Mayoral"
        : (SPECIAL_COUNCIL_NAMES[e.result.name] || e.result.name + " " + (SECTION_TITLES[e.result.type] || "Council"));
      return {
        tabLabel: tabLabel,
        renderPanel: function (panel) {
          if (e.type === "mayoral") {
            var badgeContainer = panel.append("div");
            mayoralResultCard(badgeContainer.node(), e.result);
            badgeContainer.selectAll(".fptp-card__header").each(function () {
              if (this.children.length === 0) d3.select(this).remove();
            });
          } else {
            // Badge
            var badgeSpan = panel.append("div").style("margin-bottom", "4px").append("span");
            gainHoldBadge(badgeSpan.node(), e.result, { fullNames: true });

            // Toggle: Change / Seats
            var council = e.result;
            var toggleRow = panel.append("div")
              .attr("class", "party-strip-toggle")
              .style("margin", "12px 0 8px")
              .style("position", "relative")
              .style("z-index", "2");
            var changeBtn = toggleRow.append("button")
              .attr("class", "party-strip-toggle__btn party-strip-toggle__btn--active")
              .text("Change");
            var seatsBtn = toggleRow.append("button")
              .attr("class", "party-strip-toggle__btn")
              .text("Seats");

            var contentDiv = panel.append("div");

            function renderChangeView() {
              contentDiv.html("");
              if (council.changes) {
                var barEl = contentDiv.append("div").style("margin-top", "12px");
                changeBarChart(barEl.node(), council.changes);
              }
            }

            function renderSeatsView() {
              contentDiv.html("");
              var parties = (council.newCouncil || []).slice().sort(function (a, b) { return b.seats - a.seats; });
              if (parties.length === 0) return;

              var totalSeats = parties.reduce(function (s, p) { return s + p.seats; }, 0);
              var majority = Math.ceil(totalSeats / 2) + 1;
              var maxSeats = parties[0].seats;

              var barHeight = 28;
              var gap = 6;
              var labelWidth = 50;
              var width = 600;
              var chartLeft = labelWidth;
              var chartWidth = width - labelWidth - 10;
              var height = parties.length * (barHeight + gap) + gap + 24;

              var scale = chartWidth / Math.max(maxSeats, majority);

              var seatsSvg = contentDiv.append("div").style("margin-top", "12px")
                .append("svg")
                .attr("viewBox", "0 0 " + width + " " + height)
                .attr("width", "100%")
                .attr("preserveAspectRatio", "xMidYMid meet");

              var majX = chartLeft + majority * scale;

              parties.forEach(function (p, i) {
                var y = gap + i * (barHeight + gap);
                var barW = Math.max(p.seats * scale, 1);
                var hex = partyColour(p.name);

                // Party label
                seatsSvg.append("text")
                  .attr("x", chartLeft - 6)
                  .attr("y", y + barHeight / 2)
                  .attr("text-anchor", "end")
                  .attr("dominant-baseline", "central")
                  .attr("font-size", 15)
                  .attr("font-weight", 600)
                  .attr("fill", "#444")
                  .attr("font-family", "'Inter', sans-serif")
                  .text(partyShortName(p.name));

                // Bar
                seatsSvg.append("rect")
                  .attr("x", chartLeft)
                  .attr("y", y)
                  .attr("width", barW)
                  .attr("height", barHeight)
                  .attr("rx", 2)
                  .attr("fill", hex)
                  .attr("opacity", 0.85);

                // Seat count label
                var minBarForLabel = 30;
                if (barW >= minBarForLabel) {
                  var col = d3.color(hex);
                  var lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
                  var textFill = lum > 160 ? "#222" : "#fff";
                  // Shift label left if it would overlap the majority line
                  var labelX = chartLeft + barW - 5;
                  if (Math.abs(labelX - majX) < 16) {
                    labelX = majX - 16;
                  }
                  seatsSvg.append("text")
                    .attr("x", labelX)
                    .attr("y", y + barHeight / 2)
                    .attr("text-anchor", "end")
                    .attr("dominant-baseline", "central")
                    .attr("font-size", 14)
                    .attr("font-weight", 700)
                    .attr("fill", textFill)
                    .attr("font-family", "'Inter', sans-serif")
                    .text(p.seats);
                } else {
                  seatsSvg.append("text")
                    .attr("x", chartLeft + barW + 5)
                    .attr("y", y + barHeight / 2)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "central")
                    .attr("font-size", 14)
                    .attr("font-weight", 700)
                    .attr("fill", "#444")
                    .attr("font-family", "'Inter', sans-serif")
                    .text(p.seats);
                }
              });

              // Majority line
              var barsBottom = gap + parties.length * (barHeight + gap);
              seatsSvg.append("line")
                .attr("x1", majX)
                .attr("y1", 0)
                .attr("x2", majX)
                .attr("y2", barsBottom)
                .attr("stroke", "#333")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "4,3");

              var majLabel = majority + " for majority";
              var majAnchor = "middle";
              var majTextX = majX;
              if (majX > width - 60) { majAnchor = "end"; majTextX = majX; }
              seatsSvg.append("text")
                .attr("x", majTextX)
                .attr("y", barsBottom + 14)
                .attr("text-anchor", majAnchor)
                .attr("font-size", 11)
                .attr("fill", "#888")
                .attr("font-family", "'Inter', sans-serif")
                .text(majLabel);
            }

            changeBtn.on("click", function () {
              changeBtn.classed("party-strip-toggle__btn--active", true);
              seatsBtn.classed("party-strip-toggle__btn--active", false);
              renderChangeView();
            });
            seatsBtn.on("click", function () {
              seatsBtn.classed("party-strip-toggle__btn--active", true);
              changeBtn.classed("party-strip-toggle__btn--active", false);
              renderSeatsView();
            });

            // Default: change view
            renderChangeView();

            // Declaration time
            if (council.declarationTime) {
              var t = new Date(council.declarationTime);
              var dateStr = t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
              var timeStr = t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
              panel.append("div")
                .attr("class", "council-card__declared")
                .text("Declared " + timeStr + ", " + dateStr);
            }
          }
        }
      };
    });
    englandOverlayApi = createMapOverlay(items, { container: m.el, onClose: function () {
      englandOverlayApi = null;
      resetAreaDim(m.zoomGroup);
    }});
  }

  function showAwaitingOverlay(name, type) {
    var tabLabel = SPECIAL_COUNCIL_NAMES[name] || name + " " + (SECTION_TITLES[type] || "Council");
    englandOverlayApi = createMapOverlay([{
      tabLabel: tabLabel,
      renderPanel: function (panel) {
        panel.append("div")
          .attr("class", "map-overlay__awaiting")
          .html("<p style=\"color:#888; text-align:center; padding:40px 20px; font-size:15px;\">Awaiting declaration</p>");
      }
    }], { container: m.el, onClose: function () {
      englandOverlayApi = null;
      resetAreaDim(m.zoomGroup);
    }});
  }

  // Initial render
  renderView("district");

  return m.svg.node();
}
