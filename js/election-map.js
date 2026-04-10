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
  var dropdown = searchWrap.append("div").attr("class", "map-search__dropdown");

  // Map wrapper
  var wrapper = el.append("div").attr("class", "map-wrapper");
  var svg = wrapper.append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  var zoomGroup = svg.append("g").attr("class", "map-zoom-group");

  var zoom = d3.zoom()
    .scaleExtent([1, 8])
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
 */
function setupMapSearch(searchInput, dropdown, searchWrap, onNameSearch, onPostcode) {
  var debounceTimer = null;
  var postcodePattern = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;

  searchInput.on("input", function () {
    var val = this.value.trim();
    clearTimeout(debounceTimer);
    if (!val) { dropdown.style("display", "none"); return; }
    if (postcodePattern.test(val)) {
      debounceTimer = setTimeout(function () { onPostcode(val); }, 400);
    } else {
      onNameSearch(val);
    }
  });

  document.addEventListener("click", function (e) {
    if (!searchWrap.node().contains(e.target)) {
      dropdown.style("display", "none");
    }
  });
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
 * Create a tabbed overlay panel attached to .map-wrapper.
 *   items: [{tabLabel, renderPanel(panelEl), tabKey?}]
 *   Returns an API: { overlay, activateTab(idx), addOrReplaceTab(key, label, renderFn) }
 */
function createMapOverlay(items) {
  d3.select(".map-overlay").remove();

  var overlay = d3.select(".map-wrapper").append("div")
    .attr("class", "map-overlay");

  overlay.append("button")
    .attr("class", "map-overlay__close")
    .text("\u2715")
    .on("click", function () { overlay.remove(); });

  var cardWrap = overlay.append("div")
    .attr("class", "map-overlay__card");

  var tabBar = cardWrap.append("div").attr("class", "map-overlay__tabs");
  var panels = [];
  var tabBtns = [];
  var tabKeys = [];

  function activateTab(idx) {
    tabBar.selectAll(".map-overlay__tab").classed("map-overlay__tab--active", false);
    d3.select(tabBtns[idx]).classed("map-overlay__tab--active", true);
    panels.forEach(function (p, pi) { p.style("display", pi === idx ? "block" : "none"); });
    requestAnimationFrame(function () {
      repositionBarLabels(panels[idx].node());
      // Re-fit elected pills that may have been measured while hidden
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
      // Remove old tab button + panel
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

  var escHandler = function (e) {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  return { overlay: overlay, activateTab: activateTab, addOrReplaceTab: addOrReplaceTab };
}
