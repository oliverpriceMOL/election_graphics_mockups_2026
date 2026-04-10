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
