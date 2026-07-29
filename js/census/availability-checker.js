/**
 * Preset table availability checks for the current year, dataset, and geography.
 * Auto-extracted from the original scripts.js to improve maintainability.
 */

function hasRequiredContextForAvailability(){if(!selectedYear||!selectedDataset||!geoLevel)return false;const p=new URLSearchParams();return geoParams(p);}

function scheduleAvailabilityCheck(){clearTimeout(availabilityDebounceTimer);availabilityDebounceTimer=setTimeout(checkTableAvailabilityForCurrentGeography,350);}

function setAvailabilityStatus(m,t){$("availabilityStatus").textContent=m;$("availabilityStatus").className=`availability-status ${t}`;}

function resetAvailabilityUI(){document.querySelectorAll(".table-card").forEach(card=>{card.classList.remove("available","unavailable","checking");const cb=card.querySelector(".presetCheckbox");if(cb)cb.disabled=false;const msg=card.querySelector(".table-card__message");if(msg)msg.textContent="";});setAvailabilityStatus("Select a year, dataset, and geography to check table availability.","muted");}

async function checkTableAvailabilityForCurrentGeography(){if(availabilityAbortController)availabilityAbortController.abort();if(!hasRequiredContextForAvailability()){resetAvailabilityUI();return;}availabilityAbortController=new AbortController();const signal=availabilityAbortController.signal;const ids=allPresetTableIds();setAvailabilityStatus("Checking table availability for selected geography...","checking");let ok=0,done=0;for(const id of ids){if(signal.aborted)return;const card=document.querySelector(`.table-card[data-table-id="${id}"]`),cb=card.querySelector(".presetCheckbox"),msg=card.querySelector(".table-card__message");card.classList.add("checking");try{const url=buildSingleTopicUrl(selectedYear,id);const r=await fetch(url,{signal});const avail=r.ok;card.classList.remove("checking");card.classList.toggle("available",avail);card.classList.toggle("unavailable",!avail);cb.disabled=!avail;if(!avail)cb.checked=false;msg.textContent=avail?"Available":"Not available for selected geography";if(avail)ok++;}catch(e){if(e.name==="AbortError")return;card.classList.remove("checking");card.classList.add("unavailable");cb.disabled=true;cb.checked=false;msg.textContent="Availability check failed";}done++;if(done%5===0)setAvailabilityStatus(`Checked ${done} of ${ids.length} tables...`,"checking");}updateSelectedTablesFromUI();setAvailabilityStatus(`${ok} of ${ids.length} preset tables are available for the selected geography.`,"success");}
