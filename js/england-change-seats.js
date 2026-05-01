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


// ── change-columns.js ───────────────────────────────────────────
/**
 * Change Columns Chart — shared core
 * Renders a vertical diverging bar chart showing +/- change per party.
 * Each bar shows the change label (▲5 / ▼3) and the total in brackets.
 * options.seatsOnly — if true, renders simple upward bars of d.total with no change labels.
 * Requires: d3.js, party-config.js, utils.js
 *
 * options.parties — [{name, change, total, ...}] sorted; change = primary value
 */
function changeColumnsChart(containerEl, options) {
  var parties = options.parties;
  var seatsOnly = options.seatsOnly || false;

  var el = d3.select(containerEl);
  el.selectAll("*").remove();

  if (!parties || parties.length === 0) return;

  if (seatsOnly) return _renderSeatsOnly(el, parties);

  // SVG dimensions — extra bottom margin for party labels plus totals row
  var margin = { top: 38, right: 12, bottom: 46, left: 40 };
  var width = 600;
  var height = 280;
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = el.append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  var g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // X scale
  var x = d3.scaleBand()
    .domain(parties.map(function (p) { return p.name; }))
    .range([0, innerW])
    .padding(0.12);

  // Y domain
  var maxAbs = Math.max.apply(null, parties.map(function (p) { return Math.abs(p.change); }).concat(1));
  var domainMax = nextCleanScale(maxAbs);
  var yScale = d3.scaleLinear()
    .domain([-domainMax, domainMax])
    .range([innerH, 0]);
  var zeroY = yScale(0);

  // Y-axis
  var halfStep = domainMax / 2;
  var yAxis = d3.axisLeft(yScale)
    .tickValues([-domainMax, -halfStep, 0, halfStep, domainMax])
    .tickFormat(function (d) { return d === 0 ? "" : (d > 0 ? "+" : "") + d; });
  g.append("g")
    .call(yAxis)
    .call(function (gg) { gg.select(".domain").remove(); })
    .call(function (gg) { gg.selectAll(".tick line").attr("stroke", "#e0e0e4").attr("x2", innerW); })
    .call(function (gg) { gg.selectAll(".tick text").attr("font-family", "'Inter', sans-serif").attr("font-size", 11).attr("fill", "#888"); });

  // Zero line
  g.append("line")
    .attr("x1", 0).attr("x2", innerW)
    .attr("y1", zeroY).attr("y2", zeroY)
    .attr("stroke", "#999").attr("stroke-width", 1);

  function valLabel(v) {
    if (v > 0) return "▲" + v;
    if (v < 0) return "▼" + Math.abs(v);
    return "—";
  }

  function valColour(v) {
    return v > 0 ? "#1a7f37" : v < 0 ? "#d1242f" : "#888";
  }

  // ── Bars ──
  g.selectAll(".col-bar")
    .data(parties).join("rect")
      .attr("class", "col-bar")
      .attr("x", function (d) { return x(d.name); })
      .attr("width", x.bandwidth())
      .attr("y", function (d) { return d.change >= 0 ? yScale(d.change) : zeroY; })
      .attr("height", function (d) { return Math.abs(yScale(d.change) - zeroY); })
      .attr("rx", 2).attr("fill", function (d) { return partyColour(d.name); });

  // ── Change labels (▲5 / ▼3) ──
  g.selectAll(".col-val")
    .data(parties).join("text")
      .attr("class", "col-val")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", function (d) {
        if (d.change >= 0) return yScale(d.change) - 5;
        var below = yScale(d.change) + 14;
        return below > innerH - 18 ? yScale(d.change) - 4 : below;
      })
      .attr("text-anchor", "middle").attr("font-size", 13).attr("font-weight", 700)
      .attr("font-family", "'Inter', sans-serif")
      .attr("fill", function (d) {
        if (d.change >= 0) return valColour(d.change);
        var below = yScale(d.change) + 14;
        return below > innerH - 18 ? textColourForBg(partyColour(d.name)) : valColour(d.change);
      })
      .style("pointer-events", "none")
      .text(function (d) { return valLabel(d.change); });

  // ── Total labels in brackets — fixed row under party labels ──
  g.selectAll(".col-total")
    .data(parties).join("text")
      .attr("class", "col-total")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", innerH + 28)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 500)
      .attr("font-family", "'Inter', sans-serif")
      .attr("fill", "#666")
      .style("pointer-events", "none")
      .text(function (d) {
        return d.total != null ? "(" + Number(d.total).toLocaleString("en-GB") + ")" : "";
      });

  // Party labels at bottom
  g.selectAll(".col-label")
    .data(parties).join("text")
      .attr("class", "col-label")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", innerH + 14)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600)
      .attr("font-family", "'Inter', sans-serif").attr("fill", "#444")
      .style("pointer-events", "none")
      .text(function (d) { return partyShortName(d.name); });
}

/**
 * Seats-only bar chart — simple upward bars from 0 with count above each bar.
 * Used for Wales where no previous-election data exists.
 */
function _renderSeatsOnly(el, parties) {
  var margin = { top: 28, right: 12, bottom: 32, left: 40 };
  var width = 600;
  var height = 240;
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = el.append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  var g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var x = d3.scaleBand()
    .domain(parties.map(function (p) { return p.name; }))
    .range([0, innerW])
    .padding(0.12);

  var maxVal = Math.max.apply(null, parties.map(function (p) { return p.total || 0; }).concat(1));
  var domainMax = nextCleanScale(maxVal);
  var yScale = d3.scaleLinear()
    .domain([0, domainMax])
    .range([innerH, 0]);

  // Y-axis
  var halfStep = domainMax / 2;
  var yAxis = d3.axisLeft(yScale)
    .tickValues([0, halfStep, domainMax])
    .tickFormat(function (d) { return d; });
  g.append("g")
    .call(yAxis)
    .call(function (gg) { gg.select(".domain").remove(); })
    .call(function (gg) { gg.selectAll(".tick line").attr("stroke", "#e0e0e4").attr("x2", innerW); })
    .call(function (gg) { gg.selectAll(".tick text").attr("font-family", "'Inter', sans-serif").attr("font-size", 11).attr("fill", "#888"); });

  // Bars
  g.selectAll(".col-bar")
    .data(parties).join("rect")
      .attr("class", "col-bar")
      .attr("x", function (d) { return x(d.name); })
      .attr("width", x.bandwidth())
      .attr("y", function (d) { return yScale(d.total || 0); })
      .attr("height", function (d) { return innerH - yScale(d.total || 0); })
      .attr("rx", 2).attr("fill", function (d) { return partyColour(d.name); });

  // Seat count labels above bars
  g.selectAll(".col-val")
    .data(parties).join("text")
      .attr("class", "col-val")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", function (d) { return yScale(d.total || 0) - 6; })
      .attr("text-anchor", "middle").attr("font-size", 13).attr("font-weight", 700)
      .attr("font-family", "'Inter', sans-serif").attr("fill", "#444")
      .style("pointer-events", "none")
      .text(function (d) { return d.total || 0; });

  // Party labels at bottom
  g.selectAll(".col-label")
    .data(parties).join("text")
      .attr("class", "col-label")
      .attr("x", function (d) { return x(d.name) + x.bandwidth() / 2; })
      .attr("y", innerH + 16)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600)
      .attr("font-family", "'Inter', sans-serif").attr("fill", "#444")
      .style("pointer-events", "none")
      .text(function (d) { return partyShortName(d.name); });
}


// ── party-change-columns.js ─────────────────────────────────────
/**
 * England Party Change Columns — thin wrapper
 * Aggregates councillor/council change data and passes to changeColumnsChart
 * Toggle between Councillors and Councils views
 * Requires: d3.js, party-config.js, utils.js, change-columns.js
 */
function partyChangeColumns(container, results) {
  var el = d3.select(container);
  var deduped = dedupByRevision(results);

  // Aggregate
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

  var currentMode = "councillors";

  // Toggle row (created once — callers may append progress counters)
  el.selectAll("*").remove();
  var toggleRow = el.append("div").attr("class", "party-strip-toggle-row");
  var toggleWrap = toggleRow.append("div").attr("class", "party-strip-toggle");
  function makeBtn(label, value) {
    toggleWrap.append("button")
      .attr("class", "party-strip-toggle__btn" + (value === currentMode ? " party-strip-toggle__btn--active" : ""))
      .text(label)
      .on("click", function () {
        if (currentMode === value) return;
        currentMode = value;
        toggleWrap.selectAll(".party-strip-toggle__btn").classed("party-strip-toggle__btn--active", false);
        d3.select(this).classed("party-strip-toggle__btn--active", true);
        render();
      });
  }
  makeBtn("Councillors", "councillors");
  makeBtn("Councils", "councils");

  var chartContainer = el.append("div");

  function render() {
    chartContainer.selectAll("*").remove();

    var isCouncils = currentMode === "councils";
    var changeKey = isCouncils ? "councilChange" : "change";
    var sortKey = isCouncils ? "councils" : "seats";
    var totalLabel = isCouncils ? "Councils" : "Councillors";
    var totalKey = isCouncils ? "councils" : "seats";

    var sorted = Object.values(partyTotals)
      .filter(function (p) { return p.name !== "NOC"; })
      .sort(function (a, b) { return b[sortKey] - a[sortKey]; });

    // NOC entry (appended after grouping so it's never collapsed into Other)
    var nocEntry = partyTotals["NOC"];

    // Group minor parties into Other
    sorted = groupMinorParties(sorted, MINOR_PARTIES_ENGLAND);

    if (nocEntry && isCouncils) {
      sorted.push(nocEntry);
    }

    var parties = sorted.map(function (p) {
      return { name: p.name, change: p[changeKey], total: p[totalKey] };
    });

    changeColumnsChart(chartContainer.node(), {
      parties: parties
    });
  }

  render();
}


