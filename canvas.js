import { setupReadAloud } from './read-aloud.js';
import { setupOutputRevision, setupContextButtons } from './output-revision.js';
import { setupTranslation } from './canvas-translation.js';
import { setupSpeechInput } from './speech-input.js';
import { copy } from './canvas-i18n.js';

const $ = id => document.getElementById(id);
const categories = {humor:'categoryHumor', slang:'categorySlang', tone:'categoryTone', culture:'categoryCulture', format:'categoryFormat', general:'categoryGeneral'};
let storage, language = 'en', habits = [], key = '', model = 'openrouter/auto';
try { storage = localStorage; } catch { storage = null; }
try {
  language = storage?.getItem('nuancebridge.canvas.language') === 'zh' ? 'zh' : 'en';
  const saved = JSON.parse(storage?.getItem('nuancebridge.canvas.habits') || '[]');
  habits = Array.isArray(saved) ? saved.map(value => ({
    rule:typeof value === 'string' ? value : value?.rule,
    category:Object.hasOwn(categories,value?.category) ? value.category : 'general',
  })).filter(({rule}) => typeof rule === 'string' && rule.trim() && rule.length <= 400).slice(0,12) : [];
} catch { /* Keep writing usable when storage is unavailable. */ }
const t = name => copy[language][name] || copy.en[name] || name;
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const updateContextButtons = setupContextButtons();
let outputRevision, voice, readAloud;
const connect = () => { outputRevision?.close(); $('connection').showModal(); $('canvas-key').focus(); };
const translationTools = setupTranslation({t, connection:()=>({apiKey:key,model,hosted:!key}),
  preferences:()=>habits.map(({rule})=>rule), connect, onOutputChange:()=>{outputRevision?.close(); readAloud?.stop();},
});
outputRevision = setupOutputRevision({t, connection:()=>({apiKey:key,model,hosted:!key}), connect,
  replace:(...args)=>translationTools.replace(...args),
});
voice = setupSpeechInput({t, beforeStart:()=>readAloud?.stop()});
readAloud = setupReadAloud({t, beforeSpeak:()=>voice.stop()});
function localize() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(node=>{node.textContent=t(node.dataset.i18n);});
  $('translation-source').placeholder = t('sourcePlaceholder');
  $('translation-output').ariaLabel = t('selectOutput');
  $('close-output-popover').ariaLabel = t('close');
  $('habit-input').placeholder = t('habitPlaceholder');
  document.querySelectorAll('[data-close].icon-button').forEach(node=>{node.ariaLabel=t('close');});
  $('skip-input').textContent = t($('memory-panel').hidden ? 'skipInput' : 'skipMemory');
  $('connect').textContent = t(key ? 'connected' : 'builtinSettings');
  translationTools.render(); updateContextButtons(); renderHabits(); renderSuggestions(); voice.render(); readAloud.render();
}
$('ui-language').value = language;
$('ui-language').addEventListener('change',()=>{
  language=$('ui-language').value;
  try {storage?.setItem('nuancebridge.canvas.language',language);} catch {}
  localize();
});
$('connect').addEventListener('click',connect);
$('connection-form').addEventListener('submit',event=>{
  event.preventDefault(); translationTools.cancel(); outputRevision.close();
  key=$('canvas-key').value.trim(); model=$('canvas-model').value.trim(); $('canvas-key').value='';
  $('connection').close(); $('connect').textContent=t(key?'connected':'builtinSettings');
});
$('disconnect').addEventListener('click',()=>{
  translationTools.cancel(); outputRevision.close(); key=''; $('canvas-key').value='';
  $('connection').close(); $('connect').textContent=t('builtinSettings');
});
document.querySelectorAll('[data-close]').forEach(node=>node.addEventListener('click',()=>$(node.dataset.close).close()));
function renderHabits() {
  const list = $('habit-list');
  list.replaceChildren();
  $('reset-habits').disabled = !habits.length;
  if (!habits.length) list.append(el('li', t('emptyMemory'), 'memory-card'));
  habits.forEach(({rule, category}, index) => {
    const item = el('li', undefined, 'memory-card');
    const remove = el('button', t('remove')); remove.type = 'button';
    remove.setAttribute('aria-label', `${t('remove')}: ${rule}`);
    remove.addEventListener('click', () => {
      habits.splice(index, 1); persistHabits('habitRemoved'); renderHabits(); $('habits-open').focus();
    });
    item.append(el('span', t(categories[category]), 'memory-badge'), el('p', rule), remove);
    list.append(item);
  });
}
function persistHabits(success) {
  translationTools.invalidate();
  let message = success;
  try { if (!storage) throw new Error(); storage.setItem('nuancebridge.canvas.habits', JSON.stringify(habits)); }
  catch { message = 'storageError'; }
  $('memory-status').textContent = t(message);
}
function openHabitDialog(rule = '', category = 'humor') {
  $('habit-input').value = rule;
  $('habit-category').value = category;
  $('habit-form-status').textContent = '';
  $('habits-dialog').showModal();
  (rule ? $('habit-input') : $('habit-category')).focus();
}
$('habits-open').addEventListener('click', () => openHabitDialog());
$('habit-form').addEventListener('submit', event => {
  event.preventDefault();
  const rule = $('habit-input').value.trim(), category = $('habit-category').value;
  if (!rule || !Object.hasOwn(categories, category)) return;
  if (habits.some(item => item.rule === rule && item.category === category)) {
    $('habit-form-status').textContent = t('duplicateHabit'); return;
  }
  if (habits.length >= 12) { $('habit-form-status').textContent = t('limit'); return; }
  habits.push({rule, category}); persistHabits('saved'); renderHabits(); $('habits-dialog').close();
});
$('reset-habits').addEventListener('click', () => {
  if (!habits.length || !confirm(t('confirmResetHabits'))) return;
  habits = []; persistHabits('habitsReset'); renderHabits(); $('habits-open').focus();
});
const workspaceTabs = [$('translator-tab'), $('memory-tab')];
function showWorkspace(index) {
  if (index === 1) { outputRevision?.close(); voice?.stop(); readAloud?.stop(); }
  $('translator-panel').hidden = index !== 0; $('memory-panel').hidden = index !== 1;
  $('skip-input').href = index === 0 ? '#translation-source' : '#habits-open';
  $('skip-input').textContent = t(index === 0 ? 'skipInput' : 'skipMemory');
  workspaceTabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(index === i)); tab.tabIndex = index === i ? 0 : -1;
  });
}
workspaceTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showWorkspace(index));
  tab.addEventListener('keydown', event => {
    const target = {ArrowLeft:1-index, ArrowRight:1-index, Home:0, End:1}[event.key];
    if (target === undefined) return;
    event.preventDefault(); showWorkspace(target); workspaceTabs[target].focus();
  });
});

$('habit-category').addEventListener('change',renderSuggestions);
function renderSuggestions() {
  const list = $('habit-suggestions'); list.replaceChildren();
  const names = {humor:['gentle','lol','dry'],slang:['emmm','lol','cool'],tone:['warm','direct','emoji'],
    culture:['idiom','mix'],format:['short','paragraph'],general:['emmm','lol','cool','emoji']};
  for (const name of names[$('habit-category').value] || names.general) {
    const button=el('button',t('starterLabel_'+name)); button.type='button';
    button.addEventListener('click',()=>{
      const input=$('habit-input'), rule=t('starterRule_'+name);
      const value=input.value.trim();
      if (!value.includes(rule)) {
        if ((value+(value?'\n':'')+rule).length>400) { $('habit-form-status').textContent=t('starterLimit'); return; }
        input.value=value+(value?'\n':'')+rule;
      }
      input.focus();
    });
    list.append(button);
  }
}
$('habits-open').addEventListener('click',renderSuggestions);
$('canvas-translation-form').addEventListener('submit',()=>voice.stop());
window.addEventListener('pagehide',()=>{
  voice.stop(); readAloud.stop(); translationTools.cancel(); outputRevision.close(); key=''; $('canvas-key').value='';
});
localize();
