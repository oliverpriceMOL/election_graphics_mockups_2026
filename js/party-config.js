/**
 * Party colours & names — shared config
 */
const PARTY = {
  Lab:    { name: "Labour",              short: "Lab",     colour: "#E4003B" },
  C:      { name: "Conservative",        short: "Con",     colour: "#0087DC" },
  LD:     { name: "Liberal Democrats",    short: "LD",      colour: "#FAA61A" },
  Green:  { name: "Green",               short: "Grn",     colour: "#6AB023" },
  Reform: { name: "Reform UK",           short: "Ref",     colour: "#12B6CF" },
  R:      { name: "Ratepayers/Residents", short: "R",       colour: "#2D6A4F" },
  Ind:    { name: "Independent",         short: "Ind",     colour: "#AAAAAA" },
  Your:   { name: "Your Party",          short: "Your",    colour: "#7E57C2" },
  SNP:    { name: "SNP",                 short: "SNP",     colour: "#FFF95D" },
  Alba:   { name: "Alba Party",          short: "Alba",    colour: "#005EB8" },
  PC:     { name: "Plaid Cymru",         short: "PC",      colour: "#005B54" },
  Gwlad:  { name: "Gwlad Gwlad",         short: "Gwlad",   colour: "#D4002A" },
  Propel: { name: "Propel",              short: "Propel",  colour: "#00A86B" },
  Abolish:{ name: "Abolish",             short: "Abolish", colour: "#6B2C91" },
  NOC:    { name: "No overall control",  short: "NOC",     colour: "#DEA5B2" },
  Other:  { name: "Other",               short: "Other",   colour: "#CCCCCC" },
};

function partyColour(abbr) {
  return (PARTY[abbr] || PARTY.Other).colour;
}

function partyName(abbr) {
  return (PARTY[abbr] || PARTY.Other).name;
}

function partyShortName(abbr) {
  var p = PARTY[abbr];
  return p ? p.short : abbr;
}
