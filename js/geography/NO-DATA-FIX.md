# PrettyCensus Create Change Map no-data patch

Replace:

`js/geography/geography-harmonizer-worker.js`

with the file in this patch.

## What changed

- Same-GEOID source and target features are now always joined directly.
- Geometry overlap is retained as QA metadata instead of blocking the direct join.
- Failed Turf intersections no longer silently explain all missing records. The worker returns diagnostics for invalid area, no bounding-box candidates, and no valid intersections.
- Relationship records now include `sameGeoid`, `geometryChanged`, and `geometryOverlap`.

## Important

This patch can restore an earlier harmonized value when both Census API responses contain the GEOID. It cannot create a missing later-year Census API value. If the hover still shows `No data` for the later year, inspect the later-year API response and variable availability.
