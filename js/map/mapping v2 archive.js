/** PrettyCensus Mapbox GL JS choropleth mapping. */
(function () {
  "use strict";
  const MAP_SOURCE = "prettycensus-boundaries";
  const MAP_FILL = "prettycensus-fill";
  const MAP_LINE = "prettycensus-outline";
  const MAP_HOVER = "prettycensus-hover";
  let map = null;
  let hoveredId = null;
  let activeSourceLayer = null;
  let mappedValues = new Map();

  function el(id) { return document.getElementById(id); }
  function setStatus(message, kind) {
    const node = el("mapStatus");
    if (!node) return;
    node.textContent = message;
    node.className = "map-status " + (kind || "muted");
  }
  function repositoryForYear(year) {
    const y = Number(year);
    if (y >= 2010 && y <= 2014) return "2010-14Census";
    if (y >= 2015 && y <= 2019) return "2015-19Census";
    if (y >= 2020 && y <= 2024) return "2020-24Census";
    return "";
  }
  function geographyFolder() {
    if (geoLevel === "tract") return "TRACT";
    if (geoLevel === "blockgroup") return "BG";
    return "";
  }
  function tileTemplate() {
    const repo = repositoryForYear(selectedYear);
    const folder = geographyFolder();
    if (!repo || !folder || !selectedState || selectedState === "*") return "";
    return `https://raw.githubusercontent.com/jwilsonschutter2/${repo}/main/${selectedYear}/${folder}/${selectedState}/{z}/{x}/{y}.pbf`;
  }
  function selectedTopic() {
    return el("mapVariableSelect") ? el("mapVariableSelect").value : "";
  }
  function populateVariableOptions() {
    const select = el("mapVariableSelect");
    if (!select) return;
    const previous = select.value;
    const ids = selectedTables && selectedTables.length ? selectedTables : [];
    select.innerHTML = '<option value="">-- Select a mapped variable --</option>';
    ids.forEach(id => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = tableFriendlyNames[id] ? `${tableFriendlyNames[id]} (${id})` : id;
      select.appendChild(option);
    });
    if (ids.includes(previous)) select.value = previous;
    else if (ids.length === 1) select.value = ids[0];
  }
  function censusGeoid(row) {
    if (geoLevel === "tract") return `${row.state || ""}${row.county || ""}${row.tract || ""}`;
    if (geoLevel === "blockgroup") return `${row.state || ""}${row.county || ""}${row.tract || ""}${row["block group"] || ""}`;
    return "";
  }
  function numbersFromRows(rows, topic) {
    const result = new Map();
    rows.forEach(row => {
      const geoid = censusGeoid(row);
      const value = Number(row[topic]);
      if (geoid && Number.isFinite(value) && value > -666666666) result.set(geoid, value);
    });
    return result;
  }
  function quantileBreaks(values, classes) {
    const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
    if (!sorted.length) return [];
    const breaks = [];
    for (let i=0; i<=classes; i++) {
      const pos = (sorted.length - 1) * i / classes;
      const lo = Math.floor(pos), hi = Math.ceil(pos), f = pos - lo;
      breaks.push(sorted[lo] + (sorted[hi] - sorted[lo]) * f);
    }
    return breaks;
  }
  function colorExpression(breaks) {
    const colors = ["#eff3ff","#bdd7e7","#6baed6","#3182bd","#08519c"];
    if (breaks.length < 6) return "#dce6f2";
    return ["step", ["feature-state", "value"], colors[0], breaks[1], colors[1], breaks[2], colors[2], breaks[3], colors[3], breaks[4], colors[4]];
  }
  function drawLegend(breaks, topic) {
    const legend = el("mapLegend");
    if (!legend) return;
    if (breaks.length < 6) { legend.innerHTML = ""; return; }
    const colors = ["#eff3ff","#bdd7e7","#6baed6","#3182bd","#08519c"];
    const label = tableFriendlyNames[topic] || topic;
    legend.innerHTML = `<strong>${escapeHtml(label)}</strong>` + colors.map((c,i) =>
      `<div class="legend-row"><span style="background:${c}"></span>${formatMapNumber(breaks[i])} to ${formatMapNumber(breaks[i+1])}</div>`).join("");
  }
  function formatMapNumber(value) {
    return Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
  }
  function findFeatureGeoid(properties) {
    const p = properties || {};
    for (const key of ["GEOID","GEOID20","GEOID10","geoid","AFFGEOID"]) {
      if (p[key] != null) {
        const match = String(p[key]).match(/(\d{11,12})$/);
        return match ? match[1] : String(p[key]);
      }
    }
    const state = String(p.STATEFP || p.STATEFP20 || p.STATEFP10 || selectedState || "").padStart(2,"0");
    const county = String(p.COUNTYFP || p.COUNTYFP20 || p.COUNTYFP10 || "").padStart(3,"0");
    const tract = String(p.TRACTCE || p.TRACTCE20 || p.TRACTCE10 || "").padStart(6,"0");
    const bg = String(p.BLKGRPCE || p.BLKGRPCE20 || p.BLKGRPCE10 || "");
    return geoLevel === "blockgroup" ? state+county+tract+bg : state+county+tract;
  }
  async function inspectTileLayer(urlTemplate) {
    const probeUrl = urlTemplate.replace("{z}","0").replace("{x}","0").replace("{y}","0");
    const response = await fetch(probeUrl);
    if (!response.ok) throw new Error(`Tile probe failed (${response.status})`);
    const buffer = await response.arrayBuffer();
    if (!window.Pbf || !window.VectorTile) throw new Error("Vector-tile inspection libraries did not load.");
    const tile = new window.VectorTile(new window.Pbf(new Uint8Array(buffer)));
    const names = Object.keys(tile.layers || {});
    if (!names.length) throw new Error("The probe tile contains no vector layers.");
    return names[0];
  }
  async function fetchMapRows(topic) {
    const url = buildSingleTopicUrl(selectedYear, topic);
    if (!url) throw new Error("Complete the year, dataset, state, county, and geography selections first.");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Census API request failed (${response.status})`);
    const data = await response.json();
    return apiArrayToObjects(data);
  }
  function removeMapLayers() {
    if (!map) return;
    [MAP_HOVER,MAP_LINE,MAP_FILL].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
    if (map.getSource(MAP_SOURCE)) map.removeSource(MAP_SOURCE);
  }
  function applyFeatureState() {
    if (!map || !activeSourceLayer) return;
    const features = map.querySourceFeatures(MAP_SOURCE,{sourceLayer:activeSourceLayer});
    const seen = new Set();
    features.forEach(feature => {
      if (feature.id == null || seen.has(feature.id)) return;
      seen.add(feature.id);
      const geoid = findFeatureGeoid(feature.properties);
      if (mappedValues.has(geoid)) map.setFeatureState({source:MAP_SOURCE,sourceLayer:activeSourceLayer,id:feature.id},{value:mappedValues.get(geoid),geoid});
    });
  }
  async function buildMap() {
    const token = el("mapboxToken").value.trim();
    const topic = selectedTopic();
    const tiles = tileTemplate();
    if (!token) { setStatus("Enter a Mapbox public access token.","error"); return; }
    if (!topic) { setStatus("Select one of the Census variables already chosen above.","error"); return; }
    if (!tiles) { setStatus("Mapping currently requires 2010-2024, one state, and Tract or Block Group geography.","error"); return; }
    try {
      setStatus("Loading Census values and inspecting the vector tiles...","checking");
      const [rows, layerName] = await Promise.all([fetchMapRows(topic), inspectTileLayer(tiles)]);
      mappedValues = numbersFromRows(rows,topic);
      activeSourceLayer = layerName;
      if (!mappedValues.size) throw new Error("The Census response did not contain numeric values to map.");
      mapboxgl.accessToken = token;
      if (!map) {
        map = new mapboxgl.Map({container:"prettyCensusMap",style:"mapbox://styles/mapbox/light-v11",center:[-96,38],zoom:3});
        map.addControl(new mapboxgl.NavigationControl(),"top-right");
      } else removeMapLayers();
      const render = () => {
        map.addSource(MAP_SOURCE,{type:"vector",tiles:[tiles],minzoom:0,maxzoom:14,promoteId:"GEOID"});
        const breaks = quantileBreaks(Array.from(mappedValues.values()),5);
        map.addLayer({id:MAP_FILL,type:"fill",source:MAP_SOURCE,"source-layer":activeSourceLayer,paint:{"fill-color":colorExpression(breaks),"fill-opacity":["case",["==",["feature-state","value"],null],0.12,0.78]}});
        map.addLayer({id:MAP_LINE,type:"line",source:MAP_SOURCE,"source-layer":activeSourceLayer,paint:{"line-color":"#ffffff","line-width":["interpolate",["linear"],["zoom"],3,0.15,10,0.8]}});
        map.addLayer({id:MAP_HOVER,type:"line",source:MAP_SOURCE,"source-layer":activeSourceLayer,paint:{"line-color":"#f97316","line-width":2},filter:["==",["id"],""]});
        drawLegend(breaks,topic);
        map.on("sourcedata", e => { if (e.sourceId === MAP_SOURCE && e.isSourceLoaded) applyFeatureState(); });
        map.on("idle", applyFeatureState);
        map.on("mousemove",MAP_FILL,e => {
          if (!e.features || !e.features.length) return;
          const f=e.features[0]; hoveredId=f.id;
          map.setFilter(MAP_HOVER,["==",["id"],hoveredId]);
          const geoid=findFeatureGeoid(f.properties), value=mappedValues.get(geoid);
          el("mapReadout").innerHTML=`<strong>GEOID:</strong> ${escapeHtml(geoid)}<br><strong>${escapeHtml(tableFriendlyNames[topic]||topic)}:</strong> ${value==null?"No data":formatMapNumber(value)}`;
          map.getCanvas().style.cursor="pointer";
        });
        map.on("mouseleave",MAP_FILL,()=>{map.setFilter(MAP_HOVER,["==",["id"],""]);map.getCanvas().style.cursor="";});
        setStatus(`Mapped ${mappedValues.size.toLocaleString()} Census records using tile layer “${activeSourceLayer}”.`,"success");
      };
      if (map.loaded()) render(); else map.once("load",render);
    } catch (error) {
      console.error(error);
      setStatus(error.message || String(error),"error");
    }
  }
  document.addEventListener("DOMContentLoaded",()=>{
    const btn=el("mappingOptionBtn"),panel=el("mappingPanel"),close=el("closeMappingPanelBtn"),draw=el("drawMapBtn");
    if (btn && panel) btn.addEventListener("click",()=>{ panel.style.display=(panel.style.display==="none"||!panel.style.display)?"block":"none"; populateVariableOptions(); if (panel.style.display==="block") panel.scrollIntoView({behavior:"smooth",block:"start"}); });
    if (close && panel) close.addEventListener("click",()=>panel.style.display="none");
    if (draw) draw.addEventListener("click",buildMap);
    document.addEventListener("change",e=>{ if (["yearSelect","datasetSelect","geoLevel","stateSelect","countySelect","tractInput","blockGroupInput","tableInput"].includes(e.target.id)||e.target.classList.contains("presetCheckbox")) populateVariableOptions(); });
  });
})();
