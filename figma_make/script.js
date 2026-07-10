"use strict";

const supabaseClient = window.supabase?.createClient ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) : null;
const BALANCE_TABLE = CONFIG.tableName;
const MY_BALANCE_TABLE = CONFIG.viewTableName;

const TEXT = Object.freeze({
  entity: "\uac1c \uc5d4\ud2f0\ud2f0", allTypes: "\uc804\uccb4 \ud0c0\uc785", empty: "\uc870\uac74\uc5d0 \ub9de\ub294 \ubaac\uc2a4\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
  created: "\uc0dd\uc131", updated: "\uc218\uc815", remove: "\uc0ad\uc81c", clearConfirm: "\ubaa8\ub4e0 \ubaac\uc2a4\ud130\ub97c \uc0ad\uc81c\ud560\uae4c\uc694?",
  difficulty: { easy: "\uc26c\uc6c0", normal: "\ubcf4\ud1b5", hard: "\uc5b4\ub824\uc6c0", boss: "\ubcf4\uc2a4" }
});

const byId = id => document.getElementById(id);
const cloneSeed = () => CONFIG.seedMonsters.map(monster => ({ ...monster }));
let monsters = cloneSeed();
let deletedMonsters = [];
let editingTrashId = null;
let editingMonsterId = null;

const elements = {
  list: byId("monsterList"), search: byId("searchInput"), difficulty: byId("difficultyFilter"), type: byId("typeFilter"), sort: byId("sortOrder"),
  dialog: byId("monsterDialog"), form: byId("monsterForm"), trashDialog: byId("trashDialog"), trashList: byId("trashList")
};
const entityTooltip = byId("entityTooltip");
const naturalCollator = new Intl.Collator(["ko", "en"], { numeric: true, sensitivity: "base" });
let savedBalances = [];
let currentBalanceId = null;

async function loadSavedBalances() {
  if (!supabaseClient) return false;
  let { data, error } = await supabaseClient.from(MY_BALANCE_TABLE).select("id,title,memo,state,created_at").order("created_at", { ascending: true });
  if (error && /state|column/i.test(error.message || "")) {
    const fallback = await supabaseClient.from(MY_BALANCE_TABLE).select("id,title,memo,created_at").order("created_at", { ascending: true });
    data = fallback.data; error = fallback.error;
  }
  if (error) { console.error("My Balance load failed", error); return false; }
  savedBalances = (data || []).map(row => ({ id: row.id, name: row.title, memo: row.memo || "", state: row.state || {}, created_at: row.created_at }));
  renderSavedBalances();
  return true;
}

function fromDatabase(row) {
  const created = row.created_at ? String(row.created_at).slice(0, 10) : "-";
  const updated = row.updated_at ? String(row.updated_at).slice(0, 10) : created;
  return { id: row.id, balanceId: row.balance_id, name: row.name, type: row.type || "\uae30\ud0c0", difficulty: row.difficulty || "normal", hp: Number(row.hp || 1), speed: Number(row.speed || 0), attack: Number(row.damage || 0), defense: Number(row.defense || 0), xp: Number(row.xp_reward || 0), spawn: Number(row.spawn_rate || 0) * 100, notes: row.note || "", created, updated, deletedAt: row.deleted_at };
}

function toDatabase(monster) {
  return { name: monster.name, type: monster.type, difficulty: monster.difficulty, hp: monster.hp, speed: monster.speed, damage: monster.attack, defense: monster.defense, xp_reward: monster.xp, spawn_rate: monster.spawn / 100, note: monster.notes, updated_at: new Date().toISOString() };
}

function showDatabaseError(action, error) {
  console.error(`Supabase ${action} failed`, error);
  window.alert(`${action}\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.\n${error?.message || ""}`);
}

async function loadBalances() {
  if (!supabaseClient || !currentBalanceId) return;
  let { data, error } = await supabaseClient.from(BALANCE_TABLE).select("*").eq("balance_id", currentBalanceId).order("created_at", { ascending: true });
  if (error && /created_at|column/i.test(error.message || "")) {
    const fallback = await supabaseClient.from(BALANCE_TABLE).select("*").eq("balance_id", currentBalanceId);
    data = fallback.data; error = fallback.error;
  }
  if (error) { showDatabaseError("\ubaa9\ub85d \ubd88\ub7ec\uc624\uae30", error); return; }
  const rows = (data || []).map(fromDatabase);
  monsters = rows.filter(monster => !monster.deletedAt);
  deletedMonsters = rows.filter(monster => monster.deletedAt).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  render();
  if (document.body.classList.contains("trash-mode")) renderTrashPage();
}

async function initializeApp() {
  if (!supabaseClient) { console.error("Supabase SDK was not loaded. Showing local fallback data."); render(); return; }
  const loaded = await loadSavedBalances();
  if (!loaded) return;
  if (!savedBalances.length) {
    let { data, error } = await supabaseClient.from(MY_BALANCE_TABLE).insert({ title: "\uae30\ubcf8 Balance", memo: "\uae30\ubcf8 \ubc38\ub7f0\uc2a4", state: currentBalanceState() }).select("id").single();
    if (error && /state|column/i.test(error.message || "")) {
      const fallback = await supabaseClient.from(MY_BALANCE_TABLE).insert({ title: "\uae30\ubcf8 Balance", memo: "\uae30\ubcf8 \ubc38\ub7f0\uc2a4" }).select("id").single();
      data = fallback.data; error = fallback.error;
    }
    if (error) { showDatabaseError("\uae30\ubcf8 Balance \uc0dd\uc131", error); return; }
    currentBalanceId = data.id;
    await loadSavedBalances();
  } else currentBalanceId = savedBalances[0].id;
  await loadBalances();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function statCell(value, maximum, className, suffix = "") {
  const width = Math.min(100, Math.max(0, Number(value) / maximum * 100));
  return `<div class="stat ${className}"><span>${escapeHtml(value)}${suffix}</span><span class="stat-track"><i class="stat-fill" style="width:${width}%"></i></span></div>`;
}

const typeColors = new Map();
const PAGE_BACKGROUND = "#0d0f12";

function randomHexColor() {
  return `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0")}`;
}

function rgb(hex) {
  return [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
}

function luminance(hex) {
  const channels = rgb(hex).map(channel => { const value = channel / 255; return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
  const bright = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (bright + 0.05) / (dark + 0.05);
}

function createAccessibleTypeColor() {
  const lightText = "#f7f9fc";
  const darkText = "#101318";
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const background = randomHexColor();
    if (contrast(background, PAGE_BACKGROUND) < 1.65) continue;
    const lightContrast = contrast(background, lightText);
    const darkContrast = contrast(background, darkText);
    const color = lightContrast >= darkContrast ? lightText : darkText;
    if (Math.max(lightContrast, darkContrast) >= 4.5) {
      for (let accentAttempt = 0; accentAttempt < 200; accentAttempt += 1) {
        const accent = randomHexColor();
        if (contrast(accent, PAGE_BACKGROUND) < 1.65 || contrast(accent, color) < 4.5 || contrast(accent, background) < 1.15) continue;
        return { background, accent, color };
      }
    }
  }
  return { background: "#16384a", accent: "#245f73", color: "#f7f9fc" };
}

function typeTagStyle(type) {
  if (!typeColors.has(type)) typeColors.set(type, createAccessibleTypeColor());
  const { background, accent, color } = typeColors.get(type);
  return `background:linear-gradient(135deg,${background} 42%,${accent});color:${color};border:1px solid ${color}`;
}

function renderRow(monster) {
  return `<article class="column-grid monster-row" data-id="${monster.id}">
    <div class="identity"><strong>${escapeHtml(monster.name)}</strong><span class="type-tag" style="${typeTagStyle(monster.type)}">${escapeHtml(monster.type)}</span></div>
    <div><span class="difficulty difficulty-${monster.difficulty}">${TEXT.difficulty[monster.difficulty]}</span></div>
    ${statCell(monster.hp, 1000, "hp")}${statCell(monster.speed, 10, "speed")}${statCell(monster.attack, 300, "attack")}${statCell(monster.spawn, 100, "spawn", "%")}
    <div class="date-cell"><span><small>${TEXT.created}</small>${monster.created}</span><span><small>${TEXT.updated}</small>${monster.updated}</span></div>
    <div class="main-actions"><button class="row-edit action-swap" type="button" data-edit="${monster.id}" aria-label="\uc218\uc815"><span class="action-icon">&#9998;</span><span class="action-label">\uc218\uc815</span></button><button class="row-delete action-swap" type="button" data-delete="${monster.id}" aria-label="${TEXT.remove}"><span class="action-icon">&#128465;</span><span class="action-label">\uc0ad\uc81c</span></button></div>
  </article>`;
}

function tooltipStat(label, value, maximum, color, suffix = "") {
  const width = Math.min(100, Math.max(0, Number(value) / maximum * 100));
  return `<div class="tooltip-stat"><div class="tooltip-stat-label"><span>${label}</span><strong>${value}${suffix}</strong></div><div class="tooltip-track"><i style="width:${width}%;background:${color}"></i></div></div>`;
}

function closeEntityTooltip() { entityTooltip.classList.remove("open"); }

function openEntityTooltip(monster, row) {
  entityTooltip.innerHTML = `<div class="tooltip-head"><h3>${escapeHtml(monster.name)}</h3><button class="tooltip-close" aria-label="close">&times;</button><div class="tooltip-badges"><span class="difficulty difficulty-${monster.difficulty}">${TEXT.difficulty[monster.difficulty]}</span><span class="type-tag" style="${typeTagStyle(monster.type)}">${escapeHtml(monster.type)}</span></div></div><div class="tooltip-body">${tooltipStat("\uccb4\ub825",monster.hp,1000,"#fb64b6")}${tooltipStat("\uc774\ub3d9 \uc18d\ub3c4 (m/s)",monster.speed,10,"#00d3f3")}${tooltipStat("\uacf5\uaca9\ub825",monster.attack,300,"#ff6467")}${tooltipStat("\ubc29\uc5b4\ub825",monster.defense ?? 5,100,"#8b9cff")}${tooltipStat("\uc2a4\ud3f0\uc728",monster.spawn,100,"#ffb900","%")}${tooltipStat("\uacbd\ud5d8\uce58 \ubcf4\uc0c1",monster.xp ?? 40,1000,"#00d492")}<div class="tooltip-notes"><span>\uae30\ud68d \ub178\ud2b8</span><p>${escapeHtml(monster.notes || "\ub290\ub9b0 \uc774\ub3d9, \ub0ae\uc740 \ub370\ubbf8\uc9c0. \ud29c\ud1a0\ub9ac\uc5bc \uad6c\uc5ed\uc5d0 \uc801\ud569.")}</p></div><div class="tooltip-dates"><div><span>＋ \uc0dd\uc131\uc77c</span><strong>${monster.created}</strong></div><div><span>◷ \ucd5c\uc885 \uc218\uc815\uc77c</span><strong>${monster.updated}</strong></div></div><div class="tooltip-actions"><button class="tooltip-edit" data-tooltip-edit="${monster.id}">✎ &nbsp;\uc218\uc815</button><button class="tooltip-delete" data-tooltip-delete="${monster.id}">♜ &nbsp;\uc0ad\uc81c</button></div></div>`;
  entityTooltip.classList.add("open");
  const rect = row.getBoundingClientRect();
  const left = Math.min(window.innerWidth - 282, Math.max(8, rect.right - 270));
  const top = Math.min(window.innerHeight - entityTooltip.offsetHeight - 8, Math.max(8, rect.top));
  entityTooltip.style.left = `${left}px`; entityTooltip.style.top = `${top}px`;
}

function visibleMonsters() {
  const query = elements.search.value.trim().toLocaleLowerCase("ko");
  const filtered = monsters.filter(monster => (!query || `${monster.name} ${monster.type}`.toLocaleLowerCase("ko").includes(query)) && (!elements.difficulty.value || monster.difficulty === elements.difficulty.value) && (!elements.type.value || monster.type === elements.type.value));
  return filtered.sort((first, second) => {
    if (elements.sort.value === "name-desc") return naturalCollator.compare(second.name, first.name);
    if (elements.sort.value === "type-asc") return naturalCollator.compare(first.type, second.type) || naturalCollator.compare(first.name, second.name);
    if (elements.sort.value === "difficulty-asc") { const order = { easy: 0, normal: 1, hard: 2, boss: 3 }; return order[first.difficulty] - order[second.difficulty] || naturalCollator.compare(first.name, second.name); }
    if (elements.sort.value === "created-desc") return String(second.created).localeCompare(String(first.created));
    return naturalCollator.compare(first.name, second.name);
  });
}

function render() {
  const visible = visibleMonsters();
  elements.list.innerHTML = visible.length ? visible.map(renderRow).join("") : `<div class="empty-state">${TEXT.empty}</div>`;
  updateSummary();
}

function updateSummary() {
  const total = monsters.length;
  byId("entityCount").textContent = `${total}${TEXT.entity}`;
  byId("easyMetric").textContent = monsters.filter(monster => monster.difficulty === "easy").length;
  byId("normalMetric").textContent = monsters.filter(monster => monster.difficulty === "normal").length;
  byId("hardMetric").textContent = monsters.filter(monster => monster.difficulty === "hard").length;
  byId("bossMetric").textContent = monsters.filter(monster => monster.difficulty === "boss").length;
  const selectedType = elements.type.value;
  const types = [...new Set(monsters.map(monster => monster.type))];
  elements.type.innerHTML = `<option value="">${TEXT.allTypes}</option>${types.map(type => `<option value="${escapeHtml(type)}"${type === selectedType ? " selected" : ""}>${escapeHtml(type)}</option>`).join("")}`;
}

elements.search.addEventListener("input", render);
elements.difficulty.addEventListener("change", render);
elements.type.addEventListener("change", render);
elements.sort.addEventListener("change", render);
elements.list.addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    const monster = monsters.find(item => item.id === editButton.dataset.edit);
    if (!monster) return;
    editingMonsterId = monster.id; editingTrashId = null;
    elements.form.elements.name.value = monster.name;
    const hasType = [...elements.form.elements.type.options].some(option => option.value === monster.type);
    elements.form.elements.type.value = hasType ? monster.type : "custom";
    elements.form.elements.customType.value = hasType ? "" : monster.type;
    byId("customTypeField").classList.toggle("visible", !hasType);
    byId("customTypeInput").required = !hasType;
    elements.form.elements.difficulty.value = monster.difficulty;
    elements.form.elements.hp.value = monster.hp; elements.form.elements.attack.value = monster.attack;
    elements.form.elements.defense.value = monster.defense || 0; elements.form.elements.xp.value = monster.xp || 0;
    elements.form.elements.speed.value = monster.speed; elements.form.elements.spawn.value = monster.spawn / 100;
    elements.form.elements.notes.value = monster.notes || "";
    elements.dialog.querySelector("h2").textContent = "\ubaac\uc2a4\ud130 \uc218\uc815";
    elements.dialog.showModal(); return;
  }
  const button = event.target.closest("[data-delete]");
  if (!button) { const row = event.target.closest(".monster-row"); if (row) { const monster = monsters.find(item => item.id === row.dataset.id); if (monster) openEntityTooltip(monster, row); } return; }
  const target = monsters.find(monster => monster.id === button.dataset.delete);
  if (!target) return;
  const deletedAt = new Date().toISOString();
  const { error } = await supabaseClient.from(BALANCE_TABLE).update({ deleted_at: deletedAt }).eq("id", target.id);
  if (error) { showDatabaseError("\ud734\uc9c0\ud1b5\uc73c\ub85c \uc774\ub3d9", error); return; }
  await loadBalances();
  closeEntityTooltip();
});

entityTooltip.addEventListener("click", event => {
  if (event.target.closest(".tooltip-close")) closeEntityTooltip();
  const edit = event.target.closest("[data-tooltip-edit]"); const remove = event.target.closest("[data-tooltip-delete]");
  if (edit) { const button=document.querySelector(`[data-edit="${edit.dataset.tooltipEdit}"]`); closeEntityTooltip(); button?.click(); }
  if (remove) { const button=document.querySelector(`[data-delete="${remove.dataset.tooltipDelete}"]`); closeEntityTooltip(); button?.click(); }
});
document.addEventListener("click", event => { if (entityTooltip.classList.contains("open") && !entityTooltip.contains(event.target) && !event.target.closest(".monster-row")) closeEntityTooltip(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeEntityTooltip(); });

byId("addButton").addEventListener("click", () => { editingTrashId=null; editingMonsterId=null; elements.form.reset(); elements.dialog.querySelector("h2").textContent="\uc0c8 \ubaac\uc2a4\ud130 \ucd94\uac00"; byId("customTypeField").classList.remove("visible"); elements.dialog.showModal(); });
byId("monsterType").addEventListener("change", event => {
  const isCustom = event.target.value === "custom";
  byId("customTypeField").classList.toggle("visible", isCustom);
  byId("customTypeInput").required = isCustom;
  if (isCustom) byId("customTypeInput").focus();
});
byId("dialogClose").addEventListener("click", () => elements.dialog.close());
byId("dialogCancel").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => { if (event.target === elements.dialog) elements.dialog.close(); });
elements.form.addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(elements.form);
  const today = new Date().toISOString().slice(0, 10);
  const selectedType = form.get("type");
  const monsterType = selectedType === "custom" ? form.get("customType").trim() : selectedType;
  if (!monsterType) { byId("customTypeInput").focus(); return; }
  const submittedName = form.get("name").trim();
  const duplicate = monsters.find(monster => monster.id !== editingMonsterId && monster.name.localeCompare(submittedName, undefined, { sensitivity: "base" }) === 0);
  if (editingTrashId === null && duplicate) { window.alert("\ud604\uc7ac Balance\uc5d0 \uac19\uc740 \uc774\ub984\uc758 \uc5d4\ud2f0\ud2f0\uac00 \uc774\ubbf8 \uc788\uc2b5\ub2c8\ub2e4."); return; }
  const values = { name: submittedName, type: monsterType, difficulty: form.get("difficulty"), hp: Number(form.get("hp")), speed: Number(form.get("speed")), attack: Number(form.get("attack")), defense: Number(form.get("defense")), xp: Number(form.get("xp")), spawn: Number(form.get("spawn")) * 100, notes: form.get("notes").trim(), updated: today };
  let result;
  if (editingTrashId !== null) result = await supabaseClient.from(BALANCE_TABLE).update(toDatabase(values)).eq("id", editingTrashId);
  else if (editingMonsterId !== null) result = await supabaseClient.from(BALANCE_TABLE).update(toDatabase(values)).eq("id", editingMonsterId);
  else result = await supabaseClient.from(BALANCE_TABLE).insert({ ...toDatabase(values), balance_id: currentBalanceId, created_at: new Date().toISOString(), deleted_at: null });
  if (result.error) { showDatabaseError(editingTrashId !== null || editingMonsterId !== null ? "\ubaac\uc2a4\ud130 \uc218\uc815" : "\ubaac\uc2a4\ud130 \ucd94\uac00", result.error); return; }
  editingTrashId = null; editingMonsterId = null;
  elements.form.reset();
  byId("customTypeField").classList.remove("visible");
  byId("customTypeInput").required = false;
  elements.dialog.close();
  await loadBalances();
});

function renderTrash() {
  elements.trashList.innerHTML = deletedMonsters.length ? deletedMonsters.map(monster => `<div class="trash-item"><div><strong>${escapeHtml(monster.name)}</strong><span>${escapeHtml(monster.type)} · ${TEXT.difficulty[monster.difficulty]}</span></div><button class="restore-button" data-restore="${monster.id}" type="button">\ubcf5\uc6d0</button><button class="permanent-delete" data-destroy="${monster.id}" type="button">\uc601\uad6c \uc0ad\uc81c</button></div>`).join("") : `<div class="trash-empty">\ud734\uc9c0\ud1b5\uc774 \ube44\uc5b4 \uc788\uc2b5\ub2c8\ub2e4.</div>`;
}
function renderTrashPage() {
  const query = byId("trashSearch").value.trim().toLocaleLowerCase("ko");
  const difficulty = byId("trashDifficulty").value;
  const type = byId("trashType").value;
  const rows = deletedMonsters.filter(monster => (!query || `${monster.name} ${monster.type}`.toLocaleLowerCase("ko").includes(query)) && (!difficulty || monster.difficulty === difficulty) && (!type || monster.type === type));
  byId("deletedCount").textContent = deletedMonsters.length;
  const selectedType = byId("trashType").value;
  const types = [...new Set(deletedMonsters.map(monster => monster.type))];
  byId("trashType").innerHTML = `<option value="">${TEXT.allTypes}</option>${types.map(item => `<option value="${escapeHtml(item)}"${item === selectedType ? " selected" : ""}>${escapeHtml(item)}</option>`).join("")}`;
  byId("trashPageList").innerHTML = rows.length ? rows.map(monster => `<article class="column-grid monster-row trash-page-row"><div class="identity"><strong>${escapeHtml(monster.name)}</strong><span class="type-tag" style="${typeTagStyle(monster.type)}">${escapeHtml(monster.type)}</span></div><div><span class="difficulty difficulty-${monster.difficulty}">${TEXT.difficulty[monster.difficulty]}</span></div>${statCell(monster.hp,1000,"hp")}${statCell(monster.speed,10,"speed")}${statCell(monster.attack,300,"attack")}${statCell(monster.spawn,100,"spawn","%")}<div class="trash-dates"><div class="deleted-date">\uc0ad\uc81c ${monster.deletedAt.slice(0,10)}</div><div>\uc0dd\uc131 ${monster.created}</div></div><div class="trash-actions"><button class="edit-trash trash-swap" data-edit-trash="${monster.id}" aria-label="\uc218\uc815"><span class="trash-action-icon">&#9998;</span><span class="trash-action-label">\uc218\uc815</span></button><button class="restore-trash trash-swap" data-page-restore="${monster.id}" aria-label="\ubcf5\uc6d0"><span class="trash-action-icon">&#8634;</span><span class="trash-action-label">\ubcf5\uc6d0</span></button><button class="destroy-trash trash-swap" data-page-destroy="${monster.id}" aria-label="\uc0ad\uc81c"><span class="trash-action-icon">&#128465;</span><span class="trash-action-label">\uc0ad\uc81c</span></button></div></article>`).join("") : `<div class="empty-state">\ud734\uc9c0\ud1b5\uc774 \ube44\uc5b4 \uc788\uc2b5\ub2c8\ub2e4.</div>`;
}
byId("trashButton").onclick = () => { document.body.classList.add("trash-mode"); renderTrashPage(); };
byId("backToList").addEventListener("click", () => { document.body.classList.remove("trash-mode"); render(); });
byId("trashSearch").addEventListener("input", renderTrashPage);
byId("trashDifficulty").addEventListener("change", renderTrashPage);
byId("trashType").addEventListener("change", renderTrashPage);
byId("trashPageList").addEventListener("click", async event => {
  const restore = event.target.closest("[data-page-restore]"); const destroy = event.target.closest("[data-page-destroy]"); const edit = event.target.closest("[data-edit-trash]");
  if (restore) { const id=restore.dataset.pageRestore; const { error }=await supabaseClient.from(BALANCE_TABLE).update({ deleted_at:null, updated_at:new Date().toISOString() }).eq("id",id); if(error){showDatabaseError("\ubaac\uc2a4\ud130 \ubcf5\uc6d0",error);return;} await loadBalances(); }
  if (destroy) { const id=destroy.dataset.pageDestroy; if(!window.confirm("\uc774 \ubaac\uc2a4\ud130\ub97c \uc601\uad6c \uc0ad\uc81c\ud560\uae4c\uc694?"))return; const { error }=await supabaseClient.from(BALANCE_TABLE).delete().eq("id",id); if(error){showDatabaseError("\uc601\uad6c \uc0ad\uc81c",error);return;} await loadBalances(); }
  if (edit) { const item=deletedMonsters.find(monster=>monster.id===edit.dataset.editTrash); if(!item)return; editingTrashId=item.id; elements.form.elements.name.value=item.name; elements.form.elements.type.value=[...elements.form.elements.type.options].some(option=>option.value===item.type)?item.type:"custom"; elements.form.elements.customType.value=elements.form.elements.type.value==="custom"?item.type:""; byId("customTypeField").classList.toggle("visible",elements.form.elements.type.value==="custom"); elements.form.elements.difficulty.value=item.difficulty; elements.form.elements.hp.value=item.hp; elements.form.elements.attack.value=item.attack; elements.form.elements.defense.value=item.defense||0; elements.form.elements.xp.value=item.xp||0; elements.form.elements.speed.value=item.speed; elements.form.elements.spawn.value=item.spawn/100; elements.form.elements.notes.value=item.notes||""; elements.dialog.querySelector("h2").textContent="\uc0ad\uc81c\ub41c \ubaac\uc2a4\ud130 \uc218\uc815"; elements.dialog.showModal(); }
});
byId("trashClose").addEventListener("click", () => elements.trashDialog.close());
byId("trashDone").addEventListener("click", () => elements.trashDialog.close());
byId("emptyTrash").addEventListener("click", async () => { if (deletedMonsters.length && window.confirm("\ud734\uc9c0\ud1b5\uc744 \ube44\uc6b8\uae4c\uc694? \uc774 \uc791\uc5c5\uc740 \ub418\ub3cc\ub9b4 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.")) { const ids=deletedMonsters.map(monster=>monster.id); const { error }=await supabaseClient.from(BALANCE_TABLE).delete().in("id",ids); if(error){showDatabaseError("\ud734\uc9c0\ud1b5 \ube44\uc6b0\uae30",error);return;} await loadBalances(); renderTrash(); } });
elements.trashList.addEventListener("click", async event => {
  const restore = event.target.closest("[data-restore]"); const destroy = event.target.closest("[data-destroy]");
  if (restore) { const { error }=await supabaseClient.from(BALANCE_TABLE).update({deleted_at:null}).eq("id",restore.dataset.restore); if(error){showDatabaseError("\ubcf5\uc6d0",error);return;} await loadBalances(); renderTrash(); }
  if (destroy) { const { error }=await supabaseClient.from(BALANCE_TABLE).delete().eq("id",destroy.dataset.destroy); if(error){showDatabaseError("\uc601\uad6c \uc0ad\uc81c",error);return;} await loadBalances(); renderTrash(); }
});

function currentBalanceState() {
  return { search: elements.search.value, difficulty: elements.difficulty.value, type: elements.type.value, sort: elements.sort.value };
}

function describeBalance(state) {
  const parts = [];
  if (state.search) parts.push(`\uac80\uc0c9: ${state.search}`);
  if (state.difficulty) parts.push(`\ub09c\uc774\ub3c4: ${TEXT.difficulty[state.difficulty]}`);
  if (state.type) parts.push(`\ud0c0\uc785: ${state.type}`);
  const sortLabels = { "name-asc": "\uc774\ub984\uc21c", "name-desc": "\uc774\ub984 \uc5ed\uc21c", "type-asc": "\ud0c0\uc785\uc21c", "difficulty-asc": "\ub09c\uc774\ub3c4\uc21c", "created-desc": "\ucd5c\uadfc \uc0dd\uc131\uc21c" };
  parts.push(sortLabels[state.sort] || sortLabels["name-asc"]);
  return parts.join(" · ");
}

function renderSavedBalances() {
  byId("balanceList").innerHTML = savedBalances.length ? savedBalances.map(balance => `<div class="balance-item"><div><strong>${escapeHtml(balance.name)}</strong><span>${escapeHtml(describeBalance(balance.state))}</span></div><button class="balance-load" data-load-balance="${balance.id}">\ubd88\ub7ec\uc624\uae30</button><button class="balance-remove" data-remove-balance="${balance.id}">\uc0ad\uc81c</button></div>`).join("") : `<div class="balance-empty">\uc800\uc7a5\ub41c Balance\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</div>`;
}

byId("myBalanceButton").addEventListener("click", async () => { byId("myBalanceDialog").showModal(); await loadSavedBalances(); });
byId("myBalanceClose").addEventListener("click", () => byId("myBalanceDialog").close());
byId("myBalanceDone").addEventListener("click", () => byId("myBalanceDialog").close());
byId("saveBalance").addEventListener("click", async () => {
  const name = byId("balanceName").value.trim();
  if (!name) { byId("balanceName").focus(); return; }
  const saveButton = byId("saveBalance"); saveButton.disabled = true;
  const { data: saved, error } = await supabaseClient.from(MY_BALANCE_TABLE).insert({ title: name, memo: "", state: currentBalanceState() }).select("id").single();
  saveButton.disabled = false;
  if (error) { showDatabaseError("My Balance \uc800\uc7a5", error); return; }
  if (monsters.length) {
    const copies = monsters.map(monster => ({ ...toDatabase(monster), balance_id: saved.id, created_at: new Date().toISOString(), deleted_at: null }));
    const { error: copyError } = await supabaseClient.from(BALANCE_TABLE).insert(copies);
    if (copyError) { await supabaseClient.from(MY_BALANCE_TABLE).delete().eq("id", saved.id); showDatabaseError("Balance \uc5d4\ud2f0\ud2f0 \ubcf5\uc0ac", copyError); return; }
  }
  byId("balanceName").value = "";
  await loadSavedBalances();
});
byId("balanceList").addEventListener("click", async event => {
  const load = event.target.closest("[data-load-balance]"); const remove = event.target.closest("[data-remove-balance]");
  if (load) { const balance=savedBalances.find(item=>item.id===load.dataset.loadBalance); if(!balance)return; currentBalanceId=balance.id; elements.search.value=balance.state.search||""; elements.difficulty.value=balance.state.difficulty||""; elements.sort.value=balance.state.sort||"name-asc"; await loadBalances(); elements.type.value=balance.state.type||""; render(); byId("myBalanceDialog").close(); }
  if (remove) { const id=remove.dataset.removeBalance; if(id===currentBalanceId){window.alert("\ud604\uc7ac \uc0ac\uc6a9 \uc911\uc778 Balance\ub294 \uc0ad\uc81c\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.");return;} const { error }=await supabaseClient.from(MY_BALANCE_TABLE).delete().eq("id",id); if(error){showDatabaseError("My Balance \uc0ad\uc81c",error);return;} await loadSavedBalances(); }
});
render();
initializeApp().catch(error => { console.error("App initialization failed", error); render(); });
