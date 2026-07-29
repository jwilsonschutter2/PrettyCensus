/**
 * Geography form controls and dependent county loading behavior.
 * Auto-extracted from the original scripts.js to improve maintainability.
 */

function populateStateDropdown(){const s=$("stateSelect");STATE_FIPS.forEach(st=>{const o=document.createElement("option");o.value=st.fips;o.textContent=`${st.name} (${st.fips})`;s.appendChild(o);});}

function handleGeoLevelChange(){geoLevel=this.value;$("stateOptions").style.display=["state","county","tract","blockgroup"].includes(geoLevel)?"block":"none";$("countyOptions").style.display=["county","tract","blockgroup"].includes(geoLevel)?"block":"none";$("tractOptions").style.display=geoLevel==="tract"?"block":"none";$("blockGroupOptions").style.display=geoLevel==="blockgroup"?"block":"none";scheduleAvailabilityCheck();}

async function handleStateSelectChange(){selectedState=this.value;$("stateInput").value=selectedState;selectedCounty="";$("countyInput").value="";resetCountyDropdown("-- Loading Counties --");syncState();if(!selectedState||selectedState==="*"){resetCountyDropdown("-- Select State First --");scheduleAvailabilityCheck();return;}await loadCountiesForSelectedState();scheduleAvailabilityCheck();}

function handleCountySelectChange(){selectedCounty=this.value;$("countyInput").value=selectedCounty;if(selectedCounty){$("allTractsCheckbox").checked=true;$("allBlockGroupsCheckbox").checked=true;selectedTract="*";selectedBlockGroup="*";}syncCounty();syncTract();syncBlockGroup();scheduleAvailabilityCheck();}

function syncState(){const all=$("allStatesCheckbox").checked;$("stateSelect").disabled=all;selectedState=all?"*":$("stateSelect").value;$("stateInput").value=selectedState;}

function syncCounty(){const all=$("allCountiesCheckbox").checked;$("countySelect").disabled=all||!selectedState||selectedState==="*";selectedCounty=all?"*":$("countySelect").value;$("countyInput").value=selectedCounty;}

function syncTract(){selectedTract=$("allTractsCheckbox").checked?"*":digitsOnly($("tractInput").value).slice(0,6);$("tractInput").disabled=$("allTractsCheckbox").checked;}

function syncBlockGroup(){selectedBlockGroup=$("allBlockGroupsCheckbox").checked?"*":digitsOnly($("blockGroupInput").value).slice(0,1);$("blockGroupInput").disabled=$("allBlockGroupsCheckbox").checked;}

function resetCountyDropdown(label){$("countySelect").innerHTML=`<option value="">${label}</option>`;$("countySelect").disabled=true;}

async function reloadCountiesIfStateSelected(){if(selectedState&&selectedState!=="*"&&["county","tract","blockgroup"].includes(geoLevel))await loadCountiesForSelectedState();}

async function loadCountiesForSelectedState(){try{$("countyStatus").textContent="Loading counties...";const counties=await loadCountyFipsFromCensus({year:selectedYear||"2024",dataset:selectedDataset||"acs/acs5",stateFips:selectedState,apiKey});const c=$("countySelect");c.innerHTML="<option value=''>-- Select County --</option>";counties.forEach(co=>{const o=document.createElement("option");o.value=co.fips;o.textContent=`${co.name} (${co.fips})`;c.appendChild(o);});c.disabled=false;$("countyStatus").textContent=`Loaded ${counties.length} counties for ${getStateNameFromFips(selectedState)}.`;}catch(e){resetCountyDropdown("-- County Lookup Failed --");$("countyStatus").textContent="Could not load counties for this year/dataset.";}}
