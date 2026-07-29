/** PrettyCensus application bootstrap. */

document.addEventListener("DOMContentLoaded", () => {
  renderPresetCheckboxesGrouped();
  populateStateDropdown();
  wireEvents();
  syncState();
  syncCounty();
  syncTract();
  syncBlockGroup();
  updateSelectedTablesFromUI();
  resetAvailabilityUI();
});
