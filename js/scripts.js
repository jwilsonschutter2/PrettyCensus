// ---------------------------
// GLOBAL STATE (restored)
// ---------------------------
let apiKey = "";
let selectedYear = "";
let selectedDataset = "";
let selectedTables = [];
let geoLevel = "";

let selectedState = "";
let selectedCounty = "";
let selectedTract = "";

// ---------------------------
// Friendly names (includes your earlier set + optgroup IDs)
// ---------------------------
const tableFriendlyNames = {
  // Economic
  "B19013_001E": "Median Household Income (B19013_001E)",
  "B19301_001E": "Per Capita Income (B19301_001E)",
  "B25077_001E": "Median Home Value (B25077_001E)",
  "B25064_001E": "Median Gross Rent (B25064_001E)",
  "B23025_003E": "Civilian Labor Force (B23025_003E)",
  "B17001_002E": "Poverty Status (B17001_002E)",
  "B19001_001E": "Household Income Brackets (B19001_001E)",
  "B25035_001E": "Median Year Structure Built (B25035_001E)",
  "B25071_001E": "Rent as Percentage of Income (B25071_001E)",
  "B19083_001E": "Gini Index of Income Inequality (B19083_001E)",

  // Vehicle
  "B08301_001E": "Means of Transportation to Work (B08301_001E)",
  "B08006_001E": "Workers by Travel Time to Work (B08006_001E)",
  "B08101_001E": "Vehicle Availability (B08101_001E)",
  "B08103_001E": "Commute Mode Share (B08103_001E)",
  "B08105_001E": "Travel Time to Work (B08105_001E)",
  "B08111_001E": "Carpooling Statistics (B08111_001E)",
  "B08113_001E": "Public Transportation Usage (B08113_001E)",
  "B08119_001E": "Commute Distance (B08119_001E)",
  "B08201_001E": "Households Without Vehicles (B08201_001E)",
  "B08303_001E": "Time Leaving for Work (B08303_001E)",

  // Demographic
  "B01001_001E": "Total Population (B01001_001E)",
  "B01002_001E": "Median Age (B01002_001E)",
  "B02001_001E": "Race: Total Population (B02001_001E)",
  "B03002_001E": "Hispanic or Latino Origin (B03002_001E)",
  "B15003_001E": "Educational Attainment: Total (B15003_001E)",
  "B01003_001E": "Total Population Estimate (B01003_001E)",
  "B11001_001E": "Household Types (B11001_001E)",
  "B09001_001E": "Children Under 18 (B09001_001E)",
  "B17020_001E": "Poverty by Age (B17020_001E)",
  "B25014_001E": "Overcrowded Housing (B25014_001E)",

  // Extra (from your original JS map)
  "B17001_002E": "Population Below Poverty Level (B17001_002E)",
  "B25001_001E": "Total Housing Units (B25001_001E)",
  "B25002_002E": "Occupied Housing Units (B25002_002E)",
  "B25002_003E": "Vacant Housing Units (B25002_003E)",
  "B25003_002E": "Owner-Occupied Housing Units (B25003_002E)",
  "B25003_003E": "Renter-Occupied Housing Units (B25003_003E)",
  "B01001_002E": "Male Population (B01001_002E)",
  "B01001_026E": "Female Population (B01001_026E)",
  "B01002_002E": "Median Age: Male (B01002_002E)",
  "B01002_003E": "Median Age: Female (B01002_003E)",
  "B08134_001E": "Means of Transportation to Work: Total (B08134_001E)",
  "B08134_002E": "Means of Transportation to Work: Car, Truck, or Van (B08134_002E)",
  "B08134_003E": "Means of Transportation to Work: Public Transportation (B08134_003E)"
};

// ---------------------------
// Grouping to match your original optgroups
// ---------------------------
const presetGroups = [
  {
    name: "Economic",
    items: [
      "B19013_001E","B19301_001E","B25077_001E","B25064_001E","B23025_003E",
      "B17001_002E","B19001_001E","B25035_001E","B25071_001E","B19083_001E"
    ]
  },
  {
    name: "Vehicle",
    items: [
      "B08301_001E","B08006_001E","B08101_001E","B08103_001E","B08105_001E",
      "B08111_001E","B08113_001E","B08119_001E","B08201_001E","B08303_001E"
    ]
  },
  {
    name: "Demographic",
    items: [
      "B01001_001E","B01002_001E","B02001_001E","B03002_001E","B15003_001E",
      "B01003_001E","B11001_001E","B09001_001E","B17020_001E","B25014_001E"
    ]
  }
];

// ---------------------------
// DOM helpers
// ---------------------------
const $ = (id) => document.getElementById(id);

function digitsOnly(str) {
  return (str || "").replace(/\D+/g, "");
}

// ---------------------------
// API KEY
// ---------------------------
$("saveKeyBtn").addEventListener("click", () => {
  apiKey = $("APIKey").value.trim();
  console.log("API Key saved:", apiKey ? "(set)" : "(empty)");
});

// ---------------------------
// YEAR
// ---------------------------
$("yearSelect").addEventListener("change", function () {
  selectedYear = this.value;
  console.log("Selected Year:", selectedYear);
});

// ---------------------------
// DATASET
// ---------------------------
$("datasetSelect").addEventListener("change", function () {
  selectedDataset = this.value;
  console.log("Selected Dataset:", selectedDataset);
});

// ---------------------------
// PRESET TABLE CHECKBOX DROPDOWN (grouped)
// ---------------------------
const presetDropdown = $("presetDropdown");
const presetDropdownToggle = $("presetDropdownToggle");
const presetDropdownMenu = $("presetDropdownMenu");
const presetCheckboxList = $("presetCheckboxList");

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
      const labelText = tableFriendlyNames[varId] || varId;

      const row = document.createElement("label");
      row.className = "checkbox-item";
      row.setAttribute("for", id);
      row.innerHTML = `
        <input type="checkbox" class="presetCheckbox" id="${id}" value="${varId}">
        <span>${labelText}</span>
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

  selectedTables = [...checkedPreset, ...customValues].filter(v => v !== "");
  console.log("Selected Tables:", selectedTables);

  const count = checkedPreset.length;
  const labelText = count ? `${count} table${count === 1 ? "" : "s"} selected` : "Select pre-set tables";
  // update text node before caret
  presetDropdownToggle.childNodes[0].nodeValue = ` ${labelText} `;
}

// Toggle open/close WITHOUT instant-close bug
presetDropdownToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = presetDropdown.classList.toggle("open");
  presetDropdownToggle.setAttribute("aria-expanded", String(isOpen));
});

// Clicking inside menu should not close it
presetDropdownMenu.addEventListener("click", (e) => {
  e.stopPropagation();
});

// Click outside closes dropdown
document.addEventListener("click", () => {
  presetDropdown.classList.remove("open");
  presetDropdownToggle.setAttribute("aria-expanded", "false");
});

// Update selections on checkbox change
presetDropdownMenu.addEventListener("change", (e) => {
  if (e.target.classList.contains("presetCheckbox")) {
    updateSelectedTablesFromUI();
  }
});

// Select all / Clear
$("presetSelectAll").addEventListener("click", () => {
  document.querySelectorAll(".presetCheckbox").forEach(cb => cb.checked = true);
  updateSelectedTablesFromUI();
});

$("presetClearAll").addEventListener("click", () => {
  document.querySelectorAll(".presetCheckbox").forEach(cb => cb.checked = false);
  updateSelectedTablesFromUI();
});

// Custom table IDs input merges with presets
$("tableInput").addEventListener("input", updateSelectedTablesFromUI);

// Init preset dropdown
renderPresetCheckboxesGrouped();
updateSelectedTablesFromUI();

// ---------------------------
// GEOGRAPHY LEVEL (fixes shadowing bug)
// ---------------------------
$("geoLevel").addEventListener("change", function () {
  geoLevel = this.value; // ✅ no "const geoLevel" shadowing
  console.log("Selected Geography Level:", geoLevel);

  $("stateOptions").style.display = (geoLevel === "state" || geoLevel === "county" || geoLevel === "tract") ? "block" : "none";
  $("countyOptions").style.display = (geoLevel === "county" || geoLevel === "tract") ? "block" : "none";
  $("tractOptions").style.display = (geoLevel === "tract") ? "block" : "none";
});

// Keep geo inputs synced
function syncState() {
  const all = $("allStatesCheckbox").checked;
  $("stateInput").disabled = all;
  selectedState = all ? "*" : digitsOnly($("stateInput").value).slice(0, 2);
  console.log("selectedState:", selectedState);
}
function syncCounty() {
  const all = $("allCountiesCheckbox").checked;
  $("countyInput").disabled = all;
  selectedCounty = all ? "*" : digitsOnly($("countyInput").value).slice(0, 3);
  console.log("selectedCounty:", selectedCounty);
}
function syncTract() {
  const all = $("allTractsCheckbox").checked;
  $("tractInput").disabled = all;
  selectedTract = all ? "*" : digitsOnly($("tractInput").value).slice(0, 6);
  console.log("selectedTract:", selectedTract);
}

$("allStatesCheckbox").addEventListener("change", syncState);
$("allCountiesCheckbox").addEventListener("change", syncCounty);
$("allTractsCheckbox").addEventListener("change", syncTract);

$("stateInput").addEventListener("input", syncState);
$("countyInput").addEventListener("input", syncCounty);
$("tractInput").addEventListener("input", syncTract);

// Init geo values
syncState(); syncCounty(); syncTract();

// ---------------------------
// BUILD URL (restored)
// Uses &outputFormat=csv as a supported parameter in examples/documentation. [2](https://dol.ny.gov/system/files/documents/2025/06/using-the-census-api-in-excel-cornell-pad-jan-vink.pdf)[3](https://www.census.gov/data/developers/guidance/api-user-guide.html)
// ---------------------------
function buildCensusURL() {
  if (!apiKey || !selectedYear || !selectedDataset || selectedTables.length === 0 || !geoLevel) {
    alert("Missing required fields (API key, year, dataset, tables, and geography level are required).");
    return "";
  }

  const base = `https://api.census.gov/data/${selectedYear}/${selectedDataset}`;
  let url = `${base}?get=${selectedTables.join(",")}`;

  if (geoLevel === "state") {
    if (!selectedState) { alert("Enter State FIPS or check 'All states'."); return ""; }
    url += `&for=state:${selectedState}`;
  }

  if (geoLevel === "county") {
    if (!selectedState) { alert("Enter State FIPS or check 'All states'."); return ""; }
    if (!selectedCounty) { alert("Enter County FIPS or check 'All counties in state'."); return ""; }
    url += `&for=county:${selectedCounty}&in=state:${selectedState}`;
  }

  if (geoLevel === "tract") {
    if (!selectedState) { alert("Enter State FIPS or check 'All states'."); return ""; }
    if (!selectedCounty) { alert("Enter County FIPS or check 'All counties in state'."); return ""; }
    if (!selectedTract) { alert("Enter Tract FIPS or check 'All tracts in county'."); return ""; }
    url += `&for=tract:${selectedTract}&in=state:${selectedState}+county:${selectedCounty}`;
  }

  // CSV format BEFORE API key (your original pattern)
  url += `&outputFormat=csv&key=${encodeURIComponent(apiKey)}`;
  return url;
}

// ---------------------------
// BUTTONS
// ---------------------------
$("generateURL").addEventListener("click", () => {
  const url = buildCensusURL();
  $("urlOutput").value = url;
});

$("fetchJSON").addEventListener("click", () => {
  const url = buildCensusURL().replace("&outputFormat=csv", ""); // JSON endpoint
  if (!url) return;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      $("jsonTableContainer").innerHTML = convertJSONToTable(data);
    })
    .catch(err => {
      $("jsonTableContainer").innerHTML = "<p style='color:red;'>Error fetching JSON.</p>";
      console.error(err);
    });
});

// ---------------------------
// JSON -> HTML TABLE (restored & improved)
// ---------------------------
function convertJSONToTable(jsonData) {
  if (!Array.isArray(jsonData) || jsonData.length < 2) {
    return "<p>No data returned.</p>";
  }

  const [headers, ...rows] = jsonData;

  // Replace headers with friendly names when available
  const displayHeaders = headers.map(h => tableFriendlyNames[h] || h);

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