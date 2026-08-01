/* =============================================================
 * Modulo: modules/configuracoes/modelos.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- Central de Solicitação de Documentos (modelos de mensagens) ----------
function defaultTemplates() {
  return [
    { id: "t_extrato", categoria: "Bancos", nome: "Extrato bancário",
      texto: "Olá! Tudo bem?\n\nPara darmos andamento à conciliação da empresa {empresa}, poderia nos enviar o extrato bancário {documento} referente ao período de {periodo}?\n\nData de solicitação: {dataHoje}.\n\nDesde já agradecemos." },
    { id: "t_fatura", categoria: "Cartões", nome: "Fatura de cartão de crédito",
      texto: "Olá! Tudo bem?\n\nPoderia nos encaminhar a fatura do cartão {documento} da empresa {empresa}, com vencimento em {periodo}?\n\nPrecisamos do PDF completo para conciliação. Obrigado!" },
    { id: "t_marketplace", categoria: "Marketplaces", nome: "Relatório de marketplace",
      texto: "Olá!\n\nSolicitamos o relatório do marketplace {documento} da empresa {empresa}, referente a {periodo}.\n\nSe possível, envie também o repasse financeiro do período. Obrigado!" },
    { id: "t_investimentos", categoria: "Investimentos", nome: "Relatório de investimentos",
      texto: "Olá! Tudo bem?\n\nPara a conciliação da empresa {empresa}, precisamos do relatório de investimentos ({documento}) com posição consolidada em {periodo}.\n\nObrigado!" },
    { id: "t_geral", categoria: "Geral", nome: "Solicitação genérica de documento",
      texto: "Olá!\n\nEstamos finalizando a conciliação da empresa {empresa} e precisamos do documento: {documento}, referente a {periodo}.\n\nPode nos enviar assim que possível? Obrigado!" }
  ];
}
function fillTemplateVars(text, ctx) {
  return String(text || "").replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null ? ctx[k] : "{" + k + "}"));
}
function templateContext(gkey, rem) {
  const label = customLabels[gkey] != null ? customLabels[gkey] : gkey;
  const info = rem ? computeReminderDueInfo(rem) : null;
  const hoje = new Date();
  const dueBr = info ? info.dueDateBr : "";
  const periodo = (() => {
    if (!rem) return "";
    if (rem.frequencia === "mensal") {
      const parts = dueBr.split("/");
      if (parts.length === 3) return `${MESES_PT[parseInt(parts[1],10)-1]}/${parts[2]}`;
      return "mês vigente";
    }
    return dueBr;
  })();
  return {
    empresa: label,
    documento: rem ? rem.documento : "",
    periodo: periodo,
    dataSolicitacao: dueBr,
    dataHoje: `${String(hoje.getDate()).padStart(2,"0")}/${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`,
    mes: dueBr.split("/")[1] ? MESES_PT[parseInt(dueBr.split("/")[1],10)-1] : "",
    ano: dueBr.split("/")[2] || String(hoje.getFullYear())
  };
}
let tplPickerState = { gkey: null, remId: null, selectedId: null };
function openTemplatePicker(gkey, remId) {
  tplPickerState = { gkey, remId, selectedId: templates[0] ? templates[0].id : null };
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "tpl-picker-overlay";
  overlay.innerHTML = renderTemplatePicker();
  document.body.appendChild(overlay);
}
function closeTemplatePicker() { const el = document.getElementById("tpl-picker-overlay"); if (el) el.remove(); }
function selectTemplate(id) { tplPickerState.selectedId = id; refreshTemplatePicker(); }
function refreshTemplatePicker() {
  const el = document.getElementById("tpl-picker-overlay");
  if (el) el.innerHTML = renderTemplatePicker();
}
function renderTemplatePicker() {
  const rem = (reminders[tplPickerState.gkey] || []).find((r) => r.id === tplPickerState.remId);
  const ctx = templateContext(tplPickerState.gkey, rem);
  const tpl = templates.find((t) => t.id === tplPickerState.selectedId) || templates[0];
  const preview = tpl ? fillTemplateVars(tpl.texto, ctx) : "";
  const items = templates.map((t) => `
    <div class="tpl-item ${t.id === (tpl && tpl.id) ? "selected" : ""}" onclick="selectTemplate('${jsq(t.id)}')">
      <div class="tpl-name">${esc(t.nome)}</div>
      <div class="tpl-cat">${esc(t.categoria || "")}</div>
    </div>
  `).join("");
  return `
    <div class="modal" style="width:640px">
      <h3>💬 Central de solicitação — ${esc(ctx.empresa)}</h3>
      <p class="hint" style="margin-top:0">Documento: <b>${esc(ctx.documento || "—")}</b> · Período: <b>${esc(ctx.periodo || "—")}</b></p>
      <div style="display:grid;grid-template-columns:220px 1fr;gap:14px;margin-top:10px">
        <div>
          <label style="margin:0 0 6px">Modelos</label>
          <div class="tpl-list">${items || `<div class="hint">Nenhum modelo cadastrado.</div>`}</div>
          <button class="btn btn-sm" style="margin-top:8px;width:100%" onclick="openTemplatesManager()">Gerenciar modelos</button>
        </div>
        <div>
          <label style="margin:0 0 6px">Mensagem gerada</label>
          <textarea class="tpl-preview" id="tpl-preview-text" style="width:100%">${esc(preview)}</textarea>
          <p class="hint" style="margin-top:4px">Variáveis disponíveis: {empresa}, {documento}, {periodo}, {dataSolicitacao}, {dataHoje}, {mes}, {ano}</p>
        </div>
      </div>
      <div class="actions">
        <button class="btn" onclick="closeTemplatePicker()">Fechar</button>
        <button class="btn btn-primary" onclick="copyTemplateMessage()">📋 Copiar mensagem</button>
      </div>
    </div>
  `;
}
function copyTemplateMessage() {
  const ta = document.getElementById("tpl-preview-text");
  if (!ta) return;
  ta.select();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value);
    else document.execCommand("copy");
    const btns = document.querySelectorAll("#tpl-picker-overlay .btn-primary");
    btns.forEach((b) => { const t = b.textContent; b.textContent = "✓ Copiado!"; setTimeout(() => (b.textContent = t), 1400); });
  } catch(e) { alert("Não foi possível copiar automaticamente. Selecione e copie manualmente."); }
}

// ---------- Gerenciar modelos ----------
function openTemplatesManager() {
  closeTemplatePicker();
  closeSettingsModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "tpl-manager-overlay";
  overlay.innerHTML = renderTemplatesManager();
  document.body.appendChild(overlay);
}
function closeTemplatesManager() { const el = document.getElementById("tpl-manager-overlay"); if (el) el.remove(); }
function renderTemplatesManager(editingId) {
  const editing = editingId ? templates.find((t) => t.id === editingId) : null;
  const list = templates.map((t) => `
    <div class="tpl-manage-item">
      <div class="body">
        <div style="font-weight:600">${esc(t.nome)} <span class="hint">· ${esc(t.categoria || "")}</span></div>
        <pre>${esc(t.texto)}</pre>
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm" onclick="editTemplate('${jsq(t.id)}')">✎</button>
        <button class="btn-danger-ghost" onclick="deleteTemplate('${jsq(t.id)}')">✕</button>
      </div>
    </div>
  `).join("");
  const form = `
    <label>Nome do modelo</label>
    <input type="text" id="tpl-nome" value="${editing ? esc(editing.nome) : ""}" placeholder="Ex: Extrato bancário mensal">
    <label>Categoria</label>
    <input type="text" id="tpl-cat" value="${editing ? esc(editing.categoria || "") : ""}" placeholder="Ex: Bancos, Cartões, Marketplaces...">
    <label>Texto (use {empresa}, {documento}, {periodo}, {dataHoje}, {mes}, {ano})</label>
    <textarea id="tpl-texto" style="width:100%;min-height:130px">${editing ? esc(editing.texto) : ""}</textarea>
    <div class="actions">
      ${editing ? `<button class="btn-danger-ghost" style="margin-right:auto" onclick="deleteTemplate('${jsq(editing.id)}')">Excluir</button>` : ""}
      <button class="btn" onclick="closeTemplatesManager()">Fechar</button>
      <button class="btn btn-primary" onclick="saveTemplate(${editing ? `'${jsq(editing.id)}'` : "null"})">${editing ? "Salvar alterações" : "+ Adicionar modelo"}</button>
    </div>
  `;
  return `
    <div class="modal" style="width:640px">
      <h3>💬 Modelos de mensagens</h3>
      <p class="hint" style="margin-top:0">Modelos pré-cadastrados para solicitar documentos aos clientes. Use as variáveis para preencher automaticamente empresa, documento e período.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
        <div>
          <label style="margin:0 0 6px">Modelos cadastrados (${templates.length})</label>
          <div class="tpl-manage-list">${list || `<div class="hint">Nenhum modelo cadastrado.</div>`}</div>
          ${templates.length ? "" : `<button class="btn btn-sm" style="margin-top:10px" onclick="carregarModelosPadrao()">Carregar modelos sugeridos</button>`}
        </div>
        <div>
          <label style="margin:0 0 6px">${editing ? "Editar modelo" : "Novo modelo"}</label>
          ${form}
        </div>
      </div>
    </div>
  `;
}
function editTemplate(id) {
  const el = document.getElementById("tpl-manager-overlay");
  if (el) el.innerHTML = renderTemplatesManager(id);
}
/** Carrega os modelos de mensagem sugeridos (ação manual do usuário). */
function carregarModelosPadrao() {
  templates = defaultTemplates();
  saveTemplates();
  const el = document.getElementById("tpl-manager-overlay");
  if (el) el.innerHTML = renderTemplatesManager();
  notify("Modelos sugeridos carregados.");
}
function saveTemplate(id) {
  const nome = (document.getElementById("tpl-nome").value || "").trim();
  const categoria = (document.getElementById("tpl-cat").value || "").trim();
  const texto = (document.getElementById("tpl-texto").value || "").trim();
  if (!nome || !texto) { alert("Informe nome e texto do modelo."); return; }
  if (id) {
    const t = templates.find((x) => x.id === id);
    if (t) { t.nome = nome; t.categoria = categoria; t.texto = texto; }
  } else {
    templates.push({ id: "tpl" + Date.now(), nome, categoria, texto });
  }
  saveTemplates();
  const el = document.getElementById("tpl-manager-overlay");
  if (el) el.innerHTML = renderTemplatesManager();
}
function deleteTemplate(id) {
  if (!confirm("Excluir este modelo?")) return;
  templates = templates.filter((t) => t.id !== id);
  saveTemplates();
  const el = document.getElementById("tpl-manager-overlay");
  if (el) el.innerHTML = renderTemplatesManager();
}
