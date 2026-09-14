/** Light/dark theme toggle with saved browser preference. */
(function(){
  'use strict';
  const STORAGE_KEY='prettyCensusTheme';
  function preferredTheme(){
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved==='light'||saved==='dark')return saved;
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  }
  function applyTheme(theme,control){
    document.documentElement.dataset.theme=theme;
    if(control){control.checked=theme==='dark';control.setAttribute('aria-checked',String(theme==='dark'));}
    const mapStyle=theme==='dark'?'mapbox://styles/mapbox/dark-v11':'mapbox://styles/mapbox/light-v11';
    window.dispatchEvent(new CustomEvent('prettycensus:themechange',{detail:{theme,mapStyle}}));
  }
  function init(){
    const header=document.querySelector('header');
    if(!header)return;
    const wrap=document.createElement('div');wrap.className='theme-switch-wrap';
    const light=document.createElement('span');light.className='theme-label';light.textContent='Light';
    const label=document.createElement('label');label.className='theme-switch';label.title='Toggle light and dark theme';
    const input=document.createElement('input');input.id='themeToggle';input.type='checkbox';input.setAttribute('role','switch');input.setAttribute('aria-label','Use dark red and black theme');
    const slider=document.createElement('span');slider.className='theme-slider';label.append(input,slider);
    const dark=document.createElement('span');dark.className='theme-label';dark.textContent='Dark';wrap.append(light,label,dark);header.append(wrap);
    const theme=preferredTheme();applyTheme(theme,input);
    input.addEventListener('change',()=>{const next=input.checked?'dark':'light';localStorage.setItem(STORAGE_KEY,next);applyTheme(next,input);});
  }
  const initial=preferredTheme();document.documentElement.dataset.theme=initial;
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
