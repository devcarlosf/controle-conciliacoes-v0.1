/* =============================================================
 * Modulo: modules/conciliacao/edicao.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

/* =========================================================================
 * EDIÇÃO ÚNICA DE LANÇAMENTO (um só botão "Editar")
 * ====================================================================== */

/** Abre o modal com TODOS os campos editáveis do lançamento. */
function openEditModal(id) {
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  const cat = getRowCategory(row.id);
  const catOpts = [`<option value="">— sem categoria —</option>`]
    .concat(categoryList.map((c) => `<option value="${esc(c)}" ${c === cat ? "selected" : ""}>${esc(c)}</option>`)).join("");
  const sitOpts = SITUACOES.map((s) => `<option value="${esc(s)}" ${(row.situacao || "Pendente") === s ? "selected" : ""}>${esc(s)}</option>`).join("");
  const empresaOpts = empresasCadastro.map((e) => `<option value="${esc(e.nome)}"></option>`).join("");
  openModal("edit-row-overlay", `
    <div class="modal modal-lg">
      <h3>✎ Editar lançamento</h3>
      <div class="form-grid">
        <div>
          <label>Empresa</label>
          <input type="text" id="er-empresa" list="er-empresas" value="${esc(row.empresa || "")}">
          <datalist id="er-empresas">${empresaOpts}</datalist>
        </div>
        <div>
          <label>Grupo</label>
          <input type="text" id="er-grupo" value="${esc(row.grupo || "")}" placeholder="Opcional">
        </div>
        <div>
          <label>Banco / conta / integração</label>
          <input type="text" id="er-banco" value="${esc(row.banco || "")}">
        </div>
        <div>
          <label>Categoria</label>
          <select id="er-categoria">${catOpts}</select>
        </div>
        <div>
          <label>Saldo batendo</label>
          <input type="date" id="er-saldo" value="${esc(brToIso(row.saldo_batendo || ""))}">
        </div>
        <div>
          <label>Data conciliado</label>
          <input type="date" id="er-conciliado" value="${esc(brToIso(row.data_conciliado || ""))}">
        </div>
        <div>
          <label>Data de envio</label>
          <input type="date" id="er-envio" value="${esc(brToIso(row.data_envio || ""))}">
        </div>
        <div>
          <label>Competência</label>
          <input type="text" id="er-competencia" value="${esc(row.competencia || "")}" placeholder="Ex: MAIO">
        </div>
        <div>
          <label>Situação</label>
          <select id="er-situacao">${sitOpts}</select>
        </div>
      </div>
      <label>Observação</label>
      <textarea id="er-obs" class="obs-editable" style="width:100%">${esc(row.observacao || "")}</textarea>
      <div class="actions">
        <button class="btn btn-danger" style="margin-right:auto" onclick="closeModal('edit-row-overlay'); deleteRow(${row.id})">🗑 Excluir</button>
        <button class="btn" onclick="closeModal('edit-row-overlay')">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarEditModal(${row.id})">Salvar</button>
      </div>
    </div>`);
  const el = document.getElementById("er-banco"); if (el) el.focus();
}

/** Grava as alterações do modal de edição. */
function salvarEditModal(id) {
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  const empresa = fieldValue("er-empresa");
  if (!empresa) { notify("Informe a empresa.", "erro"); return; }
  const grupo = fieldValue("er-grupo") || null;
  row.empresa = empresa;
  row.grupo = grupo;
  row.banco = fieldValue("er-banco");
  row.saldo_batendo = isoToBr(fieldValue("er-saldo"));
  row.data_conciliado = isoToBr(fieldValue("er-conciliado"));
  row.data_envio = isoToBr(fieldValue("er-envio"));
  row.competencia = fieldValue("er-competencia");
  row.situacao = fieldValue("er-situacao");
  const obsEl = document.getElementById("er-obs");
  row.observacao = obsEl ? obsEl.value : row.observacao;
  setRowCategory(row.id, fieldValue("er-categoria"));
  ensureEmpresa(empresa, grupo);
  persist();
  closeModal("edit-row-overlay");
  if (view.type === "group" && !rows.some((r) => groupKey(r) === view.key)) view = { type: "home" };
  render();
  notify("Lançamento atualizado.");
}
