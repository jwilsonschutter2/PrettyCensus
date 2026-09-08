/* PrettyCensus source-to-target relationship worker with configurable fallbacks. */
importScripts("https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js");
self.onmessage = event => {
  try { self.postMessage(build(event.data)); }
  catch (error) { self.postMessage({ error: error.message || String(error) }); }
};
function build({ sourceFeatures, targetFeatures, options = {} }) {
  const minShare = number(options.minSourceShare, 0.0001);
  const cumulativeTarget = number(options.cumulativeTarget, 0.995);
  const preferredCoverage = number(options.preferredCoverage, 0.95);
  const maxDistanceKm = number(options.maxDistanceKm, 10);
  const pointFallback = options.pointFallback !== false;
  const nearestFallback = options.nearestFallback !== false;
  const targetsById = new Map(targetFeatures.map((feature, index) => [id(feature), index]));
  const grid = buildGrid(targetFeatures);
  const targetPoints = targetFeatures.map(feature => safePoint(feature));
  const relationships = [], diagnostics = [];
  let sliversExcluded = 0, intersectionErrors = 0, directGeometryChanged = 0;
  for (const source of sourceFeatures) {
    const sourceId = id(source), sameIndex = targetsById.get(sourceId), sourceArea = safeArea(source);
    if (sameIndex !== undefined) {
      const overlap = safeIntersection(source, targetFeatures[sameIndex]);
      if (overlap.error) intersectionErrors++;
      const geometryOverlap = sourceArea && overlap.area ? Math.min(1, overlap.area / sourceArea) : null;
      const geometryChanged = geometryOverlap === null || geometryOverlap < 0.999;
      if (geometryChanged) directGeometryChanged++;
      relationships.push(record(sourceId, sourceId, 1, 1, overlap.area, "direct-geoid", "high", geometryChanged, geometryOverlap));
      continue;
    }
    if (!sourceArea) { diagnostics.push({ source: sourceId, reason: "invalid-or-zero-area" }); continue; }
    const candidates = queryGrid(grid, turf.bbox(source));
    let overlaps = [];
    for (const targetIndex of candidates) {
      const target = targetFeatures[targetIndex], overlap = safeIntersection(source, target);
      if (overlap.error) intersectionErrors++;
      if (!overlap.area) continue;
      const sourceShare = overlap.area / sourceArea, targetArea = safeArea(target);
      overlaps.push({ target: id(target), sourceShare, targetShare: targetArea ? overlap.area / targetArea : 0, area: overlap.area });
    }
    overlaps.sort((a, b) => b.sourceShare - a.sourceShare);
    const accepted = []; let cumulative = 0;
    for (const overlap of overlaps) {
      if (overlap.sourceShare >= minShare || cumulative < cumulativeTarget) {
        accepted.push(overlap); cumulative += overlap.sourceShare;
      } else sliversExcluded++;
    }
    if (accepted.length) {
      const confidence = cumulative >= preferredCoverage ? "medium" : cumulative >= 0.8 ? "low" : "very-low";
      for (const overlap of accepted) relationships.push(record(sourceId, overlap.target, overlap.sourceShare, overlap.targetShare, overlap.area, "polygon-overlap", confidence, true, null, cumulative));
      continue;
    }
    const sourcePoint = safePoint(source);
    if (sourcePoint && pointFallback) {
      const containing = targetFeatures.findIndex(target => safeContains(target, sourcePoint));
      if (containing >= 0) {
        relationships.push(record(sourceId, id(targetFeatures[containing]), 1, 0, 0, "point-on-surface-fallback", "low", true, null, 0));
        continue;
      }
    }
    if (sourcePoint && nearestFallback) {
      let bestIndex = -1, bestDistance = Infinity;
      targetPoints.forEach((point, index) => {
        if (!point) return;
        const distance = turf.distance(sourcePoint, point, { units: "kilometers" });
        if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
      });
      if (bestIndex >= 0 && bestDistance <= maxDistanceKm) {
        const r = record(sourceId, id(targetFeatures[bestIndex]), 1, 0, 0, "nearest-target-fallback", "very-low", true, null, 0);
        r.distanceKm = bestDistance; relationships.push(r); continue;
      }
    }
    diagnostics.push({ source: sourceId, reason: "unmatched-after-fallbacks" });
  }
  return { relationships, diagnostics, sliversExcluded, intersectionErrors, directGeometryChanged };
}
function record(source, target, sourceShare, targetShare, intersectionArea, method, confidence, geometryChanged, geometryOverlap, observedCoverage = 1) {
  return { source, target, sourceShare, targetShare, intersectionArea, direct: method === "direct-geoid", method, confidence, geometryChanged, geometryOverlap, observedCoverage, fallbackUsed: method.includes("fallback") };
}
function id(feature) { return String(feature.properties?.__pc_geoid || ""); }
function number(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function safeArea(feature) { try { const a = turf.area(feature); return Number.isFinite(a) && a > 0 ? a : 0; } catch (_) { return 0; } }
function safeIntersection(a, b) { try { const i = turf.intersect(a, b); return { area: i ? safeArea(i) : 0, error: false }; } catch (_) { return { area: 0, error: true }; } }
function safePoint(feature) { try { return turf.pointOnFeature(feature); } catch (_) { return null; } }
function safeContains(feature, point) { try { return turf.booleanPointInPolygon(point, feature); } catch (_) { return false; } }
function cells(box, size = 0.25) { const out = []; for (let x = Math.floor(box[0]/size); x <= Math.floor(box[2]/size); x++) for (let y = Math.floor(box[1]/size); y <= Math.floor(box[3]/size); y++) out.push(`${x}:${y}`); return out; }
function buildGrid(features) { const grid = new Map(); features.forEach((feature, index) => { let box; try { box = turf.bbox(feature); } catch (_) { return; } cells(box).forEach(key => { if (!grid.has(key)) grid.set(key, []); grid.get(key).push(index); }); }); return grid; }
function queryGrid(grid, box) { const found = new Set(); cells(box).forEach(key => (grid.get(key) || []).forEach(index => found.add(index))); return [...found]; }
