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

## September 2026 map UI update

- Intersection failures are retained with source GEOID, target GEOID, processing stage, and error message and displayed in a table below Create Change Map.
- Create Change Map uses a red-white-blue legend with no grey category.
- Mapping Option uses only the five blue data classes. No-data polygons and their outlines are transparent and are omitted from the legend.
- Compare to Another Year was removed from the Run interface. Compatibility no-op hooks remain so existing table-selection event code does not fail.
- Census Grabber & Mapper is fixed to the top of the viewport, with body offset and scroll padding added to prevent content from being hidden beneath it.
