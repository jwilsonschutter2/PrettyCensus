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


### Independent change map
- Create Change Map is its own top-level Run workflow.
- It makes two Census API requests directly and does not depend on comparisonRows or Run Comparison.
- Select two years and a variable inside the panel. Dataset, geography, state, and county use the main controls.
- Results are drawn on the later-year geography and can be exported as GeoJSON.
- This build validates GEOID format and duplicate IDs, but only maps direct GEOID matches. Earlier GEOIDs absent from the later vintage are reported rather than silently reassigned.
