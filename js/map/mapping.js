/** Mapping panel behavior and future Mapbox integration hooks. */

// Separate placeholder for future Mapbox GL JS logic.
(function(){function $(id){return document.getElementById(id)}document.addEventListener("DOMContentLoaded",()=>{const btn=$("mappingOptionBtn"),panel=$("mappingPanel"),close=$("closeMappingPanelBtn");if(btn&&panel){btn.addEventListener("click",()=>{panel.style.display=(panel.style.display==="none"||!panel.style.display)?"block":"none";});}if(close&&panel)close.addEventListener("click",()=>panel.style.display="none");});})();
