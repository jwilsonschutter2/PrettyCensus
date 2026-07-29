/**
 * Reusable HTML table rendering helpers.
 * Auto-extracted from the original scripts.js to improve maintainability.
 */

function rowsToHtmlTable(rows){if(!rows.length)return"<p>No comparison data returned.</p>";const headers=Object.keys(rows[0]);let html="<table class='data-table'><thead><tr>"+headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")+"</tr></thead><tbody>";rows.forEach(r=>{html+="<tr>"+headers.map(h=>`<td>${escapeHtml(formatCell(r[h]))}</td>`).join("")+"</tr>";});return html+"</tbody></table>";}

function convertJSONToTable(data){return rowsToHtmlTable(apiArrayToObjects(data).map(r=>{const out={};Object.keys(r).forEach(k=>out[tableFriendlyNames[k]?`${tableFriendlyNames[k]} (${k})`:k]=r[k]);return out;}));}
