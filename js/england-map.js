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

  // Deduplicate local results by highest revision
  var byName = {};
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!byName[r.name] || (r.revision || 0) > (byName[r.name].revision || 0)) {
      byName[r.name] = r;
    }
  }
  var deduped = Object.values(byName);

  // Build lookup
  var ladNames = englandLad.features.map(function (f) { return f.properties.LAD25NM; });
  var countyNames = countyGeo.features.map(function (f) { return f.properties.CTY24NM; });
  var lookup = buildCouncilLookup(ladNames, countyNames);

  // Map result → geo feature name, split by layer
  var ladResults = {};
  var countyResults = {};
  var unmatched = [];

  for (var i = 0; i < deduped.length; i++) {
    var match = lookup.resolve(deduped[i]);
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
  // Map mayoral results to LAD features by name
  var mayoralLadResults = {};
  var mayoralVals = Object.values(mayoralByName);
  for (var mi = 0; mi < mayoralVals.length; mi++) {
    var mv = mayoralVals[mi];
    var mvNorm = normaliseName(mv.name);
    for (var fi = 0; fi < englandLad.features.length; fi++) {
      if (normaliseName(englandLad.features[fi].properties.LAD25NM) === mvNorm) {
        mayoralLadResults[englandLad.features[fi].properties.LAD25NM] = mv;
        break;
      }
    }
  }

  // Build nomination lookups (for distinguishing "awaiting" from "no election")
  var ladNominations = {};   // geoName → nomination
  var countyNominations = {};
  var mayoralLadNominations = {};
  var localNoms = options.localNominations || [];
  var mayoralNoms = options.mayoralNominations || [];

  for (var ni = 0; ni < localNoms.length; ni++) {
    var nom = localNoms[ni];
    var nomMatch = lookup.resolve(nom);
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
    var mnNorm = normaliseName(mn.name);
    for (var fi2 = 0; fi2 < englandLad.features.length; fi2++) {
      if (normaliseName(englandLad.features[fi2].properties.LAD25NM) === mnNorm) {
        mayoralLadNominations[englandLad.features[fi2].properties.LAD25NM] = mn;
        break;
      }
    }
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

  // ── Search ──
  setupMapSearch(m.searchInput, m.dropdown, m.searchWrap,
    function onNameSearch(query) {
      var q = query.toLowerCase();
      var matches = searchIndex.filter(function (s) {
        return s.label.toLowerCase().indexOf(q) >= 0;
      }).slice(0, 8);
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
            showOverlay(s.elections);
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
          var allElections = [];
          var seen = {};
          var districtEntry = pc.admin_district ? indexByNorm[normaliseName(pc.admin_district)] : null;
          var countyEntry = pc.admin_county ? indexByNorm[normaliseName(pc.admin_county)] : null;
          if (districtEntry) {
            for (var i = 0; i < districtEntry.elections.length; i++) {
              var key = districtEntry.elections[i].result.name + "|" + districtEntry.elections[i].type;
              if (!seen[key]) { seen[key] = true; allElections.push(districtEntry.elections[i]); }
            }
          }
          if (countyEntry) {
            for (var i = 0; i < countyEntry.elections.length; i++) {
              var key = countyEntry.elections[i].result.name + "|" + countyEntry.elections[i].type;
              if (!seen[key]) { seen[key] = true; allElections.push(countyEntry.elections[i]); }
            }
          }
          if (allElections.length > 0) {
            var label = pc.admin_district || pc.admin_county;
            m.searchInput.property("value", label);
            m.dropdown.style("display", "none");
            showOverlay(allElections);
          } else {
            m.dropdown.html('<div class="map-search__item map-search__item--empty">No elections found for ' + (pc.admin_district || postcode) + '</div>');
          }
        })
        .catch(function () {
          m.dropdown.html('<div class="map-search__item map-search__item--empty">Postcode lookup failed</div>');
        });
    }
  );

  // ── Filter tabs ──
  var filters = [
    { key: "district", label: "District" },
    { key: "county", label: "County" },
    { key: "mayoral", label: "Mayoral" },
  ];

  m.searchWrap.classed("map-search--has-filters", true);
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
    Tooltip.position(el, event.clientX, event.clientY, mapBounds);
  }
  function showAwaitingTooltip(event, name) {
    mapBounds = getMapBounds();
    Tooltip.show("map-tooltip", "<strong>" + name + "</strong><br><span style=\"color:#888\">Awaiting declaration</span>", event.clientX, event.clientY, mapBounds);
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
        .attr("fill", "#e8e8e8")
        .attr("stroke", "#e8e8e8")
        .attr("stroke-width", 0.5)
        .attr("class", "map-area");

      // County boundaries on top
      m.zoomGroup.append("g")
        .attr("class", "map-county-layer")
        .selectAll("path")
        .data(countyGeo.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", function (d) {
          var r = countyResults[d.properties.CTY24NM];
          if (r) return partyColour(r.winningParty);
          return countyNominations[d.properties.CTY24NM] ? "#d8d8dc" : "#f0f0f2";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .attr("class", function (d) {
          var nm = d.properties.CTY24NM;
          if (countyResults[nm]) return "map-area map-area--has-result";
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
          var r = countyResults[d.properties.CTY24NM];
          if (r) showOverlay(findAllElections(r.name));
        });
    } else {
      // District / Mayoral mode – LAD layer
      m.zoomGroup.append("g")
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
            return ladNominations[name] ? "#d8d8dc" : "#f0f0f2";
          } else if (mode === "mayoral") {
            var mr = mayoralLadResults[name];
            if (mr) return partyColour(mr.winningParty);
            return mayoralLadNominations[name] ? "#d8d8dc" : "#f0f0f2";
          }
          return "#f0f0f2";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.3)
        .attr("class", function (d) {
          var name = d.properties.LAD25NM;
          if (mode === "district") {
            if (ladResults[name]) return "map-area map-area--has-result";
            if (ladNominations[name]) return "map-area map-area--awaiting";
          } else if (mode === "mayoral") {
            if (mayoralLadResults[name]) return "map-area map-area--has-result";
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
          var name = d.properties.LAD25NM;
          if (mode === "district") {
            var r = ladResults[name];
            if (r) showOverlay(findAllElections(r.name));
          } else if (mode === "mayoral") {
            var mr = mayoralLadResults[name];
            if (mr) showOverlay(findAllElections(mr.name));
          }
        });
    }
  }

  // ── Overlay ──
  function showOverlay(elections) {
    var modeType = activeMode === "mayoral" ? "mayoral" : "council";
    var sorted = elections.slice().sort(function (a, b) {
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
          if (e.type !== "mayoral") {
            var badgeSpan = panel.append("div").attr("class", "map-overlay__title-row").append("span");
            gainHoldBadge(badgeSpan.node(), e.result, { fullNames: true });
          }
          var cardContainer = panel.append("div");
          if (e.type === "mayoral") {
            mayoralResultCard(cardContainer.node(), e.result);
          } else {
            councilResultCard(cardContainer.node(), e.result, { size: "full" });
          }
          cardContainer.select(".council-card__name").remove();
          cardContainer.selectAll(".council-card__badge").remove();
          cardContainer.selectAll(".council-card__header, .fptp-card__header").each(function () {
            if (this.children.length === 0) d3.select(this).remove();
          });
          cardContainer.selectAll(".council-card__hemicycle").style("margin-top", "0");
        }
      };
    });
    createMapOverlay(items);
  }

  // Initial render
  renderView("district");

  return m.svg.node();
}
