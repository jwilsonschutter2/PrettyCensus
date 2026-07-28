// ------------------------------------------------------------
// PrettyCensus geography definitions
// Location: styles/geography.js
// Purpose: defines state FIPS and county lookup helpers used by js/scripts.js
// ------------------------------------------------------------

const STATE_FIPS = [
  { fips: "01", name: "Alabama" },
  { fips: "02", name: "Alaska" },
  { fips: "04", name: "Arizona" },
  { fips: "05", name: "Arkansas" },
  { fips: "06", name: "California" },
  { fips: "08", name: "Colorado" },
  { fips: "09", name: "Connecticut" },
  { fips: "10", name: "Delaware" },
  { fips: "11", name: "District of Columbia" },
  { fips: "12", name: "Florida" },
  { fips: "13", name: "Georgia" },
  { fips: "15", name: "Hawaii" },
  { fips: "16", name: "Idaho" },
  { fips: "17", name: "Illinois" },
  { fips: "18", name: "Indiana" },
  { fips: "19", name: "Iowa" },
  { fips: "20", name: "Kansas" },
  { fips: "21", name: "Kentucky" },
  { fips: "22", name: "Louisiana" },
  { fips: "23", name: "Maine" },
  { fips: "24", name: "Maryland" },
  { fips: "25", name: "Massachusetts" },
  { fips: "26", name: "Michigan" },
  { fips: "27", name: "Minnesota" },
  { fips: "28", name: "Mississippi" },
  { fips: "29", name: "Missouri" },
  { fips: "30", name: "Montana" },
  { fips: "31", name: "Nebraska" },
  { fips: "32", name: "Nevada" },
  { fips: "33", name: "New Hampshire" },
  { fips: "34", name: "New Jersey" },
  { fips: "35", name: "New Mexico" },
  { fips: "36", name: "New York" },
  { fips: "37", name: "North Carolina" },
  { fips: "38", name: "North Dakota" },
  { fips: "39", name: "Ohio" },
  { fips: "40", name: "Oklahoma" },
  { fips: "41", name: "Oregon" },
  { fips: "42", name: "Pennsylvania" },
  { fips: "44", name: "Rhode Island" },
  { fips: "45", name: "South Carolina" },
  { fips: "46", name: "South Dakota" },
  { fips: "47", name: "Tennessee" },
  { fips: "48", name: "Texas" },
  { fips: "49", name: "Utah" },
  { fips: "50", name: "Vermont" },
  { fips: "51", name: "Virginia" },
  { fips: "53", name: "Washington" },
  { fips: "54", name: "West Virginia" },
  { fips: "55", name: "Wisconsin" },
  { fips: "56", name: "Wyoming" },
  { fips: "72", name: "Puerto Rico" }
];

const COUNTY_FIPS_CACHE = {};

function getStateNameFromFips(stateFips) {
  const state = STATE_FIPS.find(item => item.fips === stateFips);
  return state ? state.name : "";
}

function countyCacheKey(year, dataset, stateFips) {
  return `${year}|${dataset}|${stateFips}`;
}

async function loadCountyFipsFromCensus({ year, dataset, stateFips, apiKey }) {
  const lookupYear = year || "2024";
  const lookupDataset = dataset || "acs/acs5";
  const key = countyCacheKey(lookupYear, lookupDataset, stateFips);

  if (COUNTY_FIPS_CACHE[key]) {
    return COUNTY_FIPS_CACHE[key];
  }

  const params = new URLSearchParams();
  params.set("get", "NAME");
  params.set("for", "county:*");
  params.set("in", `state:${stateFips}`);

  if (apiKey) {
    params.set("key", apiKey);
  }

  const url = `https://api.census.gov/data/${lookupYear}/${lookupDataset}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`County lookup failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length < 2) {
    return [];
  }

  const headers = data[0];
  const nameIndex = headers.indexOf("NAME");
  const countyIndex = headers.indexOf("county");

  const counties = data.slice(1)
    .map(row => ({
      fips: row[countyIndex],
      name: cleanCountyDisplayName(row[nameIndex])
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  COUNTY_FIPS_CACHE[key] = counties;
  return counties;
}

function cleanCountyDisplayName(name) {
  if (!name) return "";
  return String(name).replace(/,.*$/, "").trim();
}
