/** Reload active Mapbox styles when the site theme changes. */
window.addEventListener('prettycensus:themechange',event=>{
  document.documentElement.style.colorScheme=event.detail.theme;
});
