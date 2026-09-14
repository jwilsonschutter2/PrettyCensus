/** Friendly-name decoration for table, JSON, CSV, and GeoJSON outputs. */
window.PrettyCensusExports = (()=>{
  "use strict";
  const label=id=>PrettyCensusLibrary?.variableName(id)||id;
  function friendlyRows(rows){
    return rows.map(row=>{
      const output={};
      Object.entries(row).forEach(([key,value])=>{output[PrettyCensusLibrary.friendlyHeader(key)]=value;});
      return output;
    });
  }
  function decorateGeoJson(featureCollection,variableIds){
    const ids=Array.isArray(variableIds)?variableIds.filter(Boolean):[];
    featureCollection.features.forEach(feature=>{
      const properties=feature.properties||(feature.properties={});
      properties.__variable_ids=ids.join("|");
      properties.__variable_names=ids.map(label).join("|");
      ids.forEach(id=>{
        if(Object.prototype.hasOwnProperty.call(properties,id)) properties[label(id)]=properties[id];
      });
      if(properties.__value!==undefined&&ids.length===1){
        properties.__value_name=label(ids[0]);
        properties[label(ids[0])]=properties.__value;
      }
      if(properties.__earlier_harmonized!==undefined&&ids.length===1){
        properties.__change_variable_id=ids[0];
        properties.__change_variable_name=label(ids[0]);
      }
    });
    return featureCollection;
  }
  return { label, friendlyRows, decorateGeoJson };
})();
