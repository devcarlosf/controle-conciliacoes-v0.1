/* =============================================================
 * Modulo: js/app.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- app render ----------
/** Escolhe a tela conforme o estado de navegação. */
function renderCurrentView() {
  if (view.type === "baterSaldo") return renderBaterSaldo();
  if (view.type === "home") return renderHome();
  return renderGroupDetail();
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = renderCurrentView() + renderCategoryManagerModal();
  syncSidebar();
}

// ---------- shell: menu lateral / tema / microinterações ----------
/** Marca o item ativo do menu lateral conforme a tela atual. */
function syncSidebar() {
  const map = view.type === "baterSaldo" ? "baterSaldo" : (view.type === "home" ? homeTab : "empresas");
  document.querySelectorAll(".fm-nav-item[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-nav") === map);
  });
}

/** Navegação do menu lateral. Reaproveita as ações já existentes. */
function navigate(destino) {
  toggleSidebar(false);
  switch (destino) {
    case "painel":       view = { type: "home" }; homeTab = "painel"; render(); break;
    case "empresas":     view = { type: "home" }; homeTab = "empresas"; render(); break;
    case "baterSaldo":   view = { type: "baterSaldo" }; render(); break;
    case "empresasCadastro": openEmpresasManager(); break;
    case "categorias":   openCategoryManager(); break;
    case "calendario":   openCalendarModal(); break;
    case "solicitacoes": openTemplatesManager(); break;
    case "configuracoes": openSettingsModal(); break;
  }
}

function toggleSidebar(forcar) {
  const shell = document.getElementById("fm-shell");
  if (!shell) return;
  const abrir = forcar === undefined ? !shell.classList.contains("nav-open") : !!forcar;
  shell.classList.toggle("nav-open", abrir);
}

/** Alterna claro/escuro mantendo a preferência salva. */
function toggleTheme() {
  settings.theme = settings.theme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", settings.theme);
  saveSettings();
  render();
}

/* Ripple nos botões (puramente visual). */
document.addEventListener("pointerdown", (e) => {
  const btn = e.target.closest && e.target.closest(".btn");
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  const span = document.createElement("span");
  span.className = "fm-ripple";
  span.style.width = span.style.height = size + "px";
  span.style.left = (e.clientX - r.left - size / 2) + "px";
  span.style.top = (e.clientY - r.top - size / 2) + "px";
  btn.appendChild(span);
  setTimeout(() => span.remove(), 560);
});

// ---------- actions ----------
function openGroup(key) {
  view = { type: "group", key };
  groupSearch = "";
  activeTab = "conciliacoes";
  sortField = null; sortDir = "asc";
  bulkDateEdit = false; bulkDraft = {};
  Object.keys(columnFilters).forEach((k) => columnFilters[k] = "");
  render();
}
function goHome() {
  view = { type: "home" };
  render();
}
function setTab(t) { activeTab = t; render(); }
function setHomeTab(t) { homeTab = t; render(); }
function onSearchHome(v) { search = v; render(); const el = document.querySelector(".search-input"); if (el) { el.focus(); el.selectionStart = el.value.length; } }
function onHomeGroupFilter(v) { homeGroupFilter = v; render(); }
function onHomeTypeFilter(v) { homeTypeFilter = v; render(); }
function clearHomeFilters() { homeGroupFilter = ""; homeTypeFilter = ""; render(); }
function onSearchGroup(v) { groupSearch = v; render(); const el = document.querySelector(".toolbar .search-input"); if (el) { el.focus(); el.selectionStart = el.value.length; } }
function renderColumnFilterSelect(col, groupRows) {
  const values = new Set();
  let hasEmpty = false;
  groupRows.forEach((r) => {
    const raw = col.field === "situacao" ? (r.situacao || "Pendente") : (r[col.field] || "");
    if (raw === "") hasEmpty = true; else values.add(raw);
  });
  const sorted = Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const current = columnFilters[col.field];
  const opts = [`<option value="">Todos</option>`]
    .concat(sorted.map((v) => `<option value="${esc(v)}" ${current === v ? "selected" : ""}>${esc(v)}</option>`))
    .concat(hasEmpty ? [`<option value="__EMPTY__" ${current === "__EMPTY__" ? "selected" : ""}>(vazio)</option>`] : []);
  const activeClass = current ? "active" : "";
  return `<select class="col-filter ${activeClass}" onchange="onColumnFilter('${col.field}', this.value)">${opts.join("")}</select>`;
}
function onColumnFilter(field, value) { columnFilters[field] = value; render(); }
function hasActiveColumnFilters() { return Object.values(columnFilters).some((v) => v !== ""); }
function clearColumnFilters() { Object.keys(columnFilters).forEach((k) => columnFilters[k] = ""); render(); }

// Edição unificada: os antigos "Editar data" e "Editar informações" agora
// abrem o mesmo modal com todos os campos.
function startEditDates(id) { openEditModal(id); }
function startEditNames(id) { openEditModal(id); }
function onSituacaoChange(id, value) {
  rows = rows.map((r) => (r.id === id ? Object.assign({}, r, { situacao: value }) : r));
  openStatusId = null;
  saveData(); render();
}
function onObservacaoInput(id, value) {
  const row = rows.find((r) => r.id === id);
  if (row) row.observacao = value;
  saveData();
}
function deleteRow(id) {
  confirmar({
    titulo: "Excluir lançamento",
    texto: "Esta linha será removida definitivamente. Deseja continuar?",
    onOk: () => {
      rows = rows.filter((r) => r.id !== id);
      saveData(); render();
      notify("Lançamento excluído.");
    },
  });
}
function addRowToGroup(key, isGrupo) {
  const nextId = nextRowId();
  const row = {
    id: nextId,
    empresa: isGrupo ? "" : key,
    grupo: isGrupo ? key : null,
    banco: "", saldo_batendo: "", data_conciliado: "", data_envio: "", competencia: "",
    situacao: "Pendente", observacao: ""
  };
  rows = [row, ...rows];
  saveData();
  view = { type: "group", key };
  render();
  openEditModal(nextId);
}
function openNewModal() {
  openModal("new-modal-overlay", `
    <div class="modal">
      <h3>Nova empresa</h3>
      <label>Nome da empresa</label>
      <input type="text" id="nm-empresa" placeholder="Ex: NOVA EMPRESA LTDA">
      <label>Grupo (opcional)</label>
      <input type="text" id="nm-grupo" placeholder="Ex: JGC">
      <div class="hint">Deixe em branco se essa empresa não pertence a um grupo.</div>
      <div class="actions">
        <button class="btn" onclick="closeNewModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="confirmNewModal()">Criar</button>
      </div>
    </div>`);
  document.getElementById("nm-empresa").focus();
}
function closeNewModal() { closeModal("new-modal-overlay"); }
function confirmNewModal() {
  const empresa = fieldValue("nm-empresa");
  const grupo = fieldValue("nm-grupo");
  if (!empresa) { notify("Informe o nome da empresa.", "erro"); return; }
  if (findEmpresa(empresa)) { notify("Já existe uma empresa com esse nome.", "erro"); return; }
  cadastrarEmpresa(empresa, grupo);
  const nextId = nextRowId();
  const row = {
    id: nextId, empresa, grupo: grupo || null, banco: "",
    saldo_batendo: "", data_conciliado: "", data_envio: "", competencia: "",
    situacao: "Pendente", observacao: ""
  };
  rows = [row, ...rows];
  saveData();
  closeNewModal();
  const key = groupKey(row);
  view = { type: "group", key };
  render();
  openEditModal(nextId);
}

// ---------- init ----------

document.addEventListener("click", (e) => {
  if (openStatusId !== null && !e.target.closest(".status-dropdown-wrap")) {
    openStatusId = null;
    render();
  }
});
loadAll();
document.documentElement.setAttribute("data-theme", settings.theme === "light" ? "light" : "dark");
render();
