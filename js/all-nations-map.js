// ── poll-wrapper.js ─────────────────────────────────────────────
/**
 * Poll Wrapper — auto-refreshing data loader for standalone modules.
 * Fetches data immediately, renders, then re-fetches every intervalMs.
 * Skips render when data hasn't changed.
 * If updateFn is provided, uses it for subsequent updates instead of full re-render.
 */
var POLL_INTERVAL = 60000; // 60 seconds

function pollData(fetchFn, renderFn, updateFnOrInterval, intervalMs) {
  var updateFn;
  if (typeof updateFnOrInterval === "function") {
    updateFn = updateFnOrInterval;
  } else if (typeof updateFnOrInterval === "number") {
    intervalMs = updateFnOrInterval;
  }
  if (intervalMs === undefined) intervalMs = POLL_INTERVAL;
  var running = true;
  var lastJson = null;
  var rendered = false;

  function tick() {
    fetchFn().then(function (data) {
      if (!running) return;
      var json = JSON.stringify(data);
      if (json === lastJson) return; // data unchanged — skip
      lastJson = json;
      if (!rendered) {
        renderFn(data);
        rendered = true;
      } else if (updateFn) {
        updateFn(data);
      } else {
        renderFn(data);
      }
    }).catch(function (err) {
      console.warn("Poll fetch error:", err);
    }).finally(function () {
      if (running) setTimeout(tick, intervalMs);
    });
  }

  tick();

  // Return stop handle
  return { stop: function () { running = false; } };
}


// ── tooltip.js ──────────────────────────────────────────────────
/**
 * Tooltip Module
 * Shared tooltip with smart viewport-aware positioning, smooth following,
 * optional bounds constraint, and scroll/touch hide.
 */

// =========================================================================
// TOOLTIP CREATION AND MANAGEMENT
// =========================================================================

/**
 * Show a tooltip with smart positioning.
 * Creates the element if it doesn't exist; reuses it if it does.
 * @param {string} id - Unique tooltip ID
 * @param {string} html - HTML content
 * @param {number} cursorX - Cursor X in viewport
 * @param {number} cursorY - Cursor Y in viewport
 * @param {Object} [bounds] - Optional {left, top, right, bottom} to constrain within
 * @returns {HTMLElement} The tooltip DOM element (for further manipulation like badge append)
 */
function showTooltip(id, html, cursorX, cursorY, bounds) {
  var tooltip = document.getElementById(id);
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = id;
    tooltip.className = "shared-tooltip";
    document.body.appendChild(tooltip);
  }
  tooltip.innerHTML = html;
  tooltip.style.display = "block";
  positionTooltip(tooltip, cursorX, cursorY, bounds);
  return tooltip;
}

/**
 * Position tooltip with smart viewport-aware logic.
 * Horizontal: left third → show right; right third → show left; middle → show right.
 * Vertical: prefer above cursor, flip below if would clip top.
 * @param {HTMLElement} tooltip - Tooltip DOM element
 * @param {number} cursorX - Cursor X in viewport
 * @param {number} cursorY - Cursor Y in viewport
 * @param {Object} [bounds] - Optional {left, top, right, bottom} to constrain within
 */
function positionTooltip(tooltip, cursorX, cursorY, bounds) {
  var viewportW = window.innerWidth;
  var viewportH = window.innerHeight;
  var padding = 10;
  var hOffset = 18;
  var vOffset = 20;

  var cLeft   = bounds ? bounds.left   : 0;
  var cTop    = bounds ? bounds.top    : 0;
  var cRight  = bounds ? bounds.right  : viewportW;
  var cBottom = bounds ? bounds.bottom : viewportH;
  var cWidth  = cRight - cLeft;

  // Clamp max-width to fit constraint area
  var maxW = Math.min(240, cWidth - padding * 2);
  tooltip.style.maxWidth = maxW + "px";
  tooltip.style.minWidth = "150px";

  var tipW = tooltip.offsetWidth;
  var tipH = tooltip.offsetHeight;

  // Horizontal: thirds-based
  var xRatio = (cursorX - cLeft) / cWidth;
  var left;
  if (xRatio < 0.33) {
    left = cursorX + hOffset;
  } else if (xRatio > 0.67) {
    left = cursorX - tipW - hOffset;
  } else {
    left = cursorX + hOffset;
  }
  left = Math.max(cLeft + padding, Math.min(cRight - tipW - padding, left));

  // Vertical: prefer above, flip below if clipping
  var top = cursorY - tipH - vOffset;
  if (top < cTop + padding) {
    top = cursorY + vOffset;
  }
  top = Math.min(top, cBottom - tipH - padding);
  top = Math.max(cTop + padding, top);

  tooltip.style.left = left + "px";
  tooltip.style.top  = top  + "px";
}

/**
 * Hide a tooltip by ID.
 * @param {string} id - Tooltip ID
 */
function hideTooltip(id) {
  var tooltip = document.getElementById(id);
  if (tooltip) {
    tooltip.style.display = "none";
  }
}

// =========================================================================
// SCROLL / TOUCH HIDE
// =========================================================================

var _scrollTimeout = null;

function hideAllTooltipsOnScroll() {
  var tips = document.querySelectorAll(".shared-tooltip");
  for (var i = 0; i < tips.length; i++) {
    tips[i].style.display = "none";
  }
}

window.addEventListener("scroll", function () {
  if (_scrollTimeout) return;
  _scrollTimeout = setTimeout(function () {
    hideAllTooltipsOnScroll();
    _scrollTimeout = null;
  }, 50);
}, { passive: true });

window.addEventListener("touchmove", function () {
  if (_scrollTimeout) return;
  _scrollTimeout = setTimeout(function () {
    hideAllTooltipsOnScroll();
    _scrollTimeout = null;
  }, 50);
}, { passive: true });

// =========================================================================
// EXPORTS
// =========================================================================

window.Tooltip = {
  show: showTooltip,
  hide: hideTooltip,
  position: positionTooltip,
  hideAll: hideAllTooltipsOnScroll
};


// ── utils.js ────────────────────────────────────────────────────
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
 * Lighten a hex colour toward white by a given amount (0 = original, 1 = white).
 */
function lightenColour(hex, amount) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  r = Math.round(r + (255 - r) * amount);
  g = Math.round(g + (255 - g) * amount);
  b = Math.round(b + (255 - b) * amount);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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




// ── data-adapter.js ─────────────────────────────────────────────
/**
 * data-adapter.js — Transform raw PA wire JSON (xmltodict format) into the
 * processed shapes that D3 components expect.
 *
 * Raw PA JSON uses @-prefixed attribute names, wrapper keys per result type,
 * and deeply nested Election > Council/Constituency structures.
 * This adapter flattens that into the simple objects the frontend already uses.
 */

/* ── Base URL configuration ────────────────────────────────────────────── */

var PA_DATA_BASE = "/static/uk_elections/2026/local_elections";
var PA_DATA_ENV  = "test";   // flip to "live" on election night

function paUrl(category, filename) {
  // Use CDN only on the production domain; everywhere else serve from local data/
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1"
      && !location.hostname.endsWith("github.io")) {
    return PA_DATA_BASE + "/" + category + "/" + PA_DATA_ENV + "/" + filename;
  }
  return "data/" + filename;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function _tryNum(v) {
  if (v == null || v === "") return v;
  var n = Number(v);
  return isNaN(n) ? v : n;
}

function _parseChange(v) {
  if (v == null) return 0;
  return _tryNum(String(v).replace(/^\+/, ""));
}

/** xmltodict returns a single object (not array) when there's only one child. */
function _arr(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/* ── Local election results ────────────────────────────────────────────── */

function normalizeLocalResults(raw) {
  var results = [];
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var key = Object.keys(item)[0];
    // Skip SOP and anything we don't recognise
    if (key !== "LocalElectionResult" && key !== "LocalElectionRush") continue;

    var wrapper = item[key];
    var election = wrapper.Election || {};
    var council = election.Council || {};

    var r = {
      name:          council["@name"],
      paId:          council["@paId"],
      type:          council["@type"],
      proportion:    council["@proportion"],
      winningParty:  council["@winningParty"],
      gainOrHold:    council["@gainOrHold"],
      sittingParty:  council["@sittingParty"],
      revision:      _tryNum(wrapper["@revision"]),
      fileType:      key === "LocalElectionResult" ? "result" : "rush",
      declarationTime: wrapper["@declarationTime"],
      election: {
        date: election["@date"],
        paId: election["@paId"]
      }
    };

    // ElectedCouncillors
    var ec = (council.ElectedCouncillors || {}).Party;
    r.electedCouncillors = _arr(ec).map(function (p) {
      return { name: p["@name"], paId: p["@paId"], key: resolvePartyKey(p["@paId"], p["@name"]), seats: _tryNum(p["@seats"]) };
    });

    // Changes
    var ch = (council.Changes || {}).Party;
    r.changes = _arr(ch).map(function (p) {
      return { name: p["@name"], paId: p["@paId"], key: resolvePartyKey(p["@paId"], p["@name"]), change: _parseChange(p["@change"]) };
    });

    // NewCouncil
    var nc = (council.NewCouncil || {}).Party;
    r.newCouncil = _arr(nc).map(function (p) {
      return { name: p["@name"], paId: p["@paId"], key: resolvePartyKey(p["@paId"], p["@name"]), seats: _tryNum(p["@seats"]) };
    });

    results.push(r);
  }
  return { results: results };
}

/* ── FPTP results (mayoral + Scottish constituencies) ──────────────────── */

function normalizeFPTPResults(raw) {
  var results = [];
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var key = Object.keys(item)[0];
    if (key !== "FirstPastThePostResult" && key !== "FirstPastThePostRush") continue;

    var wrapper = item[key];
    var election = wrapper.Election || {};
    var cons = election.Constituency || {};
    var isResult = key === "FirstPastThePostResult";

    var r = {
      number:                   _tryNum(cons["@number"]),
      name:                     cons["@name"],
      electorate:               _tryNum(cons["@electorate"]),
      turnout:                  _tryNum(cons["@turnout"]),
      percentageTurnout:        _tryNum(cons["@percentageTurnout"]),
      percentageChangeTurnout:  _tryNum(cons["@percentageChangeTurnout"]),
      winningParty:             cons["@winningParty"] || cons["@winningPartyAbbreviation"],
      gainOrHold:               cons["@gainOrHold"],
      sittingParty:             cons["@sittingParty"] || cons["@sittingPartyAbbreviation"],
      majority:                 _tryNum(cons["@majority"]),
      percentageMajority:       _tryNum(cons["@percentageMajority"]),
      percentageChangeMajority: _tryNum(cons["@percentageChangeMajority"]),
      revision:                 _tryNum(wrapper["@revision"]),
      fileType:                 isResult ? "result" : "rush",
      declarationTime:          wrapper["@declarationTime"],
      election: {
        name: election["@name"],
        date: election["@date"],
        type: election["@type"]
      }
    };

    // Candidates
    r.candidates = _arr(cons.Candidate).map(function (c) {
      var party = c.Party || {};
      return {
        elected:                c["@elected"],
        previousSittingMember:  c["@previousSittingMember"],
        paId:                   c["@paId"],
        firstName:              c["@firstName"],
        surname:                c["@surname"],
        ballotName:             c["@ballotName"],
        party: {
          paId:                   party["@paId"],
          name:                   party["@name"],
          abbreviation:           party["@abbreviation"],
          key:                    resolvePartyKey(party["@paId"], party["@abbreviation"]),
          votes:                  _tryNum(party["@votes"]),
          percentageShare:        _tryNum(party["@percentageShare"]),
          percentageShareChange:  _tryNum(party["@percentageShareChange"])
        }
      };
    });

    results.push(r);
  }
  return results;
}

/* ── TopUp results (Scottish regional + Welsh) ─────────────────────────── */

function normalizeTopUpResults(raw) {
  var results = [];
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var key = Object.keys(item)[0];
    if (key !== "TopUpResult" && key !== "TopUpRush") continue;

    var wrapper = item[key];
    var election = wrapper.Election || {};
    var cons = election.Constituency || {};
    var isResult = key === "TopUpResult";

    var r = {
      number:                   _tryNum(cons["@number"]),
      name:                     cons["@name"],
      electorate:               _tryNum(cons["@electorate"]),
      turnout:                  _tryNum(cons["@turnout"]),
      percentageTurnout:        _tryNum(cons["@percentageTurnout"]),
      percentageChangeTurnout:  _tryNum(cons["@percentageChangeTurnout"]),
      winningParty:             cons["@winningParty"] || cons["@winningPartyAbbreviation"],
      majority:                 _tryNum(cons["@majority"]),
      percentageMajority:       _tryNum(cons["@percentageMajority"]),
      percentageChangeMajority: _tryNum(cons["@percentageChangeMajority"]),
      swing:                    _tryNum(cons["@swing"]),
      swingTo:                  cons["@swingTo"],
      swingFrom:                cons["@swingFrom"],
      revision:                 _tryNum(wrapper["@revision"]),
      fileType:                 isResult ? "result" : "rush",
      declarationTime:          wrapper["@declarationTime"],
      election: {
        name: election["@name"],
        date: election["@date"],
        type: election["@type"]
      }
    };

    // Candidates — each has partyListRank; party sub-object has no votes
    r.candidates = _arr(cons.Candidate).map(function (c) {
      var party = c.Party || {};
      return {
        elected:                c["@elected"],
        previousSittingMember:  c["@previousSittingMember"],
        paId:                   c["@paId"],
        firstName:              c["@firstName"],
        surname:                c["@surname"],
        ballotName:             c["@ballotName"],
        partyListRank:          _tryNum(c["@partyListRank"]),
        party: {
          paId:         party["@paId"],
          abbreviation: party["@abbreviation"],
          name:         party["@name"],
          key:          resolvePartyKey(party["@paId"], party["@abbreviation"])
        }
      };
    });

    // Aggregate party-level vote totals (Party elements that are siblings of Candidate)
    // In the raw JSON, cons.Party holds the aggregate party array (sibling parties).
    // Candidate[].Party holds each candidate's party (no votes).
    r.parties = _arr(cons.Party).map(function (p) {
      return {
        paId:                   p["@paId"],
        abbreviation:           p["@abbreviation"],
        name:                   p["@name"],
        key:                    resolvePartyKey(p["@paId"], p["@abbreviation"]),
        votes:                  _tryNum(p["@votes"]),
        percentageShare:        _tryNum(p["@percentageShare"]),
        percentageShareChange:  _tryNum(p["@percentageShareChange"]),
        candidatesElected:      _tryNum(p["@candidatesElected"])
      };
    });

    // PreviousElection — sibling of Election under the wrapper root.
    // Each contains Constituency elements with candidates (used for regional seat change calc).
    var prevEls = _arr(wrapper.PreviousElection);
    if (prevEls.length) {
      r.previousElections = prevEls.map(function (pe) {
        var peElection = pe.Election || pe;  // may or may not have Election wrapper
        return {
          name: pe["@name"],
          date: pe["@date"],
          type: pe["@type"],
          constituencies: _arr(pe.Constituency).map(function (pc) {
            return {
              number:            _tryNum(pc["@number"]),
              name:              pc["@name"],
              turnout:           _tryNum(pc["@turnout"]),
              percentageTurnout: _tryNum(pc["@percentageTurnout"]),
              winningParty:      pc["@winningParty"],
              majority:          _tryNum(pc["@majority"]),
              percentageMajority: _tryNum(pc["@percentageMajority"]),
              candidates: _arr(pc.Candidate).map(function (c) {
                var party = c.Party || {};
                return {
                  elected:    c["@elected"],
                  paId:       c["@paId"],
                  firstName:  c["@firstName"],
                  surname:    c["@surname"],
                  ballotName: c["@ballotName"],
                  sex:        c["@sex"],
                  party: {
                    paId:         party["@paId"],
                    name:         party["@name"],
                    abbreviation: party["@abbreviation"],
                    key:          resolvePartyKey(party["@paId"], party["@abbreviation"]),
                    votes:        _tryNum(party["@votes"]),
                    percentageShare: _tryNum(party["@percentageShare"])
                  }
                };
              }),
              parties: _arr(pc.Party).map(function (p) {
                return {
                  paId:         p["@paId"],
                  abbreviation: p["@abbreviation"],
                  name:         p["@name"],
                  key:          resolvePartyKey(p["@paId"], p["@abbreviation"]),
                  votes:        _tryNum(p["@votes"]),
                  percentageShare: _tryNum(p["@percentageShare"])
                };
              })
            };
          })
        };
      });
    }

    results.push(r);
  }
  return results;
}

/* ── Local election nominations ────────────────────────────────────────── */

function normalizeLocalNominations(raw) {
  var results = [];
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var wrapper = item.LocalElectionNominations;
    if (!wrapper) continue;

    var election = wrapper.Election || {};
    var council = election.Council || {};

    results.push({
      name:       council["@name"],
      paId:       council["@paId"],
      type:       council["@type"],
      proportion: council["@proportion"],
      parties: _arr(council.Party).map(function (p) {
        return {
          name:              p["@name"],
          abbreviation:      p["@abbreviation"],
          paId:              p["@paId"],
          key:               resolvePartyKey(p["@paId"], p["@abbreviation"]),
          seatsHeld:         _tryNum(p["@seatsHeld"]),
          seatsOffered:      _tryNum(p["@seatsOffered"]),
          unopposedReturns:  _tryNum(p["@unopposedReturns"]),
          candidates:        _tryNum(p["@candidates"])
        };
      }),
      election: {
        date: election["@date"],
        paId: election["@paId"]
      }
    });
  }
  return results;
}

/* ── FPTP nominations (mayoral + Scottish constituencies) ──────────────── */

function normalizeFPTPNominations(raw) {
  var results = [];
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var wrapper = item.FirstPastThePostNominations;
    if (!wrapper) continue;

    var election = wrapper.Election || {};
    var cons = election.Constituency || {};

    results.push({
      number:     _tryNum(cons["@number"]),
      name:       cons["@name"],
      electorate: _tryNum(cons["@electorate"]),
      candidates: _arr(cons.Candidate).map(function (c) {
        var party = c.Party || {};
        return {
          paId:       c["@paId"],
          firstName:  c["@firstName"],
          surname:    c["@surname"],
          ballotName: c["@ballotName"],
          party: {
            paId:         party["@paId"],
            name:         party["@name"],
            abbreviation: party["@abbreviation"],
            key:          resolvePartyKey(party["@paId"], party["@abbreviation"])
          }
        };
      }),
      election: {
        name: election["@name"],
        date: election["@date"],
        type: election["@type"]
      }
    });
  }
  return results;
}

/* ── TopUp nominations (Scottish regional + Welsh) ─────────────────────── */

function normalizeTopUpNominations(raw) {
  var results = [];
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var wrapper = item.TopUpNominations;
    if (!wrapper) continue;

    var election = wrapper.Election || {};
    var cons = election.Constituency || {};

    results.push({
      number:     _tryNum(cons["@number"]),
      name:       cons["@name"],
      electorate: _tryNum(cons["@electorate"]),
      candidates: _arr(cons.Candidate).map(function (c) {
        var party = c.Party || {};
        return {
          paId:          c["@paId"],
          firstName:     c["@firstName"],
          surname:       c["@surname"],
          ballotName:    c["@ballotName"],
          partyListRank: _tryNum(c["@partyListRank"]),
          party: {
            paId:         party["@paId"],
            abbreviation: party["@abbreviation"],
            name:         party["@name"],
            key:          resolvePartyKey(party["@paId"], party["@abbreviation"])
          }
        };
      }),
      election: {
        name: election["@name"],
        date: election["@date"],
        type: election["@type"]
      }
    });
  }
  return results;
}


// ── party-config.js ─────────────────────────────────────────────
/**
 * Party colours & names — shared config
 *
 * Architecture:
 *  PARTY_REGISTRY[canonicalKey] → { name, short, colour }
 *  PA_ID_LOOKUP[paId]           → canonicalKey
 *  ABBREVIATION_FALLBACK[abbr]  → canonicalKey
 *
 * Helper functions accept either a canonical key or a PA abbreviation.
 */

/* ── Canonical Party Registry ──────────────────────────────────────────── */

var PARTY_REGISTRY = {
  con:      { name: "Conservative",            short: "Con",   colour: "#005FD4" },
  lab:      { name: "Labour",                  short: "Lab",   colour: "#E6170C" },
  ld:       { name: "Liberal Democrats",       short: "LD",    colour: "#FFB300" },
  green:    { name: "Green",                   short: "Grn",   colour: "#005414" },
  reform:   { name: "Reform UK",              short: "Ref",   colour: "#2EEBFF" },
  snp:      { name: "SNP",                    short: "SNP",   colour: "#ffff54" },
  alba:     { name: "Alba Party",             short: "Alba",  colour: "#005EB8" },
  pc:       { name: "Plaid Cymru",            short: "PC",    colour: "#5BD65B" },
  ind:      { name: "Independent",            short: "Ind",   colour: "#181818" },
  r:        { name: "Ratepayers/Residents",   short: "R",     colour: "#ff8faa" },
  your:     { name: "Your Party",             short: "Your",  colour: "#7E57C2" },
  noc:      { name: "No overall control",     short: "NOC",   colour: "#CCCCCC" },
  other:    { name: "Other",                  short: "Other", colour: "#CCCCCC" },

  /* ── NI ──────────────────────────────────────────────────────────── */
  dup:      { name: "DUP",                    short: "DUP",   colour: "#931100" },
  sf:       { name: "Sinn Féin",              short: "SF",    colour: "#1FCA90" },
  sdlp:     { name: "SDLP",                   short: "SDLP",  colour: "#158336" },
  apni:     { name: "Alliance",               short: "APNI",  colour: "#D3911C" },
  uup:      { name: "UUP",                    short: "UUP",   colour: "#48A5EE" },

  /* ── Welsh ───────────────────────────────────────────────────────── */
  gwlad:    { name: "Gwlad Gwlad",            short: "Gwl",   colour: "#D4002A" },
  propel:   { name: "Propel",                 short: "Prop",  colour: "#00A86B" },
  abolish:  { name: "Abolish",                short: "Abol",  colour: "#6B2C91" },

  /* ── Mayoral ─────────────────────────────────────────────────────── */
  aspire:   { name: "Aspire",                 short: "Asp",   colour: "#00A99D" },

  /* ── Minor (Scottish, Welsh, cross-election) ─────────────────────── */
  ukip:     { name: "UKIP",                          short: "UKIP",  colour: "#70147A" },
  ssp:      { name: "Scottish Socialist Party",      short: "SSP",   colour: "#E53935" },
  tusc:     { name: "TUSC",                          short: "TUSC",  colour: "#BF360C" },
  animal:   { name: "Animal Welfare Party",          short: "AWP",   colour: "#C2185B" },
  reclaim:  { name: "Reclaim Party",                 short: "Recl",  colour: "#152856" },
  comm_brit:{ name: "Communist Party of Britain",    short: "Comm",  colour: "#8B0000" },
  slp:      { name: "Scottish Libertarian Party",    short: "SLP",   colour: "#B71C1C" },
  renew:    { name: "Renew",                         short: "Rnw",   colour: "#582C83" },
  wpb:      { name: "Workers Party",                 short: "WPB",   colour: "#770000" },
  wep:      { name: "Women's Equality Party",        short: "WEP",   colour: "#2E8B57" },
  fa:       { name: "Freedom Alliance",              short: "FA",    colour: "#B8860B" },
  lib:      { name: "Liberal Party",                 short: "Lib",   colour: "#EB7F00" },
  igv:      { name: "Independent Green Voice",       short: "IGV",   colour: "#66BB6A" },
  scf:      { name: "Scotia Future",                 short: "ScF",   colour: "#1E3765" },
  sfp:      { name: "Scottish Family Party",         short: "SFP",   colour: "#1E3765" },
  rs:       { name: "Restore Scotland",              short: "RS",    colour: "#5C6BC0" },
  soc_dem:  { name: "Social Democratic Party",       short: "SDP",   colour: "#843B62" },
  nd:       { name: "No Description",                short: "ND",    colour: "#607D8B" },
  unity:    { name: "Unity",                         short: "Uni",   colour: "#795548" },
  vanguard: { name: "Vanguard",                      short: "Van",   colour: "#455A64" },
  liberate: { name: "Alliance to Liberate Scotland", short: "Lib",   colour: "#1565C0" },
  common:   { name: "Scottish Common Party",         short: "Com",   colour: "#6D4C41" },
  advance_uk:{ name: "Advance UK",                   short: "Adv",   colour: "#37474F" },
  equality: { name: "Equality Party",                short: "Eq",    colour: "#7B1FA2" },
  scp:      { name: "Scottish Christian Party",      short: "SCP",   colour: "#1B5E20" },
  srp:      { name: "Scottish Rural Party",          short: "SRP",   colour: "#33691E" },
  eelp:     { name: "Edinburgh & East Lothian People", short: "EELP", colour: "#4E342E" },
  heritage: { name: "Heritage Party",                short: "Hrtg",  colour: "#5D4037" },
  soc_lab:  { name: "Socialist Labour Party",        short: "SocL",  colour: "#CC0000" },
  adf:      { name: "Alliance for Democracy and Freedom", short: "ADF", colour: "#546E7A" },
};

/* ── PA ID → Canonical Key Lookup ──────────────────────────────────────── */
// paIds are unique within any given PA election event but the same party
// receives different IDs across elections. This flat table maps every known
// paId to the canonical key in PARTY_REGISTRY.

var PA_ID_LOOKUP = {
  /* ── Local Elections ─────────────────────────────────────────────── */
  659: "con", 662: "lab", 667: "ld", 660: "green", 664: "reform",
  661: "ind", 663: "r", 671: "your",

  /* ── Mayoral Elections ───────────────────────────────────────────── */
  13899: "con", 13900: "lab", 13894: "ld", 13895: "green", 13896: "reform",
  13931: "aspire",
  13933: "ind", 13934: "ind", 13935: "ind", 13936: "ind", 13937: "ind",
  13938: "ind", 13939: "ind", 13940: "ind", 13941: "ind", 13942: "ind",
  13943: "ind", 13944: "ind",

  /* ── Scottish FPTP 2026 ──────────────────────────────────────────── */
  13786: "con", 13787: "lab", 13789: "ld", 13790: "snp", 13791: "green",
  13813: "reform", 13804: "comm_brit", 13814: "lib", 13819: "rs",
  13822: "scf", 13824: "sfp", 13825: "nd", 13826: "fa", 13836: "vanguard",
  13838: "reclaim", 13856: "slp", 13878: "tusc", 13880: "ukip",
  13886: "ind", 13945: "ind", 13946: "ind",

  /* ── Scottish FPTP 2021 (historical/previous election data) ──────── */
  10345: "con", 10346: "lab", 10348: "ld", 10349: "snp", 10350: "green",
  10363: "comm_brit", 10379: "nd", 10397: "slp", 10408: "tusc",
  10409: "ukip", 10631: "rs", 10633: "scf", 10634: "sfp", 10635: "fa",
  10640: "vanguard",
  10642: "ind", 10652: "ind", 10658: "ind", 10662: "ind", 10702: "ind",

  /* ── Scottish Regional 2026 ──────────────────────────────────────── */
  13796: "animal", 13828: "abolish", 13930: "igv",
  14041: "liberate", 14042: "common", 14044: "advance_uk", 14045: "adf",
  14046: "wpb", 14048: "eelp", 14049: "ssp", 14050: "equality",
  14051: "scp", 14052: "srp", 14053: "heritage", 14054: "soc_lab",

  /* ── Scottish Regional 2021 ──────────────────────────────────────── */
  10355: "animal", 10411: "wep", 10624: "alba", 10626: "reform",
  10636: "abolish", 10637: "unity", 10638: "igv", 10639: "renew",
  10641: "reclaim", 10644: "soc_dem",

  /* ── Scottish Notional/State-of-Parties ──────────────────────────── */
  13518: "con", 13519: "lab", 13520: "ld", 13521: "snp", 13522: "green",
  13523: "reform", 13524: "ind", 13525: "sfp", 13526: "ssp", 13527: "ukip",
  13921: "con", 13922: "snp", 13923: "lab", 13925: "alba",
  13927: "ld", 13928: "reform", 13929: "green",

  /* ── Welsh Elections ─────────────────────────────────────────────── */
  13708: "con", 13709: "lab", 13712: "ld", 13706: "green", 13707: "reform",
  13705: "pc", 13710: "ukip", 13711: "gwlad", 13713: "abolish",
  13714: "comm_brit", 13731: "propel", 13745: "tusc", 13750: "wpb",
  13918: "ind",
};

/* ── Abbreviation → Canonical Key Fallback ─────────────────────────────── */
// Used when paId is not available (e.g. @winningParty, @sittingParty fields,
// StateOfParties messages, or legacy data without paId).

var ABBREVIATION_FALLBACK = {
  C: "con", Lab: "lab", LD: "ld", Green: "green", Reform: "reform",
  "Reform UK": "reform", SNP: "snp", Alba: "alba", PC: "pc",
  Ind: "ind", R: "r", Your: "your", NOC: "noc", Other: "other", Others: "other",
  DUP: "dup", SF: "sf", SDLP: "sdlp", APNI: "apni", UUP: "uup",
  Gwlad: "gwlad", Propel: "propel", Abolish: "abolish", Aspire: "aspire",
  UKIP: "ukip", SSP: "ssp", TUSC: "tusc", Animal: "animal",
  Reclaim: "reclaim", "Comm Brit": "comm_brit", SLP: "slp", Renew: "renew",
  WP: "wpb", WPB: "wpb", WEP: "wep", FA: "fa", Lib: "lib", IGV: "igv",
  ScF: "scf", SFP: "sfp", RS: "rs", "Soc Dem": "soc_dem", ND: "nd",
  Unity: "unity", Vanguard: "vanguard", Liberate: "liberate", Common: "common",
  "Advance UK": "advance_uk", Equality: "equality", SCP: "scp", SRP: "srp",
  EELP: "eelp", Heritage: "heritage", "Soc Lab": "soc_lab", ADF: "adf",
};

/* ── Party SVG Icon Map ─────────────────────────────────────────────────── */

var PARTY_SVG_MAP = {
  con: "CON.svg", lab: "LAB.svg", ld: "LIB_DEM.svg",
  green: "GREEN.svg", reform: "REFORM.svg", ind: "IND_BLACK.svg",
  snp: "SNP.svg", pc: "PLAID.svg",
  r: "RATEPAYERS_RES.svg", your: "YP.svg", other: "OTHER.svg",
  noc: "NOC_GREY.svg",
};

var _PARTY_ICON_BASE = "img/party-icons/";

function partyIconUrl(keyOrAbbr) {
  var key = PARTY_REGISTRY[keyOrAbbr] ? keyOrAbbr : (ABBREVIATION_FALLBACK[keyOrAbbr] || null);
  var filename = key && PARTY_SVG_MAP[key];
  return filename ? _PARTY_ICON_BASE + filename : null;
}

// Inline SVG icons for parties that need text rather than a graphic symbol.
var PARTY_INLINE_ICONS = {
};

function partyInlineIcon(keyOrAbbr) {
  var key = PARTY_REGISTRY[keyOrAbbr] ? keyOrAbbr : (ABBREVIATION_FALLBACK[keyOrAbbr] || null);
  return (key && PARTY_INLINE_ICONS[key]) || null;
}

// Returns inline SVG: OTHER.svg cross/asterisk shape, background recoloured to hex.
// The inner polygon shares the background colour (cutout effect), so both fills change.
function partyFallbackIconSvg(hex) {
  var c = String(hex).replace(/[^#0-9a-fA-F]/g, "");
  var fg = textColourForBg(c);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 97.265386 97.265386" width="100%" height="100%">' +
    '<circle cx="48.632693" cy="48.632693" r="48.632693" fill="' + c + '"/>' +
    '<path d="M77.73247,66.834141H9.42633l12.125578-8.8061h68.30614l-12.125578,8.8061ZM15.99548,64.700339h61.043088l6.249288-4.538496H22.244769l-6.249288,4.538496Z" fill="' + fg + '"/>' +
    '<path d="M60.925791,62.431054l-33.897491-9.273732,9.275129-33.896794,33.897491,9.273732-9.275129,33.896794Z" fill="' + fg + '"/>' +
    '<polygon points="66.685187 30.542283 58.926029 58.91542 30.542327 51.15775 38.310562 22.772561 66.685187 30.542283" fill="' + c + '"/>' +
    '<rect x="46.469133" y="33.186123" width="4.290954" height="17.70378" transform="translate(-14.441604 29.608665) rotate(-29.699695)" fill="' + fg + '"/>' +
    '<rect x="39.76259" y="39.89219" width="17.704041" height="4.291645" transform="translate(-14.444156 29.62162) rotate(-29.711467)" fill="' + fg + '"/>' +
    '</svg>';
}

/* ── Legacy PARTY alias (backward-compatible) ──────────────────────────── */
// Some external code may reference PARTY directly. Keep as a derived view.
var PARTY = {};
(function () {
  // Populate PARTY keyed by abbreviation for backward compat
  for (var abbr in ABBREVIATION_FALLBACK) {
    var key = ABBREVIATION_FALLBACK[abbr];
    if (PARTY_REGISTRY[key]) PARTY[abbr] = PARTY_REGISTRY[key];
  }
  // Also add canonical keys themselves
  for (var k in PARTY_REGISTRY) {
    PARTY[k] = PARTY_REGISTRY[k];
  }
})();

/* ── Party lists (per nation) ──────────────────────────────────────────── */

// Parties always grouped into "Other" (per nation)
var MINOR_PARTIES_ENGLAND  = ["R", "Your", "Aspire", "UKIP"];
var MINOR_PARTIES_SCOTLAND = ["Alba", "SSP", "TUSC", "Animal", "Reclaim", "Comm Brit", "SLP", "Renew", "WEP", "FA", "Lib", "IGV", "ScF", "SFP", "RS", "Soc Dem", "ND", "Unity", "Vanguard", "Others"];
var MINOR_PARTIES_WALES    = ["Gwlad", "Propel", "Abolish", "TUSC", "UKIP", "Comm Brit", "WP"];

// Major parties shown in seats view (Scotland scoreboard)
var MAJOR_PARTIES_SCOTLAND = ["snp", "con", "lab", "ld", "green", "reform", "alba"];

/* ── Lookup helpers ────────────────────────────────────────────────────── */

/**
 * Resolve a PA party ID (or abbreviation) to a canonical registry key.
 * @param {string|number} paId - PA party ID (optional)
 * @param {string} abbreviation - PA abbreviation fallback
 * @returns {string} canonical key (e.g. "con", "lab")
 */
function resolvePartyKey(paId, abbreviation) {
  if (paId != null && PA_ID_LOOKUP[paId]) return PA_ID_LOOKUP[paId];
  if (abbreviation && ABBREVIATION_FALLBACK[abbreviation]) return ABBREVIATION_FALLBACK[abbreviation];
  return "other";
}

function partyColour(keyOrAbbr) {
  var entry = PARTY_REGISTRY[keyOrAbbr];
  if (entry) return entry.colour;
  var canonKey = ABBREVIATION_FALLBACK[keyOrAbbr];
  if (canonKey && PARTY_REGISTRY[canonKey]) return PARTY_REGISTRY[canonKey].colour;
  return PARTY_REGISTRY.other.colour;
}

function partyName(keyOrAbbr) {
  var entry = PARTY_REGISTRY[keyOrAbbr];
  if (entry) return entry.name;
  var canonKey = ABBREVIATION_FALLBACK[keyOrAbbr];
  if (canonKey && PARTY_REGISTRY[canonKey]) return PARTY_REGISTRY[canonKey].name;
  return keyOrAbbr;
}

function partyShortName(keyOrAbbr) {
  var entry = PARTY_REGISTRY[keyOrAbbr];
  if (entry) return entry.short;
  var canonKey = ABBREVIATION_FALLBACK[keyOrAbbr];
  if (canonKey && PARTY_REGISTRY[canonKey]) return PARTY_REGISTRY[canonKey].short;
  return keyOrAbbr;
}


// ── hemicycle.js ────────────────────────────────────────────────
/**
 * Hemicycle Component
 * EU Parliament–style: concentric arcs of small circles
 * Requires: d3.js, party-config.js
 */

/**
 * Compute hemicycle layout geometry from arc angle and radius.
 * @param {number} arcAngle - Total arc sweep in degrees (e.g. 200)
 * @param {number} r - Outer radius in px
 * @param {number} width - SVG width in px
 * @returns {{ height, cx, cy, padding }}
 */
function hemicycleLayout(arcAngle, r, width) {
  const arcRad = arcAngle * Math.PI / 180;
  const padding = (Math.PI - arcRad) / 2;

  // How far the arc endpoints dip below the center line
  const dipBelow = arcRad > Math.PI ? r * Math.sin(Math.abs(padding)) : 0;

  // Vertical space: top margin + arc height + dip below horizontal + dot overflow
  const topMargin = r * 0.05;
  const dotPadding = r * 0.06;
  const height = topMargin + r + dipBelow + dotPadding;
  const cx = width / 2;
  const cy = topMargin + r;

  return { height, cx, cy, padding };
}

function hemicycle(container, parties, options = {}) {
  const {
    width = 400,
    outerRadius = null,
    arcAngle = 200,
    showMajorityLine = true,
    showLabels = true,
    labelMinSeats = 3,
  } = options;

  const totalSeats = parties.reduce((s, p) => s + p.seats, 0);
  const majorityLine = Math.floor(totalSeats / 2) + 1;

  const r = outerRadius || width * 0.45;
  const { height, cx, cy, padding } = hemicycleLayout(arcAngle, r, width);

  // Determine ring layout — pick smallest numRings where ideal packing fits totalSeats
  const innerRadiusFrac = 0.38;
  const usableArc = Math.PI - 2 * padding; // arc sweep in radians
  let numRings = 3;
  for (let n = 3; n <= 8; n++) {
    const gap = r * (1 - innerRadiusFrac) / n;
    let ideal = 0;
    for (let i = 0; i < n; i++) {
      ideal += (r * innerRadiusFrac + gap * (i + 0.5)) * usableArc / gap;
    }
    numRings = n;
    if (ideal >= totalSeats) break;
  }
  const ringGap = (r - r * innerRadiusFrac) / numRings;

  // Distribute seats so angular spacing ≈ radial spacing on each ring
  const ringRadii = [];
  const idealSeats = [];

  for (let i = 0; i < numRings; i++) {
    const ringR = r * innerRadiusFrac + ringGap * (i + 0.5);
    ringRadii.push(ringR);
    idealSeats.push(ringR * usableArc / ringGap);
  }
  const idealTotal = idealSeats.reduce((a, b) => a + b, 0);

  const ringSeats = idealSeats.map(s => Math.round((s / idealTotal) * totalSeats));
  let diff = totalSeats - ringSeats.reduce((a, b) => a + b, 0);
  for (let i = ringSeats.length - 1; diff !== 0; i = (i - 1 + ringSeats.length) % ringSeats.length) {
    if (diff > 0) { ringSeats[i]++; diff--; }
    else { ringSeats[i]--; diff++; }
  }

  // Create flat list of seat positions
  const seats = [];
  for (let ring = 0; ring < numRings; ring++) {
    const ringR = ringRadii[ring];
    const n = ringSeats[ring];
    for (let j = 0; j < n; j++) {
      const angle = Math.PI - padding - (j / (n - 1 || 1)) * (Math.PI - 2 * padding);
      seats.push({
        x: cx + ringR * Math.cos(angle),
        y: cy - ringR * Math.sin(angle),
        angle,
        ring,
        indexInRing: j,
      });
    }
  }

  // Sort by angle (descending) for left-to-right party assignment
  seats.sort((a, b) => b.angle - a.angle || a.ring - b.ring);

  // Assign party colours to seats
  let seatIdx = 0;
  for (const party of parties) {
    for (let j = 0; j < party.seats; j++) {
      if (seatIdx < seats.length) {
        seats[seatIdx].party = party.name;
        seats[seatIdx].colour = partyColour(party.name);
        seats[seatIdx].striped = !!party.striped;
        seatIdx++;
      }
    }
  }

  const circleR = Math.min(
    ringGap * 0.50,
    (Math.PI * ringRadii[0]) / (ringSeats[0] * 2.0)
  );

  // Clear and create SVG
  const el = d3.select(container);
  el.selectAll("*").remove();

  const svg = el.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("max-width", "100%");

  // Draw seat circles (handlers added after text elements are created)
  svg.selectAll("circle.seat")
    .data(seats)
    .join("circle")
    .attr("class", "seat")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", circleR)
    .attr("fill", d => d.striped ? "#fff" : (d.colour || "#ddd"))
    .attr("stroke", d => d.striped ? (d.colour || "#ddd") : "#fff")
    .attr("stroke-width", d => d.striped ? circleR * 0.4 : circleR * 0.15);

  // Majority line — curved path threading between the correct seats on each ring
  // The line is drawn at the halfway mark (majorityLine - 1 seats before it),
  // so that the majorityLine-th seat is the first one visually past the line.
  if (showMajorityLine && totalSeats > 1) {
    const clearance = circleR * 1.5;
    const majLineIdx = majorityLine - 1; // line sits between seat majLineIdx-1 and majLineIdx

    // Tag each seat with its sorted global index
    seats.forEach((s, i) => { s.globalIdx = i; });

    // For each ring, collect the seats sorted by their global index
    // and find which pair straddles the majority boundary
    const ringGapAngles = [];
    for (let ring = 0; ring < numRings; ring++) {
      const ringR = ringRadii[ring];
      const n = ringSeats[ring];

      // Get seats on this ring, sorted by global index (left-to-right)
      const ringSeatsArr = seats.filter(s => s.ring === ring).sort((a, b) => a.globalIdx - b.globalIdx);

      // Count seats on this ring before the line (globalIdx < majLineIdx)
      const countInMajority = ringSeatsArr.filter(s => s.globalIdx < majLineIdx).length;

      // The gap is between local seat [countInMajority - 1] and [countInMajority]
      let gapAngle;
      if (countInMajority <= 0) {
        // All seats on this ring are outside majority — line goes to the far left
        const firstAngle = Math.PI - padding - (0 / (n - 1 || 1)) * (Math.PI - 2 * padding);
        gapAngle = firstAngle + (Math.PI - 2 * padding) / (n - 1 || 1) * 0.5;
      } else if (countInMajority >= n) {
        // All seats on this ring are in majority — line goes to the far right
        const lastAngle = Math.PI - padding - ((n - 1) / (n - 1 || 1)) * (Math.PI - 2 * padding);
        gapAngle = lastAngle - (Math.PI - 2 * padding) / (n - 1 || 1) * 0.5;
      } else {
        // Normal case: gap between seat countInMajority-1 and countInMajority
        const seatLeft = ringSeatsArr[countInMajority - 1];
        const seatRight = ringSeatsArr[countInMajority];
        // Recover their angles from indexInRing
        const a1 = Math.PI - padding - (seatLeft.indexInRing / (n - 1 || 1)) * (Math.PI - 2 * padding);
        const a2 = Math.PI - padding - (seatRight.indexInRing / (n - 1 || 1)) * (Math.PI - 2 * padding);
        gapAngle = (a1 + a2) / 2;
      }

      ringGapAngles.push({ ringR, gapAngle });
    }

    const gapPoints = [];

    // Point just inside inner ring
    const preR = ringGapAngles[0].ringR - clearance;
    gapPoints.push([cx + preR * Math.cos(ringGapAngles[0].gapAngle), cy - preR * Math.sin(ringGapAngles[0].gapAngle)]);

    // Point on each ring
    for (const { ringR, gapAngle } of ringGapAngles) {
      gapPoints.push([cx + ringR * Math.cos(gapAngle), cy - ringR * Math.sin(gapAngle)]);
    }

    // Point just outside outer ring
    const lastGap = ringGapAngles[ringGapAngles.length - 1];
    const postR = lastGap.ringR + clearance;
    gapPoints.push([cx + postR * Math.cos(lastGap.gapAngle), cy - postR * Math.sin(lastGap.gapAngle)]);

    const line = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
    svg.append("path")
      .attr("d", line(gapPoints))
      .attr("fill", "none")
      .attr("stroke", "#181818")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,3")
      .attr("opacity", 0.7);
  }

  // Centre text — anchored so bottom text aligns with inner row bottom
  const bigFont = Math.max(14, width * 0.055);
  const smallFont = Math.max(9, width * 0.028);
  // Bottom of innermost ring = y of endpoint dots (where arc meets baseline)
  const innerBottomY = cy - ringRadii[0] * Math.sin(padding) + circleR;
  const textBaseY = innerBottomY;
  const majTextY = cy - ringRadii[0] + circleR + smallFont * 2.5;

  // "X for majority" — fixed at top of hollow (just below inner ring)
  const majText = svg.append("text")
    .attr("class", "hemi-label hemi-label--maj")
    .attr("x", cx)
    .attr("y", majTextY)
    .attr("text-anchor", "middle")
    .attr("font-size", smallFont)
    .attr("fill", "#888")
    .attr("font-family", "'Inter', sans-serif");

  if (showMajorityLine) {
    if (width >= 250) {
      majText.text(`${majorityLine} for majority`);
    } else {
      majText.append("tspan").attr("x", cx).text(`${majorityLine}`);
      majText.append("tspan").attr("x", cx).attr("dy", smallFont * 1.2).text("for majority");
    }
  }

  // Party name — shown on hover (just above seats text)
  const partyFont = Math.max(12, width * 0.038);
  const partyText = svg.append("text")
    .attr("class", "hemi-label hemi-label--party")
    .attr("x", cx)
    .attr("y", textBaseY - bigFont * 1.05)
    .attr("text-anchor", "middle")
    .attr("font-size", partyFont)
    .attr("fill", "#888")
    .attr("font-family", "'Inter', sans-serif");

  // "X seats" — below (bottom-aligned)
  const seatsText = svg.append("text")
    .attr("class", "hemi-label hemi-label--seats")
    .attr("x", cx)
    .attr("y", textBaseY)
    .attr("text-anchor", "middle")
    .attr("font-size", bigFont)
    .attr("font-weight", "bold")
    .attr("fill", "#222")
    .attr("font-family", "'Inter', sans-serif")
    .text(`${totalSeats} seats`);

  function labelFillForParty(partyAbbr) {
    const hex = partyColour(partyAbbr);
    const col = d3.color(hex);
    if (!col) return "#222";
    const luminance = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
    return luminance > 160 ? "#222" : hex;
  }

  // ── Hover / tap interactivity ──
  // Build invisible convex-hull hit-areas per party so hovering the
  // combined zone (including gaps between circles) triggers highlight.
  const allCircles = svg.selectAll("circle.seat");

  // Group seat positions by party
  const partySeatsMap = {};
  for (const s of seats) {
    if (!s.party) continue;
    if (!partySeatsMap[s.party]) partySeatsMap[s.party] = [];
    partySeatsMap[s.party].push([s.x, s.y]);
  }

  // Create a hit-area group rendered behind the circles
  const hitGroup = svg.insert("g", "circle.seat").attr("class", "hit-areas");

  for (const [partyAbbr, points] of Object.entries(partySeatsMap)) {
    if (points.length < 3) {
      // For tiny parties (1-2 seats), use inflated circles as hit area
      for (const pt of points) {
        hitGroup.append("circle")
          .attr("cx", pt[0])
          .attr("cy", pt[1])
          .attr("r", circleR * 2.2)
          .attr("fill", "transparent")
          .style("cursor", "pointer")
          .datum(partyAbbr)
          .on("mouseenter", function(event, d) { showPartyHighlight(d); })
          .on("mouseleave", resetHighlight)
          .on("touchstart", function(event, d) { event.preventDefault(); showPartyHighlight(d); })
          .on("touchend", function() { setTimeout(resetHighlight, 1500); });
      }
    } else {
      // Compute convex hull and pad it outward
      const hull = d3.polygonHull(points);
      if (!hull) continue;

      // Expand hull outward by circleR so gaps between circles are covered
      const centroid = d3.polygonCentroid(hull);
      const expanded = hull.map(pt => {
        const dx = pt[0] - centroid[0];
        const dy = pt[1] - centroid[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = (dist + circleR * 1.5) / dist;
        return [centroid[0] + dx * scale, centroid[1] + dy * scale];
      });

      hitGroup.append("polygon")
        .attr("points", expanded.map(p => p.join(",")).join(" "))
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .datum(partyAbbr)
        .on("mouseenter", function(event, d) { showPartyHighlight(d); })
        .on("mouseleave", resetHighlight)
        .on("touchstart", function(event, d) { event.preventDefault(); showPartyHighlight(d); })
        .on("touchend", function() { setTimeout(resetHighlight, 1500); });
    }
  }

  function showPartyHighlight(partyAbbr) {
    allCircles
      .attr("opacity", d => d.party === partyAbbr ? 1 : 0.2);

    // Sum all entries for this party (solid + hollow may be separate)
    const count = parties.reduce((s, p) => p.name === partyAbbr ? s + p.seats : s, 0);

    partyText
      .text(partyShortName(partyAbbr))
      .attr("fill", labelFillForParty(partyAbbr))
      .attr("font-weight", "bold");

    seatsText
      .text(`${count} seats`);
  }

  function resetHighlight() {
    allCircles.attr("opacity", 1);
    partyText
      .text("")
      .attr("fill", "#888")
      .attr("font-weight", "normal");
    seatsText
      .text(`${totalSeats} seats`);
  }

  // Attach handlers to the seat circles as well (hulls cover gaps, circles cover dots)
  allCircles
    .style("cursor", "pointer")
    .on("mouseenter", function(event, d) { showPartyHighlight(d.party); })
    .on("mouseleave", resetHighlight)
    .on("touchstart", function(event, d) { event.preventDefault(); showPartyHighlight(d.party); })
    .on("touchend", function() { setTimeout(resetHighlight, 1500); });

  return svg.node();
}


// ── badge.js ────────────────────────────────────────────────────
/**
 * Gain/Hold Badge Component
 * Requires: d3.js, party-config.js
 */
function gainHoldBadge(container, { winningParty, gainOrHold, sittingParty }, options = {}) {
  const el = d3.select(container);
  el.selectAll("*").remove();

  const wFull = partyName(winningParty);
  const sFull = partyName(sittingParty);
  const wShort = partyShortName(winningParty);
  const sShort = partyShortName(sittingParty);

  // If fullNames not requested, just use abbreviations everywhere
  const useFull = options.fullNames;

  function makeText(w, s) {
    if (gainOrHold === "gain") return `${w} gain from ${s}`;
    if (gainOrHold === "lose to NOC") return `${s} loss to NOC`;
    return `${w} hold`;
  }

  function autoTextColour(hex) {
    return textColourForBg(hex);
  }

  let bgColour, textColour;
  if (gainOrHold === "gain") {
    bgColour = partyColour(winningParty);
  } else if (gainOrHold === "lose to NOC") {
    bgColour = "#666";
  } else {
    bgColour = partyColour(winningParty);
  }
  textColour = autoTextColour(bgColour);

  if (useFull) {
    // Render two spans: full (desktop) and short (mobile), toggled by CSS
    const badge = el.append("span")
      .attr("class", "gain-hold-badge")
      .style("font-weight", "700")
      .style("background", bgColour)
      .style("color", textColour);
    badge.append("span").attr("class", "badge-full").text(makeText(wFull, sFull));
    badge.append("span").attr("class", "badge-short").text(makeText(wShort, sShort));
  } else {
    el.append("span")
      .attr("class", "gain-hold-badge")
      .style("font-weight", "700")
      .style("background", bgColour)
      .style("color", textColour)
      .text(makeText(wShort, sShort));
  }
}


// ── progress.js ─────────────────────────────────────────────────
/**
 * Progress Counter Component
 * Requires: d3.js
 */
function progressCounter(container, { declared, total, label = "councils" }) {
  const el = d3.select(container);
  el.selectAll("*").remove();

  const wrap = el.append("div").attr("class", "progress-counter");

  const barWrap = wrap.append("div").attr("class", "progress-bar");
  barWrap.append("div")
    .attr("class", "progress-bar__fill")
    .style("width", ((declared / total) * 100) + "%");
  barWrap.append("span")
    .attr("class", "progress-bar__text")
    .text(`${declared}/${total} ${label}`);
}


// ── council-card.js ─────────────────────────────────────────────
/**
 * Council Result Card Component
 * Requires: d3.js, party-config.js, hemicycle.js, badge.js
 */
function councilResultCard(container, council, options = {}) {
  const { size = "full" } = options;
  const el = d3.select(container);
  el.selectAll("*").remove();

  const card = el.append("div")
    .attr("class", `council-card council-card--${size}`);

  // Header: council name
  const header = card.append("div").attr("class", "council-card__header");

  header.append("h3")
    .attr("class", "council-card__name")
    .text(council.name);

  // Gain/hold badge (below header)
  const badgeEl = card.append("div").attr("class", "council-card__badge");
  gainHoldBadge(badgeEl.node(), council, { fullNames: size === "full" });

  // Hemicycle
  const hemiEl = card.append("div").attr("class", "council-card__hemicycle");
  const containerWidth = hemiEl.node().getBoundingClientRect().width;
  const hemiWidth = size === "mini"
    ? Math.min(200, Math.max(120, containerWidth * 0.9))
    : Math.min(320, Math.max(180, containerWidth * 0.8));

  const sortedParties = [...(council.newCouncil || [])].sort((a, b) => b.seats - a.seats);
  hemicycle(hemiEl.node(), sortedParties, {
    width: hemiWidth,
    showLabels: size === "full",
    showMajorityLine: true,
  });

  // Change bar chart (full size only)
  if (size === "full") {
    // Merge newCouncil parties with changes so 0-change parties appear
    const mergedChanges = (council.newCouncil || []).map(function (p) {
      const found = (council.changes || []).find(function (c) { return c.name === p.name; });
      return { name: p.name, change: found ? found.change : 0 };
    });
    if (mergedChanges.length > 0) {
      const barEl = card.append("div").style("margin-top", "12px");
      changeBarChart(barEl.node(), mergedChanges);
    }
  }

  return card.node();
}


// ── change-bar.js ───────────────────────────────────────────────
/**
 * Change Bar Chart Component
 * Full-width horizontal pos/neg bar chart with 0 centred
 * Requires: d3.js, party-config.js
 */
function changeBarChart(container, changes, options = {}) {
  const {
    barHeight = 28,
    gap = 6,
  } = options;

  const el = d3.select(container);
  el.selectAll("*").remove();

  if (!changes || changes.length === 0) return;

  // Sort: biggest positive first, then biggest negative
  const sorted = [...changes].sort((a, b) => b.change - a.change);

  const maxAbs = Math.max(...sorted.map(c => Math.abs(c.change)), 1);
  const labelWidth = 50;
  const width = 600; // viewBox width, scales to 100%
  const chartWidth = width - labelWidth * 2;
  const midX = width / 2;
  const height = sorted.length * (barHeight + gap) + gap;

  const svg = el.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Centre line
  svg.append("line")
    .attr("x1", midX)
    .attr("y1", 0)
    .attr("x2", midX)
    .attr("y2", height)
    .attr("stroke", "#ccc")
    .attr("stroke-width", 1);

  sorted.forEach((c, i) => {
    const y = gap + i * (barHeight + gap);
    const barW = Math.max((Math.abs(c.change) / maxAbs) * (chartWidth / 2), 1);
    const isPositive = c.change >= 0;
    const barX = isPositive ? midX : midX - barW;

    // Party label (left side for negative, right side for positive — outside the bar)
    svg.append("text")
      .attr("x", isPositive ? midX - 6 : midX + 6)
      .attr("y", y + barHeight / 2)
      .attr("text-anchor", isPositive ? "end" : "start")
      .attr("dominant-baseline", "central")
      .attr("font-size", 15)
      .attr("font-weight", 600)
      .attr("fill", "#444")
      .attr("font-family", "'Inter', sans-serif")
      .text(partyShortName(c.name));

    // Bar
    svg.append("rect")
      .attr("x", barX)
      .attr("y", y)
      .attr("width", barW)
      .attr("height", barHeight)
      .attr("rx", 2)
      .attr("fill", partyColour(c.name))
      .attr("opacity", 0.85);

    // Value label inside bar at the edge
    if (c.change !== 0) {
      const arrow = c.change > 0 ? "\u25B2" : "\u25BC";
      const valText = `${arrow}${Math.abs(c.change)}`;
      const textX = isPositive ? barX + barW - 5 : barX + 5;
      const anchor = isPositive ? "end" : "start";
      // Only show inside if bar is wide enough
      const minBarForLabel = 30;
      if (barW >= minBarForLabel) {
        // Pick white or black for contrast against party colour
        const col = d3.color(partyColour(c.name));
        const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
        const textFill = lum > 160 ? "#222" : "#fff";
        svg.append("text")
          .attr("x", textX)
          .attr("y", y + barHeight / 2)
          .attr("text-anchor", anchor)
          .attr("dominant-baseline", "central")
          .attr("font-size", 14)
          .attr("font-weight", 700)
          .attr("fill", textFill)
          .attr("font-family", "'Inter', sans-serif")
          .text(valText);
      } else {
        // Show outside the bar in black
        const outsideX = isPositive ? barX + barW + 5 : barX - 5;
        const outsideAnchor = isPositive ? "start" : "end";
        svg.append("text")
          .attr("x", outsideX)
          .attr("y", y + barHeight / 2)
          .attr("text-anchor", outsideAnchor)
          .attr("dominant-baseline", "central")
          .attr("font-size", 14)
          .attr("font-weight", 700)
          .attr("fill", "#444")
          .attr("font-family", "'Inter', sans-serif")
          .text(valText);
      }
    } else {
      // Zero change — show "—" next to party label
      svg.append("text")
        .attr("x", midX + 6)
        .attr("y", y + barHeight / 2)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "central")
        .attr("font-size", 14)
        .attr("font-weight", 700)
        .attr("fill", "#888")
        .attr("font-family", "'Inter', sans-serif")
        .text("\u2014");
    }
  });

  return svg.node();
}


// ── council-lookup.js ───────────────────────────────────────────
/**
 * Council name matching — maps result council names to GeoJSON feature names
 * Requires: nothing (standalone lookup)
 */

// County councils use the counties GeoJSON layer (type="England" in results)
const COUNTY_COUNCILS = new Set([
  "Essex", "Hampshire", "Norfolk", "Suffolk", "East Sussex", "West Sussex"
]);

// Manual overrides for names that can't be normalised automatically
const NAME_OVERRIDES = {
  "Hull": "Kingston upon Hull, City of",
  "St Helens": "St. Helens",
  "Newcastle-upon-Tyne": "Newcastle upon Tyne",
  "Kingston-upon-Thames": "Kingston upon Thames",
  "Richmond-upon-Thames": "Richmond upon Thames",
};

/**
 * Normalise a council name for fuzzy matching
 * Handles &→and, hyphens→spaces, strips ", City of" / ", County of", lowercases
 */
function normaliseName(name) {
  return name
    .replace(/&/g, "and")
    .replace(/-/g, " ")
    .replace(/,\s*(City|County)\s+of$/i, "")
    .replace(/\./g, "")
    .trim()
    .toLowerCase();
}

/**
 * Build a lookup: result council name → GeoJSON feature name
 * Call once with the arrays of LAD and county feature names from the GeoJSON
 */
function buildCouncilLookup(ladNames, countyNames) {
  // Build normalised index: normalised name → original GeoJSON name
  const ladIndex = {};
  for (const n of ladNames) {
    ladIndex[normaliseName(n)] = n;
  }
  const countyIndex = {};
  for (const n of countyNames) {
    countyIndex[normaliseName(n)] = n;
  }

  return {
    ladIndex,
    countyIndex,

    /**
     * Given a result object, return { geoName, layer } or null
     * layer is "lad" or "county"
     */
    resolve(result) {
      const name = result.name;

      // County councils → county layer
      if (COUNTY_COUNCILS.has(name) || result.type === "England") {
        const override = NAME_OVERRIDES[name];
        if (override && countyIndex[normaliseName(override)]) {
          return { geoName: override, layer: "county" };
        }
        const norm = normaliseName(name);
        if (countyIndex[norm]) {
          return { geoName: countyIndex[norm], layer: "county" };
        }
        return null;
      }

      // Manual override → LAD layer
      if (NAME_OVERRIDES[name]) {
        const overrideName = NAME_OVERRIDES[name];
        return { geoName: overrideName, layer: "lad" };
      }

      // Automatic normalised match → LAD layer
      const norm = normaliseName(name);
      if (ladIndex[norm]) {
        return { geoName: ladIndex[norm], layer: "lad" };
      }

      return null;
    }
  };
}


// ── pa-ons-lookup.js ────────────────────────────────────────────
/**
 * PA ID → ONS code lookup table
 * Generated by scripts/build_pa_ons_lookup.py — do not edit manually
 */
var PA_ONS_LOOKUP = {
  // paId → LAD25CD or CTY24CD
  localCouncils: {
    "4717": "E06000008",  // Blackburn with Darwen
    "4718": "E06000006",  // Halton
    "4719": "E06000001",  // Hartlepool
    "4721": "E06000042",  // Milton Keynes
    "4722": "E06000012",  // North East Lincolnshire
    "4723": "E06000031",  // Peterborough
    "4724": "E06000026",  // Plymouth
    "4725": "E06000044",  // Portsmouth
    "4726": "E06000038",  // Reading
    "4727": "E06000045",  // Southampton
    "4728": "E06000033",  // Southend-on-Sea
    "4729": "E06000030",  // Swindon
    "4730": "E06000034",  // Thurrock
    "4731": "E06000041",  // Wokingham
    "4732": "E08000038",  // Barnsley
    "4733": "E08000025",  // Birmingham
    "4734": "E08000032",  // Bradford
    "4735": "E08000001",  // Bolton
    "4736": "E08000002",  // Bury
    "4737": "E08000033",  // Calderdale
    "4738": "E08000026",  // Coventry
    "4739": "E08000027",  // Dudley
    "4740": "E08000037",  // Gateshead
    "4741": "E08000034",  // Kirklees
    "4742": "E08000011",  // Knowsley
    "4743": "E08000035",  // Leeds
    "4744": "E08000003",  // Manchester
    "4745": "E08000021",  // Newcastle-upon-Tyne
    "4746": "E08000022",  // North Tyneside
    "4747": "E08000004",  // Oldham
    "4748": "E08000005",  // Rochdale
    "4749": "E08000006",  // Salford
    "4750": "E08000028",  // Sandwell
    "4751": "E08000014",  // Sefton
    "4752": "E08000039",  // Sheffield
    "4753": "E08000029",  // Solihull
    "4754": "E08000023",  // South Tyneside
    "4755": "E08000013",  // St Helens
    "4756": "E08000007",  // Stockport
    "4757": "E08000024",  // Sunderland
    "4758": "E08000008",  // Tameside
    "4759": "E08000009",  // Trafford
    "4760": "E08000036",  // Wakefield
    "4761": "E08000030",  // Walsall
    "4762": "E08000010",  // Wigan
    "4764": "E07000223",  // Adur
    "4765": "E07000066",  // Basildon
    "4766": "E07000084",  // Basingstoke & Deane
    "4767": "E07000068",  // Brentwood
    "4768": "E07000095",  // Broxbourne
    "4769": "E07000117",  // Burnley
    "4770": "E07000008",  // Cambridge
    "4771": "E07000192",  // Cannock Chase
    "4773": "E07000078",  // Cheltenham
    "4774": "E07000177",  // Cherwell
    "4775": "E07000118",  // Chorley
    "4776": "E07000071",  // Colchester
    "4777": "E07000226",  // Crawley
    "4778": "E07000086",  // Eastleigh
    "4780": "E07000072",  // Epping Forest
    "4781": "E07000041",  // Exeter
    "4782": "E07000087",  // Fareham
    "4783": "E07000088",  // Gosport
    "4784": "E07000073",  // Harlow
    "4785": "E07000089",  // Hart
    "4786": "E07000062",  // Hastings
    "4787": "E07000090",  // Havant
    "4788": "E07000011",  // Huntingdonshire
    "4789": "E07000120",  // Hyndburn
    "4790": "E07000202",  // Ipswich
    "4791": "E07000138",  // Lincoln
    "4792": "E07000195",  // Newcastle-under-Lyme
    "4793": "E07000148",  // Norwich
    "4794": "E07000219",  // Nuneaton & Bedworth
    "4795": "E07000178",  // Oxford
    "4796": "E07000122",  // Pendle
    "4797": "E07000123",  // Preston
    "4798": "E07000236",  // Redditch
    "4799": "E07000075",  // Rochford
    "4801": "E07000220",  // Rugby
    "4802": "E07000092",  // Rushmoor
    "4803": "E07000012",  // South Cambridgeshire
    "4804": "E07000240",  // St Albans
    "4805": "E07000243",  // Stevenage
    "4806": "E07000199",  // Tamworth
    "4807": "E07000102",  // Three Rivers
    "4808": "E07000116",  // Tunbridge Wells
    "4809": "E07000103",  // Watford
    "4810": "E07000241",  // Welwyn Hatfield
    "4811": "E07000127",  // West Lancashire
    "4812": "E07000094",  // Winchester
    "4813": "E07000229",  // Worthing
    "4814": "E10000012",  // Essex
    "4815": "E10000014",  // Hampshire
    "4816": "E10000020",  // Norfolk
    "4817": "E10000029",  // Suffolk
    "4818": "E09000002",  // Barking & Dagenham
    "4819": "E09000003",  // Barnet
    "4820": "E09000005",  // Brent
    "4821": "E09000004",  // Bexley
    "4822": "E09000006",  // Bromley
    "4823": "E09000007",  // Camden
    "4824": "E09000008",  // Croydon
    "4825": "E09000009",  // Ealing
    "4826": "E09000010",  // Enfield
    "4827": "E09000011",  // Greenwich
    "4828": "E09000012",  // Hackney
    "4829": "E09000013",  // Hammersmith & Fulham
    "4830": "E09000014",  // Haringey
    "4831": "E09000015",  // Harrow
    "4832": "E09000016",  // Havering
    "4833": "E09000017",  // Hillingdon
    "4834": "E09000018",  // Hounslow
    "4835": "E09000019",  // Islington
    "4836": "E09000020",  // Kensington & Chelsea
    "4837": "E09000021",  // Kingston-upon-Thames
    "4838": "E09000022",  // Lambeth
    "4839": "E09000023",  // Lewisham
    "4840": "E09000024",  // Merton
    "4841": "E09000025",  // Newham
    "4842": "E09000026",  // Redbridge
    "4843": "E09000027",  // Richmond-upon-Thames
    "4844": "E09000028",  // Southwark
    "4845": "E09000029",  // Sutton
    "4846": "E09000030",  // Tower Hamlets
    "4847": "E09000031",  // Waltham Forest
    "4848": "E06000010",  // Hull
    "4849": "E06000046",  // Isle of Wight
    "4852": "E10000011",  // East Sussex
    "4853": "E07000181",  // West Oxfordshire
    "4854": "E09000032",  // Wandsworth
    "4855": "E09000033",  // Westminster
    "4856": "E10000032",  // West Sussex
    "4857": "E08000031",  // Wolverhampton
    "4858": "E06000083",  // East Surrey
    "4859": "E06000084"  // West Surrey
  },
  // number → LAD25CD
  mayoralAreas: {
    "1": "E09000008",  // Croydon
    "2": "E09000012",  // Hackney
    "3": "E09000023",  // Lewisham
    "4": "E09000025",  // Newham
    "5": "E09000030",  // Tower Hamlets
    "6": "E07000103"  // Watford
  },
  // number → SPC_CD
  scottishConstituencies: {
    "1": "S16000151",  // Aberdeen Central
    "2": "S16000152",  // Aberdeen Deeside & North Kincardine
    "3": "S16000153",  // Aberdeen Donside
    "4": "S16000154",  // Aberdeenshire East
    "5": "S16000155",  // Aberdeenshire West
    "6": "S16000156",  // Airdrie
    "7": "S16000157",  // Almond Valley
    "8": "S16000158",  // Angus North & Mearns
    "9": "S16000159",  // Angus South
    "10": "S16000160",  // Argyll & Bute
    "11": "S16000161",  // Ayr
    "12": "S16000162",  // Banffshire & Buchan Coast
    "13": "S16000163",  // Bathgate
    "14": "S16000164",  // Caithness, Sutherland & Ross
    "15": "S16000165",  // Carrick, Cumnock & Doon Valley
    "16": "S16000166",  // Clackmannanshire and Dunblane
    "17": "S16000167",  // Clydebank & Milngavie
    "18": "S16000168",  // Clydesdale
    "19": "S16000169",  // Coatbridge & Chryston
    "20": "S16000170",  // Cowdenbeath
    "21": "S16000171",  // Cumbernauld & Kilsyth
    "22": "S16000172",  // Cunninghame North
    "23": "S16000173",  // Cunninghame South
    "24": "S16000174",  // Dumbarton
    "25": "S16000175",  // Dumfriesshire
    "26": "S16000176",  // Dundee City East
    "27": "S16000177",  // Dundee City West
    "28": "S16000178",  // Dunfermline
    "29": "S16000179",  // East Kilbride
    "30": "S16000180",  // East Lothian Coast & Lammermuirs
    "31": "S16000181",  // Eastwood
    "32": "S16000182",  // Edinburgh Central
    "33": "S16000183",  // Edinburgh Eastern, Musselburgh and Tranent
    "34": "S16000184",  // Edinburgh North Eastern and Leith
    "35": "S16000185",  // Edinburgh North Western
    "36": "S16000186",  // Edinburgh Northern
    "37": "S16000187",  // Edinburgh South Western
    "38": "S16000188",  // Edinburgh Southern
    "39": "S16000189",  // Ettrick, Roxburgh & Berwickshire
    "40": "S16000190",  // Falkirk East & Linlithgow
    "41": "S16000191",  // Falkirk West
    "42": "S16000192",  // Fife North East
    "43": "S16000193",  // Galloway & Dumfries West
    "44": "S16000194",  // Glasgow Anniesland
    "45": "S16000195",  // Glasgow Baillieston and Shettleston
    "46": "S16000196",  // Glasgow Cathcart and Pollok
    "47": "S16000197",  // Glasgow Central
    "48": "S16000198",  // Glasgow Easterhouse and Springburn
    "49": "S16000199",  // Glasgow Kelvin & Maryhill
    "50": "S16000200",  // Glasgow Southside
    "51": "S16000201",  // Hamilton, Larkhall & Stonehouse
    "52": "S16000202",  // Inverclyde
    "53": "S16000203",  // Inverness & Nairn
    "54": "S16000204",  // Kilmarnock & Irvine Valley
    "55": "S16000205",  // Kirkcaldy
    "56": "S16000206",  // Fife Mid & Glenrothes
    "57": "S16000207",  // Midlothian North
    "58": "S16000208",  // Midlothian South, Tweeddale & Lauderdale
    "59": "S16000209",  // Moray
    "60": "S16000210",  // Motherwell & Wishaw
    "61": "S16000211",  // Na h-Eileanan an Iar
    "62": "S16000212",  // Orkney Islands
    "63": "S16000213",  // Paisley
    "64": "S16000214",  // Perthshire North
    "65": "S16000215",  // Perthshire South & Kinross-shire
    "66": "S16000216",  // Renfrewshire North & Cardonald
    "67": "S16000217",  // Renfrewshire West & Levern Valley
    "68": "S16000218",  // Rutherglen & Cambuslang
    "69": "S16000219",  // Shetland Islands
    "70": "S16000220",  // Skye, Lochaber and Badenoch
    "71": "S16000221",  // Stirling
    "72": "S16000222",  // Strathkelvin & Bearsden
    "73": "S16000223"  // Uddingston & Bellshill
  },
  // number → SPR_CD
  scottishRegions: {
    "101": "S17000022",  // Edinburgh & Lothians East
    "102": "S17000023",  // Glasgow
    "103": "S17000024",  // Highlands & Islands
    "104": "S17000021",  // Scotland Central & Lothians West
    "105": "S17000025",  // Scotland Mid & Fife
    "106": "S17000026",  // Scotland North East
    "107": "S17000027",  // Scotland South
    "108": "S17000028"  // Scotland West
  },
  // number → SENEDD_CD
  welshConstituencies: {
    "1": "W09000048",  // Afan Ogwr Rhondda
    "2": "W09000049",  // Bangor Conwy Mon
    "3": "W09000050",  // Blaenau Gwent Caerffili Rhymni
    "4": "W09000051",  // Brycheiniog Tawe Nedd
    "5": "W09000052",  // Caerdydd Ffynnon Taf
    "6": "W09000053",  // Caerdydd Penarth
    "7": "W09000054",  // Casnewydd Islwyn
    "8": "W09000055",  // Ceredigion Penfro
    "9": "W09000056",  // Clwyd
    "10": "W09000057",  // Fflint Wrecsam
    "11": "W09000059",  // Gwyr Abertawe
    "12": "W09000058",  // Gwynedd Maldwyn
    "13": "W09000060",  // Pen-y-Bont Bro Morgannwg
    "14": "W09000061",  // Pontypridd Cynon Merthyr
    "15": "W09000062",  // Sir Fynwy Torfaen
    "16": "W09000063"  // Sir Gaerfyrddin
  }
};


// ── election-map.js ─────────────────────────────────────────────
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
    .scaleExtent([0.5, 8])
    .translateExtent([[-width * 0.5, -height * 0.5], [width * 1.5, height * 1.5]])
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

  // Vote share intensity gradient
  if (options.showVoteShareGradient) {
    var gradSection = body.append("div").attr("class", "legend-separator");
    gradSection.append("div").attr("class", "legend-title").text("Colour intensity = vote share");
    var gradItem = gradSection.append("div").attr("class", "legend-item legend-gradient-item");
    var gradBar = gradItem.append("div").attr("class", "legend-gradient-bar");
    // Use a neutral grey to show light→dark concept
    gradBar.style("background", "linear-gradient(to right, " + lightenColour("#555555", 0.6) + ", #555555)");
    var gradLabels = gradItem.append("div").attr("class", "legend-gradient-labels");
    gradLabels.append("span").text("Lower");
    gradLabels.append("span").text("Higher");
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
 * Areas with no election (no --has-result or --awaiting modifier) are left untouched.
 *   zoomGroup:    D3 selection of the zoom <g>
 *   selectedPath: the DOM element (path) to keep bright, or null to reset
 */
function dimOtherAreas(zoomGroup, selectedPath) {
  zoomGroup.selectAll(".map-area").each(function () {
    var sel = d3.select(this);
    var hasElection = this.classList.contains("map-area--has-result") || this.classList.contains("map-area--awaiting");
    if (this === selectedPath) {
      sel.style("opacity", 1).style("stroke-opacity", null);
    } else if (hasElection) {
      sel.style("opacity", 0.3).style("stroke-opacity", 0.3);
    }
  });
}

/**
 * Reset all map area opacities to full.
 */
function resetAreaDim(zoomGroup) {
  zoomGroup.selectAll(".map-area").style("opacity", null).style("stroke-opacity", null);
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
  var paddingBottom = opts.paddingBottom != null ? opts.paddingBottom : padding / 2;
  var paddingTop = padding / 2;
  var scale = Math.min(
    svgW / (dx * (1 + padding)),
    svgH / (dy + (paddingTop + paddingBottom) * dy)
  );
  scale = Math.max(0.5, Math.min(scale, 8));

  // Shift center upward to account for extra bottom padding (legend area)
  var yOffset = (paddingBottom - paddingTop) * dy * scale * 0.5;
  var translate = [svgW / 2 - scale * x, svgH / 2 - scale * y - yOffset];
  var transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);

  var dur = opts.duration != null ? opts.duration : 800;
  var t = svg.transition().duration(dur).call(zoom.transform, transform);

  if (opts.onEnd) {
    t.on("end", opts.onEnd);
  }
  return t;
}


// ── england-map.js ──────────────────────────────────────────────
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
            zoomThenOverlay(feature, function () { showAwaitingOverlay(countyNominations[nm].name, countyNominations[nm].type, countyNominations[nm]); });
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
            else if (ladNominations[name]) { zoomThenOverlay(feature, function () { showAwaitingOverlay(ladNominations[name].name, ladNominations[name].type, ladNominations[name]); }); }
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

    // Update declared badge for current view
    updateDeclaredBadge(mode);

    // Zoom to fit visible areas
    var visibleFeatures = getVisibleFeatures(mode);
    if (visibleFeatures.length > 0) {
      zoomToFeatures(m.svg, m.zoom, m.path, visibleFeatures, { duration: 600, paddingBottom: 0.25 });
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

  // ── Declared badge (mode-specific) ──
  function updateDeclaredBadge(mode) {
    var badgeEl = container.querySelector(".scoreboard__declared");
    if (!badgeEl) return;
    var declared, total, label;
    if (mode === "county") {
      declared = Object.keys(countyResults).length;
      total = Object.keys(countyNominations).length;
      label = "county councils declared";
    } else if (mode === "mayoral") {
      declared = Object.keys(mayoralLadResults).length;
      total = Object.keys(mayoralLadNominations).length;
      label = "mayoral races declared";
    } else {
      declared = Object.keys(ladResults).length;
      total = Object.keys(ladNominations).length;
      label = "district councils declared";
    }
    var html = "<strong>" + declared + "</strong> of <strong>" + total + "</strong> " + label;
    badgeEl.className = "scoreboard__declared" + (declared >= total && total > 0 ? " scoreboard__declared--complete" : "");
    var wrapperEl = container.querySelector(".map-wrapper");
    if (wrapperEl) {
      registerMapDeclaredBadge(wrapperEl, badgeEl, html);
    } else {
      badgeEl.innerHTML = html;
    }
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
    zoomToFeature(m.svg, m.zoom, m.path, feature);
    overlayFn();
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

  // Helper: build proportion subtitle text
  function proportionText(proportion, seatsContested, totalSeats) {
    if (!proportion || !totalSeats) return "";
    if (proportion === "all") return "All " + totalSeats + " seats up for election";
    if (proportion === "third") return seatsContested + " of " + totalSeats + " seats (one third) up for election";
    if (proportion === "half") return seatsContested + " of " + totalSeats + " seats (half) up for election";
    return "";
  }

  function showOverlay(elections) {
    // If all elections are awaiting, show awaiting overlay
    var allAwaiting = elections.every(function (e) { return e.result._awaiting; });
    if (allAwaiting && elections.length > 0) {
      var first = elections[0].result;
      showAwaitingOverlay(first.name, first.type, first);
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
            // Badge + proportion inline
            var council = e.result;
            var badgeRow = panel.append("div")
              .style("display", "flex")
              .style("align-items", "baseline")
              .style("gap", "8px")
              .style("margin-bottom", "4px");
            var badgeSpan = badgeRow.append("span");
            gainHoldBadge(badgeSpan.node(), council, { fullNames: true });

            var totalSeats = (council.newCouncil || []).reduce(function (s, p) { return s + p.seats; }, 0);
            var seatsContested = council.proportion === "all" ? totalSeats
              : (council.electedCouncillors || []).reduce(function (s, p) { return s + p.seats; }, 0);
            var propText = proportionText(council.proportion, seatsContested, totalSeats);
            if (propText) {
              badgeRow.append("span")
                .style("font-size", "13px")
                .style("color", "#888")
                .text(propText);
            }

            // Toggle: Change / Seats
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
              // Merge newCouncil parties with changes so 0-change parties appear
              var mergedChanges = (council.newCouncil || []).map(function (p) {
                var found = (council.changes || []).find(function (c) { return c.name === p.name; });
                return { name: p.name, change: found ? found.change : 0 };
              });
              if (mergedChanges.length > 0) {
                var barEl = contentDiv.append("div").style("margin-top", "12px");
                changeBarChart(barEl.node(), mergedChanges);
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

  function showAwaitingOverlay(name, type, nomOrResult) {
    var tabLabel = SPECIAL_COUNCIL_NAMES[name] || name + " " + (SECTION_TITLES[type] || "Council");
    englandOverlayApi = createMapOverlay([{
      tabLabel: tabLabel,
      renderPanel: function (panel) {
        // Proportion subtitle from nomination or result data
        var propText = "";
        if (nomOrResult && nomOrResult.proportion) {
          var totalSeats, seatsContested;
          if (nomOrResult.parties) {
            // Nomination data
            totalSeats = nomOrResult.parties.reduce(function (s, p) { return s + (p.seatsHeld || 0); }, 0);
            seatsContested = nomOrResult.parties.reduce(function (s, p) { return s + (p.seatsOffered || 0); }, 0);
          } else if (nomOrResult.newCouncil) {
            // Result data
            totalSeats = nomOrResult.newCouncil.reduce(function (s, p) { return s + p.seats; }, 0);
            seatsContested = nomOrResult.proportion === "all" ? totalSeats
              : (nomOrResult.electedCouncillors || []).reduce(function (s, p) { return s + p.seats; }, 0);
          }
          propText = proportionText(nomOrResult.proportion, seatsContested, totalSeats);
        }
        if (propText) {
          panel.append("div")
            .style("font-size", "13px")
            .style("color", "#888")
            .style("text-align", "center")
            .style("padding", "20px 20px 0")
            .text(propText);
        }
        panel.append("div")
          .attr("class", "map-overlay__awaiting")
          .html("<p style=\"color:#888; text-align:center; padding:" + (propText ? "12px" : "40px") + " 20px; font-size:15px;\">Awaiting declaration</p>");
      }
    }], { container: m.el, onClose: function () {
      englandOverlayApi = null;
      resetAreaDim(m.zoomGroup);
    }});
  }

  // Create declared badge inside map-wrapper
  var mapWrapperNode = m.wrapper.node ? m.wrapper.node() : container.querySelector(".map-wrapper");
  if (mapWrapperNode) {
    var declaredBadge = document.createElement("div");
    declaredBadge.className = "scoreboard__declared";
    mapWrapperNode.appendChild(declaredBadge);
  }

  // Initial render
  renderView("district");

  // ── Incremental update (patch existing paths without destroying DOM) ──
  function updateResults(newResults, newMayoralResults, newLocalNominations, newMayoralNominations) {
    // Rebuild deduped + lookup dicts
    var newDeduped = dedupByRevision(newResults);
    // Clear old lookups
    for (var k in ladResults) delete ladResults[k];
    for (var k in countyResults) delete countyResults[k];
    for (var k in mayoralLadResults) delete mayoralLadResults[k];
    for (var k in ladNominations) delete ladNominations[k];
    for (var k in countyNominations) delete countyNominations[k];
    for (var k in mayoralLadNominations) delete mayoralLadNominations[k];

    for (var i = 0; i < newDeduped.length; i++) {
      var match = resolveLocal(newDeduped[i]);
      if (match) {
        if (match.layer === "county") countyResults[match.geoName] = newDeduped[i];
        else ladResults[match.geoName] = newDeduped[i];
      }
    }

    // Rebuild mayoral lookups
    var newMayoralArr = newMayoralResults || [];
    var newMayoralByName = {};
    for (var i = 0; i < newMayoralArr.length; i++) {
      var mr = newMayoralArr[i];
      if (mr.fileType !== "result") continue;
      if (!newMayoralByName[mr.name] || (mr.revision || 0) > (newMayoralByName[mr.name].revision || 0)) {
        newMayoralByName[mr.name] = mr;
      }
    }
    var newMayoralVals = Object.values(newMayoralByName);
    for (var mi = 0; mi < newMayoralVals.length; mi++) {
      var mv = newMayoralVals[mi];
      var geoName = resolveMayoral(mv);
      if (geoName) mayoralLadResults[geoName] = mv;
    }

    // Rebuild nomination lookups
    var newLocalNoms = newLocalNominations || [];
    for (var ni = 0; ni < newLocalNoms.length; ni++) {
      var nomMatch = resolveLocal(newLocalNoms[ni]);
      if (nomMatch) {
        if (nomMatch.layer === "county") countyNominations[nomMatch.geoName] = newLocalNoms[ni];
        else ladNominations[nomMatch.geoName] = newLocalNoms[ni];
      }
    }
    var newMayoralNoms = newMayoralNominations || [];
    for (var mi2 = 0; mi2 < newMayoralNoms.length; mi2++) {
      var mn = newMayoralNoms[mi2];
      var gn = resolveMayoral(mn);
      if (gn) mayoralLadNominations[gn] = mn;
    }

    // Patch existing SVG paths in-place based on active mode
    if (activeMode === "county") {
      m.zoomGroup.selectAll(".map-county-layer path")
        .attr("fill", function (d) {
          var r = countyResults[d.properties.CTY24NM];
          if (r) return partyColour(r.winningParty);
          return countyNominations[d.properties.CTY24NM] ? "url(#crosshatch)" : "#fff";
        })
        .attr("stroke", function (d) {
          var nm = d.properties.CTY24NM;
          return areaStrokeColour(countyResults[nm], countyNominations[nm]);
        })
        .attr("stroke-width", function (d) {
          var r = countyResults[d.properties.CTY24NM];
          return (r && r.gainOrHold === "gain") ? 1 : 0.5;
        })
        .attr("class", function (d) {
          var nm = d.properties.CTY24NM;
          if (countyResults[nm]) return "map-area map-area--has-result";
          if (countyNominations[nm]) return "map-area map-area--awaiting";
          return "map-area";
        });
    } else {
      m.zoomGroup.selectAll(".map-lad-layer path")
        .attr("fill", function (d) {
          var name = d.properties.LAD25NM;
          if (activeMode === "district") {
            var r = ladResults[name];
            if (r) return partyColour(r.winningParty);
            return ladNominations[name] ? "url(#crosshatch)" : "#fff";
          } else if (activeMode === "mayoral") {
            var mr = mayoralLadResults[name];
            if (mr) return partyColour(mr.winningParty);
            return mayoralLadNominations[name] ? "url(#crosshatch)" : "#fff";
          }
          return "#fff";
        })
        .attr("stroke", function (d) {
          var name = d.properties.LAD25NM;
          var r = activeMode === "district" ? ladResults[name] : activeMode === "mayoral" ? mayoralLadResults[name] : null;
          var hasNom = activeMode === "district" ? ladNominations[name] : activeMode === "mayoral" ? mayoralLadNominations[name] : null;
          return areaStrokeColour(r, hasNom);
        })
        .attr("stroke-width", function (d) {
          var name = d.properties.LAD25NM;
          var r = activeMode === "district" ? ladResults[name] : activeMode === "mayoral" ? mayoralLadResults[name] : null;
          return (r && r.gainOrHold === "gain") ? 1 : 0.3;
        })
        .attr("class", function (d) {
          var name = d.properties.LAD25NM;
          if (activeMode === "district") {
            if (ladResults[name]) return "map-area map-area--has-result";
            if (ladNominations[name]) return "map-area map-area--awaiting";
          } else if (activeMode === "mayoral") {
            if (mayoralLadResults[name]) return "map-area map-area--has-result";
            if (mayoralLadNominations[name]) return "map-area map-area--awaiting";
          }
          return "map-area";
        });
    }

    // Update legend
    updateLegend(activeMode);

    // Update declared badge for current view
    updateDeclaredBadge(activeMode);
  }

  return { svg: m.svg.node(), update: updateResults };
}


// ── fptp-card.js ────────────────────────────────────────────────
/**
 * FPTP Result Card Component
 * Unified card for mayoral results (England) and constituency results (Scotland FPTP)
 * Requires: d3.js, party-config.js, badge.js, utils.js
 */
function fptpResultCard(container, result, options) {
  if (!options) options = {};
  var showDeclarationTime = options.showDeclarationTime || false;

  var el = d3.select(container);
  el.selectAll("*").remove();

  var card = el.append("div").attr("class", "fptp-card");

  // Header
  var header = card.append("div").attr("class", "fptp-card__header council-card__header");
  header.append("h3").attr("class", "council-card__name").text(result.name);

  // Winner highlight
  var winner = result.candidates.find(function (c) { return c.elected === "*"; });
  if (winner) {
    var winWrap = card.append("div").attr("class", "fptp-card__winner");
    var hex = partyColour(winner.party.abbreviation);
    var avatar = winWrap.append("div").attr("class", "fptp-card__avatar");
    var avatarIconUrl = partyIconUrl(winner.party.abbreviation);
    if (avatarIconUrl) {
      avatar.append("img")
        .attr("src", avatarIconUrl)
        .attr("alt", partyShortName(winner.party.abbreviation))
        .attr("width", "50").attr("height", "50");
    } else {
      avatar.html(partyFallbackIconSvg(hex));
    }

    var info = winWrap.append("div");
    info.append("div").attr("class", "fptp-card__winner-name")
      .text(winner.firstName + " " + winner.surname);
    var winBadge = info.append("div").attr("class", "fptp-card__winner-party");
    gainHoldBadge(winBadge.node(), {
      winningParty: result.winningParty,
      gainOrHold: result.gainOrHold === "hold" ? "no change" : result.gainOrHold,
      sittingParty: result.sittingParty,
    });
    if (result.majority != null) {
      winBadge.append("span").attr("class", "majority-badge")
        .text("Majority: " + (result.majority || 0).toLocaleString());
    }
  }

  // Candidate bars
  var maxVotes = Math.max.apply(null, result.candidates.map(function (c) { return c.party.votes || 0; }));
  var barsWrap = card.append("div").attr("class", "fptp-card__bars");

  var sortedCandidates = result.candidates.slice().sort(function (a, b) {
    return (b.party.votes || 0) - (a.party.votes || 0);
  });

  for (var i = 0; i < sortedCandidates.length; i++) {
    var c = sortedCandidates[i];
    var row = barsWrap.append("div").attr("class", "fptp-card__bar-row fptp-card__bar-row--two-col");

    row.append("div")
      .attr("class", "fptp-card__bar-name")
      .text(c.firstName + " " + c.surname);

    var hex = partyColour(c.party.abbreviation);
    var barWrap = row.append("div").attr("class", "fptp-card__bar-wrap");
    barWrap.append("div")
      .attr("class", "fptp-card__bar-fill")
      .style("width", ((c.party.votes / maxVotes) * 90) + "%")
      .style("background", hex);
    var labelText = (c.party.votes || 0).toLocaleString() + " (" + formatPct(c.party.percentageShare) + "%)";
    barWrap.append("span")
      .attr("class", "fptp-card__bar-label")
      .attr("data-party-colour", hex)
      .text(labelText);

    var pctChg = formatPercentageChange(c.party.percentageShareChange);
    var chgText = pctChg ? pctChg.text : "";
    var chgColour = pctChg ? pctChg.colour : "#888";
    barWrap.append("span")
      .attr("class", "fptp-card__bar-change-inline")
      .style("color", chgColour)
      .text(chgText);
  }

  // Collapse to top 6 if more candidates
  var MAX_VISIBLE = 6;
  var allBarRows = barsWrap.selectAll(".fptp-card__bar-row").nodes();
  if (allBarRows.length > MAX_VISIBLE) {
    for (var h = MAX_VISIBLE; h < allBarRows.length; h++) {
      d3.select(allBarRows[h]).style("display", "none");
    }
    var expandBtn = card.append("button")
      .attr("class", "map-overlay__expand-btn")
      .text("Show more \u25BE");
    expandBtn.on("click", function () {
      var expanded = expandBtn.classed("map-overlay__expand-btn--expanded");
      if (!expanded) {
        for (var j = MAX_VISIBLE; j < allBarRows.length; j++) {
          d3.select(allBarRows[j]).style("display", null);
        }
        expandBtn.text("Show fewer \u25B4").classed("map-overlay__expand-btn--expanded", true);
      } else {
        for (var j = MAX_VISIBLE; j < allBarRows.length; j++) {
          d3.select(allBarRows[j]).style("display", "none");
        }
        expandBtn.text("Show more \u25BE").classed("map-overlay__expand-btn--expanded", false);
      }
      requestAnimationFrame(function () { repositionBarLabels(barsWrap.node()); });
    });
  }

  // Size name column to fit longest name, then position labels
  requestAnimationFrame(function () {
    // Measure natural width of each name, find the max (capped)
    var maxNameW = 0;
    var containerW = barsWrap.node().getBoundingClientRect().width;
    var cap = Math.min(containerW * 0.45, 160); // never more than 45% of card or 160px
    barsWrap.selectAll(".fptp-card__bar-name").each(function () {
      var el = this;
      // Temporarily remove grid constraint to measure natural width
      var origW = el.style.width;
      el.style.width = "max-content";
      var w = el.getBoundingClientRect().width;
      el.style.width = origW;
      if (w > maxNameW) maxNameW = w;
    });
    var nameCol = Math.ceil(Math.min(maxNameW, cap)) + 1;
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
      var hex = label.getAttribute("data-party-colour");
      if (labelW + 10 <= fillW) {
        // Fits inside: right-align within bar, use contrast colour
        label.style.left = (fillW - labelW - 5) + "px";
        label.style.color = textColourForBg(hex);
        // Change just outside bar
        if (change) {
          change.style.left = (fillW + 4) + "px";
        }
      } else {
        // Outside: position just past the bar end, use dark text
        label.style.left = (fillW + 4) + "px";
        label.style.color = "#1a1a2e";
        // Change just after label
        if (change) {
          change.style.left = (fillW + 4 + labelW + 4) + "px";
        }
      }
    });
  });

  // Turnout bar
  var totalVotesFptp = result.candidates.reduce(function (s, c) { return s + (c.party.votes || 0); }, 0);
  if (result.percentageTurnout != null || totalVotesFptp) {
    turnoutBar(card.node(), {
      turnout: result.percentageTurnout || 0,
      totalVotes: totalVotesFptp,
      electorate: result.electorate || 0
    });
  }

  // Declaration time (mayoral results only) — after turnout bar
  if (showDeclarationTime && result.declarationTime) {
    var t = new Date(result.declarationTime);
    var dateStr = t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    var timeStr = t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    card.append("div")
      .attr("class", "council-card__declared")
      .text("Declared " + timeStr + ", " + dateStr);
  }
}

// Backwards-compatible aliases
function mayoralResultCard(container, result) {
  fptpResultCard(container, result, { showDeclarationTime: true });
}

function constituencyResultCard(container, result) {
  fptpResultCard(container, result);
}


// ── party-strip.js ──────────────────────────────────────────────
/**
 * Party Strip — shared core
 * Horizontal party totals with optional toggle and fixed minor-party grouping.
 * Requires: d3.js, party-config.js, utils.js
 *
 * options.toggleLabels   — string[] toggle button labels (empty = no buttons)
 * options.getData        — function(modeIndex) → {
 *     parties: [{name, value, change}],  sorted
 *     showChange: boolean,
 *     groupIntoOther: string[]  — party names folded into Other
 *   }
 */
function partyStrip(container, options) {
  const { toggleLabels = [], getData } = options;

  const el = d3.select(container);
  el.selectAll("*").remove();

  // Toggle row (always created — callers may append progress counters)
  const toggleRow = el.append("div").attr("class", "party-strip-toggle-row");

  let currentMode = 0;

  if (toggleLabels.length > 1) {
    const toggleWrap = toggleRow.append("div").attr("class", "party-strip-toggle");
    toggleLabels.forEach(function (label, i) {
      toggleWrap.append("button")
        .attr("class", "party-strip-toggle__btn" + (i === 0 ? " party-strip-toggle__btn--active" : ""))
        .text(label)
        .on("click", function () {
          toggleWrap.selectAll(".party-strip-toggle__btn").classed("party-strip-toggle__btn--active", false);
          d3.select(this).classed("party-strip-toggle__btn--active", true);
          currentMode = i;
          render();
        });
    });
  }

  const stripContainer = el.append("div");

  function render() {
    stripContainer.selectAll("*").remove();
    const data = getData(currentMode);
    var parties = data.parties.slice();

    var table = stripContainer.append("div").attr("class", "party-strip");

    // Group minor parties into Other
    parties = groupMinorParties(parties, data.groupIntoOther || []);

    // Force NOC to the very end (after Other)
    var nocIdx = -1;
    for (var ni = 0; ni < parties.length; ni++) {
      if (parties[ni].name === "NOC") { nocIdx = ni; break; }
    }
    if (nocIdx >= 0) {
      var nocItem = parties.splice(nocIdx, 1)[0];
      parties.push(nocItem);
    }

    // Row 1: party names
    var nameRow = table.append("div").attr("class", "party-strip__row party-strip__row--name");
    for (var i = 0; i < parties.length; i++) {
      var hex = partyColour(parties[i].name);
      nameRow.append("div")
        .attr("class", "party-strip__cell")
        .style("background", hex)
        .style("color", textColourForBg(hex))
        .text(partyShortName(parties[i].name));
    }

    // Row 2: counts
    var countRow = table.append("div").attr("class", "party-strip__row party-strip__row--seats");
    for (var j = 0; j < parties.length; j++) {
      countRow.append("div")
        .attr("class", "party-strip__cell")
        .style("background", d3.color(partyColour(parties[j].name)).copy({opacity: 0.15}))
        .text(parties[j].value.toLocaleString());
    }

    // Row 3: change (optional)
    if (data.showChange) {
      var changeRow = table.append("div").attr("class", "party-strip__row party-strip__row--change");
      for (var m = 0; m < parties.length; m++) {
        var fmt = formatChange(parties[m].change);
        changeRow.append("div")
          .attr("class", "party-strip__cell")
          .style("background", d3.color(partyColour(parties[m].name)).copy({opacity: 0.08}))
          .style("color", fmt.colour)
          .text(fmt.text);
      }
    }
  }

  render();
}

/**
 * England Party Totals Strip — thin wrapper
 * Aggregates councillor/council data and passes to partyStrip
 */
function partyTotalsStrip(container, results) {
  var deduped = dedupByRevision(results);

  var partyTotals = {};
  for (var i = 0; i < deduped.length; i++) {
    var r = deduped[i];
    for (var j = 0; j < (r.newCouncil || []).length; j++) {
      var p = r.newCouncil[j];
      if (!partyTotals[p.name]) partyTotals[p.name] = { name: p.name, seats: 0, change: 0, councils: 0, councilChange: 0 };
      partyTotals[p.name].seats += p.seats;
    }
    for (var k = 0; k < (r.changes || []).length; k++) {
      var c = r.changes[k];
      if (partyTotals[c.name]) partyTotals[c.name].change += c.change;
    }
    if (r.winningParty) {
      if (!partyTotals[r.winningParty]) partyTotals[r.winningParty] = { name: r.winningParty, seats: 0, change: 0, councils: 0, councilChange: 0 };
      partyTotals[r.winningParty].councils++;
    }
    if (r.gainOrHold === "gain" && r.winningParty && r.sittingParty) {
      if (partyTotals[r.winningParty]) partyTotals[r.winningParty].councilChange++;
      if (!partyTotals[r.sittingParty]) partyTotals[r.sittingParty] = { name: r.sittingParty, seats: 0, change: 0, councils: 0, councilChange: 0 };
      partyTotals[r.sittingParty].councilChange--;
    } else if (r.gainOrHold === "lose to NOC" && r.sittingParty) {
      if (!partyTotals[r.sittingParty]) partyTotals[r.sittingParty] = { name: r.sittingParty, seats: 0, change: 0, councils: 0, councilChange: 0 };
      partyTotals[r.sittingParty].councilChange--;
    }
  }

  var sorted = Object.values(partyTotals).sort(function (a, b) { return b.seats - a.seats; });

  partyStrip(container, {
    toggleLabels: ["Councillors", "Councils"],
    getData: function (modeIndex) {
      var isCouncils = modeIndex === 1;
      var parties;
      if (isCouncils) {
        var nocEntry = sorted.find(function (p) { return p.name === "NOC"; });
        parties = sorted.slice().filter(function (p) { return p.name !== "NOC"; })
          .sort(function (a, b) { return b.councils - a.councils; })
          .map(function (p) { return { name: p.name, value: p.councils, change: p.councilChange }; });
        if (nocEntry) {
          parties.push({ name: nocEntry.name, value: nocEntry.councils, change: nocEntry.councilChange });
        }
      } else {
        parties = sorted.filter(function (p) { return p.name !== "NOC"; })
          .map(function (p) { return { name: p.name, value: p.seats, change: p.change }; });
      }
      return {
        parties: parties,
        showChange: true,
        groupIntoOther: MINOR_PARTIES_ENGLAND
      };
    }
  });
}


// ── scoreboard.js ───────────────────────────────────────────────
/** Duration (ms) the full party name stays visible after tap on mobile */
var SCOREBOARD_NAME_EXPAND_MS = 5000;

/**
 * Election Scoreboard — shared core
 * Renders a party scoreboard table with configurable columns.
 * Each nation provides its own data aggregation + column render functions.
 * Requires: d3.js, party-config.js, utils.js
 *
 * options.title        — string (e.g. "England council results")
 * options.declaredText — HTML string for declared count
 * options.columns      — [{header, render(td, row)}] where td is a D3 selection
 * options.partyRows    — [{name, ...data}] sorted array
 * options.nocRow       — optional object with same shape as partyRows entries
 */
function electionScoreboard(container, options) {
  const { title, declaredText, columns, partyRows, nocRow } = options;

  const el = d3.select(container);
  el.selectAll("*").remove();

  const board = el.append("div").attr("class", "scoreboard");

  // Header
  const header = board.append("div").attr("class", "scoreboard__header");
  header.append("div").append("h2")
    .attr("class", "scoreboard__title")
    .text(title);
  board.append("div")
    .attr("class", "scoreboard__declared" + (options.allDeclared ? " scoreboard__declared--complete" : ""))
    .html(declaredText);

  // Table
  const table = board.append("table").attr("class", "scoreboard__table");
  const thead = table.append("thead").append("tr");
  thead.append("th"); // blank for party column
  for (const col of columns) thead.append("th").text(col.header);
  const tbody = table.append("tbody");

  function renderPartyCell(row, name) {
    const nameCell = row.append("td").attr("class", "scoreboard__party-cell");
    const inner = nameCell.append("div").attr("class", "scoreboard__party-inner");
    const hex = partyColour(name);
    const logo = inner.append("span").attr("class", "party-logo");
    const iconUrl = partyIconUrl(name);
    const inlineIcon = partyInlineIcon(name);
    if (iconUrl) {
      logo.append("img")
        .attr("src", iconUrl)
        .attr("alt", partyShortName(name))
        .attr("width", "52").attr("height", "52");
    } else if (inlineIcon) {
      logo.html(inlineIcon);
    } else {
      logo.html(partyFallbackIconSvg(hex));
    }
    var fullSpan = inner.append("span")
      .attr("class", "scoreboard__party-name scoreboard__party-name--full")
      .text(partyName(name));
    var shortSpan = inner.append("span")
      .attr("class", "scoreboard__party-name scoreboard__party-name--short")
      .text(partyShortName(name));

    // Mobile tap-to-expand: show full name temporarily
    shortSpan.on("click", function () {
      var shortNode = shortSpan.node();
      if (getComputedStyle(shortNode).display === "none") return;
      inner.classed("scoreboard__party-inner--revealed", true);
      fullSpan.style("left", shortNode.offsetLeft + "px");
      clearTimeout(inner.node().__expandTimer);
      inner.node().__expandTimer = setTimeout(function () {
        inner.classed("scoreboard__party-inner--revealed", false);
        fullSpan.style("left", null);
      }, SCOREBOARD_NAME_EXPAND_MS);
    });
  }

  for (const p of partyRows) {
    const row = tbody.append("tr");
    renderPartyCell(row, p.name);
    for (const col of columns) {
      col.render(row.append("td").attr("class", "scoreboard__num-cell"), p);
    }
  }

  // NOC row (optional, England only)
  if (nocRow) {
    const row = tbody.append("tr");
    renderPartyCell(row, "NOC");
    for (const col of columns) {
      col.render(row.append("td").attr("class", "scoreboard__num-cell"), nocRow);
    }
  }

  // Show more / Show fewer toggle for long party lists
  if (options.maxVisibleRows != null && partyRows.length > options.maxVisibleRows) {
    var allRows = tbody.selectAll("tr").nodes();
    for (var hi = options.maxVisibleRows; hi < allRows.length; hi++) {
      d3.select(allRows[hi]).style("display", "none");
    }
    var expandBtn = board.append("button")
      .attr("class", "map-overlay__expand-btn")
      .text("Show more \u25BE");
    expandBtn.on("click", function () {
      var expanded = expandBtn.classed("map-overlay__expand-btn--expanded");
      if (!expanded) {
        for (var j = options.maxVisibleRows; j < allRows.length; j++) {
          d3.select(allRows[j]).style("display", null);
        }
        expandBtn.text("Show fewer \u25B4").classed("map-overlay__expand-btn--expanded", true);
      } else {
        for (var j = options.maxVisibleRows; j < allRows.length; j++) {
          d3.select(allRows[j]).style("display", "none");
        }
        expandBtn.text("Show more \u25BE").classed("map-overlay__expand-btn--expanded", false);
      }
      if (options.onExpandToggle) options.onExpandToggle();
    });
  }

  // Aggregate turnout bar (Scotland/Wales)
  if (options.turnout) {
    turnoutBar(board.node(), options.turnout);
  }
}

/**
 * England Party Scoreboard — thin wrapper
 * Aggregates council/councillor data and passes to electionScoreboard
 */
function partyScoreboard(container, results) {
  const deduped = dedupByRevision(results);

  // Aggregate seats and councils
  const partyTotals = {};
  for (const r of deduped) {
    for (const p of (r.newCouncil || [])) {
      if (!partyTotals[p.name]) {
        partyTotals[p.name] = { name: p.name, seats: 0, councils: 0, change: 0, councilChange: 0 };
      }
      partyTotals[p.name].seats += p.seats;
    }
    for (const c of (r.changes || [])) {
      if (partyTotals[c.name]) partyTotals[c.name].change += c.change;
    }
    if (r.winningParty && r.winningParty !== "NOC") {
      if (!partyTotals[r.winningParty]) {
        partyTotals[r.winningParty] = { name: r.winningParty, seats: 0, councils: 0, change: 0, councilChange: 0 };
      }
      partyTotals[r.winningParty].councils++;
    }
    if (r.gainOrHold === "gain" && r.winningParty && r.sittingParty) {
      if (partyTotals[r.winningParty]) partyTotals[r.winningParty].councilChange++;
      if (!partyTotals[r.sittingParty]) {
        partyTotals[r.sittingParty] = { name: r.sittingParty, seats: 0, councils: 0, change: 0, councilChange: 0 };
      }
      partyTotals[r.sittingParty].councilChange--;
    } else if (r.gainOrHold === "lose to NOC" && r.sittingParty) {
      if (!partyTotals[r.sittingParty]) {
        partyTotals[r.sittingParty] = { name: r.sittingParty, seats: 0, councils: 0, change: 0, councilChange: 0 };
      }
      partyTotals[r.sittingParty].councilChange--;
    }
  }

  const sorted = Object.values(partyTotals)
    .filter(p => p.name !== "NOC")
    .sort((a, b) => b.seats - a.seats);
  const nocCount = deduped.filter(r => r.winningParty === "NOC").length;

  function renderNumChange(td, value, change) {
    td.append("div").attr("class", "scoreboard__num").text(value);
    const fmt = formatChange(change);
    td.append("div").attr("class", "scoreboard__change")
      .style("color", fmt.colour).text(fmt.text);
  }

  const nocData = nocCount > 0 ? {
    name: "NOC",
    councils: nocCount,
    councilChange: (partyTotals["NOC"] && partyTotals["NOC"].councilChange) || 0,
    seats: null
  } : null;

  electionScoreboard(container, {
    title: "England council results",
    declaredText: `<strong>${deduped.length}</strong> of <strong>136</strong> councils declared`,
    allDeclared: deduped.length >= 136,
    columns: [
      {
        header: "Councils",
        render: function (td, p) {
          renderNumChange(td, p.councils != null ? p.councils : "—", p.councilChange);
        }
      },
      {
        header: "Councillors",
        render: function (td, p) {
          if (p.seats == null) {
            td.append("div").attr("class", "scoreboard__num").text("—");
            return;
          }
          renderNumChange(td, p.seats.toLocaleString(), p.change);
        }
      }
    ],
    partyRows: sorted,
    nocRow: nocData
  });
}


// ── scotland-map.js ─────────────────────────────────────────────
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

  /**
   * Get regional vote share sorted by percentage (for map colouring & tooltip).
   */
  function regionVoteShareTally(regionName) {
    var rr = regMap[regionName];
    if (!rr || !rr.parties) return [];
    var parties = rr.parties.slice().sort(function (a, b) {
      return (b.percentageShare || 0) - (a.percentageShare || 0);
    });
    return parties;
  }

  function regionWinningParty(regionName) {
    var tally = regionVoteShareTally(regionName);
    return tally.length > 0 ? tally[0].abbreviation : null;
  }

  /**
   * Build stacked tooltip HTML for a region: constituency (solid) + additional (striped) bars.
   */
  function regionTallyHtml(regionName) {
    var parties = regionVoteShareTally(regionName);
    if (parties.length === 0) return "";
    // Only include parties that won at least one MSP (constituency or regional)
    var tally = regionTotalTally(regionName);
    var wonSeat = {};
    for (var i = 0; i < tally.length; i++) { wonSeat[tally[i].abbr] = true; }
    parties = parties.filter(function (p) { return wonSeat[p.abbreviation || "Other"]; });
    if (parties.length === 0) return "";
    var maxShare = parties[0].percentageShare || 1;
    return '<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">' +
      parties.map(function (p) {
        var abbr = p.abbreviation || "Other";
        var share = p.percentageShare || 0;
        if (share === 0) return '';
        var bg = partyColour(abbr);
        var fg = textColourForBg(bg);
        var pct = Math.round((share / maxShare) * 100);
        var small = pct < 55;
        var label = share.toFixed(1) + '%';
        return '<div style="display:flex;align-items:center;gap:0;height:22px">' +
          '<span style="display:inline-flex;align-items:center;justify-content:space-between;height:100%;width:' + pct + '%;min-width:18px;border-radius:3px;box-sizing:border-box;background:' + bg + ';padding:0 4px;overflow:hidden">' +
            '<span style="font-size:11px;font-weight:700;color:' + fg + ';white-space:nowrap">' + partyShortName(abbr) + '</span>' +
            (!small ? '<span style="font-size:11px;font-weight:400;color:' + fg + ';white-space:nowrap">' + label + '</span>' : '') +
          '</span>' +
          (small
            ? '<span style="font-size:11px;font-weight:400;color:#444;margin-left:4px;flex-shrink:0;white-space:nowrap">' + label + '</span>'
            : ''
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
        if (activeMode === f.key) return;
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
      // Region view: colour regions by largest party (lighter = lower vote share)
      m.zoomGroup.append("g")
        .attr("class", "map-region-layer")
        .selectAll("path")
        .data(regGeo.features)
        .join("path")
        .attr("d", m.path)
        .attr("fill", function (d) {
          var nm = d.properties.SPR_NM;
          var wp = regionWinningParty(nm);
          if (!wp) return regNomSet[nm] ? "url(#crosshatch)" : "#fff";
          var base = partyColour(wp);
          var tally = regionVoteShareTally(nm);
          if (tally.length === 0) return base;
          var topShare = tally[0].percentageShare || 0;
          // 50%+ = full colour, scales lighter below that (max lighten 0.6)
          var lightness = 1 - Math.min(1, Math.max(0, topShare / 50));
          return lightenColour(base, lightness * 0.6);
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
    buildMapLegend(m.wrapper, parties, { hideNoElection: true, showVoteShareGradient: mode === "region" });
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
    zoomToFeature(m.svg, m.zoom, m.path, feature);
    overlayFn();
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
            .text("Show more \u25BE");
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
              expandBtn.text("Show more \u25BE").classed("map-overlay__expand-btn--expanded", false);
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
    var pv = {};
    (rr.parties || []).forEach(function (p) { pv[p.abbreviation] = p.votes || 0; });
    renderElectedPills(container.node(), elected, { winningParty: rr.winningParty, partyVotes: pv });
  }

  renderView("constituency");

  // Initial zoom to fit (exclude Shetland so default view focuses on mainland)
  var visibleFeatures = constGeo.features.filter(function (f) {
    return f.properties.SPC_NM !== "Shetland Islands";
  });
  zoomToFeatures(m.svg, m.zoom, m.path, visibleFeatures, { duration: 0, paddingBottom: 0.25 });

  // ── Incremental update (patch existing paths without destroying DOM) ──
  function updateResults(newConstResults, newRegResults) {
    // Rebuild deduped result lookups
    var newConstByName = {};
    var constDedup = dedupByRevision(newConstResults);
    for (var i = 0; i < constDedup.length; i++) newConstByName[constDedup[i].name] = constDedup[i];

    var newRegByName = {};
    var regDedup = dedupByRevision(newRegResults);
    for (var i = 0; i < regDedup.length; i++) newRegByName[regDedup[i].name] = regDedup[i];

    // Clear and rebuild geo-mapped lookups
    for (var k in constMap) delete constMap[k];
    for (var k in regMap) delete regMap[k];

    for (var key in newConstByName) {
      var geoName = resolveConst(newConstByName[key]);
      if (geoName) constMap[geoName] = newConstByName[key];
    }
    for (var key in newRegByName) {
      var geoName = resolveReg(newRegByName[key]);
      if (geoName) regMap[geoName] = newRegByName[key];
    }

    // Patch existing SVG paths based on active mode
    if (activeMode === "region") {
      m.zoomGroup.selectAll(".map-region-layer path")
        .attr("fill", function (d) {
          var nm = d.properties.SPR_NM;
          var wp = regionWinningParty(nm);
          if (!wp) return regNomSet[nm] ? "url(#crosshatch)" : "#fff";
          var base = partyColour(wp);
          var tally = regionVoteShareTally(nm);
          if (tally.length === 0) return base;
          var topShare = tally[0].percentageShare || 0;
          var lightness = 1 - Math.min(1, Math.max(0, topShare / 50));
          return lightenColour(base, lightness * 0.6);
        })
        .attr("class", function (d) {
          var nm = d.properties.SPR_NM;
          if (regMap[nm]) return "map-area map-area--has-result";
          if (regNomSet[nm]) return "map-area map-area--awaiting";
          return "map-area";
        });
    } else {
      m.zoomGroup.selectAll(".map-const-layer path")
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
          if (constMap[nm]) return "map-area map-area--has-result";
          if (constNomSet[nm]) return "map-area map-area--awaiting";
          return "map-area";
        });
    }

    // Update legend
    updateScotlandLegend(activeMode);

    // Update declared badge if present
    var badgeEl = container.querySelector(".scoreboard__declared");
    if (badgeEl) {
      var totalConst = 73, totalReg = 8;
      badgeEl.className = "scoreboard__declared" + (constDedup.length >= totalConst && regDedup.length >= totalReg ? " scoreboard__declared--complete" : "");
      badgeEl.innerHTML = "<strong>" + constDedup.length + "</strong> of <strong>" + totalConst + "</strong> constituencies, <strong>" + regDedup.length + "</strong> of <strong>" + totalReg + "</strong> regions declared";
    }
  }

  return { svg: m.svg.node(), update: updateResults };
}


// ── list-card.js ────────────────────────────────────────────────
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
  // Sort: winning party first, then by count desc, then by votes
  var wp = options.winningParty;
  var pv = options.partyVotes || {};
  partyOrder.sort(function (a, b) {
    if (wp && a === wp) return -1;
    if (wp && b === wp) return 1;
    var countDiff = groups[b].length - groups[a].length;
    if (countDiff !== 0) return countDiff;
    return (pv[b] || 0) - (pv[a] || 0);
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


// ── wales-map.js ────────────────────────────────────────────────
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

  function walesVoteShareHtml(result) {
    if (!result || !result.parties || result.parties.length === 0) return "";
    // Only include parties that won at least one seat
    var wonSeat = {};
    if (result.candidates) {
      for (var i = 0; i < result.candidates.length; i++) {
        var c = result.candidates[i];
        if (c.elected === "true" || c.elected === true || c.elected === "*") {
          var a = c.party ? c.party.abbreviation : "Other";
          wonSeat[a] = true;
        }
      }
    }
    var sorted = result.parties.slice().sort(function (a, b) {
      return (b.percentageShare || 0) - (a.percentageShare || 0);
    }).filter(function (p) { return (p.percentageShare || 0) > 0 && wonSeat[p.abbreviation || "Other"]; });
    if (sorted.length === 0) return "";
    var maxShare = sorted[0].percentageShare;
    return '<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">' +
      sorted.map(function (p) {
        var abbr = p.abbreviation || "Other";
        var share = p.percentageShare || 0;
        var bg = partyColour(abbr);
        var fg = textColourForBg(bg);
        var pct = Math.round((share / maxShare) * 100);
        var small = pct < 55;
        var label = share.toFixed(1) + '%';
        return '<div style="display:flex;align-items:center;gap:0;height:22px">' +
          '<span style="display:inline-flex;align-items:center;justify-content:space-between;height:100%;width:' + pct + '%;min-width:18px;border-radius:3px;box-sizing:border-box;background:' + bg + ';padding:0 4px;overflow:hidden">' +
            '<span style="font-size:11px;font-weight:700;color:' + fg + ';white-space:nowrap">' + partyShortName(abbr) + '</span>' +
            (!small ? '<span style="font-size:11px;font-weight:400;color:' + fg + ';white-space:nowrap">' + label + '</span>' : '') +
          '</span>' +
          (small ? '<span style="font-size:11px;font-weight:400;color:#444;margin-left:4px;flex-shrink:0;white-space:nowrap">' + label + '</span>' : '') +
          '</div>';
      }).join("") + "</div>";
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
      if (!wp) return constNomSet[nm] ? "url(#crosshatch)" : "#fff";
      var base = partyColour(wp);
      if (!r || !r.parties || r.parties.length === 0) return base;
      var sorted = r.parties.slice().sort(function (a, b) { return (b.percentageShare || 0) - (a.percentageShare || 0); });
      var topShare = sorted[0].percentageShare || 0;
      // 50%+ = full colour, scales lighter below that (max lighten 0.6)
      var lightness = 1 - Math.min(1, Math.max(0, topShare / 50));
      return lightenColour(base, lightness * 0.6);
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
        var tally = walesVoteShareHtml(r);
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
    buildMapLegend(m.wrapper, parties, { hideGain: true, hideNoElection: true, showVoteShareGradient: true });
  }
  updateWalesLegend();

  // Initial zoom to fit with bottom padding for legend
  zoomToFeatures(m.svg, m.zoom, m.path, constGeo.features, { duration: 0, padding: 0.35, paddingBottom: 0.4 });

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
    zoomToFeature(m.svg, m.zoom, m.path, feature);
    overlayFn();
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
          var pv = {};
          (result.parties || []).forEach(function (p) { pv[p.abbreviation] = p.votes || 0; });
          renderElectedPills(contentArea.node(), elected, { winningParty: result.winningParty, partyVotes: pv });
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
                .text("Show more \u25BE");
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
                  expandBtn.text("Show more \u25BE").classed("map-overlay__expand-btn--expanded", false);
                }
                requestAnimationFrame(function () { repositionBarLabels(contentArea.node()); });
              });
            }

            requestAnimationFrame(function () {
              repositionBarLabels(contentArea.node());
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

  // ── Incremental update (patch existing paths without destroying DOM) ──
  function updateResults(newResults) {
    // Rebuild deduped result lookup
    var newDedup = dedupByRevision(newResults);
    for (var k in constMap) delete constMap[k];
    for (var i = 0; i < newDedup.length; i++) {
      var geoName = resolveWelsh(newDedup[i]);
      if (geoName) constMap[geoName] = newDedup[i];
    }

    // Patch existing SVG paths
    m.zoomGroup.selectAll(".map-const-layer path")
      .attr("fill", function (d) {
        var nm = d.properties.SENEDD_NM;
        var r = constMap[nm];
        var wp = constWinningParty(r);
        if (!wp) return constNomSet[nm] ? "url(#crosshatch)" : "#fff";
        var base = partyColour(wp);
        if (!r || !r.parties || r.parties.length === 0) return base;
        var sorted = r.parties.slice().sort(function (a, b) { return (b.percentageShare || 0) - (a.percentageShare || 0); });
        var topShare = sorted[0].percentageShare || 0;
        var lightness = 1 - Math.min(1, Math.max(0, topShare / 50));
        return lightenColour(base, lightness * 0.6);
      })
      .attr("class", function (d) {
        var nm = d.properties.SENEDD_NM;
        if (constMap[nm]) return "map-area map-area--has-result";
        if (constNomSet[nm]) return "map-area map-area--awaiting";
        return "map-area";
      });

    // Update legend
    updateWalesLegend();

    // Update declared badge if present
    var badgeEl = container.querySelector(".scoreboard__declared");
    if (badgeEl) {
      var totalConst = constGeo.features.length || 16;
      badgeEl.className = "scoreboard__declared" + (newDedup.length >= totalConst ? " scoreboard__declared--complete" : "");
      badgeEl.innerHTML = "<strong>" + newDedup.length + "</strong> of <strong>" + totalConst + "</strong> constituencies declared";
    }
  }

  return { svg: m.svg.node(), update: updateResults };
}


