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

## Split/merge-aware Create Change Map

Create Change Map now builds a reusable source-to-target relationship matrix in a Web Worker. The matrix is cached by year pair, state, county, and geography level.

- Exact GEOID only keeps geometrically stable same-GEOID relationships.
- Automatic and Area weighted allocate configured additive counts by normalized source-area overlap.
- Intersections below Minimum source share are excluded as slivers.
- Sources below Minimum source coverage are not allocated.
- Target features are classified as direct, renumbered one-to-one, split, merge, complex, or unmatched.
- GeoJSON output records source GEOIDs, source weights, relationship class, weighting method, and estimated status.
- Relationship CSV exports the source-to-target matrix.
- Validation reports direct/renumbered/split/merge/complex/unmatched counts, excluded slivers, and allocation error.
- Non-additive variables are restricted to Exact GEOID only. Medians and percentages are not area allocated.
- Area-mode map generation stops when allocated additive totals differ from source totals by more than 1%.

## Compare to Another Year removed

The Compare to Another Year feature has been fully removed, including its Run button, panel, JavaScript implementation, state, event wiring, dropdown refresh call, script reference, comparison-only export filename helper, and named CSS selectors. Create Change Map remains independent.
