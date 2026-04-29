/**
 * data-adapter.js — Transform raw PA wire JSON (xmltodict format) into the
 * processed shapes that D3 components expect.
 *
 * Raw PA JSON uses @-prefixed attribute names, wrapper keys per result type,
 * and deeply nested Election > Council/Constituency structures.
 * This adapter flattens that into the simple objects the frontend already uses.
 */

/* ── Base URL configuration ────────────────────────────────────────────── */

var PA_DATA_BASE = "https://scripts.dailymail.co.uk/static/uk_elections/2026/local_elections";
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
      return { name: p["@name"], paId: p["@paId"], seats: _tryNum(p["@seats"]) };
    });

    // Changes
    var ch = (council.Changes || {}).Party;
    r.changes = _arr(ch).map(function (p) {
      return { name: p["@name"], paId: p["@paId"], change: _parseChange(p["@change"]) };
    });

    // NewCouncil
    var nc = (council.NewCouncil || {}).Party;
    r.newCouncil = _arr(nc).map(function (p) {
      return { name: p["@name"], paId: p["@paId"], seats: _tryNum(p["@seats"]) };
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
          name:         party["@name"]
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
            abbreviation: party["@abbreviation"]
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
            name:         party["@name"]
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
