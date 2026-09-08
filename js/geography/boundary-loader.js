/** Cached yearly gzipped GeoJSON loader. */
window.PrettyCensusBoundaries = (() => {
  const cache = new Map();
  function buildUrl({ year, level, state, county }) {
    const folder = level === "blockgroup" ? "BG" : "TRACT";
    const filename = Number(year) === 2010
      ? (level === "blockgroup" ? `tl_2010_${state}_bg10.geojson.gz` : `tl_2010_${state}${county}_tract10.geojson.gz`)
      : `tl_${year}_${state}_${level === "blockgroup" ? "bg" : "tract"}.geojson.gz`;
    return `https://raw.githubusercontent.com/jwilsonschutter2/${year}Cenv1/main/${year}/${folder}/${filename}`;
  }
  async function decode(response) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] !== 31 || bytes[1] !== 139) return JSON.parse(new TextDecoder().decode(bytes));
    if (typeof DecompressionStream !== "function") throw new Error("Browser gzip decompression is unavailable.");
    return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
  }
  async function load(options) {
    const url = buildUrl(options);
    if (!cache.has(url)) cache.set(url, fetch(url, { mode: "cors", cache: "force-cache" }).then(async response => {
      if (!response.ok) throw new Error(`Boundary request failed (${response.status}): ${url}`);
      const data = await decode(response);
      if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) throw new Error("Boundary file is not a GeoJSON FeatureCollection.");
      return data;
    }).catch(error => { cache.delete(url); throw error; }));
    return structuredClone(await cache.get(url));
  }
  function county(data, options) {
    const prefix = options.state + options.county;
    data.features = data.features.filter(feature => PrettyCensusGeoid.fromFeature(feature, options.level).startsWith(prefix));
    return data;
  }
  return { buildUrl, load, county };
})();
