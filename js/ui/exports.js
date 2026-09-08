/**
 * CSV export helpers and export filename builders.
 * Auto-extracted from the original scripts.js to improve maintainability.
 */

function currentRowsAsObjects(){return apiArrayToObjects(currentFetchedData);}

function suggestCurrentCsvName(){return `census_${selectedDataset.replaceAll('/','_')}_${selectedYear}_${geoLevel}.csv`;}

function suggestComparisonCsvName(){return `comparison_${selectedDataset.replaceAll('/','_')}_${$("comparisonYearSelect").value}_to_${selectedYear}_${geoLevel}.csv`;}

function exportRowsToCsv(rows,filename){if(!rows||!rows.length)return;const headers=Object.keys(rows[0]);const csv=[headers.join(","),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(","))].join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove();}

function downloadGeoJson(featureCollection,filename){if(!featureCollection||featureCollection.type!=="FeatureCollection")return;const blob=new Blob([JSON.stringify(featureCollection,null,2)],{type:"application/geo+json;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);a.remove();}
