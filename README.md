# PrettyCensus mapping update

This build replaces the Mapping Option placeholder with a Mapbox GL JS choropleth workflow.

## Run
Serve this folder through a local web server or GitHub Pages. Do not open index.html directly with file:// because browser fetch and CORS rules may block API and tile requests.

## Mapping workflow
1. Enter and save a Census API key.
2. Select year, dataset, Tract or Block Group, state, county, and table variable.
3. Open Mapping Option.
4. Enter a Mapbox public access token and select a mapped variable.
5. Click Draw map.

The code automatically selects the repository by year, builds the raw GitHub XYZ PBF template, inspects the z0 tile to discover its source-layer name, requests the selected Census variable, joins by GEOID, and applies a five-class quantile style.

## Two-year change mapping

The Create Change Map panel compares the selected current year with the Comparison Year on the later year's boundaries.

- Direct GEOID mode maps exact tract or block-group matches.
- Area-weight mode allocates unmatched additive count variables by polygon intersection and identifies splits and merges.
- GEOID length, state/county prefix, duplicate boundary IDs, and duplicate Census API IDs are validated before rendering.
- The panel reports direct matches, splits, merges, and unmatched features and can export the feature-level results to CSV.
- Area allocation is intentionally blocked for medians, percentages, indexes, and other non-additive statistics.

Serve the project through localhost or GitHub Pages. Do not open index.html with file://.
