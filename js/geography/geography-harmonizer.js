/** Geographic split/merge harmonization and validation. */
window.PrettyCensusHarmonizer = (() => {
  const relationshipCache = new Map();
  const ADDITIVE = new Set(["B01001_001E","B01003_001E","B23025_003E","B17001_002E","B25001_001E","B25002_002E","B25002_003E","B25003_002E","B25003_003E","B01001_002E","B01001_026E","B08134_001E","B08134_002E","B08134_003E"]);
  function variableRule(variable) { return ADDITIVE.has(variable) ? { type: "additive" } : { type: "unsupported" }; }
  function workerRelationships(sourceFeatures, targetFeatures, options) {
    return new Promise((resolve, reject) => {
      const worker = new Worker("js/geography/geography-harmonizer-worker.js");
      worker.onmessage = event => { worker.terminate(); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data); };
      worker.onerror = event => { worker.terminate(); reject(new Error(event.message || "Geography worker failed.")); };
      worker.postMessage({ sourceFeatures, targetFeatures, options });
    });
  }
  async function relationships({ sourceGeoJson, targetGeoJson, cacheKey, options = {} }) {
    if (!relationshipCache.has(cacheKey)) relationshipCache.set(cacheKey,
      workerRelationships(sourceGeoJson.features, targetGeoJson.features, options).catch(error => { relationshipCache.delete(cacheKey); throw error; }));
    return relationshipCache.get(cacheKey);
  }
  function classify(records) {
    const targetsBySource = new Map(), sourcesByTarget = new Map();
    records.forEach(r => {
      if (!targetsBySource.has(r.source)) targetsBySource.set(r.source, new Set());
      if (!sourcesByTarget.has(r.target)) sourcesByTarget.set(r.target, new Set());
      targetsBySource.get(r.source).add(r.target); sourcesByTarget.get(r.target).add(r.source);
    });
    const relationshipForTarget = target => {
      const sources = sourcesByTarget.get(target) || new Set();
      const sourceTargetCounts = [...sources].map(source => targetsBySource.get(source)?.size || 0);
      if (sources.size === 1 && sourceTargetCounts[0] === 1) return records.find(r => r.target === target)?.direct ? "direct" : "renumbered-one-to-one";
      if (sources.size === 1 && sourceTargetCounts[0] > 1) return "split";
      if (sources.size > 1 && sourceTargetCounts.every(count => count === 1)) return "merge";
      if (sources.size > 1) return "complex";
      return "unmatched";
    };
    return { targetsBySource, sourcesByTarget, relationshipForTarget };
  }
  async function harmonize(input) {
    const rule = variableRule(input.variable);
    if (input.method !== "exact" && rule.type !== "additive") throw new Error("This variable is not configured as an additive count. Use Exact GEOID only or configure a numerator/denominator rule.");
    const relationResult = await relationships(input);
    const records = input.method === "exact" ? relationResult.relationships.filter(r => r.direct) : relationResult.relationships;
    const classes = classify(records);
    const sourceValues = new Map(input.sourceRows.map(row => [PrettyCensusGeoid.fromRow(row, input.level), numeric(row[input.variable])]));
    const targetValues = new Map(input.targetRows.map(row => [PrettyCensusGeoid.fromRow(row, input.level), numeric(row[input.variable])]));
    const allocated = new Map(), coverageBySource = new Map(), sourcesByTarget = new Map();
    records.forEach(r => coverageBySource.set(r.source, (coverageBySource.get(r.source) || 0) + r.sourceShare));
    records.forEach(r => {
      const sourceValue = sourceValues.get(r.source);
      if (sourceValue === null || sourceValue === undefined) return;
      const coverage = coverageBySource.get(r.source) || 0;
      if (coverage < (input.options?.minCoverage ?? 0.95)) return;
      const weight = r.direct ? 1 : r.sourceShare / coverage;
      allocated.set(r.target, (allocated.get(r.target) || 0) + sourceValue * weight);
      if (!sourcesByTarget.has(r.target)) sourcesByTarget.set(r.target, []);
      sourcesByTarget.get(r.target).push({ geoid: r.source, weight });
    });
    const originalTotal = sum([...sourceValues.values()]);
    const allocatedTotal = sum([...allocated.values()]);
    const allocationError = originalTotal ? Math.abs(allocatedTotal - originalTotal) / Math.abs(originalTotal) : 0;
    const summary = { direct: 0, renumbered: 0, splits: 0, merges: 0, complex: 0, unmatchedTargets: 0,
      unmatchedSources: [...sourceValues.keys()].filter(id => !coverageBySource.has(id) || coverageBySource.get(id) < (input.options?.minCoverage ?? 0.95)).length,
      sliversExcluded: relationResult.sliversExcluded, originalTotal, allocatedTotal, allocationError };
    input.targetGeoJson.features.forEach((feature, index) => {
      const id = PrettyCensusGeoid.fromFeature(feature, input.level), relation = classes.relationshipForTarget(id);
      const oldValue = allocated.get(id) ?? null, newValue = targetValues.get(id) ?? null;
      const difference = oldValue !== null && newValue !== null ? newValue - oldValue : null;
      const percent = difference !== null && oldValue !== 0 ? difference / oldValue * 100 : null;
      if (relation === "direct") summary.direct++; else if (relation === "renumbered-one-to-one") summary.renumbered++;
      else if (relation === "split") summary.splits++; else if (relation === "merge") summary.merges++;
      else if (relation === "complex") summary.complex++; else summary.unmatchedTargets++;
      const sourceInfo = sourcesByTarget.get(id) || [];
      feature.id = index;
      feature.properties = { ...feature.properties, __geoid: id, __earlier_harmonized: oldValue, __later: newValue,
        __difference: difference, __percent: percent, __relationship: relation,
        __weight_method: relation === "direct" ? "none" : (input.method === "exact" ? "none" : "area"),
        __source_geoids: sourceInfo.map(x => x.geoid).join("|"), __source_weights: sourceInfo.map(x => x.weight.toFixed(8)).join("|"),
        __estimated: relation !== "direct" && oldValue !== null };
    });
    return { geojson: input.targetGeoJson, relationships: records, summary, rule };
  }
  function numeric(value) { const n = Number(value); return Number.isFinite(n) && n > -666666666 ? n : null; }
  function sum(values) { return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0); }
  return { harmonize, variableRule };
})();
