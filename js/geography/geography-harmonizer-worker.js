/*
 * PrettyCensus geography relationship worker, direct-match reliability patch.
 * Same-GEOID features are joined directly even when geometry differs.
 * Geometry overlap is retained as QA metadata rather than blocking the join.
 */
importScripts("https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js");

self.onmessage = event => {
  const { sourceFeatures, targetFeatures, options = {} } = event.data;

  try {
    const minShare = finiteOption(options.minSourceShare, 0.001);
    const directThreshold = finiteOption(options.directThreshold, 0.999);
    const targetByGeoid = new Map();

    targetFeatures.forEach((feature, index) => {
      const geoid = feature.properties && feature.properties.__pc_geoid;
      if (geoid) targetByGeoid.set(String(geoid), index);
    });

    const index = buildGridIndex(targetFeatures);
    const relationships = [];
    const diagnostics = [];
    let sliversExcluded = 0;
    let directGeometryChanged = 0;
    let intersectionErrors = 0;

    sourceFeatures.forEach(source => {
      const sourceGeoid = String(source.properties && source.properties.__pc_geoid || "");
      const sourceArea = safeArea(source);
      const sameIndex = targetByGeoid.get(sourceGeoid);

      // A common GEOID is a valid direct tabular join. Geometry difference is QA,
      // not a reason to throw the record into an error-prone overlay operation.
      if (sameIndex !== undefined) {
        const overlapResult = safeIntersectionArea(source, targetFeatures[sameIndex]);
        if (overlapResult.error) intersectionErrors += 1;
        const overlapRatio = sourceArea > 0 && overlapResult.area > 0
          ? Math.min(1, overlapResult.area / sourceArea)
          : null;
        const geometryChanged = overlapRatio === null || overlapRatio < directThreshold;
        if (geometryChanged) directGeometryChanged += 1;

        relationships.push({
          source: sourceGeoid,
          target: sourceGeoid,
          sourceShare: 1,
          targetShare: 1,
          intersectionArea: overlapResult.area,
          direct: true,
          sameGeoid: true,
          geometryChanged,
          geometryOverlap: overlapRatio
        });
        return;
      }

      if (!sourceArea) {
        diagnostics.push({ source: sourceGeoid, reason: "invalid-or-zero-area-source" });
        return;
      }

      const candidates = queryGrid(index, turf.bbox(source));
      let accepted = 0;

      candidates.forEach(targetIndex => {
        const target = targetFeatures[targetIndex];
        const overlap = safeIntersectionArea(source, target);
        if (overlap.error) intersectionErrors += 1;
        if (!overlap.area) return;

        const sourceShare = overlap.area / sourceArea;
        if (sourceShare < minShare) {
          sliversExcluded += 1;
          return;
        }

        const targetArea = safeArea(target);
        relationships.push({
          source: sourceGeoid,
          target: String(target.properties && target.properties.__pc_geoid || ""),
          sourceShare,
          targetShare: targetArea ? overlap.area / targetArea : 0,
          intersectionArea: overlap.area,
          direct: false,
          sameGeoid: false,
          geometryChanged: true,
          geometryOverlap: null
        });
        accepted += 1;
      });

      if (!accepted) {
        diagnostics.push({
          source: sourceGeoid,
          reason: candidates.length ? "no-valid-intersection" : "no-bbox-candidates"
        });
      }
    });

    self.postMessage({
      relationships,
      diagnostics,
      sliversExcluded,
      directGeometryChanged,
      intersectionErrors
    });
  } catch (error) {
    self.postMessage({ error: error.message || String(error) });
  }
};

function finiteOption(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeArea(feature) {
  try {
    const area = turf.area(feature);
    return Number.isFinite(area) && area > 0 ? area : 0;
  } catch (_) {
    return 0;
  }
}

function safeIntersectionArea(source, target) {
  try {
    const result = turf.intersect(source, target);
    return { area: result ? safeArea(result) : 0, error: false };
  } catch (_) {
    return { area: 0, error: true };
  }
}

function cells(box, size = 0.25) {
  const result = [];
  for (let x = Math.floor(box[0] / size); x <= Math.floor(box[2] / size); x += 1) {
    for (let y = Math.floor(box[1] / size); y <= Math.floor(box[3] / size); y += 1) {
      result.push(`${x}:${y}`);
    }
  }
  return result;
}

function buildGridIndex(features) {
  const grid = new Map();
  features.forEach((feature, index) => {
    let box;
    try { box = turf.bbox(feature); } catch (_) { return; }
    cells(box).forEach(key => {
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(index);
    });
  });
  return grid;
}

function queryGrid(grid, box) {
  const found = new Set();
  cells(box).forEach(key => (grid.get(key) || []).forEach(index => found.add(index)));
  return [...found];
}
