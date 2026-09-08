/** Static, mutually exclusive Run workflow controller. */
(function () {
  "use strict";
  const panelIds = ["fetchWorkflowPanel", "comparisonPanel", "mappingPanel", "changeMapPanel"];
  function setOpen(panelId, open) {
    const panel = document.getElementById(panelId);
    const trigger = document.querySelector(`[aria-controls="${panelId}"]`);
    if (panel) panel.hidden = !open;
    if (trigger) trigger.setAttribute("aria-expanded", String(open));
  }
  function toggle(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const opening = panel.hidden;
    panelIds.forEach(id => setOpen(id, id === panelId && opening));
    if (!opening) return;
    if (panelId === "comparisonPanel" && typeof populateComparisonTopicOptions === "function") populateComparisonTopicOptions();
    if (panelId === "changeMapPanel" && typeof window.populateChangeMapVariables === "function") window.populateChangeMapVariables();
    setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
  }
  document.addEventListener("click", event => {
    const close = event.target.closest("[data-close-panel]");
    if (close) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(close.dataset.closePanel, false);
      return;
    }
    const trigger = event.target.closest(".workflow-toggle[aria-controls]");
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggle(trigger.getAttribute("aria-controls"));
  }, true);
  document.addEventListener("DOMContentLoaded", () => panelIds.forEach(id => setOpen(id, false)));
})();
