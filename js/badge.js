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
