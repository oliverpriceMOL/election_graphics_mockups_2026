/**
 * Party colours & names — shared config
 */
const PARTY = {
  Lab:    { name: "Labour",              short: "Lab",     colour: "#E6170C" },
  C:      { name: "Conservative",        short: "Con",     colour: "#005FD4" },
  LD:     { name: "Liberal Democrats",    short: "LD",      colour: "#FFB300" },
  Green:  { name: "Green",               short: "Grn",     colour: "#005414" },
  Reform: { name: "Reform UK",           short: "Ref",     colour: "#2EEBFF" },
  R:      { name: "Ratepayers/Residents", short: "R",       colour: "#2D6A4F" },
  Ind:    { name: "Independent",         short: "Ind",     colour: "#191919" },
  Your:   { name: "Your Party",          short: "Your",    colour: "#7E57C2" },
  SNP:    { name: "SNP",                 short: "SNP",     colour: "#ffff54" },
  Alba:   { name: "Alba Party",          short: "Alba",    colour: "#005EB8" },
  PC:     { name: "Plaid Cymru",         short: "PC",      colour: "#5BD65B" },
  Gwlad:  { name: "Gwlad Gwlad",         short: "Gwlad",   colour: "#D4002A" },
  Propel: { name: "Propel",              short: "Propel",  colour: "#00A86B" },
  Abolish:{ name: "Abolish",             short: "Abolish", colour: "#6B2C91" },
  DUP:    { name: "DUP",                 short: "DUP",     colour: "#931100" },
  SF:     { name: "Sinn Féin",           short: "SF",      colour: "#1FCA90" },
  SDLP:   { name: "SDLP",               short: "SDLP",    colour: "#158336" },
  APNI:   { name: "Alliance",            short: "APNI",    colour: "#D3911C" },
  WPB:    { name: "Workers Party",       short: "WPB",     colour: "#770000" },
  UUP:    { name: "UUP",                 short: "UUP",     colour: "#48A5EE" },
  NOC:    { name: "No overall control",  short: "NOC",     colour: "#CCCCCC" },
  Other:  { name: "Other",               short: "Other",   colour: "#CCCCCC" },

  /* ── Aliases (PA data uses varying abbreviation strings) ─────────── */
  "Reform UK": { name: "Reform UK",      short: "Ref",     colour: "#2EEBFF" },
  Others:      { name: "Other",          short: "Other",   colour: "#CCCCCC" },

  /* ── Minor parties (Scottish, Welsh, mayoral) ────────────────────── */
  UKIP:        { name: "UKIP",                       short: "UKIP",    colour: "#70147A" },
  Aspire:      { name: "Aspire",                     short: "Aspire",  colour: "#00A99D" },
  SSP:         { name: "Scottish Socialist Party",    short: "SSP",     colour: "#E53935" },
  TUSC:        { name: "TUSC",                       short: "TUSC",    colour: "#BF360C" },
  Animal:      { name: "Animal Welfare Party",       short: "AWP",     colour: "#C2185B" },
  Reclaim:     { name: "Reclaim Party",              short: "Reclaim", colour: "#152856" },
  "Comm Brit": { name: "Communist Party of Britain",  short: "CPB",     colour: "#8B0000" },
  SLP:         { name: "Socialist Labour Party",     short: "SLP",     colour: "#B71C1C" },
  Renew:       { name: "Renew",                      short: "Renew",   colour: "#582C83" },
  WP:          { name: "Workers Party",              short: "WP",      colour: "#770000" },
  WEP:         { name: "Women's Equality Party",     short: "WEP",     colour: "#2E8B57" },
  FA:          { name: "Freedom Alliance",           short: "FA",      colour: "#B8860B" },
  Lib:         { name: "Liberal Party",              short: "Lib",     colour: "#EB7F00" },
  IGV:         { name: "Independent Green Voice",    short: "IGV",     colour: "#66BB6A" },
  ScF:         { name: "Scottish Family Party",      short: "ScF",     colour: "#1E3765" },
  SFP:         { name: "Scottish Freedom Party",     short: "SFP",     colour: "#4A148C" },
  RS:          { name: "Reform Scotland",            short: "RS",      colour: "#5C6BC0" },
  "Soc Dem":   { name: "Social Democratic Party",    short: "SDP",     colour: "#843B62" },
  ND:          { name: "New Democrats",              short: "ND",      colour: "#607D8B" },
  Unity:       { name: "Unity",                      short: "Unity",   colour: "#795548" },
  Vanguard:    { name: "Vanguard",                   short: "Vanguard",colour: "#455A64" },
};

// Parties always grouped into "Other" (per nation)
var MINOR_PARTIES_ENGLAND  = ["R", "Your", "Aspire", "UKIP"];
var MINOR_PARTIES_SCOTLAND = ["Alba", "SSP", "TUSC", "Animal", "Reclaim", "Comm Brit", "SLP", "Renew", "WEP", "FA", "Lib", "IGV", "ScF", "SFP", "RS", "Soc Dem", "ND", "Unity", "Vanguard", "Others"];
var MINOR_PARTIES_WALES    = ["Gwlad", "Propel", "Abolish", "TUSC", "UKIP", "Comm Brit", "WP"];

function partyColour(abbr) {
  return (PARTY[abbr] || PARTY.Other).colour;
}

function partyName(abbr) {
  var p = PARTY[abbr];
  return p ? p.name : abbr;
}

function partyShortName(abbr) {
  var p = PARTY[abbr];
  return p ? p.short : abbr;
}
