/**
 * Census API URL construction, fetch, and response normalization helpers.
 * Auto-extracted from the original scripts.js to improve maintainability.
 */

function geoParams(params){if(geoLevel==="state"){if(!selectedState)return false;params.set("for",`state:${selectedState}`);}else if(geoLevel==="county"){if(!selectedState||selectedState==="*"||!selectedCounty)return false;params.set("for",`county:${selectedCounty}`);params.set("in",`state:${selectedState}`);}else if(geoLevel==="tract"){if(!selectedState||selectedState==="*"||!selectedCounty||selectedCounty==="*")return false;params.set("for",`tract:${selectedTract||"*"}`);params.set("in",`state:${selectedState} county:${selectedCounty}`);}else if(geoLevel==="blockgroup"){if(!selectedState||selectedState==="*"||!selectedCounty||selectedCounty==="*")return false;params.set("for",`block group:${selectedBlockGroup||"*"}`);params.set("in",`state:${selectedState} county:${selectedCounty} tract:${selectedTract||"*"}`);}else return false;return true;}

function buildCensusURL(opts={}){if(!apiKey||!selectedYear||!selectedDataset||!selectedTables.length||!geoLevel){alert("Missing required fields: API key, year, dataset, tables, and geography level.");return"";}const p=new URLSearchParams();p.set("get",selectedTables.join(","));if(!geoParams(p)){alert("Check geography selections.");return"";}if((opts.outputFormat||"csv")==="csv")p.set("outputFormat","csv");p.set("key",apiKey);return`https://api.census.gov/data/${selectedYear}/${selectedDataset}?${p.toString()}`;}

function buildSingleTopicUrl(year,topic){if(!year||!selectedDataset||!geoLevel)return"";const p=new URLSearchParams();p.set("get",`NAME,${topic}`);if(!geoParams(p))return"";if(apiKey)p.set("key",apiKey);return`https://api.census.gov/data/${year}/${selectedDataset}?${p.toString()}`;}

async function fetchJsonAndDisplay(){const url=buildCensusURL({outputFormat:"json"});if(!url)return;const jsonUrl=url.replace(/&?outputFormat=csv/,"");try{const r=await fetch(jsonUrl);const d=await r.json();currentFetchedData=d;currentFetchedHeaders=Array.isArray(d)?d[0]:null;$("jsonTableContainer").innerHTML=convertJSONToTable(d);$("exportCurrentCsvBtn").disabled=false;}catch(e){$("jsonTableContainer").innerHTML="<p class='error-text'>Error fetching JSON.</p>";$("exportCurrentCsvBtn").disabled=true;}}

function apiArrayToObjects(data){if(!Array.isArray(data)||data.length<2)return[];const [headers,...rows]=data;return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));}
