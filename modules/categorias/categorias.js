/* =============================================================
 * Modulo: modules/categorias/categorias.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- categorias ----------
function getRowCategory(id) { return bankCategories[id] || ""; }
function setRowCategory(id, cat) {
  if (cat) bankCategories[id] = cat; else delete bankCategories[id];
  saveBankCategories();
}
function categoryColor(cat) {
  // deterministic color from name
  const palette = [
    { bg: "rgba(79,195,232,.16)", bd: "rgba(79,195,232,.55)", tx: "#7FD5F0" },
    { bg: "rgba(52,211,153,.16)", bd: "rgba(52,211,153,.55)", tx: "#5DDBAA" },
    { bg: "rgba(251,191,36,.16)", bd: "rgba(251,191,36,.55)", tx: "#FCD34D" },
    { bg: "rgba(167,139,250,.18)", bd: "rgba(167,139,250,.55)", tx: "#C4B5FD" },
    { bg: "rgba(244,114,182,.16)", bd: "rgba(244,114,182,.55)", tx: "#F9A8D4" },
    { bg: "rgba(248,113,113,.16)", bd: "rgba(248,113,113,.55)", tx: "#FCA5A5" },
    { bg: "rgba(56,189,248,.16)", bd: "rgba(56,189,248,.55)", tx: "#7DD3FC" },
  ];
  if (!cat) return palette[0];
  let h = 0; for (let i=0;i<cat.length;i++) h = (h*31 + cat.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
function renderCategoryBadge(cat) {
  if (!cat) return "";
  const c = categoryColor(cat);
  return `<span class="cat-badge" style="background:${c.bg};border-color:${c.bd};color:${c.tx}">${esc(cat)}</span>`;
}
function openCategoryManager() { categoryManagerOpen = true; render(); }
function closeCategoryManager() { categoryManagerOpen = false; render(); }
function addCategory() {
  const name = (prompt("Nome da nova categoria:") || "").trim();
  if (!name) return;
  if (categoryList.includes(name)) { alert("Categoria já existe."); return; }
  categoryList.push(name);
  saveCategoryList();
  render();
}
function renameCategory(oldName) {
  const name = (prompt("Novo nome:", oldName) || "").trim();
  if (!name || name === oldName) return;
  if (categoryList.includes(name)) { alert("Categoria já existe."); return; }
  categoryList = categoryList.map(c => c === oldName ? name : c);
  Object.keys(bankCategories).forEach(id => { if (bankCategories[id] === oldName) bankCategories[id] = name; });
  saveCategoryList(); saveBankCategories();
  if (categoryFilter === oldName) categoryFilter = name;
  render();
}
function removeCategory(name) {
  if (!confirm(`Remover a categoria "${name}"? Os itens marcados com ela ficarão sem categoria.`)) return;
  categoryList = categoryList.filter(c => c !== name);
  Object.keys(bankCategories).forEach(id => { if (bankCategories[id] === name) delete bankCategories[id]; });
  saveCategoryList(); saveBankCategories();
  if (categoryFilter === name) categoryFilter = "";
  render();
}
function setCategoryFilter(cat) { categoryFilter = (categoryFilter === cat) ? "" : cat; render(); }
function onRowCategoryChange(id, value) {
  setRowCategory(id, value);
  if (draft && draft.id === id) draft._category = value;
  render();
}

function renderCategoryFilterBar(rows) {
  const counts = {};
  let uncategorized = 0;
  rows.forEach(r => {
    const c = getRowCategory(r.id);
    if (c) counts[c] = (counts[c] || 0) + 1;
    else uncategorized++;
  });
  const chips = [];
  chips.push(`<button class="cat-chip ${!categoryFilter ? "active" : ""}" onclick="setCategoryFilter('')">Todas <b>${rows.length}</b></button>`);
  categoryList.forEach(cat => {
    const n = counts[cat] || 0;
    const c = categoryColor(cat);
    const active = categoryFilter === cat;
    chips.push(`<button class="cat-chip" style="${active ? `background:${c.bg};border-color:${c.bd};color:${c.tx};` : ""}" onclick="setCategoryFilter('${jsq(cat)}')"><span class="cat-dot" style="background:${c.tx}"></span>${esc(cat)} <b>${n}</b></button>`);
  });
  if (uncategorized) {
    chips.push(`<button class="cat-chip ${categoryFilter === "__NONE__" ? "active" : ""}" onclick="setCategoryFilter('__NONE__')">Sem categoria <b>${uncategorized}</b></button>`);
  }
  return `<div class="cat-filter-bar">${chips.join("")}</div>`;
}

function renderCategoryManagerModal() {
  if (!categoryManagerOpen) return "";
  const rows = categoryList.map(cat => {
    const c = categoryColor(cat);
    const count = Object.values(bankCategories).filter(v => v === cat).length;
    return `<div class="cat-row">
      <span class="cat-badge" style="background:${c.bg};border-color:${c.bd};color:${c.tx}">${esc(cat)}</span>
      <span class="cat-count">${count} conta${count !== 1 ? "s" : ""}</span>
      <button class="btn-ghost" onclick="renameCategory('${jsq(cat)}')" title="Renomear">✎</button>
      <button class="btn-danger-ghost" onclick="removeCategory('${jsq(cat)}')" title="Excluir">✕</button>
    </div>`;
  }).join("");
  return `<div class="modal-overlay" onclick="if(event.target===this)closeCategoryManager()">
    <div class="modal" style="max-width:520px">
      <h3 style="margin:0 0 4px">🏷 Categorias</h3>
      <p class="hint" style="margin-bottom:14px">Crie e organize categorias para classificar bancos, cartões, marketplaces, investimentos e relatórios. Cada linha da conciliação pode ter uma categoria — depois use os chips no topo para filtrar.</p>
      <div class="cat-manager-list">${rows || `<p class="hint">Nenhuma categoria cadastrada ainda.</p>`}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="addCategory()">+ Nova categoria</button>
        <button class="btn" onclick="closeCategoryManager()">Fechar</button>
      </div>
    </div>
  </div>`;
}
