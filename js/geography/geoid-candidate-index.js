/** Deterministic GEOID parsing and candidate ranking. */
globalThis.PrettyCensusCandidateIndex = (() => {
  "use strict";
  function parse(raw, level) {
    const geoid = String(raw ?? "").replace(/\D/g, "");
    const expected = level === "blockgroup" ? 12 : 11;
    if (geoid.length !== expected) return null;
    const tractCode = geoid.slice(5, 11);
    return { geoid, state: geoid.slice(0,2), county: geoid.slice(2,5), tractCode,
      tractBase: tractCode.slice(0,4), tractSuffix: tractCode.slice(4,6),
      blockGroup: level === "blockgroup" ? geoid.slice(11,12) : null };
  }
  function score(source, target) {
    if (!source || !target || source.state !== target.state || source.county !== target.county) return -Infinity;
    if (source.geoid === target.geoid) return 100;
    let score = 0;
    if (source.tractCode === target.tractCode) score += 60;
    if (source.tractBase === target.tractBase) score += 40;
    if (source.tractSuffix === target.tractSuffix) score += 10;
    if (source.blockGroup && source.blockGroup === target.blockGroup) score += 5;
    return score;
  }
  function build(features, level) {
    const byGeoid = new Map(), byCounty = new Map(), byBase = new Map();
    features.forEach((feature,index) => {
      const item = parse(feature.properties?.__pc_geoid, level); if (!item) return;
      byGeoid.set(item.geoid,index);
      const county = `${item.state}|${item.county}`, base = `${county}|${item.tractBase}`;
      if (!byCounty.has(county)) byCounty.set(county,[]);
      if (!byBase.has(base)) byBase.set(base,[]);
      byCounty.get(county).push(index); byBase.get(base).push(index);
    });
    return { byGeoid, byCounty, byBase };
  }
  return { parse, score, build };
})();
