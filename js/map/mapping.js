/**
 * PrettyCensus Mapbox GL JS choropleth mapping using gzipped GeoJSON.
 * Boundary repositories: jwilsonschutter2/{YEAR}Cenv1
 */
(function () {
  "use strict";

  const OWNER = "jwilsonschutter2";
  const MAP_SOURCE = "prettycensus-boundaries";
  const MAP_FILL = "prettycensus-fill";
  const MAP_LINE = "prettycensus-outline";
  const MAP_HOVER = "prettycensus-hover";
  const COLORS = ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"];
  const GEOJSON_CACHE = new Map();

  let map = null;
  let currentBuild = 0;
  let exportGeoJson = null;

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(message, kind) {
    const node = el("mapStatus");
    if (!node) return;
    node.textContent = message;
    node.className = "map-status " + (kind || "muted");
  }

  function valueOfGlobal(name, fallback) {
    try {
      if (name === "selectedYear" && typeof selectedYear !== "undefined") return selectedYear;
      if (name === "selectedState" && typeof selectedState !== "undefined") return selectedState;
      if (name === "selectedCounty" && typeof selectedCounty !== "undefined") return selectedCounty;
      if (name === "geoLevel" && typeof geoLevel !== "undefined") return geoLevel;
      if (name === "selectedTables" && typeof selectedTables !== "undefined") return selectedTables;
      if (name === "tableFriendlyNames" && typeof tableFriendlyNames !== "undefined") return tableFriendlyNames;
    } catch (error) {
      console.debug("PrettyCensus global lookup:", error);
    }
    return fallback;
  }

  function selectValue(id, fallback) {
    const node = el(id);
    return node && node.value != null ? node.value : fallback;
  }

  function digits(value, length) {
    const match = String(value == null ? "" : value).match(/\d+/);
    return match ? match[0].padStart(length, "0").slice(-length) : "";
  }

  function currentSelection() {
    const year = Number(selectValue("yearSelect", valueOfGlobal("selectedYear", "")));
    const state = digits(selectValue("stateSelect", valueOfGlobal("selectedState", "")), 2);
    const county = digits(selectValue("countySelect", valueOfGlobal("selectedCounty", "")), 3);
    const rawLevel = String(selectValue("geoLevel", valueOfGlobal("geoLevel", ""))).toLowerCase();
    const level = rawLevel === "tract" ? "tract" :
      (["blockgroup", "block group", "bg"].includes(rawLevel) ? "blockgroup" : "");
    return { year, state, county, level };
  }

  function boundaryUrl(selection) {
    const { year, state, county, level } = selection;
    if (year < 2010 || year > 2024 || !state || !level) return "";

    const repo = `${year}Cenv1`;
    const folder = level === "tract" ? "TRACT" : "BG";
    let file;

    if (year === 2010) {
      if (level === "tract") {
        if (!county) return "";
        file = `tl_2010_${state}${county}_tract10.geojson.gz`;
      } else {
        file = `tl_2010_${state}_bg10.geojson.gz`;
      }
    } else {
      const suffix = level === "tract" ? "tract" : "bg";
      file = `tl_${year}_${state}_${suffix}.geojson.gz`;
    }

    return `https://raw.githubusercontent.com/${OWNER}/${repo}/main/${year}/${folder}/${file}`;
  }

  function selectedTopic() {
    return el("mapVariableSelect") ? el("mapVariableSelect").value : "";
  }

  function friendlyName(topic) {
    const names = valueOfGlobal("tableFriendlyNames", {});
    return names && names[topic] ? names[topic] : topic;
  }

  function populateVariableOptions() {
    const select = el("mapVariableSelect");
    if (!select) return;
    const previous = select.value;
    const tables = valueOfGlobal("selectedTables", []);
    const ids = Array.isArray(tables) ? tables : [];

    select.innerHTML = '<option value="">-- Select a mapped variable --</option>';
    ids.forEach(id => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = friendlyName(id) === id ? id : `${friendlyName(id)} (${id})`;
      select.appendChild(option);
    });

    if (ids.includes(previous)) select.value = previous;
    else if (ids.length === 1) select.value = ids[0];
  }

  function censusGeoid(row, level) {
    const state = digits(row.state, 2);
    const county = digits(row.county, 3);
    const tract = digits(row.tract, 6);
    if (!state || !county || !tract) return "";
    if (level === "tract") return state + county + tract;
    const blockGroup = digits(row["block group"], 1);
    return blockGroup ? state + county + tract + blockGroup : "";
  }

  function featureGeoid(properties, level) {
    const p = properties || {};
    const expectedLength = level === "blockgroup" ? 12 : 11;
    const geoidKeys = ["GEOID", "GEOID20", "GEOID10", "geoid", "AFFGEOID"];

    for (const key of geoidKeys) {
      if (p[key] == null) continue;
      const allDigits = String(p[key]).replace(/\D/g, "");
      if (allDigits.length >= expectedLength) return allDigits.slice(-expectedLength);
    }

    const state = digits(p.STATEFP ?? p.STATEFP20 ?? p.STATEFP10, 2);
    const county = digits(p.COUNTYFP ?? p.COUNTYFP20 ?? p.COUNTYFP10, 3);
    const tract = digits(p.TRACTCE ?? p.TRACTCE20 ?? p.TRACTCE10, 6);
    if (!state || !county || !tract) return "";
    if (level === "tract") return state + county + tract;
    const blockGroup = digits(p.BLKGRPCE ?? p.BLKGRPCE20 ?? p.BLKGRPCE10, 1);
    return blockGroup ? state + county + tract + blockGroup : "";
  }

  async function fetchMapRows(topic, year) {
    if (typeof buildSingleTopicUrl !== "function" || typeof apiArrayToObjects !== "function") {
      throw new Error("PrettyCensus Census API helper functions are not loaded before mapping.js.");
    }
    const url = buildSingleTopicUrl(year, topic);
    if (!url) throw new Error("Complete the year, dataset, state, county, and geography selections first.");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Census API request failed (${response.status}).`);
    return apiArrayToObjects(await response.json());
  }

  async function responseTextFromGzip(response) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (!isGzip) return new TextDecoder().decode(bytes);
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser cannot decompress .gz files. Use a current Chrome, Edge, Firefox, or Safari release.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }

  async function fetchBoundaryGeoJson(url) {
    if (GEOJSON_CACHE.has(url)) return structuredClone(GEOJSON_CACHE.get(url));
    const response = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!response.ok) throw new Error(`Boundary request failed (${response.status}) for ${url}`);
    const text = await responseTextFromGzip(response);
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("The boundary file downloaded, but it was not valid gzipped GeoJSON.");
    }
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      throw new Error("The boundary file is not a GeoJSON FeatureCollection.");
    }
    GEOJSON_CACHE.set(url, data);
    return structuredClone(data);
  }

  function attachValues(geojson, rows, topic, level) {
    const values = new Map();
    rows.forEach(row => {
      const geoid = censusGeoid(row, level);
      const value = Number(row[topic]);
      if (geoid && Number.isFinite(value) && value > -666666666) values.set(geoid, value);
    });

    let matched = 0;
    geojson.features.forEach((feature, index) => {
      feature.id = index;
      feature.properties = feature.properties || {};
      const geoid = featureGeoid(feature.properties, level);
      feature.properties.__geoid = geoid;
      if (values.has(geoid)) {
        feature.properties.__value = values.get(geoid);
        matched += 1;
      } else {
        feature.properties.__value = null;
      }
    });
    return { values, matched };
  }

  function quantileBreaks(values, classes) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return [];
    const breaks = [];
    for (let i = 0; i <= classes; i += 1) {
      const position = (sorted.length - 1) * i / classes;
      const low = Math.floor(position);
      const high = Math.ceil(position);
      const fraction = position - low;
      breaks.push(sorted[low] + (sorted[high] - sorted[low]) * fraction);
    }
    return breaks;
  }

  function colorExpression(breaks) {
    if (breaks.length < 6) return "rgba(0,0,0,0)";
    return ["case",
      ["==", ["get", "__value"], null], "rgba(220,230,242,0.35)",
      ["step", ["to-number", ["get", "__value"]],
        COLORS[0], breaks[1], COLORS[1], breaks[2], COLORS[2],
        breaks[3], COLORS[3], breaks[4], COLORS[4]
      ]
    ];
  }

  function formatMapNumber(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function escape(value) {
    if (typeof escapeHtml === "function") return escapeHtml(String(value));
    const node = document.createElement("div");
    node.textContent = String(value);
    return node.innerHTML;
  }

  function drawLegend(breaks, topic) {
    const legend = el("mapLegend");
    if (!legend || breaks.length < 6) {
      if (legend) legend.innerHTML = "";
      return;
    }
    legend.innerHTML = `<strong>${escape(friendlyName(topic))}</strong>` + COLORS.map((color, i) =>
      `<div class="legend-row"><span style="background:${color}"></span>${formatMapNumber(breaks[i])} to ${formatMapNumber(breaks[i + 1])}</div>`
    ).join("");
  }

  function boundsFromGeoJson(geojson) {
    const bounds = new mapboxgl.LngLatBounds();
    function visit(coordinates) {
      if (!Array.isArray(coordinates)) return;
      if (coordinates.length >= 2 && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) {
        bounds.extend([coordinates[0], coordinates[1]]);
      } else {
        coordinates.forEach(visit);
      }
    }
    geojson.features.forEach(feature => {
      if (feature.geometry) visit(feature.geometry.coordinates);
    });
    return bounds;
  }

  function removeMapData() {
    if (!map) return;
    [MAP_HOVER, MAP_LINE, MAP_FILL].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(MAP_SOURCE)) map.removeSource(MAP_SOURCE);
  }

  function renderMap(geojson, breaks, topic) {
    removeMapData();
    map.addSource(MAP_SOURCE, { type: "geojson", data: geojson, generateId: true });
    map.addLayer({
      id: MAP_FILL,
      type: "fill",
      source: MAP_SOURCE,
      paint: { "fill-color": colorExpression(breaks), "fill-opacity": ["case", ["==", ["get", "__value"], null], 0, 0.78] }
    });
    map.addLayer({
      id: MAP_LINE,
      type: "line",
      source: MAP_SOURCE,
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.15, 10, 0.8],
        "line-opacity": ["case", ["==", ["get", "__value"], null], 0, 1]
      }
    });
    map.addLayer({
      id: MAP_HOVER,
      type: "line",
      source: MAP_SOURCE,
      paint: { "line-color": "#f97316", "line-width": 2 },
      filter: ["==", ["id"], -1]
    });

    map.on("mousemove", MAP_FILL, event => {
      if (!event.features || !event.features.length) return;
      const feature = event.features[0];
      map.setFilter(MAP_HOVER, ["==", ["id"], feature.id]);
      const properties = feature.properties || {};
      const value = properties.__value == null ? null : Number(properties.__value);
      const readout = el("mapReadout");
      if (readout) {
        readout.innerHTML = `<strong>GEOID:</strong> ${escape(properties.__geoid || "Unknown")}<br>` +
          `<strong>${escape(friendlyName(topic))}:</strong> ${value == null ? "No data" : formatMapNumber(value)}`;
      }
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", MAP_FILL, () => {
      map.setFilter(MAP_HOVER, ["==", ["id"], -1]);
      map.getCanvas().style.cursor = "";
    });

    const bounds = boundsFromGeoJson(geojson);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 30, duration: 0 });
    drawLegend(breaks, topic);
  }

  async function buildMap() {
    const buildId = ++currentBuild;
    const tokenNode = el("mapboxToken");
    const token = tokenNode ? tokenNode.value.trim() : "";
    const topic = selectedTopic();
    const selection = currentSelection();
    const boundary = boundaryUrl(selection);

    if (!token) return setStatus("Enter a Mapbox public access token.", "error");
    if (!topic) return setStatus("Select one of the Census variables already chosen above.", "error");
    if (!boundary) {
      const detail = selection.year === 2010 && selection.level === "tract" && !selection.county
        ? "2010 tract mapping requires a county selection."
        : "Mapping requires 2010-2024, one state, and Tract or Block Group geography.";
      return setStatus(detail, "error");
    }

    try {
      setStatus("Loading Census values and gzipped GeoJSON boundaries...", "checking");
      console.log("PrettyCensus boundary URL:", boundary);
      const [rows, geojson] = await Promise.all([
        fetchMapRows(topic, selection.year),
        fetchBoundaryGeoJson(boundary)
      ]);
      if (buildId !== currentBuild) return;

      const joined = attachValues(geojson, rows, topic, selection.level);
      if (!joined.values.size) throw new Error("The Census response did not contain numeric values to map.");
      if (!joined.matched) throw new Error("No boundary GEOIDs matched the Census API response.");
      const breaks = quantileBreaks(Array.from(joined.values.values()), 5);
      exportGeoJson = structuredClone(geojson);
      window.prettyCensusCurrentGeoJSON = exportGeoJson;
      const geoBtn = el("exportMapGeoJsonBtn");
      if (geoBtn) geoBtn.disabled = false;

      mapboxgl.accessToken = token;
      if (!map) {
        map = new mapboxgl.Map({
          container: "prettyCensusMap",
          style: "mapbox://styles/mapbox/light-v11",
          center: [-96, 38],
          zoom: 3
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.on("error", event => {
          const message = event && event.error ? event.error.message : "Unknown Mapbox error";
          console.error("Mapbox GL error:", event && event.error ? event.error : event);
          setStatus(`Mapbox error: ${message}`, "error");
        });
      }

      const render = () => {
        if (buildId !== currentBuild) return;
        renderMap(geojson, breaks, topic);
        setStatus(`Mapped ${joined.matched.toLocaleString()} of ${geojson.features.length.toLocaleString()} boundaries.`, "success");
      };
      // map.loaded() can be false while ordinary source/tile work is pending even
      // though the style's one-time "load" event has already fired. Waiting for
      // another "load" in that state leaves the new GeoJSON permanently unrendered.
      if (map.isStyleLoaded()) {
        render();
      } else {
        map.once("style.load", render);
      }
    } catch (error) {
      console.error(error);
      if (buildId === currentBuild) setStatus(error.message || String(error), "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const button = el("mappingOptionBtn");
    const panel = el("mappingPanel");
    const close = el("closeMappingPanelBtn");
    const draw = el("drawMapBtn");

    if (button && panel) {
      button.addEventListener("click", () => {
        panel.style.display = panel.style.display === "none" || !panel.style.display ? "block" : "none";
        populateVariableOptions();
        if (panel.style.display === "block") panel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (close && panel) close.addEventListener("click", () => { panel.style.display = "none"; });
    if (draw) draw.addEventListener("click", buildMap);
    const exportBtn = el("exportMapGeoJsonBtn");
    if (exportBtn) exportBtn.addEventListener("click", () => {
      if (!exportGeoJson || typeof downloadGeoJson !== "function") return;
      downloadGeoJson(exportGeoJson, `prettycensus_${selectedYear}_${geoLevel}_${selectedState}_${selectedCounty}.geojson`);
    });

    document.addEventListener("change", event => {
      if (["yearSelect", "datasetSelect", "geoLevel", "stateSelect", "countySelect", "tractInput", "blockGroupInput", "tableInput"].includes(event.target.id) ||
          event.target.classList.contains("presetCheckbox")) {
        populateVariableOptions();
      }
    });
  });
})();
