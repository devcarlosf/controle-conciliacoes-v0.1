/* =============================================================
 * Modulo: modules/empresas/grupoConfig.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- pin / settings / reports ----------
function togglePin(key, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  if (pinned.has(key)) pinned.delete(key); else pinned.add(key);
  savePinned(); render();
}
function openGroupSettings(key, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const currentLabel = customLabels[key] != null ? customLabels[key] : key;
  const currentDesc = customDescriptions[key] || "";
  const rep = reports[key] || { url: "", senha: "" };
  const type = getType(key);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "group-settings-modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="width:480px">
      <h3>Configurações · ${esc(key)}</h3>

      <label>Tipo</label>
      <div class="type-radio" id="st-type">
        <label class="${type==='americano'?'selected':''}" onclick="selectType('americano')">
          <input type="radio" name="st-type-radio" value="americano" ${type==='americano'?'checked':''}>
          <span>
            <span class="k">Financeiro Americano</span>
            <span class="d">Saldo batendo, Data conciliado, GGG, Situação</span>
          </span>
        </label>
        <label class="${type==='controladoria'?'selected':''}" onclick="selectType('controladoria')">
          <input type="radio" name="st-type-radio" value="controladoria" ${type==='controladoria'?'checked':''}>
          <span>
            <span class="k">Controladoria</span>
            <span class="d">Somente Data de envio do relatório</span>
          </span>
        </label>
      </div>

      <label>Nome exibido</label>
      <input type="text" id="st-label" value="${esc(currentLabel)}">
      <label>Descrição</label>
      <textarea id="st-desc" rows="3" placeholder="Ex: Conciliação semanal, contato: fulano...">${esc(currentDesc)}</textarea>
      <label>Link do relatório</label>
      <input type="url" id="st-url" placeholder="https://..." value="${esc(rep.url)}">
      <label>Senha do relatório</label>
      <input type="text" id="st-senha" placeholder="Senha para acessar" value="${esc(rep.senha)}">
      <div class="hint">Dados salvos no navegador.</div>
      <div class="actions">
        <button class="btn" onclick="closeGroupSettingsModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveGroupSettingsModal('${jsq(key)}')">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("st-label").focus();
}
function selectType(t) {
  document.querySelectorAll("#st-type label").forEach(lbl => lbl.classList.remove("selected"));
  const inp = document.querySelector(`#st-type input[value="${t}"]`);
  if (inp) { inp.checked = true; inp.closest("label").classList.add("selected"); }
}
function closeGroupSettingsModal() { const el = document.getElementById("group-settings-modal-overlay"); if (el) el.remove(); }
function saveGroupSettingsModal(key) {
  const label = document.getElementById("st-label").value.trim();
  const desc = document.getElementById("st-desc").value.trim();
  const url = document.getElementById("st-url").value.trim();
  const senha = document.getElementById("st-senha").value;
  const typeInp = document.querySelector('#st-type input[name="st-type-radio"]:checked');
  const type = typeInp ? typeInp.value : "americano";
  if (!label || label === key) delete customLabels[key]; else customLabels[key] = label;
  if (!desc) delete customDescriptions[key]; else customDescriptions[key] = desc;
  if (!url && !senha) delete reports[key]; else reports[key] = { url, senha };
  if (type === "americano") delete customTypes[key]; else customTypes[key] = type;
  saveLabels(); saveDescriptions(); saveReports(); saveTypes();
  closeGroupSettingsModal();
  render();
}

function openReportModal(key, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const rep = reports[key];
  if (!rep || (!rep.url && !rep.senha)) { openGroupSettings(key); return; }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "report-modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="width:440px">
      <h3>Relatório · ${esc(customLabels[key] || key)}</h3>
      ${rep.url ? `<label>Link</label>
        <input type="text" value="${esc(rep.url)}" readonly>
        <div style="margin-top:8px"><a href="${esc(rep.url)}" target="_blank" rel="noopener" class="btn btn-primary" style="text-decoration:none">Abrir relatório ↗</a></div>` : ""}
      ${rep.senha ? `<label>Senha</label>
        <div class="password-row">
          <input type="text" id="rp-senha" value="${esc(rep.senha)}" readonly>
          <button class="copy-btn" onclick="copyReportSenha(event)">Copiar</button>
        </div>` : ""}
      <div class="actions">
        <button class="btn" onclick="closeReportModal()">Fechar</button>
        <button class="btn" onclick="closeReportModal(); openGroupSettings('${jsq(key)}')">Editar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
function closeReportModal() { const el = document.getElementById("report-modal-overlay"); if (el) el.remove(); }
function copyReportSenha(ev) {
  const el = document.getElementById("rp-senha");
  if (!el) return;
  navigator.clipboard.writeText(el.value).catch(()=>{ el.select(); document.execCommand("copy"); });
  const btn = ev.target; const old = btn.textContent;
  btn.textContent = "Copiado!"; setTimeout(()=>btn.textContent=old, 1200);
}
function openDeleteGroupModal(key, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const groups = buildGroups();
  const g = groups.find((x) => x.key === key);
  if (!g) return;
  const label = customLabels[key] != null ? customLabels[key] : key;
  const empresasList = Array.from(g.companies);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "delete-group-modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="width:460px">
      <h3>🗑 Excluir ${g.isGrupo ? "grupo" : "empresa"}</h3>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0 0 10px">
        Tem certeza que deseja excluir <strong>${esc(label)}</strong>?
      </p>
      ${g.isGrupo ? `<p style="font-size:12.5px;color:var(--text-muted);margin:0 0 10px">Empresas neste grupo: ${empresasList.map(esc).join(", ")}</p>` : ""}
      <p style="font-size:12.5px;color:var(--text-muted);line-height:1.6;margin:0 0 14px">
        Isso removerá <strong>${g.rows.length}</strong> conta(s)/conciliação(ões), além de lembretes, acessos, histórico, relatório e configurações associados.
      </p>
      <p style="font-size:12.5px;color:#F87171;font-weight:600;margin:0">Esta ação não pode ser desfeita.</p>
      <div class="actions">
        <button class="btn" onclick="closeDeleteGroupModal()">Cancelar</button>
        <button class="btn" style="background:#EF4444;border-color:#EF4444;color:#fff" onclick="confirmDeleteGroup('${jsq(key)}')">Excluir definitivamente</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
function closeDeleteGroupModal() { const el = document.getElementById("delete-group-modal-overlay"); if (el) el.remove(); }
function confirmDeleteGroup(key) {
  const removidas = rows.filter((r) => groupKey(r) === key).map((r) => r.empresa);
  rows = rows.filter((r) => groupKey(r) !== key);
  empresasCadastro = empresasCadastro.filter((e) => !(removidas.includes(e.nome) || (e.grupo || e.nome) === key));
  purgeKey(key);
  persist();
  closeDeleteGroupModal();
  if (view.type === "group" && view.key === key) {
    view = { type: "home" };
    activeTab = "conciliacoes";
  }
  render();
  notify("Excluído com sucesso.");
}
function editBadgeText(key, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const current = customBadges[key] != null ? customBadges[key] : "Semanal";
  const next = prompt("Editar texto da etiqueta:", current);
  if (next === null) return;
  const t = next.trim();
  if (!t || t.toLowerCase() === "semanal") delete customBadges[key]; else customBadges[key] = t;
  saveBadges(); render();
}
