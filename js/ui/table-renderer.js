/** Friendly-name HTML table rendering. */
function rowsToHtmlTable(rows){if(!rows.length)return'<p class="hint">No data returned.</p>';const headers=Object.keys(rows[0]);let html='<table class="data-table"><thead><tr>'+headers.map(header=>`<th>${escapeHtml(header)}</th>`).join('')+'</tr></thead><tbody>';rows.forEach(row=>{html+='<tr>'+headers.map(header=>`<td>${escapeHtml(formatCell(row[header]))}</td>`).join('')+'</tr>';});return html+'</tbody></table>';}
function convertJSONToTable(data){return rowsToHtmlTable(PrettyCensusExports.friendlyRows(apiArrayToObjects(data)));}
