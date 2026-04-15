# Election Graphics Mockups 2026

Interactive D3.js visualisations for UK May 2026 election night coverage (Daily Mail).

## Running locally

```
cd mock_up_designs
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Data

The front-end consumes **raw PA wire JSON** — xmltodict-converted XML served from a CDN in production. For local development, downloaded copies of these files live in `data/`.

`data-adapter.js` normalizes the raw format at runtime:
- Strips `@`-prefixed attribute keys → plain keys
- Converts string values to numbers
- Unwraps deeply nested `Election → Council/Constituency` structure
- Filters out State of Parties (SOP) entries
- Tags items as `fileType: "result"` or `"rush"`

`paUrl(category, filename)` automatically routes to local `data/` on localhost and to the CDN in production.

### Rush vs Result

PA sends two message types for each constituency/council:
- **Rush** — arrives first with winner info but no vote counts
- **Result** — follows with full candidate vote data

`dedupByRevision()` always prefers a Result over a Rush for the same name, then picks the highest revision number.

## Known limitations

**Council↔GeoJSON matching**: The map currently matches PA result/nomination names to GeoJSON feature names using fuzzy string normalisation (`council-lookup.js`). For the final production version, this should be replaced with a hardcoded lookup table mapping PA council IDs (`paId`) to ONS/GSS codes (`LAD25CD`, `SPC_CD`, `SENEDD_CD` etc.) for reliable matching.
