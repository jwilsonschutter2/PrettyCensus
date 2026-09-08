/* Web Worker: builds source-to-target polygon relationships. */
importScripts("https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js");
self.onmessage = event => {
  const { sourceFeatures, targetFeatures, options } = event.data;
  try {
    const minShare = options.minSourceShare ?? 0.001;
    const directThreshold = options.directThreshold ?? 0.999;
    const index = buildGridIndex(targetFeatures);
    const relationships = [];
    let sliversExcluded = 0;
    sourceFeatures.forEach((source, sourceIndex) => {
      const sourceArea = turf.area(source);
      const sourceBox = turf.bbox(source);
      const candidates = queryGrid(index, sourceBox);
      const sameId = candidates.find(index => targetFeatures[index].properties.__pc_geoid === source.properties.__pc_geoid);
      if (sameId !== undefined) {
        const overlap = intersectionArea(source, targetFeatures[sameId]);
        if (sourceArea && overlap / sourceArea >= directThreshold) {
          relationships.push({ source: source.properties.__pc_geoid, target: targetFeatures[sameId].properties.__pc_geoid,
            sourceShare: 1, targetShare: 1, intersectionArea: overlap, direct: true });
          return;
        }
      }
      candidates.forEach(targetIndex => {
        const target = targetFeatures[targetIndex];
        const area = intersectionArea(source, target);
        if (!area || !sourceArea) return;
        const sourceShare = area / sourceArea;
        if (sourceShare < minShare) { sliversExcluded += 1; return; }
        const targetArea = turf.area(target);
        relationships.push({ source: source.properties.__pc_geoid, target: target.properties.__pc_geoid,
          sourceShare, targetShare: targetArea ? area / targetArea : 0, intersectionArea: area, direct: false });
      });
    });
    self.postMessage({ relationships, sliversExcluded });
  } catch (error) {
    self.postMessage({ error: error.message || String(error) });
  }
};
function intersectionArea(a, b) {
  try { const result = turf.intersect(a, b); return result ? turf.area(result) : 0; }
  catch (_) { return 0; }
}
function cells(box, size = 0.25) {
  const result = [];
  for (let x = Math.floor(box[0] / size); x <= Math.floor(box[2] / size); x++)
    for (let y = Math.floor(box[1] / size); y <= Math.floor(box[3] / size); y++) result.push(`${x}:${y}`);
  return result;
}
function buildGridIndex(features) {
  const grid = new Map();
  features.forEach((feature, index) => cells(turf.bbox(feature)).forEach(key => {
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(index);
  }));
  return grid;
}
function queryGrid(grid, box) {
  const found = new Set();
  cells(box).forEach(key => (grid.get(key) || []).forEach(index => found.add(index)));
  return [...found];
}
