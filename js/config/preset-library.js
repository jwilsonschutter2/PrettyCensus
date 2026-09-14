/**
 * PrettyCensus preset-table and friendly-name library.
 * Add or edit entries here without changing dropdown, API, table, map, or export code.
 */
window.PrettyCensusLibrary = (() => {
  "use strict";

  const variables = {
    B19013_001E: { name: "Median Household Income", unit: "US dollars", aggregation: "median" },
    B19301_001E: { name: "Per Capita Income", unit: "US dollars", aggregation: "rate" },
    B23025_003E: { name: "Civilian Labor Force", unit: "people", aggregation: "additive" },
    B17001_002E: { name: "Population Below Poverty Level", unit: "people", aggregation: "additive" },
    B01003_001E: { name: "Total Population", unit: "people", aggregation: "additive" },
    B01001_002E: { name: "Male Population", unit: "people", aggregation: "additive" },
    B01001_026E: { name: "Female Population", unit: "people", aggregation: "additive" },
    B25001_001E: { name: "Total Housing Units", unit: "housing units", aggregation: "additive" },
    B25002_002E: { name: "Occupied Housing Units", unit: "housing units", aggregation: "additive" },
    B25002_003E: { name: "Vacant Housing Units", unit: "housing units", aggregation: "additive" },
    B25003_002E: { name: "Owner-Occupied Housing Units", unit: "housing units", aggregation: "additive" },
    B25003_003E: { name: "Renter-Occupied Housing Units", unit: "housing units", aggregation: "additive" },
    B25077_001E: { name: "Median Home Value", unit: "US dollars", aggregation: "median" },
    B25064_001E: { name: "Median Gross Rent", unit: "US dollars", aggregation: "median" },
    B08134_001E: { name: "Workers: Total", unit: "workers", aggregation: "additive" },
    B08134_002E: { name: "Workers: Car, Truck, or Van", unit: "workers", aggregation: "additive" },
    B08134_003E: { name: "Workers: Public Transportation", unit: "workers", aggregation: "additive" },
    B08201_001E: { name: "Households by Vehicle Availability", unit: "households", aggregation: "additive" },
    B08301_001E: { name: "Means of Transportation to Work", unit: "workers", aggregation: "additive" },
    B01002_001E: { name: "Median Age", unit: "years", aggregation: "median" }
  };

  const groups = [
    {
      name: "Core Demographics",
      presets: [
        { id: "population_profile", name: "Population Profile", description: "Total, male, and female population.", columns: ["B01003_001E", "B01001_002E", "B01001_026E"] },
        { id: "population_and_age", name: "Population and Age", description: "Population with median age.", columns: ["B01003_001E", "B01002_001E"] }
      ]
    },
    {
      name: "Economic",
      presets: [
        { id: "income_profile", name: "Income Profile", description: "Household and per-capita income.", columns: ["B19013_001E", "B19301_001E"] },
        { id: "labor_and_poverty", name: "Labor Force and Poverty", description: "Labor-force and poverty counts.", columns: ["B23025_003E", "B17001_002E"] }
      ]
    },
    {
      name: "Housing",
      presets: [
        { id: "housing_occupancy", name: "Housing Occupancy", description: "Total, occupied, and vacant housing units.", columns: ["B25001_001E", "B25002_002E", "B25002_003E"] },
        { id: "housing_tenure", name: "Housing Tenure", description: "Owner- and renter-occupied housing units.", columns: ["B25003_002E", "B25003_003E"] },
        { id: "housing_costs", name: "Housing Costs", description: "Median home value and gross rent.", columns: ["B25077_001E", "B25064_001E"] }
      ]
    },
    {
      name: "Transportation",
      presets: [
        { id: "commute_mode_profile", name: "Commute Mode Profile", description: "Total workers plus auto and transit commuters.", columns: ["B08134_001E", "B08134_002E", "B08134_003E"] },
        { id: "vehicles_and_commute", name: "Vehicles and Commute", description: "Vehicle availability and transportation-to-work tables.", columns: ["B08201_001E", "B08301_001E"] }
      ]
    }
  ];

  const variableName = id => variables[id]?.name || id;
  const metadata = id => variables[id] || { name: id, unit: "", aggregation: "unknown" };
  const allVariableIds = () => [...new Set(groups.flatMap(group => group.presets.flatMap(preset => preset.columns)))];
  const preset = id => groups.flatMap(group => group.presets).find(item => item.id === id) || null;
  const friendlyHeader = id => variables[id] ? `${variables[id].name} (${id})` : id;

  return { variables, groups, variableName, metadata, allVariableIds, preset, friendlyHeader };
})();

// Backward-compatible aliases used by the existing codebase.
const tableFriendlyNames = Object.fromEntries(
  Object.entries(PrettyCensusLibrary.variables).map(([id, item]) => [id, item.name])
);
const presetGroups = PrettyCensusLibrary.groups;
