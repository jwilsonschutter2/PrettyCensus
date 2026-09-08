/**
 * CSV export helpers and export filename builders.
 * Auto-extracted from the original scripts.js to improve maintainability.
 */

function currentRowsAsObjects(){return apiArrayToObjects(currentFetchedData);}

function suggestCurrentCsvName(){return `census_${selectedDataset.replaceAll('/','_')}_${selectedYear}_${geoLevel}.csv`;}

function suggestComparisonCsvName(){return `comparison_${selectedDataset.replaceAll('/','_')}_${$("comparisonYearSelect").value}_to_${selectedYear}_${geoLevel}.csv`;}

function downloadBlob(content,filename,mimeType){const blob=content instanceof Blob?content:new Blob([content],{type:mimeType});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}
function exportRowsToCsv(rows,filename){if(!rows||!rows.length)return;const headers=Object.keys(rows[0]);const csv=[headers.map(csvEscape).join(","),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(","))].join("\n");downloadBlob(csv,filename,"text/csv;charset=utf-8");}
function downloadGeoJson(featureCollection,filename){if(!featureCollection||featureCollection.type!=="FeatureCollection")return;downloadBlob(JSON.stringify(featureCollection,null,2),filename,"application/geo+json;charset=utf-8");}
