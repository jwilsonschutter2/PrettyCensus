/**
 * Small formatting, parsing, and conversion helpers.
 * Auto-extracted from the original scripts.js to improve maintainability.
 */

function digitsOnly(s){return(s||"").replace(/\D+/g,"");}

function allPresetTableIds(){return Array.from(new Set(presetGroups.flatMap(g=>g.items)));}

function escapeHtml(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

function toNumberOrBlank(v){if(v===undefined||v===null||v==="")return"";const n=Number(v);return Number.isFinite(n)?n:v;}

function formatCell(v){return typeof v==="number"?Number.isInteger(v)?String(v):v.toFixed(2):v;}

function csvEscape(v){const s=v===null||v===undefined?"":String(v);return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
