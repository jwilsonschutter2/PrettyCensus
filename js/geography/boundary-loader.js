/** Shared yearly gzipped GeoJSON boundary loader. */
window.PrettyCensusBoundaries = (() => {
  "use strict";
  const OWNER = "jwilsonschutter2";
  const cache = new Map();
  function buildUrl({ year, level, state, county }) {
    const folder = level === "blockgroup" ? "BG" : "TRACT";
    const filename = Number(year) === 2010
      ? (level === "blockgroup" ? `tl_2010_${state}_bg10.geojson.gz` : `tl_2010_${state}${county}_tract10.geojson.gz`)
      : `tl_${year}_${state}_${level === "blockgroup" ? "bg" : "tract"}.geojson.gz`;
    return `https://raw.githubusercontent.com/${OWNER}/${year}Cenv1/main/${year}/${folder}/${filename}`;
  }
  async function decode(response) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes));
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot decompress .gz boundary files.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
  }
  async function load(options) {
    const url = buildUrl(options);
    if (!cache.has(url)) {
      cache.set(url, fetch(url, { mode: "cors", cache: "force-cache" }).then(async response => {
        if (!response.ok) throw new Error(`Boundary request failed (${response.status}): ${url}`);
        const data = await decode(response);
        if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) throw new Error("Boundary file is not a GeoJSON FeatureCollection.");
        return data;
      }).catch(error => { cache.delete(url); throw error; }));
    }
    return structuredClone(await cache.get(url));
  }
  function filterCounty(data, { level, state, county }) {
    const prefix = state + county;
    data.features = data.features.filter(feature => PrettyCensusGeoid.fromFeature(feature, level).startsWith(prefix));
    return data;
  }
  return { buildUrl, load, filterCounty };
})();
