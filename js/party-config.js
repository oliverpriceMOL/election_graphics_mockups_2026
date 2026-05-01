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
  green: "GREEN.svg", reform: "REFORM.svg", ind: "INDEPENDENT.svg",
  r: "RATEPAYERS_RES.svg", your: "YP.svg", other: "OTHER.svg",
};

var _PARTY_ICON_BASE = "img/party-icons/";

function partyIconUrl(keyOrAbbr) {
  var key = PARTY_REGISTRY[keyOrAbbr] ? keyOrAbbr : (ABBREVIATION_FALLBACK[keyOrAbbr] || null);
  var filename = key && PARTY_SVG_MAP[key];
  return filename ? _PARTY_ICON_BASE + filename : null;
}

// Inline SVG icons for parties that need text rather than a graphic symbol.
var PARTY_INLINE_ICONS = {
  noc: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 97.265386 97.265386" width="100%" height="100%">' +
    '<circle cx="48.632693" cy="48.632693" r="48.632693" fill="#CCCCCC"/>' +
    '<text x="48.632693" y="48.632693" font-family="\'Inter\', Arial, sans-serif" font-size="22" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#595959">NOC</text>' +
    '</svg>',
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
