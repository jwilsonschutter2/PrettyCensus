/**
 * Modal and panel visibility helpers.
 * Auto-extracted from the original scripts.js to improve maintainability.
 */

function openModal(id){$(id).style.display="flex";$(id).setAttribute("aria-hidden","false");}

function closeModal(id){$(id).style.display="none";$(id).setAttribute("aria-hidden","true");}

function togglePanel(id){const p=$(id);p.style.display=(p.style.display==="none"||!p.style.display)?"block":"none";}

function hidePanel(id){$(id).style.display="none";}
