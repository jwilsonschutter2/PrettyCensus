/** Independent split/merge-aware two-year change map. */
(function () {
  "use strict";
  const SOURCE = "prettycensus-change", FILL = `${SOURCE}-fill`, LINE = `${SOURCE}-line`;
  let map, exportGeoJson, exportRelationships = [];
  const el = id => document.getElementById(id);
  function status(message, kind = "muted") { el("changeMapStatus").textContent = message; el("changeMapStatus").className = `map-status ${kind}`; }
  function populateVariables() {
    const select = el("changeMapVariable"), previous = select.value;
    select.innerHTML = '<option value="">-- Select a variable --</option>';
    selectedTables.forEach(id => { const option = document.createElement("option"); option.value = id; option.textContent = tableFriendlyNames[id] ? `${tableFriendlyNames[id]} (${id})` : id; select.append(option); });
    if (selectedTables.includes(previous)) select.value = previous; else if (selectedTables.length === 1) select.value = selectedTables[0];
  }
  window.populateChangeMapVariables = populateVariables;
  async function rows(year, topic) {
    const url = buildSingleTopicUrl(year, topic); if (!url) throw new Error("Dataset or geography selections are incomplete.");
    const response = await fetch(url); if (!response.ok) throw new Error(`Census request for ${year} failed (${response.status}).`);
    return apiArrayToObjects(await response.json());
  }
  function tagGeoids(data, level) { data.features.forEach(feature => { feature.properties = { ...feature.properties, __pc_geoid: PrettyCensusGeoid.fromFeature(feature, level) }; }); return data; }
  function bounds(data) { const result = new mapboxgl.LngLatBounds(); const walk = c => { if (!Array.isArray(c)) return; if (c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) result.extend(c); else c.forEach(walk); }; data.features.forEach(f => f.geometry && walk(f.geometry.coordinates)); return result; }
  function render(result, field, earlierYear, laterYear, topic, token) {
    mapboxgl.accessToken = token;
    if (!map) { map = new mapboxgl.Map({ container: "prettyCensusChangeMap", style: "mapbox://styles/mapbox/light-v11", center: [-96, 38], zoom: 3 }); map.addControl(new mapboxgl.NavigationControl(), "top-right"); }
    const draw = () => {
      [LINE, FILL].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); }); if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      map.addSource(SOURCE, { type: "geojson", data: result.geojson, generateId: true });
      const values = result.geojson.features.map(f => Math.abs(Number(f.properties[field]) || 0)).sort((a, b) => a - b), limit = values[Math.floor(values.length * .95)] || 1;
      map.addLayer({ id: FILL, type: "fill", source: SOURCE, paint: { "fill-color": ["case", ["==", ["get", field], null], "rgba(0,0,0,0)", ["interpolate", ["linear"], ["to-number", ["get", field]], -limit, "#b2182b", 0, "#f7f7f7", limit, "#2166ac"]], "fill-opacity": ["case", ["==", ["get", field], null], 0, .82] }});
      map.addLayer({ id: LINE, type: "line", source: SOURCE, paint: { "line-color": "#fff", "line-width": .6, "line-opacity": ["case", ["==", ["get", field], null], 0, 1] }});
      map.on("mousemove", FILL, event => { const p = event.features[0].properties; el("changeMapReadout").innerHTML = `<strong>GEOID:</strong> ${escapeHtml(p.__geoid)}<br><strong>${earlierYear} harmonized:</strong> ${format(p.__earlier_harmonized)}<br><strong>${laterYear}:</strong> ${format(p.__later)}<br><strong>Change:</strong> ${format(p[field])}<br><strong>Relationship:</strong> ${escapeHtml(p.__relationship)}<br><strong>Method:</strong> ${escapeHtml(p.__weight_method)}${p.__estimated ? " (estimated)" : ""}`; });
      const area = bounds(result.geojson); if (!area.isEmpty()) map.fitBounds(area, { padding: 30, duration: 0 });
      el("changeMapLegend").innerHTML = `<strong>${escapeHtml(tableFriendlyNames[topic] || topic)}</strong><div>Red: decrease</div><div>White: little change</div><div>Blue: increase</div>`; setTimeout(() => map.resize(), 0);
    };
    if (map.isStyleLoaded()) draw(); else map.once("style.load", draw);
  }
  async function build() {
    const y1 = Number(el("changeMapYear1").value), y2 = Number(el("changeMapYear2").value), topic = el("changeMapVariable").value,
      method = el("changeMapMethod").value, field = el("changeMapMetric").value, token = el("changeMapboxToken").value.trim() || el("mapboxToken").value.trim();
    if (!y1 || !y2 || y1 === y2 || !topic || !token) return status("Choose two different years, a variable, and a Mapbox token.", "error");
    if (!["tract", "blockgroup"].includes(geoLevel) || !selectedState || selectedState === "*" || !selectedCounty || selectedCounty === "*") return status("Select one state, one county, and Tract or Block Group above.", "error");
    const earlierYear = Math.min(y1, y2), laterYear = Math.max(y1, y2), base = { level: geoLevel, state: selectedState, county: selectedCounty };
    try {
      status("Loading two vintages and building geographic relationships...", "checking");
      const [earlierGeo, laterGeo, earlierRows, laterRows] = await Promise.all([PrettyCensusBoundaries.load({ ...base, year: earlierYear }), PrettyCensusBoundaries.load({ ...base, year: laterYear }), rows(earlierYear, topic), rows(laterYear, topic)]);
      PrettyCensusBoundaries.county(earlierGeo, base); PrettyCensusBoundaries.county(laterGeo, base);
      PrettyCensusGeoid.validate({ features: earlierGeo.features, rows: earlierRows, ...base, label: earlierYear }); PrettyCensusGeoid.validate({ features: laterGeo.features, rows: laterRows, ...base, label: laterYear });
      tagGeoids(earlierGeo, geoLevel); tagGeoids(laterGeo, geoLevel);
      const result = await PrettyCensusHarmonizer.harmonize({ sourceGeoJson: earlierGeo, targetGeoJson: laterGeo, sourceRows: earlierRows, targetRows: laterRows, variable: topic, level: geoLevel, method,
        cacheKey: `${earlierYear}|${laterYear}|${selectedState}|${selectedCounty}|${geoLevel}`, options: { minSourceShare: Number(el("changeMapMinShare").value), minCoverage: Number(el("changeMapMinCoverage").value), directThreshold: .999 } });
      if (method !== "exact" && result.summary.allocationError > .01) throw new Error(`Allocated totals differ from source totals by ${(result.summary.allocationError * 100).toFixed(2)}%, above the 1% validation limit.`);
      exportGeoJson = result.geojson; exportRelationships = result.relationships; render(result, field, earlierYear, laterYear, topic, token); showQa(result.summary);
      el("exportChangeMapGeoJsonBtn").disabled = false; el("exportRelationshipCsvBtn").disabled = false; status(`Change map created on ${laterYear} boundaries. Non-direct values are estimates.`, "success");
    } catch (error) { console.error(error); status(error.message || String(error), "error"); }
  }
  function showQa(s) { el("changeMapQa").innerHTML = `<strong>Validation</strong><br>Direct: ${s.direct}; renumbered 1:1: ${s.renumbered}; splits: ${s.splits}; merges: ${s.merges}; complex: ${s.complex}; unmatched source: ${s.unmatchedSources}; unmatched target: ${s.unmatchedTargets}; excluded slivers: ${s.sliversExcluded}; allocation error: ${(s.allocationError * 100).toFixed(4)}%.`; }
  function format(value) { const n = Number(value); return value == null || !Number.isFinite(n) ? "No data" : n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
  document.addEventListener("DOMContentLoaded", () => {
    el("buildChangeMapBtn").addEventListener("click", build);
    el("exportChangeMapGeoJsonBtn").addEventListener("click", () => exportGeoJson && downloadGeoJson(exportGeoJson, `change_${el("changeMapYear1").value}_to_${el("changeMapYear2").value}_${geoLevel}_${selectedState}_${selectedCounty}.geojson`));
    el("exportRelationshipCsvBtn").addEventListener("click", () => exportRowsToCsv(exportRelationships, `relationships_${el("changeMapYear1").value}_to_${el("changeMapYear2").value}_${geoLevel}_${selectedState}_${selectedCounty}.csv`));
    document.addEventListener("change", event => { if (event.target.classList.contains("presetCheckbox") || event.target.id === "tableInput") populateVariables(); });
  });
})();
