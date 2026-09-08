/** Split/merge harmonization with separate conservation and exclusion metrics. */
window.PrettyCensusHarmonizer = (() => {
  "use strict";
  const relationshipCache = new Map();
  const ADDITIVE = new Set([
    "B01001_001E", "B01003_001E", "B23025_003E", "B17001_002E",
    "B25001_001E", "B25002_002E", "B25002_003E", "B25003_002E",
    "B25003_003E", "B01001_002E", "B01001_026E", "B08134_001E",
    "B08134_002E", "B08134_003E"
  ]);

  function numeric(input) {
    const number = Number(input);
    return Number.isFinite(number) && number > -666666666 ? number : null;
  }

  function sum(values) {
    return values.reduce((total, current) => total + (Number.isFinite(current) ? current : 0), 0);
  }

  function variableRule(variable) {
    return ADDITIVE.has(variable) ? { type: "additive" } : { type: "unsupported" };
  }

  function runWorker(sourceFeatures, targetFeatures, options) {
    return new Promise((resolve, reject) => {
      const worker = new Worker("js/geography/geography-harmonizer-worker.js");
      worker.onmessage = event => {
        worker.terminate();
        event.data.error ? reject(new Error(event.data.error)) : resolve(event.data);
      };
      worker.onerror = event => {
        worker.terminate();
        reject(new Error(event.message || "Geography relationship worker failed."));
      };
      worker.postMessage({ sourceFeatures, targetFeatures, options });
    });
  }

  async function getRelationships(input) {
    if (!relationshipCache.has(input.cacheKey)) {
      relationshipCache.set(
        input.cacheKey,
        runWorker(input.sourceGeoJson.features, input.targetGeoJson.features, input.options || {})
          .catch(error => {
            relationshipCache.delete(input.cacheKey);
            throw error;
          })
      );
    }
    return relationshipCache.get(input.cacheKey);
  }

  function classify(records) {
    const targetsBySource = new Map();
    const sourcesByTarget = new Map();
    records.forEach(record => {
      if (!targetsBySource.has(record.source)) targetsBySource.set(record.source, new Set());
      if (!sourcesByTarget.has(record.target)) sourcesByTarget.set(record.target, new Set());
      targetsBySource.get(record.source).add(record.target);
      sourcesByTarget.get(record.target).add(record.source);
    });

    function forTarget(target) {
      const sources = sourcesByTarget.get(target) || new Set();
      const counts = [...sources].map(source => targetsBySource.get(source)?.size || 0);
      if (sources.size === 1 && counts[0] === 1) {
        return records.find(record => record.target === target)?.direct
          ? "direct"
          : "renumbered-one-to-one";
      }
      if (sources.size === 1 && counts[0] > 1) return "split";
      if (sources.size > 1 && counts.every(count => count === 1)) return "merge";
      if (sources.size > 1) return "complex";
      return "unmatched";
    }

    return { targetsBySource, sourcesByTarget, forTarget };
  }

  async function harmonize(input) {
    const rule = variableRule(input.variable);
    if (input.method !== "exact" && rule.type !== "additive") {
      throw new Error("This variable is not configured as an additive count. Use Exact GEOID only.");
    }

    const relationshipResult = await getRelationships(input);
    const records = input.method === "exact"
      ? relationshipResult.relationships.filter(record => record.direct)
      : relationshipResult.relationships;
    const classes = classify(records);
    const minimumCoverage = Number.isFinite(Number(input.options?.minCoverage))
      ? Number(input.options.minCoverage)
      : 0.95;

    const sourceValues = new Map(
      input.sourceRows.map(row => [PrettyCensusGeoid.fromRow(row, input.level), numeric(row[input.variable])])
    );
    const targetValues = new Map(
      input.targetRows.map(row => [PrettyCensusGeoid.fromRow(row, input.level), numeric(row[input.variable])])
    );
    const coverageBySource = new Map();
    const allocatedByTarget = new Map();
    const sourcesByTarget = new Map();

    records.forEach(record => {
      coverageBySource.set(record.source, (coverageBySource.get(record.source) || 0) + record.sourceShare);
    });

    records.forEach(record => {
      const sourceValue = sourceValues.get(record.source);
      if (!Number.isFinite(sourceValue)) return;
      const coverage = coverageBySource.get(record.source) || 0;
      if (coverage < minimumCoverage) return;
      const weight = record.direct ? 1 : record.sourceShare / coverage;
      allocatedByTarget.set(record.target, (allocatedByTarget.get(record.target) || 0) + sourceValue * weight);
      if (!sourcesByTarget.has(record.target)) sourcesByTarget.set(record.target, []);
      sourcesByTarget.get(record.target).push({
        geoid: record.source,
        weight,
        coverage,
        direct: record.direct,
        geometryChanged: Boolean(record.geometryChanged)
      });
    });

    const originalTotal = sum([...sourceValues.values()]);
    let eligibleSourceTotal = 0;
    let excludedSourceTotal = 0;
    let excludedSourceCount = 0;

    sourceValues.forEach((sourceValue, sourceGeoid) => {
      if (!Number.isFinite(sourceValue)) return;
      const coverage = coverageBySource.get(sourceGeoid) || 0;
      if (coverage >= minimumCoverage) eligibleSourceTotal += sourceValue;
      else {
        excludedSourceTotal += sourceValue;
        excludedSourceCount += 1;
      }
    });

    const allocatedTotal = sum([...allocatedByTarget.values()]);
    const allocationError = eligibleSourceTotal
      ? Math.abs(allocatedTotal - eligibleSourceTotal) / Math.abs(eligibleSourceTotal)
      : 0;
    const excludedSourceShare = originalTotal
      ? Math.abs(excludedSourceTotal) / Math.abs(originalTotal)
      : 0;

    const summary = {
      direct: 0,
      directGeometryChanged: relationshipResult.directGeometryChanged || 0,
      renumbered: 0,
      splits: 0,
      merges: 0,
      complex: 0,
      unmatchedTargets: 0,
      unmatchedSources: excludedSourceCount,
      sliversExcluded: relationshipResult.sliversExcluded || 0,
      intersectionErrors: relationshipResult.intersectionErrors || 0,
      relationshipDiagnostics: relationshipResult.diagnostics || [],
      originalTotal,
      eligibleSourceTotal,
      excludedSourceTotal,
      excludedSourceShare,
      allocatedTotal,
      allocationError
    };

    input.targetGeoJson.features.forEach((feature, index) => {
      const geoid = PrettyCensusGeoid.fromFeature(feature, input.level);
      const relationship = classes.forTarget(geoid);
      const earlierValue = allocatedByTarget.get(geoid) ?? null;
      const laterValue = targetValues.get(geoid) ?? null;
      const difference = earlierValue !== null && laterValue !== null
        ? laterValue - earlierValue
        : null;
      const percent = difference !== null && earlierValue !== 0
        ? difference / earlierValue * 100
        : null;
      const sourceInfo = sourcesByTarget.get(geoid) || [];
      const minimumSourceCoverage = sourceInfo.length
        ? Math.min(...sourceInfo.map(source => source.coverage))
        : 0;

      if (relationship === "direct") summary.direct += 1;
      else if (relationship === "renumbered-one-to-one") summary.renumbered += 1;
      else if (relationship === "split") summary.splits += 1;
      else if (relationship === "merge") summary.merges += 1;
      else if (relationship === "complex") summary.complex += 1;
      else summary.unmatchedTargets += 1;

      feature.id = index;
      feature.properties = {
        ...feature.properties,
        __geoid: geoid,
        __earlier_harmonized: earlierValue,
        __later: laterValue,
        __difference: difference,
        __percent: percent,
        __relationship: relationship,
        __weight_method: relationship === "direct" ? "none" : (input.method === "exact" ? "none" : "area"),
        __source_geoids: sourceInfo.map(source => source.geoid).join("|"),
        __source_weights: sourceInfo.map(source => source.weight.toFixed(8)).join("|"),
        __minimum_source_coverage: minimumSourceCoverage,
        __low_coverage: sourceInfo.length > 0 && minimumSourceCoverage < minimumCoverage,
        __estimated: relationship !== "direct" && earlierValue !== null
      };
    });

    return { geojson: input.targetGeoJson, relationships: records, summary, rule };
  }

  return { harmonize, variableRule };
})();
