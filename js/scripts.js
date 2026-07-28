// ---------------------------
// GLOBAL STATE
// ---------------------------
let apiKey = "";
let selectedYear = "";
let selectedDataset = "";
let selectedTables = [];
let geoLevel = "";
let selectedState = "";
let selectedCounty = "";
let selectedTract = "";
let selectedBlockGroup = "*";
let availabilityAbortController = null;
let availabilityDebounceTimer = null;

// ---------------------------
// Friendly names
// ---------------------------
const tableFriendlyNames = {
  "B19013_001E": "Median Household Income",
  "B19301_001E": "Per Capita Income",
  "B25077_001E": "Median Home Value",
  "B25064_001E": "Median Gross Rent",
  "B23025_003E": "Civilian Labor Force",
  "B17001_002E": "Population Below Poverty Level",
  "B19001_001E": "Household Income Brackets",
  "B25035_001E": "Median Year Structure Built",
  "B25071_001E": "Rent as Percentage of Income",
  "B19083_001E": "Gini Index of Income Inequality",

  "B08301_001E": "Means of Transportation to Work",
  "B08006_001E": "Workers by Travel Time to Work",
  "B08101_001E": "Vehicle Availability",
  "B08103_001E": "Commute Mode Share",
  "B08105_001E": "Travel Time to Work",
  "B08111_001E": "Carpooling Statistics",
  "B08113_001E": "Public Transportation Usage",
  "B08119_001E": "Commute Distance",
  "B08201_001E": "Households Without Vehicles",
  "B08303_001E": "Time Leaving for Work",

  "B01001_001E": "Total Population",
  "B01002_001E": "Median Age",
  "B02001_001E": "Race: Total Population",
  "B03002_001E": "Hispanic or Latino Origin",
  "B15003_001E": "Educational Attainment: Total",
  "B01003_001E": "Total Population Estimate",
  "B11001_001E": "Household Types",
  "B09001_001E": "Children Under 18",
  "B17020_001E": "Poverty by Age",
  "B25014_001E": "Overcrowded Housing",

  "B25001_001E": "Total Housing Units",
  "B25002_002E": "Occupied Housing Units",
  "B25002_003E": "Vacant Housing Units",
  "B25003_002E": "Owner-Occupied Housing Units",
  "B25003_003E": "Renter-Occupied Housing Units",
  "B01001_002E": "Male Population",
  "B01001_026E": "Female Population",
  "B01002_002E": "Median Age: Male",
  "B01002_003E": "Median Age: Female",
  "B08134_001E": "Means of Transportation to Work: Total",
  "B08134_002E": "Means of Transportation to Work: Car, Truck, or Van",
  "B08134_003E": "Means of Transportation to Work: Public Transportation"
};

const presetGroups = [
  {
    name: "Economic",
    items: [
      "B19013_001E", "B19301_001E", "B25077_001E", "B25064_001E", "B23025_003E",
      "B17001_002E", "B19001_001E", "B25035_001E", "B25071_001E", "B19083_001E"
    ]
  },
  {
    name: "Transportation and Vehicles",
    items: [
      "B08301_001E", "B08006_001E", "B08101_001E", "B08103_001E", "B08105_001E",
      "B08111_001E", "B08113_001E", "B08119_001E", "B08201_001E", "B08303_001E",
      "B08134_001E", "B08134_002E", "B08134_003E"
    ]
  },
  {
    name: "Demographic",
    items: [
      "B01001_001E", "B01002_001E", "B02001_001E", "B03002_001E", "B15003_001E",
      "B01003_001E", "B11001_001E", "B09001_001E", "B17020_001E", "B25014_001E",
      "B01001_002E", "B01001_026E", "B01002_002E", "B01002_003E"
    ]
  },
  {
    name: "Housing",
    items: [
      "B25001_001E", "B25002_002E", "B25002_003E", "B25003_002E", "B25003_003E",
      "B25077_001E", "B25064_001E", "B25035_001E", "B25071_001E", "B25014_001E"
    ]
  }
];

const $ = (id) => document.getElementById(id);

function digitsOnly(str) {
  return (str || "").replace(/\D+/g, "");
}

function allPresetTableIds() {
  return Array.from(new Set(presetGroups.flatMap(group => group.items)));
}

// ---------------------------
// INIT
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderPresetCheckboxesGrouped();
  updateSelectedTablesFromUI();
  populateStateDropdown();
  wireEvents();
  syncState();
  syncCounty();
  syncTract();
  syncBlockGroup();
  resetAvailabilityUI();
});

function wireEvents() {
  $("saveKeyBtn").addEventListener("click", () => {
    apiKey = $("APIKey").value.trim();
    console.log("API Key saved:", apiKey ? "(set)" : "(empty)");
    scheduleAvailabilityCheck();
  });

  $("yearSelect").addEventListener("change", function () {
    selectedYear = this.value;
    reloadCountiesIfStateSelected();
    scheduleAvailabilityCheck();
  });

  $("datasetSelect").addEventListener("change", function () {
    selectedDataset = this.value;
    reloadCountiesIfStateSelected();
    scheduleAvailabilityCheck();
  });

  $("geoLevel").addEventListener("change", handleGeoLevelChange);

  $("stateSelect").addEventListener("change", handleStateSelectChange);
  $("countySelect").addEventListener("change", handleCountySelectChange);

  $("allStatesCheckbox").addEventListener("change", () => { syncState(); scheduleAvailabilityCheck(); });
  $("allCountiesCheckbox").addEventListener("change", () => { syncCounty(); scheduleAvailabilityCheck(); });
  $("allTractsCheckbox").addEventListener("change", () => { syncTract(); scheduleAvailabilityCheck(); });
  $("allBlockGroupsCheckbox").addEventListener("change", () => { syncBlockGroup(); scheduleAvailabilityCheck(); });

  $("tractInput").addEventListener("input", () => { syncTract(); scheduleAvailabilityCheck(); });
  $("blockGroupInput").addEventListener("input", () => { syncBlockGroup(); scheduleAvailabilityCheck(); });

  $("generateURL").addEventListener("click", () => {
    const url = buildCensusURL();
    $("urlOutput").value = url;
  });

  $("fetchJSON").addEventListener("click", () => {
    const url = buildCensusURL({ outputFormat: "json" });
    if (!url) return;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        $("jsonTableContainer").innerHTML = convertJSONToTable(data);
      })
      .catch(err => {
        $("jsonTableContainer").innerHTML = "<p class='error-text'>Error fetching JSON.</p>";
        console.error(err);
      });
  });

  wireDropdownEvents();
}

// ---------------------------
// TABLE DROPDOWN AND TABLE CARDS
// ---------------------------
const presetDropdown = $("presetDropdown");
const presetDropdownToggle = $("presetDropdownToggle");
const presetDropdownMenu = $("presetDropdownMenu");
const presetCheckboxList = $("presetCheckboxList");

function wireDropdownEvents() {
  presetDropdownToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = presetDropdown.classList.toggle("open");
    presetDropdownToggle.setAttribute("aria-expanded", String(isOpen));
  });

  presetDropdownMenu.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", () => {
    presetDropdown.classList.remove("open");
    presetDropdownToggle.setAttribute("aria-expanded", "false");
  });

  presetDropdownMenu.addEventListener("change", (e) => {
    if (e.target.classList.contains("presetCheckbox")) {
      updateSelectedTablesFromUI();
    }
  });

  $("presetSelectAll").addEventListener("click", () => {
    document.querySelectorAll(".presetCheckbox:not(:disabled)").forEach(cb => cb.checked = true);
    updateSelectedTablesFromUI();
  });

  $("presetClearAll").addEventListener("click", () => {
    document.querySelectorAll(".presetCheckbox").forEach(cb => cb.checked = false);
    updateSelectedTablesFromUI();
  });

  $("tableInput").addEventListener("input", updateSelectedTablesFromUI);

  $("tableSearch").addEventListener("input", function () {
    const term = this.value.toLowerCase().trim();
    document.querySelectorAll(".table-card").forEach(card => {
      card.style.display = card.innerText.toLowerCase().includes(term) ? "" : "none";
    });

    document.querySelectorAll(".checkbox-group").forEach(group => {
      const visibleCards = Array.from(group.querySelectorAll(".table-card"))
        .filter(card => card.style.display !== "none");
      group.style.display = visibleCards.length ? "grid" : "none";
    });
  });
}

function renderPresetCheckboxesGrouped() {
  presetCheckboxList.innerHTML = "";
  const frag = document.createDocumentFragment();

  presetGroups.forEach(group => {
    const groupWrap = document.createElement("div");
    groupWrap.className = "checkbox-group";

    const title = document.createElement("div");
    title.className = "checkbox-group__title";
    title.textContent = group.name;
    groupWrap.appendChild(title);

    group.items.forEach(varId => {
      const id = `preset_${varId}`;
      const row = document.createElement("label");
      row.className = "table-card";
      row.setAttribute("for", id);
      row.dataset.tableId = varId;
      row.innerHTML = `
        <input type="checkbox" class="presetCheckbox" id="${id}" value="${varId}">
        <div class="table-card__content">
          <div class="table-card__title">${tableFriendlyNames[varId] || varId}</div>
          <div class="table-card__id">${varId}</div>
          <div class="table-card__message"></div>
        </div>
      `;
      groupWrap.appendChild(row);
    });

    frag.appendChild(groupWrap);
  });

  presetCheckboxList.appendChild(frag);
}

function updateSelectedTablesFromUI() {
  const checkedPreset = Array.from(document.querySelectorAll(".presetCheckbox:checked"))
    .map(cb => cb.value);
  const customRaw = $("tableInput").value.trim();
  const customValues = customRaw ? customRaw.split(/[\s,]+/) : [];

  selectedTables = Array.from(new Set([...checkedPreset, ...customValues]
    .map(v => v.trim())
    .filter(Boolean)));

  const count = checkedPreset.length;
  const labelText = count ? `${count} table${count === 1 ? "" : "s"} selected` : "Select pre-set tables";
  presetDropdownToggle.childNodes[0].nodeValue = ` ${labelText} `;
}

// ---------------------------
// TABLE AVAILABILITY BY GEOGRAPHY
// ---------------------------
function hasRequiredContextForAvailability() {
  if (!selectedYear || !selectedDataset || !geoLevel) return false;

  if (geoLevel === "state") {
    return Boolean(selectedState);
  }

  if (geoLevel === "county") {
    return Boolean(selectedState && selectedState !== "*" && selectedCounty);
  }

  if (geoLevel === "tract") {
    return Boolean(selectedState && selectedState !== "*" && selectedCounty && selectedCounty !== "*");
  }

  if (geoLevel === "blockgroup") {
    return Boolean(selectedState && selectedState !== "*" && selectedCounty && selectedCounty !== "*");
  }

  return false;
}

function scheduleAvailabilityCheck() {
  clearTimeout(availabilityDebounceTimer);
  availabilityDebounceTimer = setTimeout(checkTableAvailabilityForCurrentGeography, 350);
}

function resetAvailabilityUI(message = "Select a year, dataset, and geography to check table availability.") {
  document.querySelectorAll(".table-card").forEach(card => {
    card.classList.remove("available", "unavailable", "checking");
    card.removeAttribute("title");
    const checkbox = card.querySelector(".presetCheckbox");
    const messageEl = card.querySelector(".table-card__message");
    if (checkbox) checkbox.disabled = false;
    if (messageEl) messageEl.textContent = "";
  });

  setAvailabilityStatus(message, "muted");
}

function setAvailabilityStatus(message, type) {
  const status = $("availabilityStatus");
  status.textContent = message;
  status.className = `availability-status ${type}`;
}

function buildAvailabilityUrl(tableId) {
  const params = new URLSearchParams();
  params.set("get", `NAME,${tableId}`);

  if (geoLevel === "state") {
    params.set("for", `state:${selectedState}`);
  }

  if (geoLevel === "county") {
    params.set("for", `county:${selectedCounty}`);
    params.set("in", `state:${selectedState}`);
  }

  if (geoLevel === "tract") {
    params.set("for", `tract:${selectedTract || "*"}`);
    params.set("in", `state:${selectedState} county:${selectedCounty}`);
  }

  if (geoLevel === "blockgroup") {
    params.set("for", `block group:${selectedBlockGroup || "*"}`);
    params.set("in", `state:${selectedState} county:${selectedCounty} tract:${selectedTract || "*"}`);
  }

  if (apiKey) {
    params.set("key", apiKey);
  }

  return `https://api.census.gov/data/${selectedYear}/${selectedDataset}?${params.toString()}`;
}

async function checkSingleTableAvailability(tableId, signal) {
  const url = buildAvailabilityUrl(tableId);
  const response = await fetch(url, { signal });

  if (!response.ok) return false;

  const data = await response.json();
  return Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && data[0].includes(tableId);
}

async function checkTableAvailabilityForCurrentGeography() {
  if (availabilityAbortController) {
    availabilityAbortController.abort();
  }

  if (!hasRequiredContextForAvailability()) {
    resetAvailabilityUI();
    return;
  }

  availabilityAbortController = new AbortController();
  const signal = availabilityAbortController.signal;
  const tableIds = allPresetTableIds();

  document.querySelectorAll(".table-card").forEach(card => {
    card.classList.remove("available", "unavailable");
    card.classList.add("checking");
    const messageEl = card.querySelector(".table-card__message");
    if (messageEl) messageEl.textContent = "Checking availability...";
  });

  setAvailabilityStatus("Checking table availability for the selected geography...", "checking");

  let availableCount = 0;
  let checkedCount = 0;

  for (const tableId of tableIds) {
    if (signal.aborted) return;

    const card = document.querySelector(`.table-card[data-table-id="${tableId}"]`);
    const checkbox = card ? card.querySelector(".presetCheckbox") : null;
    const messageEl = card ? card.querySelector(".table-card__message") : null;

    try {
      const isAvailable = await checkSingleTableAvailability(tableId, signal);
      checkedCount += 1;

      if (!card || !checkbox) continue;

      card.classList.remove("checking");
      card.classList.toggle("available", isAvailable);
      card.classList.toggle("unavailable", !isAvailable);
      checkbox.disabled = !isAvailable;

      if (!isAvailable) {
        checkbox.checked = false;
        card.title = "This table did not return successfully for the selected year, dataset, and geography.";
        if (messageEl) messageEl.textContent = "Not available for selected geography";
      } else {
        availableCount += 1;
        card.removeAttribute("title");
        if (messageEl) messageEl.textContent = "Available";
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      checkedCount += 1;

      if (!card || !checkbox) continue;

      card.classList.remove("checking", "available");
      card.classList.add("unavailable");
      checkbox.checked = false;
      checkbox.disabled = true;
      card.title = "Availability check failed for this table.";
      if (messageEl) messageEl.textContent = "Availability check failed";
    }

    if (checkedCount % 5 === 0 || checkedCount === tableIds.length) {
      setAvailabilityStatus(`Checked ${checkedCount} of ${tableIds.length} tables...`, "checking");
    }
  }

  updateSelectedTablesFromUI();
  setAvailabilityStatus(`${availableCount} of ${tableIds.length} preset tables are available for the selected geography.`, "success");
}

// ---------------------------
// GEOGRAPHY UI
// ---------------------------
function populateStateDropdown() {
  const stateDropdown = $("stateSelect");
  stateDropdown.innerHTML = "<option value=''>-- Select State --</option>";

  STATE_FIPS.forEach(state => {
    const option = document.createElement("option");
    option.value = state.fips;
    option.textContent = `${state.name} (${state.fips})`;
    stateDropdown.appendChild(option);
  });
}

function handleGeoLevelChange() {
  geoLevel = this.value;

  $("stateOptions").style.display = ["state", "county", "tract", "blockgroup"].includes(geoLevel) ? "block" : "none";
  $("countyOptions").style.display = ["county", "tract", "blockgroup"].includes(geoLevel) ? "block" : "none";
  $("tractOptions").style.display = geoLevel === "tract" ? "block" : "none";
  $("blockGroupOptions").style.display = geoLevel === "blockgroup" ? "block" : "none";

  if (geoLevel === "tract") {
    $("allTractsCheckbox").checked = true;
    syncTract();
  }

  if (geoLevel === "blockgroup") {
    $("allBlockGroupsCheckbox").checked = true;
    selectedTract = "*";
    syncBlockGroup();
  }

  scheduleAvailabilityCheck();
}

async function handleStateSelectChange() {
  selectedState = this.value;
  $("stateInput").value = selectedState;

  selectedCounty = "";
  $("countyInput").value = "";
  resetCountyDropdown("-- Loading Counties --");

  syncState();

  if (!selectedState || selectedState === "*") {
    resetCountyDropdown("-- Select State First --");
    scheduleAvailabilityCheck();
    return;
  }

  await loadCountiesForSelectedState();
  scheduleAvailabilityCheck();
}

function handleCountySelectChange() {
  selectedCounty = this.value;
  $("countyInput").value = selectedCounty;

  if (selectedCounty) {
    $("allTractsCheckbox").checked = true;
    $("allBlockGroupsCheckbox").checked = true;
    selectedTract = "*";
    selectedBlockGroup = "*";
  }

  syncCounty();
  syncTract();
  syncBlockGroup();
  scheduleAvailabilityCheck();
}

function syncState() {
  const all = $("allStatesCheckbox").checked;
  $("stateSelect").disabled = all;
  $("stateInput").disabled = all;
  selectedState = all ? "*" : $("stateSelect").value;
  $("stateInput").value = selectedState === "*" ? "*" : selectedState;
}

function syncCounty() {
  const all = $("allCountiesCheckbox").checked;
  $("countySelect").disabled = all || !selectedState || selectedState === "*";
  $("countyInput").disabled = all;
  selectedCounty = all ? "*" : $("countySelect").value;
  $("countyInput").value = selectedCounty === "*" ? "*" : selectedCounty;
}

function syncTract() {
  const all = $("allTractsCheckbox").checked;
  $("tractInput").disabled = all;
  selectedTract = all ? "*" : digitsOnly($("tractInput").value).slice(0, 6);
}

function syncBlockGroup() {
  const all = $("allBlockGroupsCheckbox").checked;
  $("blockGroupInput").disabled = all;
  selectedBlockGroup = all ? "*" : digitsOnly($("blockGroupInput").value).slice(0, 1);
}

function resetCountyDropdown(label) {
  $("countySelect").innerHTML = `<option value="">${label}</option>`;
  $("countySelect").disabled = true;
}

async function reloadCountiesIfStateSelected() {
  if (selectedState && selectedState !== "*" && ["county", "tract", "blockgroup"].includes(geoLevel)) {
    await loadCountiesForSelectedState();
  }
}

async function loadCountiesForSelectedState() {
  const countyStatus = $("countyStatus");
  countyStatus.textContent = "Loading counties...";

  try {
    const counties = await loadCountyFipsFromCensus({
      year: selectedYear || "2024",
      dataset: selectedDataset || "acs/acs5",
      stateFips: selectedState,
      apiKey
    });

    const countySelect = $("countySelect");
    countySelect.innerHTML = "<option value=''>-- Select County --</option>";

    counties.forEach(county => {
      const option = document.createElement("option");
      option.value = county.fips;
      option.textContent = `${county.name} (${county.fips})`;
      countySelect.appendChild(option);
    });

    countySelect.disabled = false;
    countyStatus.textContent = `Loaded ${counties.length} counties for ${getStateNameFromFips(selectedState)}.`;
  } catch (error) {
    console.error(error);
    resetCountyDropdown("-- County Lookup Failed --");
    countyStatus.textContent = "Could not load counties for this year/dataset. Try ACS 5-Year Estimates.";
  }
}

// ---------------------------
// BUILD URL
// ---------------------------
function buildCensusURL(options = {}) {
  const outputFormat = options.outputFormat || "csv";

  if (!apiKey || !selectedYear || !selectedDataset || selectedTables.length === 0 || !geoLevel) {
    alert("Missing required fields: API key, year, dataset, tables, and geography level are required.");
    return "";
  }

  const base = `https://api.census.gov/data/${selectedYear}/${selectedDataset}`;
  let url = `${base}?get=${selectedTables.join(",")}`;

  if (geoLevel === "state") {
    if (!selectedState) {
      alert("Select a state or check All states.");
      return "";
    }
    url += `&for=state:${selectedState}`;
  }

  if (geoLevel === "county") {
    if (!selectedState || selectedState === "*") {
      alert("Select one state before requesting counties.");
      return "";
    }
    if (!selectedCounty) {
      alert("Select a county or check All counties in state.");
      return "";
    }
    url += `&for=county:${selectedCounty}&in=state:${selectedState}`;
  }

  if (geoLevel === "tract") {
    if (!selectedState || selectedState === "*") {
      alert("Select one state before requesting tracts.");
      return "";
    }
    if (!selectedCounty || selectedCounty === "*") {
      alert("Select one county before requesting tracts.");
      return "";
    }

    selectedTract = selectedTract || "*";
    url += `&for=tract:${selectedTract}&in=state:${selectedState}+county:${selectedCounty}`;
  }

  if (geoLevel === "blockgroup") {
    if (!selectedState || selectedState === "*") {
      alert("Select one state before requesting block groups.");
      return "";
    }
    if (!selectedCounty || selectedCounty === "*") {
      alert("Select one county before requesting block groups.");
      return "";
    }

    selectedBlockGroup = selectedBlockGroup || "*";
    selectedTract = selectedTract || "*";
    url += `&for=block group:${selectedBlockGroup}&in=state:${selectedState}+county:${selectedCounty}+tract:${selectedTract}`;
  }

  if (outputFormat === "csv") {
    url += "&outputFormat=csv";
  }

  url += `&key=${encodeURIComponent(apiKey)}`;
  return url;
}

// ---------------------------
// JSON TO TABLE
// ---------------------------
function convertJSONToTable(jsonData) {
  if (!Array.isArray(jsonData) || jsonData.length < 2) {
    return "<p>No data returned.</p>";
  }

  const [headers, ...rows] = jsonData;
  const displayHeaders = headers.map(h => tableFriendlyNames[h] ? `${tableFriendlyNames[h]} (${h})` : h);

  let html = "<table class='data-table'>";
  html += "<thead><tr>";
  displayHeaders.forEach(h => html += `<th>${escapeHtml(String(h))}</th>`);
  html += "</tr></thead>";
  html += "<tbody>";

  rows.forEach(row => {
    html += "<tr>";
    row.forEach(cell => html += `<td>${escapeHtml(String(cell))}</td>`);
    html += "</tr>";
  });

  html += "</tbody></table>";
  return html;
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
