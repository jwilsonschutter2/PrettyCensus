# PrettyCensus mapping update

This build replaces the Mapping Option placeholder with a Mapbox GL JS choropleth workflow.

https://jwilsonschutter2.github.io/PrettyCensusV2/

## Run
Serve this folder through a local web server or GitHub Pages. Do not open index.html directly with file:// because browser fetch and CORS rules may block API and tile requests.

## Mapping workflow
1. Enter and save a Census API key.
2. Select year, dataset, Tract or Block Group, state, county, and table variable.
3. Open Mapping Option.
4. Enter a Mapbox public access token and select a mapped variable.
5. Click Draw map.

The code automatically selects the repository by year, builds the raw GitHub XYZ PBF template, inspects the z0 tile to discover its source-layer name, requests the selected Census variable, joins by GEOID, and applies a five-class quantile style.

### September 2026 cleanup
- The final Run workflow structure now lives directly in index.html. JavaScript only controls panel visibility.
- Fetch, Compare, Mapping, and Create Change Map are mutually exclusive top-level panels.
- Create Change Map is independent of the tabular comparison workflow.
- Shared GEOID helpers are in js/geography/geoid.js.
- Shared yearly boundary URL, gzip, caching, and county filtering are in js/geography/boundary-loader.js.
- CSV and GeoJSON exports use one shared browser download helper.
- Obsolete mapping archives were removed from the deployed package. Git history remains the appropriate archive.
