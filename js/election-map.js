/**
 * Election Map — shared helpers
 * Provides scaffold, search, overlay, and tooltip utilities used by
 * england-map.js, scotland-map.js, and wales-map.js.
 * Requires: d3.js
 */

/**
 * Create the full map scaffold: search bar, wrapper, SVG, zoom, tooltip.
 * Returns an object with all DOM references:
 *   { el, searchWrap, searchInput, dropdown, wrapper, tooltip, svg, zoomGroup, zoom }
 */
function createMapScaffold(container, width, height, fitGeo, searchPlaceholder) {
  var el = d3.select(container);
  el.selectAll("*").remove();

  var projection = d3.geoMercator().fitSize([width, height], fitGeo);
  var path = d3.geoPath().projection(projection);

  // Search bar
  var searchWrap = el.append("div").attr("class", "map-search");
  var searchInput = searchWrap.append("input")
    .attr("class", "map-search__input")
    .attr("type", "text")
    .attr("placeholder", searchPlaceholder || "Search...");
  var searchBtn = searchWrap.append("button").attr("class", "map-search__btn").attr("type", "button").attr("aria-label", "Search");
  searchBtn.html('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>');
  var dropdown = searchWrap.append("div").attr("class", "map-search__dropdown");

  // Map wrapper
  var wrapper = el.append("div").attr("class", "map-wrapper");
  var svg = wrapper.append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  var zoomGroup = svg.append("g").attr("class", "map-zoom-group");

  // Crosshatch pattern for "awaiting declaration" areas
  var defs = svg.append("defs");
  var hatch = defs.append("pattern")
    .attr("id", "crosshatch")
    .attr("width", 8).attr("height", 8)
    .attr("patternUnits", "userSpaceOnUse");
  hatch.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#e0e0e0");
  hatch.append("path").attr("d", "M0,0 l8,8 M8,0 l-8,8")
    .attr("stroke", "#888").attr("stroke-width", 1.2).attr("stroke-linecap", "square");

  var zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[-50, -50], [width + 50, height + 50]])
    .on("zoom", function (event) {
      zoomGroup.attr("transform", event.transform);
    });
  svg.call(zoom);

  // Zoom controls
  var controls = wrapper.append("div").attr("class", "map-zoom-controls");
  controls.append("button").attr("class", "map-zoom-btn").text("+")
    .on("click", function () { svg.transition().duration(300).call(zoom.scaleBy, 1.5); });
  controls.append("button").attr("class", "map-zoom-btn").text("\u2212")
    .on("click", function () { svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.5); });
  controls.append("button").attr("class", "map-zoom-btn map-zoom-btn--reset").text("\u21BA")
    .on("click", function () { svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity); });

  return {
    el: el,
    projection: projection,
    path: path,
    searchWrap: searchWrap,
    searchInput: searchInput,
    dropdown: dropdown,
    wrapper: wrapper,
    svg: svg,
    zoomGroup: zoomGroup,
    zoom: zoom
  };
}

/**
 * Wire up search input: name matching + postcode detection with debounce.
 *   onNameSearch(query)    — called for non-postcode text
 *   onPostcode(postcode)   — called when a UK postcode is detected
 *   onOutcode(outcode)     — called when a UK outcode (partial postcode) is detected
 */
function setupMapSearch(searchInput, dropdown, searchWrap, onNameSearch, onPostcode, onOutcode) {
  var debounceTimer = null;
  var postcodePattern = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
  var outcodePattern = /^[A-Za-z]{1,2}\d[A-Za-z\d]?$/;

  function triggerSearch() {
    // If dropdown is visible with a result, click the first item
    if (dropdown.style("display") === "block") {
      var firstItem = dropdown.select(".map-search__item:not(.map-search__item--empty)");
      if (!firstItem.empty()) {
        firstItem.node().click();
        return;
      }
    }
    // Otherwise trigger a fresh search
    var val = searchInput.property("value").trim();
    clearTimeout(debounceTimer);
    if (!val) { dropdown.style("display", "none"); return; }
    if (postcodePattern.test(val)) {
      onPostcode(val);
    } else if (outcodePattern.test(val)) {
      onOutcode(val);
    } else {
      onNameSearch(val);
    }
  }

  searchInput.on("input", function () {
    var val = this.value.trim();
    clearTimeout(debounceTimer);
    if (!val) { dropdown.style("display", "none"); return; }
    if (postcodePattern.test(val)) {
      debounceTimer = setTimeout(function () { onPostcode(val); }, 400);
    } else if (outcodePattern.test(val)) {
      debounceTimer = setTimeout(function () { onOutcode(val); }, 400);
    } else {
      onNameSearch(val);
    }
  });

  // Search button click
  searchWrap.select(".map-search__btn").on("click", triggerSearch);

  document.addEventListener("click", function (e) {
    if (!searchWrap.node().contains(e.target)) {
      dropdown.style("display", "none");
    }
  });
}

/**
 * Rank search matches: starts-with > word-boundary > substring, then alphabetical.
 */
function rankSearchMatches(searchIndex, query) {
  var q = query.toLowerCase();
  return searchIndex.filter(function (s) {
    return s.label.toLowerCase().indexOf(q) >= 0;
  }).sort(function (a, b) {
    var al = a.label.toLowerCase(), bl = b.label.toLowerCase();
    var aRank = al.indexOf(q) === 0 ? 0 : (al.indexOf(" " + q) >= 0 || al.indexOf("-" + q) >= 0) ? 1 : 2;
    var bRank = bl.indexOf(q) === 0 ? 0 : (bl.indexOf(" " + q) >= 0 || bl.indexOf("-" + q) >= 0) ? 1 : 2;
    if (aRank !== bRank) return aRank - bRank;
    return al.localeCompare(bl);
  }).slice(0, 8);
}

/**
 * Show a list of name-match results in the dropdown.
 *   matches: [{label, typesText, onClick}]
 */
function showMapSearchResults(dropdown, matches) {
  if (matches.length === 0) {
    dropdown.style("display", "block")
      .html('<div class="map-search__item map-search__item--empty">No results</div>');
    return;
  }
  dropdown.style("display", "block").html("");
  matches.forEach(function (m) {
    var html = "<strong>" + m.label + "</strong>";
    if (m.typesText) html += " <span class='map-search__types'>" + m.typesText + "</span>";
    dropdown.append("div")
      .attr("class", "map-search__item")
      .html(html)
      .on("click", m.onClick);
  });
}

/**
 * Create a tabbed overlay panel below the map.
 *   items: [{tabLabel, renderPanel(panelEl), tabKey?}]
 *   options.container — D3 selection of the map section's root element (panel appended here after .map-wrapper)
 *   options.onClose   — callback when overlay is dismissed
 *   Returns an API: { overlay, activateTab(idx), addOrReplaceTab(key, label, renderFn), close() }
 */
function createMapOverlay(items, options) {
  options = options || {};
  var container = options.container || d3.select(".map-wrapper").node().parentNode;
  if (container.select) {
    // D3 selection
    container.select(".map-overlay").remove();
  } else {
    d3.select(container).select(".map-overlay").remove();
    container = d3.select(container);
  }

  var overlay = container.append("div")
    .attr("class", "map-overlay");

  var escHandler = function (e) {
    if (e.key === "Escape") close();
  };

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", escHandler);
    if (options.onClose) options.onClose();
  }

  // Close button – floated top-right, sticky so it stays visible on scroll
  overlay.append("button")
    .attr("class", "map-overlay__close")
    .text("\u2715")
    .on("click", close);

  // Header row: tabs
  var header = overlay.append("div")
    .attr("class", "map-overlay__header");

  var cardWrap = overlay.append("div")
    .attr("class", "map-overlay__card");

  var tabBar = header.append("div").attr("class", "map-overlay__tabs");

  var panels = [];
  var tabBtns = [];
  var tabKeys = [];

  function activateTab(idx) {
    tabBar.selectAll(".map-overlay__tab").classed("map-overlay__tab--active", false);
    d3.select(tabBtns[idx]).classed("map-overlay__tab--active", true);
    panels.forEach(function (p, pi) { p.style("display", pi === idx ? "block" : "none"); });
    requestAnimationFrame(function () {
      repositionBarLabels(panels[idx].node());
      var pillWraps = panels[idx].node().querySelectorAll(".elected-pills");
      for (var i = 0; i < pillWraps.length; i++) {
        _fitElectedPills(d3.select(pillWraps[i]));
      }
    });
  }

  function addTab(label, renderFn, key) {
    var idx = panels.length;
    var tabBtn = tabBar.append("button")
      .attr("class", "map-overlay__tab")
      .text(label)
      .on("click", function () {
        var currentIdx = tabBtns.indexOf(this);
        if (currentIdx >= 0) activateTab(currentIdx);
      });
    tabBtns.push(tabBtn.node());
    tabKeys.push(key || null);

    var panel = cardWrap.append("div")
      .attr("class", "map-overlay__panel")
      .style("display", "none")
      .style("position", "relative");
    panels.push(panel);
    renderFn(panel);
    return idx;
  }

  function addOrReplaceTab(key, label, renderFn) {
    var existing = tabKeys.indexOf(key);
    if (existing >= 0) {
      d3.select(tabBtns[existing]).remove();
      panels[existing].remove();
      tabBtns.splice(existing, 1);
      panels.splice(existing, 1);
      tabKeys.splice(existing, 1);
    }
    var idx = addTab(label, renderFn, key);
    activateTab(idx);
    return idx;
  }

  items.forEach(function (item) {
    addTab(item.tabLabel, item.renderPanel, item.tabKey || null);
  });

  // Activate first tab
  if (panels.length > 0) {
    d3.select(tabBtns[0]).classed("map-overlay__tab--active", true);
    panels[0].style("display", "block");
  }

  document.addEventListener("keydown", escHandler);

  // Scroll panel into view
  requestAnimationFrame(function () {
    overlay.node().scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  return { overlay: overlay, activateTab: activateTab, addOrReplaceTab: addOrReplaceTab, close: close };
}

function layoutMapDeclaredBadge(wrapperEl) {
  if (!wrapperEl) return;

  var badge = wrapperEl.querySelector(".scoreboard__declared");
  if (!badge || !badge.dataset.singleLineHtml) return;

  var textEl = badge.querySelector(".scoreboard__declared-text");
  if (!textEl) return;

  badge.classList.remove("scoreboard__declared--multiline");
  textEl.innerHTML = badge.dataset.singleLineHtml;

  var legend = wrapperEl.querySelector(".map-legend");
  if (!legend || badge.dataset.multiLineHtml === badge.dataset.singleLineHtml) return;

  var badgeRect = badge.getBoundingClientRect();
  var legendRect = legend.getBoundingClientRect();
  var overlaps = badgeRect.left < legendRect.right + 8 &&
    badgeRect.right > legendRect.left - 8 &&
    badgeRect.top < legendRect.bottom + 8 &&
    badgeRect.bottom > legendRect.top - 8;

  if (overlaps) {
    badge.classList.add("scoreboard__declared--multiline");
    textEl.innerHTML = badge.dataset.multiLineHtml;
  }
}

function registerMapDeclaredBadge(wrapperEl, badge, html) {
  if (!wrapperEl || !badge) return;

  badge.dataset.singleLineHtml = html;
  badge.dataset.multiLineHtml = html.indexOf(", ") !== -1 ? html.replace(", ", ",<br>") : html;
  badge.innerHTML = '<span class="scoreboard__declared-text">' + html + '</span>';

  if (!wrapperEl.__declaredBadgeRelayout) {
    wrapperEl.__declaredBadgeRelayout = function () {
      layoutMapDeclaredBadge(wrapperEl);
    };
    window.addEventListener("resize", wrapperEl.__declaredBadgeRelayout);
  }

  requestAnimationFrame(wrapperEl.__declaredBadgeRelayout);
}

/**
 * Build a collapsible map legend (key) inside the .map-wrapper.
 *   wrapper:  D3 selection of .map-wrapper
 *   parties:  [{name, colour}]  — party swatches to show
 *   options:  { hideGain: bool, hideNoElection: bool }
 */
function buildMapLegend(wrapper, parties, options) {
  options = options || {};
  wrapper.select(".map-legend").remove();
  var wrapperNode = wrapper.node ? wrapper.node() : null;

  var legend = wrapper.append("div").attr("class", "map-legend");

  var btn = legend.append("button").attr("class", "legend-toggle")
    .attr("aria-expanded", "false");
  var btnSvg = btn.append("svg").attr("class", "legend-toggle-icon").attr("width", 14).attr("height", 14).attr("viewBox", "0 0 14 14");
  btnSvg.append("circle").attr("cx", 7).attr("cy", 7).attr("r", 6).attr("fill", "none").attr("stroke", "currentColor").attr("stroke-width", 1.2);
  btnSvg.append("circle").attr("cx", 7).attr("cy", 7).attr("r", 3.5).attr("fill", "currentColor");
  btn.append("span").text("Key");

  var body = legend.append("div").attr("class", "legend-body")
    .style("display", "none");

  // Header row inside body: icon + "Key" title + close button
  var header = body.append("div").attr("class", "legend-header");
  var headerLeft = header.append("span").attr("class", "legend-header-left");
  var hSvg = headerLeft.append("svg").attr("class", "legend-toggle-icon").attr("width", 14).attr("height", 14).attr("viewBox", "0 0 14 14");
  hSvg.append("circle").attr("cx", 7).attr("cy", 7).attr("r", 6).attr("fill", "none").attr("stroke", "currentColor").attr("stroke-width", 1.2);
  hSvg.append("circle").attr("cx", 7).attr("cy", 7).attr("r", 3.5).attr("fill", "currentColor");
  headerLeft.append("span").text("Key");
  var closeBtn = header.append("button").attr("class", "legend-close");
  closeBtn.append("span").text("Close ");
  closeBtn.append("span").html("&#10005;");

  // Party swatches
  if (parties.length > 0) {
    var partySection = body.append("div");
    partySection.append("div").attr("class", "legend-title").text("Winning party");
    parties.forEach(function (p) {
      var item = partySection.append("div").attr("class", "legend-item");
      item.append("div").attr("class", "legend-swatch")
        .style("background", p.colour);
      item.append("span").text(partyName(p.name) || p.name);
    });
  }

  // Special items
  var specialSection = body.append("div").attr("class", "legend-separator");
  if (!options.hideNoElection) {
    var ne = specialSection.append("div").attr("class", "legend-item");
    ne.append("div").attr("class", "legend-swatch legend-swatch--no-election");
    ne.append("span").text("No election");
  }
  var aw = specialSection.append("div").attr("class", "legend-item");
  aw.append("div").attr("class", "legend-swatch legend-swatch--crosshatch");
  aw.append("span").text("Awaiting declaration");
  if (!options.hideGain) {
    var gn = specialSection.append("div").attr("class", "legend-item");
    gn.append("div").attr("class", "legend-swatch legend-swatch--outline");
    gn.append("span").text("Gain from another party");
  }

  // Toggle open
  btn.on("click", function () {
    body.style("display", "block");
    btn.style("display", "none");
    legend.attr("aria-expanded", "true");
    if (wrapperNode) requestAnimationFrame(function () { layoutMapDeclaredBadge(wrapperNode); });
  });

  // Close button
  closeBtn.on("click", function () {
    body.style("display", "none");
    btn.style("display", "flex");
    legend.attr("aria-expanded", "false");
    if (wrapperNode) requestAnimationFrame(function () { layoutMapDeclaredBadge(wrapperNode); });
  });

  if (wrapperNode) requestAnimationFrame(function () { layoutMapDeclaredBadge(wrapperNode); });

  return legend;
}

/**
 * Dim all map areas except the selected path by lowering opacity.
 *   zoomGroup:    D3 selection of the zoom <g>
 *   selectedPath: the DOM element (path) to keep bright, or null to reset
 */
function dimOtherAreas(zoomGroup, selectedPath) {
  zoomGroup.selectAll(".map-area").each(function () {
    d3.select(this).style("opacity", this === selectedPath ? 1 : 0.3);
  });
}

/**
 * Reset all map area opacities to full.
 */
function resetAreaDim(zoomGroup) {
  zoomGroup.selectAll(".map-area").style("opacity", null);
}

/**
 * Zoom the map to fit a single GeoJSON feature.
 *   svg:     D3 selection of the <svg>
 *   zoom:    D3 zoom behavior
 *   path:    D3 geoPath generator
 *   feature: GeoJSON feature
 *   opts:    { duration, onEnd }
 *   Returns the transition (caller can chain .on("end") if needed).
 */
function zoomToFeature(svg, zoom, path, feature, opts) {
  opts = opts || {};
  var bounds = path.bounds(feature);
  var dx = bounds[1][0] - bounds[0][0];
  var dy = bounds[1][1] - bounds[0][1];
  var x = (bounds[0][0] + bounds[1][0]) / 2;
  var y = (bounds[0][1] + bounds[1][1]) / 2;

  var vb = svg.attr("viewBox").split(" ");
  var svgW = +vb[2];
  var svgH = +vb[3];

  // Adaptive padding (more padding for small features)
  var size = Math.max(dx, dy);
  var padding;
  if (size < 20) padding = 0.5;
  else if (size < 60) padding = 0.4;
  else if (size < 150) padding = 0.3;
  else padding = 0.2;

  var scale = Math.min(
    svgW / (dx * (1 + padding)),
    svgH / (dy * (1 + padding))
  );
  scale = Math.min(scale, 8); // Respect max zoom

  var translate = [svgW / 2 - scale * x, svgH / 2 - scale * y];
  var transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);

  var dur = opts.duration != null ? opts.duration : 800;
  var t = svg.transition().duration(dur).call(zoom.transform, transform);

  if (opts.onEnd) {
    t.on("end", opts.onEnd);
  }
  return t;
}

/**
 * Zoom the map to fit multiple GeoJSON features.
 *   svg:      D3 selection of the <svg>
 *   zoom:     D3 zoom behavior
 *   path:     D3 geoPath generator
 *   features: array of GeoJSON features
 *   opts:     { duration, onEnd, padding }
 */
function zoomToFeatures(svg, zoom, path, features, opts) {
  opts = opts || {};
  if (!features || features.length === 0) return;

  // Compute combined bounding box
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (var i = 0; i < features.length; i++) {
    var b = path.bounds(features[i]);
    if (b[0][0] < minX) minX = b[0][0];
    if (b[0][1] < minY) minY = b[0][1];
    if (b[1][0] > maxX) maxX = b[1][0];
    if (b[1][1] > maxY) maxY = b[1][1];
  }

  var dx = maxX - minX;
  var dy = maxY - minY;
  var x = (minX + maxX) / 2;
  var y = (minY + maxY) / 2;

  var vb = svg.attr("viewBox").split(" ");
  var svgW = +vb[2];
  var svgH = +vb[3];

  var padding = opts.padding != null ? opts.padding : 0.15;
  var scale = Math.min(
    svgW / (dx * (1 + padding)),
    svgH / (dy * (1 + padding))
  );
  scale = Math.max(1, Math.min(scale, 8));

  var translate = [svgW / 2 - scale * x, svgH / 2 - scale * y];
  var transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);

  var dur = opts.duration != null ? opts.duration : 800;
  var t = svg.transition().duration(dur).call(zoom.transform, transform);

  if (opts.onEnd) {
    t.on("end", opts.onEnd);
  }
  return t;
}
