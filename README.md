# Election Graphics — Standalone Modules 2026

Self-contained interactive D3.js modules for UK May 2026 election night coverage (Daily Mail). Each module is a single HTML page designed for iframe embedding, with auto-polling every 60 seconds.

**Live preview:** https://oliverpricemol.github.io/election_graphics_mockups_2026/

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/ for the module gallery.

## Modules (19 total)

### All Nations (combined with country tabs)
| File | Graphic |
|------|---------|
| `all-nations-scoreboard.html` | Scoreboard with England/Scotland/Wales tabs |
| `all-nations-party-strip.html` | Party totals bar with country tabs |
| `all-nations-change-seats.html` | Seat change columns with country tabs |
| `all-nations-hemicycle.html` | Parliament hemicycle (Scotland + Wales) |
| `all-nations-map.html` | Interactive map with country tabs |

### England
| File | Graphic |
|------|---------|
| `england-scoreboard.html` | Party scoreboard table |
| `england-party-strip.html` | Party totals horizontal bar |
| `england-change-seats.html` | Change in councillors/councils columns |
| `england-map.html` | Interactive choropleth with search & overlays |

### Scotland
| File | Graphic |
|------|---------|
| `scotland-scoreboard.html` | Scoreboard with seats/vote share toggle |
| `scotland-party-strip.html` | Party totals horizontal bar |
| `scotland-change-seats.html` | Seat change columns |
| `scotland-hemicycle.html` | Parliament composition |
| `scotland-map.html` | Interactive constituency + region map |

### Wales
| File | Graphic |
|------|---------|
| `wales-scoreboard.html` | Scoreboard with vote share bars |
| `wales-party-strip.html` | Party totals horizontal bar |
| `wales-change-seats.html` | Seat change columns |
| `wales-hemicycle.html` | Parliament composition |
| `wales-map.html` | Interactive Senedd constituency map |

## Structure

```
├── index.html          # Landing page / module gallery
├── css/styles.css      # Shared stylesheet
├── js/                 # Built JS bundles (one per module)
├── data/               # Test JSON data (local dev)
├── map_data/           # GeoJSON boundary files
└── img/                # Flag icons + party icons
```

## Data

Each module fetches PA wire JSON via `paUrl(category, filename)`:
- **Local dev** (localhost / github.io): loads from `data/`
- **Production** (dailymail.co.uk): loads from CDN

Auto-polls every 60 seconds. Graphics update automatically as results arrive.
