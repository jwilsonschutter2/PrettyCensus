/** Independent direct-GEOID two-year change map. */
(function () {
  "use strict";
  const SOURCE = "prettycensus-change";
  const FILL = `${SOURCE}-fill`;
  const LINE = `${SOURCE}-line`;
  let map;
  let exportGeoJson;
  const byId = id => document.getElementById(id);
  const validNumber = input => {
    const number = Number(input);
    return Number.isFinite(number) && number > -666666666 ? number : null;
  };
  function setStatus(message, kind = "muted") {
    const node = byId("changeMapStatus");
    node.textContent = message;
    node.className = `map-status ${kind}`;
  }
  function populateVariables() {
    const select = byId("changeMapVariable");
    const previous = select.value;
    select.innerHTML = '<option value="">-- Select a variable --</option>';
    selectedTables.forEach(id => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = tableFriendlyNames[id] ? `${tableFriendlyNames[id]} (${id})` : id;
      select.append(option);
    });
    if (selectedTables.includes(previous)) select.value = previous;
    else if (selectedTables.length === 1) select.value = selectedTables[0];
  }
  window.populateChangeMapVariables = populateVariables;
  async function fetchRows(year, topic) {
    const url = buildSingleTopicUrl(year, topic);
    if (!url) throw new Error("Dataset or geography selections are incomplete.");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Census request for ${year} failed (${response.status}).`);
    return apiArrayToObjects(await response.json());
  }
  function prepareFeatures(boundaries, earlierRows, laterRows, topic, level) {
    const earlier = new Map(earlierRows.map(row => [PrettyCensusGeoid.fromRow(row, level), validNumber(row[topic])]));
    const later = new Map(laterRows.map(row => [PrettyCensusGeoid.fromRow(row, level), validNumber(row[topic])]));
    let matched = 0;
    boundaries.features.forEach((feature, index) => {
      const geoid = PrettyCensusGeoid.fromFeature(feature, level);
      const oldValue = earlier.get(geoid) ?? null;
      const newValue = later.get(geoid) ?? null;
      const difference = oldValue !== null && newValue !== null ? newValue - oldValue : null;
      const percent = difference !== null && oldValue !== 0 ? difference / oldValue * 100 : null;
      if (oldValue !== null && newValue !== null) matched += 1;
      feature.id = index;
      feature.properties = { ...feature.properties, __geoid: geoid, __earlier: oldValue, __later: newValue,
        __difference: difference, __percent: percent, __method: oldValue !== null ? "direct GEOID" : "unmatched" };
    });
    return { boundaries, matched, unmatchedEarlier: [...earlier.keys()].filter(id => !later.has(id)).length };
  }
  function getBounds(data) {
    const bounds = new mapboxgl.LngLatBounds();
    function visit(coordinates) {
      if (!Array.isArray(coordinates)) return;
      if (coordinates.length >= 2 && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) bounds.extend(coordinates);
      else coordinates.forEach(visit);
    }
    data.features.forEach(feature => feature.geometry && visit(feature.geometry.coordinates));
    return bounds;
  }
  function render(result, field, earlierYear, laterYear, topic, token) {
    mapboxgl.accessToken = token;
    if (!map) {
      map = new mapboxgl.Map({ container: "prettyCensusChangeMap", style: "mapbox://styles/mapbox/light-v11", center: [-96, 38], zoom: 3 });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
    }
    const draw = () => {
      [LINE, FILL].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      map.addSource(SOURCE, { type: "geojson", data: result.boundaries, generateId: true });
      const values = result.boundaries.features.map(feature => Math.abs(validNumber(feature.properties[field]) || 0)).sort((a, b) => a - b);
      const limit = values[Math.floor(values.length * 0.95)] || 1;
      map.addLayer({ id: FILL, type: "fill", source: SOURCE, paint: {
        "fill-color": ["case", ["==", ["get", field], null], "rgba(180,180,180,.25)",
          ["interpolate", ["linear"], ["to-number", ["get", field]], -limit, "#b2182b", 0, "#f7f7f7", limit, "#2166ac"]],
        "fill-opacity": 0.82
      }});
      map.addLayer({ id: LINE, type: "line", source: SOURCE, paint: { "line-color": "#fff", "line-width": 0.6 }});
      map.on("mousemove", FILL, event => {
        const p = event.features[0].properties;
        byId("changeMapReadout").innerHTML = `<strong>GEOID:</strong> ${escapeHtml(p.__geoid)}<br>` +
          `<strong>${earlierYear}:</strong> ${p.__earlier == null ? "No data" : Number(p.__earlier).toLocaleString()}<br>` +
          `<strong>${laterYear}:</strong> ${p.__later == null ? "No data" : Number(p.__later).toLocaleString()}<br>` +
          `<strong>Change:</strong> ${p[field] == null ? "No data" : Number(p[field]).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      });
      const bounds = getBounds(result.boundaries);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 30, duration: 0 });
      byId("changeMapLegend").innerHTML = `<strong>${escapeHtml(tableFriendlyNames[topic] || topic)}</strong><div>Red: decrease</div><div>White: little change</div><div>Blue: increase</div>`;
      setTimeout(() => map.resize(), 0);
    };
    if (map.isStyleLoaded()) draw(); else map.once("style.load", draw);
  }
  async function buildChangeMap() {
    const firstYear = Number(byId("changeMapYear1").value);
    const secondYear = Number(byId("changeMapYear2").value);
    const topic = byId("changeMapVariable").value;
    const field = byId("changeMapMetric").value;
    const token = byId("changeMapboxToken").value.trim() || byId("mapboxToken").value.trim();
    if (!firstYear || !secondYear || firstYear === secondYear || !topic || !token) return setStatus("Choose two different years, a variable, and a Mapbox token.", "error");
    if (!["tract", "blockgroup"].includes(geoLevel) || !selectedState || selectedState === "*" || !selectedCounty || selectedCounty === "*") return setStatus("Select one state, one county, and Tract or Block Group above.", "error");
    const earlierYear = Math.min(firstYear, secondYear);
    const laterYear = Math.max(firstYear, secondYear);
    const boundaryOptions = { year: laterYear, level: geoLevel, state: selectedState, county: selectedCounty };
    try {
      setStatus("Loading both years and validating GEOIDs...", "checking");
      const [earlierBoundaries, laterBoundaries, earlierRows, laterRows] = await Promise.all([
        PrettyCensusBoundaries.load({ ...boundaryOptions, year: earlierYear }),
        PrettyCensusBoundaries.load(boundaryOptions),
        fetchRows(earlierYear, topic), fetchRows(laterYear, topic)
      ]);
      PrettyCensusBoundaries.filterCounty(earlierBoundaries, boundaryOptions);
      PrettyCensusBoundaries.filterCounty(laterBoundaries, boundaryOptions);
      PrettyCensusGeoid.validate({ features: earlierBoundaries.features, rows: earlierRows, level: geoLevel, state: selectedState, county: selectedCounty, label: earlierYear });
      PrettyCensusGeoid.validate({ features: laterBoundaries.features, rows: laterRows, level: geoLevel, state: selectedState, county: selectedCounty, label: laterYear });
      const result = prepareFeatures(laterBoundaries, earlierRows, laterRows, topic, geoLevel);
      exportGeoJson = result.boundaries;
      render(result, field, earlierYear, laterYear, topic, token);
      byId("changeMapQa").textContent = `${result.matched} direct GEOID matches; ${result.unmatchedEarlier} earlier-year GEOIDs absent from the later year.`;
      byId("exportChangeMapGeoJsonBtn").disabled = false;
      setStatus(`Change map created on ${laterYear} boundaries.`, "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || String(error), "error");
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    byId("buildChangeMapBtn").addEventListener("click", buildChangeMap);
    byId("exportChangeMapGeoJsonBtn").addEventListener("click", () => {
      if (exportGeoJson) downloadGeoJson(exportGeoJson, `change_${byId("changeMapYear1").value}_to_${byId("changeMapYear2").value}_${geoLevel}_${selectedState}_${selectedCounty}.geojson`);
    });
    document.addEventListener("change", event => {
      if (event.target.classList.contains("presetCheckbox") || event.target.id === "tableInput") populateVariables();
    });
  });
})();
