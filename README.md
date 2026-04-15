# Election Graphics Mockups 2026

Interactive D3.js visualisations for UK May 2026 election night coverage (Daily Mail).

**Live preview**: [oliverpricemol.github.io/election_graphics_mockups_2026](https://oliverpricemol.github.io/election_graphics_mockups_2026/)

This is a standalone mirror of the `mock_up_designs/` folder from the [main project repo](https://github.com/oliverpriceMOL/local_elections_2026). It contains only the front-end HTML/CSS/JS and pre-built JSON data — no Python scripts, XML data, or GeoJSON source files.

## Pages

- **index.html** — England: 136 local councils + 6 mayoral elections
- **scotland.html** — Scottish Parliament (Holyrood): 73 constituencies + 8 regions
- **wales.html** — Welsh Parliament (Senedd): 16 constituencies

## Running locally

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Tech Stack

- **D3.js v7** (CDN) — all visualisation and DOM manipulation
- **Vanilla JavaScript** — no frameworks, no modules, no build system
- **Inter** (Google Fonts) — weights 400/500/700
- **CSS custom properties** — no preprocessor

## Known limitations

**Council↔GeoJSON matching**: The map currently matches PA result/nomination names to GeoJSON feature names using fuzzy string normalisation (`council-lookup.js`). For the final production version, this should be replaced with a hardcoded lookup table mapping PA council IDs (`paId`) to ONS/GSS codes (`LAD25CD`, `SPC_CD`, `SENEDD_CD` etc.) for reliable matching.
