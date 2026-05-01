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


