/* =============================================================
 * Modulo: modules/empresas/empresas.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

/* =========================================================================
 * CADASTRO DE EMPRESAS (cadastrar / editar / excluir / pesquisar)
 * ====================================================================== */
let empresaSearch = "";

/** Retorna a empresa cadastrada com o nome informado (ignorando acentos/caixa). */
function findEmpresa(nome, ignoreId) {
  const n = normalizeName(nome);
  return empresasCadastro.find((e) => normalizeName(e.nome) === n && e.id !== ignoreId);
}

/** Garante que a empresa exista no cadastro (usado ao criar lançamentos). */
function ensureEmpresa(nome, grupo) {
  if (!nome) return null;
  const existente = findEmpresa(nome);
  if (existente) return existente;
  const nova = { id: "e" + Date.now() + Math.random().toString(36).slice(2, 6), nome, grupo: grupo || null, criadoEm: new Date().toISOString() };
  empresasCadastro.push(nova);
  return nova;
}

/** Cadastra uma nova empresa, impedindo duplicidade. */
function cadastrarEmpresa(nome, grupo) {
  nome = String(nome || "").trim();
  grupo = String(grupo || "").trim() || null;
  if (!nome) { notify("Informe o nome da empresa.", "erro"); return null; }
  if (findEmpresa(nome)) { notify("Já existe uma empresa com esse nome.", "erro"); return null; }
  const empresa = ensureEmpresa(nome, grupo);
  persist();
  notify("Empresa cadastrada.");
  return empresa;
}

/** Renomeia a empresa e propaga a alteração para todos os lançamentos. */
function editarEmpresa(id, nome, grupo) {
  nome = String(nome || "").trim();
  grupo = String(grupo || "").trim() || null;
  const empresa = empresasCadastro.find((e) => e.id === id);
  if (!empresa) return false;
  if (!nome) { notify("Informe o nome da empresa.", "erro"); return false; }
  if (findEmpresa(nome, id)) { notify("Já existe uma empresa com esse nome.", "erro"); return false; }
  const antigo = empresa.nome, antigoGrupo = empresa.grupo;
  empresa.nome = nome;
  empresa.grupo = grupo;
  rows.forEach((r) => {
    if (r.empresa === antigo) { r.empresa = nome; r.grupo = grupo; }
  });
  renameKeyEverywhere(antigoGrupo || antigo, grupo || nome);
  persist();
  notify("Empresa atualizada.");
  return true;
}

/** Move metadados (dashboard/histórico/arquivos) de uma chave para outra. */
function renameKeyEverywhere(oldKey, newKey) {
  if (!oldKey || !newKey || oldKey === newKey) return;
  const move = (obj) => { if (obj[oldKey] !== undefined) { obj[newKey] = obj[oldKey]; delete obj[oldKey]; } };
  [customLabels, customBadges, customDescriptions, reports, customTypes, accesses, historico, reminders, importacoes].forEach(move);
  if (pinned.has(oldKey)) { pinned.delete(oldKey); pinned.add(newKey); }
}

/** Exclui a empresa e, opcionalmente, todos os seus lançamentos. */
function excluirEmpresa(id) {
  const empresa = empresasCadastro.find((e) => e.id === id);
  if (!empresa) return;
  const qtd = rows.filter((r) => r.empresa === empresa.nome).length;
  if (!confirmar(`Excluir a empresa "${empresa.nome}"${qtd ? ` e seus ${qtd} lançamento(s)` : ""}?\n\nEsta ação não pode ser desfeita.`)) return;
  empresasCadastro = empresasCadastro.filter((e) => e.id !== id);
  rows = rows.filter((r) => r.empresa !== empresa.nome);
  const key = empresa.grupo || empresa.nome;
  if (!rows.some((r) => groupKey(r) === key)) purgeKey(key);
  persist();
  notify("Empresa excluída.");
  if (view.type === "group" && view.key === key) view = { type: "home" };
  openEmpresasManager();
  render();
}

/** Remove todos os metadados associados a uma chave de grupo/empresa. */
function purgeKey(key) {
  [customLabels, customBadges, customDescriptions, reports, customTypes, accesses, historico, reminders, importacoes]
    .forEach((obj) => { delete obj[key]; });
  pinned.delete(key);
}

/** Abre a central de empresas (lista + busca + ações). */
function openEmpresasManager() {
  openModal("empresas-modal-overlay", `<div class="modal modal-lg">${renderEmpresasManagerBody()}</div>`);
}
function refreshEmpresasManager() {
  const overlay = document.getElementById("empresas-modal-overlay");
  if (overlay) overlay.innerHTML = `<div class="modal modal-lg">${renderEmpresasManagerBody()}</div>`;
}
function onEmpresaSearch(v) {
  empresaSearch = v;
  refreshEmpresasManager();
  const el = document.getElementById("emp-search");
  if (el) { el.focus(); el.selectionStart = el.value.length; }
}
function renderEmpresasManagerBody() {
  const term = normalizeName(empresaSearch);
  const list = empresasCadastro
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .filter((e) => !term || normalizeName(e.nome).includes(term) || normalizeName(e.grupo || "").includes(term));
  const items = list.map((e) => {
    const qtd = rows.filter((r) => r.empresa === e.nome).length;
    return `<div class="list-row">
      <div class="list-row-main">
        <div class="list-row-title">${esc(e.nome)}</div>
        <div class="list-row-sub">${e.grupo ? `Grupo: ${esc(e.grupo)} · ` : ""}${qtd} lançamento(s)</div>
      </div>
      <button class="icon-btn" title="Editar" onclick="openEmpresaForm('${jsq(e.id)}')">✎</button>
      <button class="icon-btn danger" title="Excluir" onclick="excluirEmpresa('${jsq(e.id)}')">🗑</button>
    </div>`;
  }).join("");
  return `
    <h3>🏢 Empresas</h3>
    <p class="hint" style="margin-top:0">Cadastre, pesquise, edite e exclua as empresas do sistema.</p>
    <div class="modal-toolbar">
      <input type="text" id="emp-search" class="search-input" placeholder="Pesquisar empresa ou grupo..." value="${esc(empresaSearch)}" oninput="onEmpresaSearch(this.value)">
      <button class="btn btn-primary" onclick="openEmpresaForm()">+ Nova empresa</button>
    </div>
    <div class="list-scroll">${items || `<div class="empty-state" style="padding:28px 10px">Nenhuma empresa cadastrada.</div>`}</div>
    <div class="actions">
      <button class="btn" onclick="closeModal('empresas-modal-overlay')">Fechar</button>
    </div>`;
}

/** Formulário de cadastro/edição de empresa. */
function openEmpresaForm(id) {
  const empresa = id ? empresasCadastro.find((e) => e.id === id) : null;
  openModal("empresa-form-overlay", `
    <div class="modal">
      <h3>${empresa ? "Editar empresa" : "Nova empresa"}</h3>
      <label>Nome da empresa</label>
      <input type="text" id="ef-nome" value="${esc(empresa ? empresa.nome : "")}" placeholder="Ex: NOVA EMPRESA LTDA">
      <label>Grupo (opcional)</label>
      <input type="text" id="ef-grupo" value="${esc(empresa && empresa.grupo ? empresa.grupo : "")}" placeholder="Ex: JGC">
      <div class="hint">Deixe em branco se a empresa não pertence a um grupo.</div>
      <div class="actions">
        <button class="btn" onclick="closeModal('empresa-form-overlay')">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarEmpresaForm('${jsq(id || "")}')">Salvar</button>
      </div>
    </div>`);
  const el = document.getElementById("ef-nome"); if (el) el.focus();
}
function salvarEmpresaForm(id) {
  const nome = fieldValue("ef-nome");
  const grupo = fieldValue("ef-grupo");
  const ok = id ? editarEmpresa(id, nome, grupo) : !!cadastrarEmpresa(nome, grupo);
  if (!ok) return;
  closeModal("empresa-form-overlay");
  refreshEmpresasManager();
  render();
}
