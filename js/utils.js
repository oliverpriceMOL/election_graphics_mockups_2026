/**
 * Shared Utility Functions
 * Used across all election pages (England, Scotland, Wales)
 */

/**
 * Re-run name column sizing + label/change positioning for all bar charts inside a container.
 * Call this after a hidden panel becomes visible (e.g. tab switch in map overlay).
 */
function repositionBarLabels(container) {
  // Re-measure name column widths per bars group
  var barsGroups = container.querySelectorAll(".fptp-card__bars");
  for (var g = 0; g < barsGroups.length; g++) {
    var barsWrap = barsGroups[g];
    var containerW = barsWrap.getBoundingClientRect().width;
    var cap = Math.min(containerW * 0.45, 160);
    var maxNameW = 0;
    var names = barsWrap.querySelectorAll(".fptp-card__bar-name");
    for (var n = 0; n < names.length; n++) {
      var el = names[n];
      var origW = el.style.width;
      el.style.width = "max-content";
      var w = el.getBoundingClientRect().width;
      el.style.width = origW;
      if (w > maxNameW) maxNameW = w;
    }
    var nameCol = Math.ceil(Math.min(maxNameW, cap)) + 1;
    var rows = barsWrap.querySelectorAll(".fptp-card__bar-row");
    for (var r = 0; r < rows.length; r++) {
      rows[r].style.setProperty("--name-col", nameCol + "px");
    }
  }

  // Re-position labels and change indicators
  var wraps = container.querySelectorAll(".fptp-card__bar-wrap");
  for (var i = 0; i < wraps.length; i++) {
    var wrap = wraps[i];
    var fill = wrap.querySelector(".fptp-card__bar-fill");
    var label = wrap.querySelector(".fptp-card__bar-label");
    var change = wrap.querySelector(".fptp-card__bar-change-inline");
    if (!fill || !label) continue;
    var fillW = fill.getBoundingClientRect().width;
    var labelW = label.getBoundingClientRect().width;
    var hex = label.getAttribute("data-party-colour");
    if (labelW + 10 <= fillW) {
      label.style.left = (fillW - labelW - 5) + "px";
      label.style.color = textColourForBg(hex);
      if (change) change.style.left = (fillW + 4) + "px";
    } else {
      label.style.left = (fillW + 4) + "px";
      label.style.color = "#1a1a2e";
      if (change) change.style.left = (fillW + 4 + labelW + 4) + "px";
    }
  }
}

/**
 * Build an HTML seat tally from a proportional/list result.
 * Renders horizontal bar-chart badges: width proportional to seats, party colour background.
 * @param {Object} result - Result object with candidates array
 * @returns {string} HTML string (empty if no elected candidates)
 */
function seatTallyHtml(result) {
  if (!result || !result.candidates) return "";
  var counts = {};
  for (var i = 0; i < result.candidates.length; i++) {
    var c = result.candidates[i];
    if (c.elected === "true" || c.elected === true || c.elected === "*") {
      var abbr = c.party ? c.party.abbreviation : "Other";
      counts[abbr] = (counts[abbr] || 0) + 1;
    }
  }
  var parties = [];
  for (var abbr in counts) {
    parties.push({ abbr: abbr, seats: counts[abbr] });
  }
  parties.sort(function (a, b) { return b.seats - a.seats; });
  if (parties.length === 0) return "";
  var maxSeats = parties[0].seats;
  return '<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">' +
    parties.map(function (p) {
      var bg = partyColour(p.abbr);
      var fg = textColourForBg(bg);
      var pct = Math.round((p.seats / maxSeats) * 100);
      var small = pct < 55;
      return '<div style="display:flex;align-items:center;gap:0;position:relative;height:22px">' +
        '<span style="display:inline-flex;align-items:center;justify-content:space-between;background:' + bg +
        ';color:' + fg + ';padding:2px 6px;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap;' +
        'min-width:18px;width:' + pct + '%;height:100%;box-sizing:border-box">' +
        partyShortName(p.abbr) + (small ? '' : '<span style="margin-left:auto;font-weight:400">' + p.seats + '</span>') +
        '</span>' +
        (small ? '<span style="font-size:11px;font-weight:400;color:#444;margin-left:4px">' + p.seats + '</span>' : '') +
        '</div>';
    }).join("") + "</div>";
}

/**
 * Deduplicate results by name, keeping the highest revision.
 * Optionally filter by fileType before deduplication.
 * @param {Array} arr - Array of result objects with name and revision fields
 * @param {string} [fileType] - If provided, only keep items with this fileType
 * @returns {Array} Deduplicated array
 */
function dedupByRevision(arr, fileType) {
  const byName = {};
  for (const r of arr) {
    if (fileType && r.fileType !== fileType) continue;
    const existing = byName[r.name];
    if (!existing) { byName[r.name] = r; continue; }
    // Always prefer "result" over "rush"; then highest revision wins
    var rIsResult = r.fileType === "result", eIsResult = existing.fileType === "result";
    if (rIsResult && !eIsResult) { byName[r.name] = r; continue; }
    if (!rIsResult && eIsResult) continue;
    if ((r.revision || 0) > (existing.revision || 0)) byName[r.name] = r;
  }
  return Object.values(byName);
}

/**
 * Auto-select white or dark text colour for a given background hex colour.
 * Uses standard luminance formula.
 * @param {string} hex - Hex colour string like "#E4003B"
 * @returns {string} "#333" for light backgrounds, "#fff" for dark
 */
function textColourForBg(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#333" : "#fff";
}

/**
 * Format a numeric change value as a change arrow string with colour.
 * @param {number} val - Change value (positive, negative, or zero)
 * @returns {{text: string, colour: string}} Arrow text and colour
 */
function formatChange(val) {
  if (val > 0) return { text: "▲" + val, colour: "#007F67" };
  if (val < 0) return { text: "▼" + Math.abs(val), colour: "#AD0025" };
  return { text: "—", colour: "#595959" };
}

/**
 * Format a percentage-share change as an arrow string with colour.
 * Returns null when the value is absent so callers can skip rendering.
 * @param {number|null|undefined} val - Percentage-point change
 * @returns {{text: string, colour: string}|null}
 */
function formatPercentageChange(val) {
  if (val == null) return null;
  if (val > 0) return { text: "\u25B2" + formatPct(val), colour: "#007F67" };
  if (val < 0) return { text: "\u25BC" + formatPct(Math.abs(val)), colour: "#AD0025" };
  return { text: "—", colour: "#595959" };
}

/**
 * Group minor parties into a single "Other" entry.
 * Sums all numeric properties from the minor entries.
 * @param {Array} parties — sorted [{name, ...}]
 * @param {string[]} minorNames — party names to fold into Other
 * @returns {Array} new array with minor parties replaced by one Other entry (or original if none matched)
 */
function groupMinorParties(parties, minorNames) {
  if (!minorNames || !minorNames.length) return parties;
  var kept = [];
  var other = { name: "Other" };
  var hasMinor = false;
  for (var i = 0; i < parties.length; i++) {
    var p = parties[i];
    if (minorNames.indexOf(p.name) !== -1) {
      hasMinor = true;
      for (var key in p) {
        if (key === "name") continue;
        if (typeof p[key] === "number") other[key] = (other[key] || 0) + p[key];
      }
    } else {
      kept.push(p);
    }
  }
  if (hasMinor) kept.push(other);
  return kept;
}

/**
 * Debounced window resize handler.
 * @param {Function} callback - Function to call on resize
 * @param {number} [ms=150] - Debounce delay in milliseconds
 * @returns {Function} Cleanup function to remove the listener
 */
function onResize(callback, ms) {
  if (ms === undefined) ms = 150;
  var timer;
  function handler() {
    clearTimeout(timer);
    timer = setTimeout(callback, ms);
  }
  window.addEventListener("resize", handler);
  return function () { window.removeEventListener("resize", handler); };
}

/**
 * Enrich Scottish FPTP and regional results with notional vote share changes
 * from Hanretty's 2021-on-2026-boundaries estimates.
 * Only fills in percentageShareChange where PA didn't provide it.
 * @param {Array} constResults - Deduplicated constituency (FPTP) results
 * @param {Array} regResults - Deduplicated regional (top-up) results
 * @param {Object} notionals - Keyed by constituency name from scottish_notionals.json
 */
function enrichWithNotionals(constResults, regResults, notionals) {
  if (!notionals || typeof notionals !== "object") return;

  // Constituency FPTP: compute percentageShareChange from notionals.
  // Always prefer Hanretty's notionals for consistency (same methodology
  // across all 73 seats on 2026 boundaries). Fall back to PA if no notional.
  for (var i = 0; i < constResults.length; i++) {
    var r = constResults[i];
    var n = notionals[r.name];
    if (!n || !n.constituency) continue;
    var candidates = r.candidates || [];
    for (var j = 0; j < candidates.length; j++) {
      var c = candidates[j];
      var notionalPct = n.constituency[c.party.abbreviation];
      if (notionalPct != null && c.party.percentageShare != null) {
        c.party.percentageShareChange = Math.round((c.party.percentageShare - notionalPct) * 100) / 100;
      }
    }
  }

  // Regional top-up: PA already provides percentageShareChange at the region level,
  // so no enrichment needed here.
}

/**
 * Find the next clean Y-axis scale boundary >= maxAbs.
 * @param {number} maxAbs - Maximum absolute value in the data
 * @returns {number} Clean scale boundary
 */
function nextCleanScale(maxAbs) {
  var steps = [2, 4, 6, 8, 10, 15, 20, 30, 40, 50, 80, 100, 150, 200, 250, 500, 1000, 2500, 5000];
  return steps.find(function (s) { return s >= maxAbs; }) || maxAbs;
}

/** Format a percentage: strip trailing .0 (e.g. 31.0 → "31", 25.3 → "25.3") */
function formatPct(val) {
  var s = (val || 0).toFixed(1);
  return s.replace(/\.0$/, "");
}

/**
 * Render a turnout bar: black fill on grey background.
 *   container: DOM element
 *   opts: { turnout, totalVotes, electorate }
 */
function turnoutBar(container, opts) {
  if (!opts) opts = {};
  var pct = opts.turnout || 0;
  var votes = opts.totalVotes || 0;
  var electorate = opts.electorate || 0;
  var el = d3.select(container);
  var wrap = el.append("div").attr("class", "turnout-bar");
  var barOuter = wrap.append("div").attr("class", "turnout-bar__track");
  barOuter.append("div").attr("class", "turnout-bar__fill")
    .style("width", Math.min(pct, 100) + "%");
  var labels = wrap.append("div").attr("class", "turnout-bar__labels");
  labels.append("span").text(votes.toLocaleString() + " votes (" + formatPct(pct) + "% turnout)");
  if (electorate) {
    labels.append("span").text(electorate.toLocaleString() + " electorate");
  }
}


