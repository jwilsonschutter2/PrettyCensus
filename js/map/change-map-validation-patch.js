/**
 * Load after js/map/change-map.js.
 * Updates QA output and blocks only true eligible-value conservation failures.
 */
(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "No data";
  }

  window.PrettyCensusChangeValidation = {
    validate(summary, method) {
      if (!summary) return { ok: false, message: "No validation summary was returned." };
      const error = Number(summary.allocationError) || 0;
      if (method !== "exact" && error > 0.01) {
        return {
          ok: false,
          message: `Eligible allocated totals differ by ${(error * 100).toFixed(2)}%, above the 1% conservation limit.`
        };
      }
      return { ok: true, message: "Allocation conservation passed." };
    },

    render(summary) {
      const node = byId("changeMapQa");
      if (!node || !summary) return;
      const conservation = (Number(summary.allocationError) || 0) * 100;
      const excluded = (Number(summary.excludedSourceShare) || 0) * 100;
      const status = conservation <= 1 ? "Allocation passed" : "Allocation failed";
      node.innerHTML = `
        <strong>${status}</strong><br>
        Direct relationships: ${summary.direct || 0}<br>
        Same-GEOID relationships with changed geometry: ${summary.directGeometryChanged || 0}<br>
        Renumbered one-to-one: ${summary.renumbered || 0}<br>
        Splits: ${summary.splits || 0}<br>
        Mergers: ${summary.merges || 0}<br>
        Complex relationships: ${summary.complex || 0}<br>
        Excluded source features: ${summary.unmatchedSources || 0}<br>
        Unmatched target features: ${summary.unmatchedTargets || 0}<br>
        Excluded slivers: ${summary.sliversExcluded || 0}<br>
        Intersection errors: ${summary.intersectionErrors || 0}<br>
        Full earlier-year total: ${formatNumber(summary.originalTotal)}<br>
        Eligible earlier-year total: ${formatNumber(summary.eligibleSourceTotal)}<br>
        Allocated total: ${formatNumber(summary.allocatedTotal)}<br>
        Allocation conservation error: ${conservation.toFixed(4)}%<br>
        Source value excluded for inadequate coverage: ${excluded.toFixed(2)}%
      `;
      node.classList.toggle("validation-warning", excluded > 5);
    }
  };
})();
