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
