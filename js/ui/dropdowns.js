/** Multi-column preset-library rendering and selection behavior. */
function wireDropdownEvents(){
  const dd=$("presetDropdown"),toggle=$("presetDropdownToggle"),menu=$("presetDropdownMenu");
  toggle.addEventListener("click",event=>{event.stopPropagation();dd.classList.toggle("open");});
  menu.addEventListener("click",event=>event.stopPropagation());
  document.addEventListener("click",()=>dd.classList.remove("open"));
  menu.addEventListener("change",event=>{if(event.target.classList.contains("presetCheckbox"))updateSelectedTablesFromUI();});
  $("presetSelectAll").addEventListener("click",()=>{document.querySelectorAll(".presetCheckbox:not(:disabled)").forEach(box=>box.checked=true);updateSelectedTablesFromUI();});
  $("presetClearAll").addEventListener("click",()=>{document.querySelectorAll(".presetCheckbox").forEach(box=>box.checked=false);updateSelectedTablesFromUI();});
  $("tableInput").addEventListener("input",updateSelectedTablesFromUI);
  $("tableSearch").addEventListener("input",function(){const term=this.value.toLowerCase().trim();document.querySelectorAll(".table-card").forEach(card=>card.style.display=card.innerText.toLowerCase().includes(term)?"":"none");});
}

function renderPresetCheckboxesGrouped(){
  const list=$("presetCheckboxList");
  list.innerHTML="";
  PrettyCensusLibrary.groups.forEach(group=>{
    const wrap=document.createElement("div");wrap.className="checkbox-group";
    const heading=document.createElement("div");heading.className="checkbox-group__title";heading.textContent=group.name;wrap.appendChild(heading);
    group.presets.forEach(preset=>{
      const label=document.createElement("label");label.className="table-card";label.dataset.presetId=preset.id;label.setAttribute("for",`preset_${preset.id}`);
      label.innerHTML=`<input id="preset_${escapeHtml(preset.id)}" class="presetCheckbox" type="checkbox" value="${escapeHtml(preset.id)}">
        <span><span class="table-card__title">${escapeHtml(preset.name)}</span>
        <span class="table-card__id">${preset.columns.length} columns: ${preset.columns.map(PrettyCensusLibrary.friendlyHeader).map(escapeHtml).join("; ")}</span>
        <span class="table-card__message">${escapeHtml(preset.description||"")}</span></span>`;
      wrap.appendChild(label);
    });
    list.appendChild(wrap);
  });
}

function selectedPresetColumns(){
  return Array.from(document.querySelectorAll(".presetCheckbox:checked"))
    .flatMap(box=>PrettyCensusLibrary.preset(box.value)?.columns||[]);
}

function updateSelectedTablesFromUI(){
  const presetColumns=selectedPresetColumns();
  const custom=$("tableInput").value.trim()?$("tableInput").value.trim().split(/[\s,]+/):[];
  selectedTables=[...new Set([...presetColumns,...custom].filter(Boolean))];
  const presetCount=document.querySelectorAll(".presetCheckbox:checked").length;
  $("presetDropdownToggle").childNodes[0].nodeValue=presetCount
    ?` ${presetCount} preset${presetCount===1?"":"s"} selected (${selectedTables.length} columns) `
    :" Select pre-set tables ";
}
