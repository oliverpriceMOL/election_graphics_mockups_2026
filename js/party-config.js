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
  NOC:    { name: "No overall control",  short: "NOC",     colour: "#DEA5B2" },
  Other:  { name: "Other",               short: "Other",   colour: "#CCCCCC" },
};

// Parties always grouped into "Other" (per nation)
var MINOR_PARTIES_ENGLAND  = ["R", "Your"];
var MINOR_PARTIES_SCOTLAND = ["Alba"];
var MINOR_PARTIES_WALES    = ["Gwlad", "Propel", "Abolish"];

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
