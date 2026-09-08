/** Shared Census GEOID helpers. */
window.PrettyCensusGeoid = (() => {
  "use strict";
  function digits(value, length) {
    const found = String(value ?? "").match(/\d+/);
    return found ? found[0].padStart(length, "0").slice(-length) : "";
  }
  function fromRow(row, level) {
    const tract = digits(row.state, 2) + digits(row.county, 3) + digits(row.tract, 6);
    return level === "blockgroup" ? tract + digits(row["block group"], 1) : tract;
  }
  function fromFeature(feature, level) {
    const p = feature.properties || {};
    const length = level === "blockgroup" ? 12 : 11;
    for (const key of ["GEOID", "GEOID20", "GEOID10", "geoid", "AFFGEOID"]) {
      const value = String(p[key] ?? "").replace(/\D/g, "");
      if (value.length >= length) return value.slice(-length);
    }
    const tract = digits(p.STATEFP ?? p.STATEFP20 ?? p.STATEFP10, 2) +
      digits(p.COUNTYFP ?? p.COUNTYFP20 ?? p.COUNTYFP10, 3) +
      digits(p.TRACTCE ?? p.TRACTCE20 ?? p.TRACTCE10, 6);
    return level === "blockgroup"
      ? tract + digits(p.BLKGRPCE ?? p.BLKGRPCE20 ?? p.BLKGRPCE10, 1)
      : tract;
  }
  function validate({ features, rows, level, state, county, label }) {
    const length = level === "blockgroup" ? 12 : 11;
    const prefix = state + county;
    const featureIds = features.map(feature => fromFeature(feature, level));
    const rowIds = rows.map(row => fromRow(row, level));
    const invalid = [...featureIds, ...rowIds].filter(id => id.length !== length || !id.startsWith(prefix));
    const duplicates = values => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
    const featureDuplicates = duplicates(featureIds);
    const rowDuplicates = duplicates(rowIds);
    if (invalid.length || featureDuplicates.length || rowDuplicates.length) {
      throw new Error(`${label} GEOID validation failed: ${invalid.length} invalid, ${featureDuplicates.length} duplicate boundaries, ${rowDuplicates.length} duplicate Census rows.`);
    }
    return { featureIds, rowIds };
  }
  return { digits, fromRow, fromFeature, validate };
})();
