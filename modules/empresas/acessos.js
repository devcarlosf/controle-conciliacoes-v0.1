/* =============================================================
 * Modulo: modules/empresas/acessos.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- Access tab ----------
const ACCESS_FIELDS = [
  ["banco","Banco"],
  ["usuario","Usuário"],
  ["senha","Senha"],
  ["agencia","Agência"],
  ["conta","Conta"],
  ["codigos","Códigos de acesso"],
  ["observacoes","Observações"]
];

function renderAccessTab(gkey) {
  const items = accesses[gkey] || [];
  const keyEsc = jsq(gkey);
  const cards = items.map(item => `
    <div class="access-item">
      <div class="access-item-title">
        <h4>${esc(item.banco || "Sem título")}</h4>
        <div style="display:flex;gap:4px">
          <button class="btn-ghost" onclick="editAccess('${keyEsc}', ${item.id})" title="Editar">✎</button>
          <button class="btn-danger-ghost" onclick="deleteAccess('${keyEsc}', ${item.id})" title="Excluir">✕</button>
        </div>
      </div>
      <div class="access-fields">
        ${ACCESS_FIELDS.filter(([k]) => k !== "banco").map(([k,label]) => item[k] ? `
          <div class="access-field ${k==='observacoes'?'obs':''}">
            <div class="k">${label}</div>
            <div class="v"><span class="val">${esc(item[k])}</span><button class="mini-copy" onclick="copyAccessField('${keyEsc}', ${item.id}, '${k}', this)">Copiar</button></div>
          </div>` : "").join("")}
      </div>
    </div>
  `).join("");

  return `
    <div class="toolbar">
      <button class="btn btn-primary" onclick="editAccess('${keyEsc}', null)">+ Novo acesso</button>
      <label class="btn file-btn">
        📥 Importar planilha
        <input type="file" accept=".xlsx,.xls,.csv" onchange="importAccessSpreadsheet(event, '${keyEsc}')">
      </label>
      <span class="hint">Cabeçalhos reconhecidos: banco, usuário, senha, agência, conta, códigos, observações</span>
    </div>
    ${items.length ? cards : `<div class="empty-state">Nenhum acesso cadastrado. Adicione manualmente ou importe a planilha da empresa.</div>`}
  `;
}
function copyAccessField(gkey, id, field, btn) {
  const item = (accesses[gkey] || []).find(x => x.id === id);
  if (!item) return;
  const val = String(item[field] || "");
  navigator.clipboard.writeText(val).catch(()=>{});
  const old = btn.textContent;
  btn.textContent = "Copiado!";
  setTimeout(() => btn.textContent = old, 1200);
}
function editAccess(gkey, id) {
  const list = accesses[gkey] || [];
  const isNew = id == null;
  const item = isNew
    ? { id: null, banco:"", usuario:"", senha:"", agencia:"", conta:"", codigos:"", observacoes:"" }
    : list.find(x => x.id === id);
  if (!item) return;
  const keyEsc = jsq(gkey);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "access-modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="width:540px">
      <h3>${isNew?'Novo':'Editar'} acesso</h3>
      <label>Banco / Título</label>
      <input type="text" id="ac-banco" value="${esc(item.banco)}" placeholder="Ex: ITAÚ, SICREDI, XP...">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label>Usuário</label><input type="text" id="ac-usuario" value="${esc(item.usuario)}"></div>
        <div><label>Senha</label><input type="text" id="ac-senha" value="${esc(item.senha)}"></div>
        <div><label>Agência</label><input type="text" id="ac-agencia" value="${esc(item.agencia)}"></div>
        <div><label>Conta</label><input type="text" id="ac-conta" value="${esc(item.conta)}"></div>
      </div>
      <label>Códigos de acesso</label>
      <textarea id="ac-codigos" rows="2" placeholder="Token, chave, código de segurança...">${esc(item.codigos)}</textarea>
      <label>Observações</label>
      <textarea id="ac-obs" rows="3">${esc(item.observacoes)}</textarea>
      <div class="actions">
        <button class="btn" onclick="closeAccessModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveAccessModal('${keyEsc}', ${isNew ? 'null' : id})">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("ac-banco").focus();
}
function closeAccessModal() { const el = document.getElementById("access-modal-overlay"); if (el) el.remove(); }
function saveAccessModal(gkey, id) {
  const data = {
    banco: document.getElementById("ac-banco").value.trim(),
    usuario: document.getElementById("ac-usuario").value.trim(),
    senha: document.getElementById("ac-senha").value,
    agencia: document.getElementById("ac-agencia").value.trim(),
    conta: document.getElementById("ac-conta").value.trim(),
    codigos: document.getElementById("ac-codigos").value.trim(),
    observacoes: document.getElementById("ac-obs").value.trim()
  };
  const list = accesses[gkey] || [];
  if (id == null) {
    const nextId = list.length ? Math.max(...list.map(x => x.id)) + 1 : 1;
    list.unshift(Object.assign({ id: nextId }, data));
  } else {
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx] = Object.assign({ id }, data);
  }
  accesses[gkey] = list;
  saveAccesses();
  closeAccessModal();
  render();
}
function deleteAccess(gkey, id) {
  if (!confirm("Excluir este acesso?")) return;
  accesses[gkey] = (accesses[gkey] || []).filter(x => x.id !== id);
  saveAccesses();
  render();
}
function importAccessSpreadsheet(ev, gkey) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsJson = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
      const mapping = {
        banco:      ["banco","bank","instituicao","instituição","titulo","título","descricao","descrição"],
        usuario:    ["usuario","usuário","user","login","cpf","cnpj","email","e-mail"],
        senha:      ["senha","password","pass","pwd"],
        agencia:    ["agencia","agência","ag"],
        conta:      ["conta","cc","c/c","account","numero da conta","número da conta"],
        codigos:    ["codigos","códigos","codigo","código","token","chave","codigo de acesso","código de acesso"],
        observacoes:["observacoes","observações","observacao","observação","obs","notas","nota","comentario","comentário"]
      };
      const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
      const list = accesses[gkey] || [];
      let nextId = list.length ? Math.max(...list.map(x => x.id)) + 1 : 1;
      let imported = 0;
      rowsJson.forEach(r => {
        const item = { id: nextId, banco:"", usuario:"", senha:"", agencia:"", conta:"", codigos:"", observacoes:"" };
        Object.keys(r).forEach(colName => {
          const nk = norm(colName);
          for (const [target, aliases] of Object.entries(mapping)) {
            if (aliases.some(a => nk === norm(a) || nk.includes(norm(a)))) {
              const val = String(r[colName] == null ? "" : r[colName]).trim();
              if (val && !item[target]) item[target] = val;
              break;
            }
          }
        });
        const hasContent = ["banco","usuario","senha","agencia","conta","codigos","observacoes"].some(k => item[k]);
        if (hasContent) { list.push(item); nextId++; imported++; }
      });
      accesses[gkey] = list;
      saveAccesses();
      render();
      alert(`Importados ${imported} acesso(s) da planilha.`);
    } catch (err) {
      alert("Erro ao importar planilha: " + err.message);
    }
    ev.target.value = "";
  };
  reader.readAsArrayBuffer(file);
}
