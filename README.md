# Election Graphics Mockups 2026

Interactive D3.js visualisations for UK May 2026 election night coverage (Daily Mail).

## Running locally

```
cd mock_up_designs
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Known limitations

**Council↔GeoJSON matching**: The map currently matches PA result/nomination names to GeoJSON feature names using fuzzy string normalisation (`council-lookup.js`). For the final production version, this should be replaced with a hardcoded lookup table mapping PA council IDs (`paId`) to ONS/GSS codes (`LAD25CD`, `SPC_CD`, `SENEDD_CD` etc.) for reliable matching.
