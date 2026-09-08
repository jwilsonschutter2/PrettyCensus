/** PrettyCensus configurable full-coverage harmonizer. */
window.PrettyCensusHarmonizer = (() => {
  "use strict";
  const cache = new Map();
  const ADDITIVE = new Set(["B01001_001E","B01003_001E","B23025_003E","B17001_002E","B25001_001E","B25002_002E","B25002_003E","B25003_002E","B25003_003E","B01001_002E","B01001_026E","B08134_001E","B08134_002E","B08134_003E"]);
  const numeric = value => { const n = Number(value); return Number.isFinite(n) && n > -666666666 ? n : null; };
  const sum = values => values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  function runWorker(input) {
    return new Promise((resolve, reject) => {
      const worker = new Worker("js/geography/geography-harmonizer-worker.js");
      worker.onmessage = event => { worker.terminate(); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data); };
      worker.onerror = event => { worker.terminate(); reject(new Error(event.message || "Relationship worker failed.")); };
      worker.postMessage({ sourceFeatures: input.sourceGeoJson.features, targetFeatures: input.targetGeoJson.features, options: input.options });
    });
  }
  async function relationshipData(input) {
    const optionKey = JSON.stringify(input.options || {}), key = `${input.cacheKey}|${optionKey}`;
    if (!cache.has(key)) cache.set(key, runWorker(input).catch(error => { cache.delete(key); throw error; }));
    return cache.get(key);
  }
  function classify(records) {
    const targetsBySource = new Map(), sourcesByTarget = new Map();
    records.forEach(r => {
      if (!targetsBySource.has(r.source)) targetsBySource.set(r.source, new Set());
      if (!sourcesByTarget.has(r.target)) sourcesByTarget.set(r.target, new Set());
      targetsBySource.get(r.source).add(r.target); sourcesByTarget.get(r.target).add(r.source);
    });
    return {
      targetsBySource, sourcesByTarget,
      targetType(target) {
        const sources = sourcesByTarget.get(target) || new Set(), counts = [...sources].map(source => targetsBySource.get(source)?.size || 0);
        if (sources.size === 1 && counts[0] === 1) return records.find(r => r.target === target)?.direct ? "direct" : "renumbered-one-to-one";
        if (sources.size === 1 && counts[0] > 1) return "split";
        if (sources.size > 1 && counts.every(count => count === 1)) return "merge";
        if (sources.size > 1) return "complex";
        return "unmatched";
      }
    };
  }
  async function harmonize(input) {
    if (input.method !== "exact" && !ADDITIVE.has(input.variable)) throw new Error("Area and fallback allocation require a configured additive count variable. Use Exact GEOID only for this variable.");
    const workerData = await relationshipData(input);
    let records = input.method === "exact" ? workerData.relationships.filter(r => r.direct) : workerData.relationships;
    if (input.method === "overlap") records = records.filter(r => !r.fallbackUsed);
    const sourceValues = new Map(input.sourceRows.map(row => [PrettyCensusGeoid.fromRow(row, input.level), numeric(row[input.variable])]));
    const targetValues = new Map(input.targetRows.map(row => [PrettyCensusGeoid.fromRow(row, input.level), numeric(row[input.variable])]));
    const bySource = new Map(); records.forEach(r => { if (!bySource.has(r.source)) bySource.set(r.source, []); bySource.get(r.source).push(r); });
    const allocated = new Map(), provenance = new Map();
    let eligibleTotal = 0, excludedTotal = 0, excludedCount = 0, fallbackValue = 0;
    sourceValues.forEach((sourceValue, sourceId) => {
      if (!Number.isFinite(sourceValue)) return;
      const sourceRecords = bySource.get(sourceId) || [];
      if (!sourceRecords.length) { excludedTotal += sourceValue; excludedCount++; return; }
      const observedCoverage = Math.max(...sourceRecords.map(r => Number(r.observedCoverage) || 0));
      const rawTotal = sum(sourceRecords.map(r => r.direct || r.fallbackUsed ? 1 : r.sourceShare));
      const normalize = input.options.normalizePartial !== false;
      if (!normalize && observedCoverage < Number(input.options.minimumUsableCoverage || 0)) { excludedTotal += sourceValue; excludedCount++; return; }
      eligibleTotal += sourceValue;
      sourceRecords.forEach(r => {
        const divisor = r.direct || r.fallbackUsed ? 1 : (normalize ? rawTotal : 1);
        const weight = r.direct || r.fallbackUsed ? 1 : r.sourceShare / divisor;
        const amount = sourceValue * weight;
        allocated.set(r.target, (allocated.get(r.target) || 0) + amount);
        if (r.fallbackUsed) fallbackValue += amount;
        if (!provenance.has(r.target)) provenance.set(r.target, []);
        provenance.get(r.target).push({ ...r, normalizedWeight: weight, observedCoverage });
      });
    });
    const originalTotal = sum([...sourceValues.values()]), allocatedTotal = sum([...allocated.values()]);
    const summary = { direct: 0, renumbered: 0, splits: 0, merges: 0, complex: 0, unmatchedTargets: 0,
      unmatchedSources: excludedCount, originalTotal, eligibleSourceTotal: eligibleTotal, excludedSourceTotal: excludedTotal,
      excludedSourceShare: originalTotal ? Math.abs(excludedTotal) / Math.abs(originalTotal) : 0,
      allocatedTotal, allocationError: eligibleTotal ? Math.abs(allocatedTotal - eligibleTotal) / Math.abs(eligibleTotal) : 0,
      fallbackValueShare: eligibleTotal ? Math.abs(fallbackValue) / Math.abs(eligibleTotal) : 0,
      sliversExcluded: workerData.sliversExcluded || 0, intersectionErrors: workerData.intersectionErrors || 0,
      directGeometryChanged: workerData.directGeometryChanged || 0, diagnostics: workerData.diagnostics || [] };
    const classes = classify(records);
    input.targetGeoJson.features.forEach((feature, index) => {
      const id = PrettyCensusGeoid.fromFeature(feature, input.level), type = classes.targetType(id), sources = provenance.get(id) || [];
      const earlier = allocated.get(id) ?? null, later = targetValues.get(id) ?? null, difference = earlier !== null && later !== null ? later - earlier : null;
      const percent = difference !== null && earlier !== 0 ? difference / earlier * 100 : null;
      if (type === "direct") summary.direct++; else if (type === "renumbered-one-to-one") summary.renumbered++;
      else if (type === "split") summary.splits++; else if (type === "merge") summary.merges++; else if (type === "complex") summary.complex++; else summary.unmatchedTargets++;
      feature.id = index; feature.properties = { ...feature.properties, __geoid: id, __earlier_harmonized: earlier, __later: later,
        __difference: difference, __percent: percent, __relationship: type,
        __assignment_methods: [...new Set(sources.map(s => s.method))].join("|"), __confidence: weakest(sources.map(s => s.confidence)),
        __source_geoids: sources.map(s => s.source).join("|"), __source_weights: sources.map(s => s.normalizedWeight.toFixed(8)).join("|"),
        __observed_coverage: sources.length ? Math.min(...sources.map(s => s.observedCoverage)) : 0,
        __fallback_used: sources.some(s => s.fallbackUsed), __estimated: type !== "direct" && earlier !== null };
    });
    return { geojson: input.targetGeoJson, relationships: records.map(r => ({ ...r, normalizedWeight: provenance.get(r.target)?.find(p => p.source === r.source)?.normalizedWeight ?? null })), summary };
  }
  function weakest(values) { const rank = { high: 3, medium: 2, low: 1, "very-low": 0 }; return values.length ? values.reduce((a,b) => rank[b] < rank[a] ? b : a, values[0]) : "none"; }
  return { harmonize, variableRule: variable => ({ type: ADDITIVE.has(variable) ? "additive" : "unsupported" }) };
})();
