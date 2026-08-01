/* =============================================================
 * Modulo: modules/auditoria/historico.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- Histórico por competência ----------
function renderStaticSituacao(row) {
  const sit = row.situacao || "Pendente";
  const st = situacaoStyle(sit);
  return `<td><span class="badge" style="background:${st.bg};color:${st.text};border:1px solid ${st.border}"><span class="status-dot" style="background:${st.dot};margin-right:6px"></span>${esc(sit)}</span></td>`;
}
function renderSnapshotEditCell(row, col, idx) {
  const f = col.field;
  const inputId = `snap-${idx}-${f}`;
  if (f === "situacao") {
    const opts = SITUACOES.map((s) => `<option value="${esc(s)}" ${row.situacao === s ? "selected" : ""}>${esc(s)}</option>`).join("");
    return `<td><select id="${inputId}" class="col-filter" style="min-width:170px">${opts}</select></td>`;
  }
  if (f === "observacao") {
    return `<td><textarea id="${inputId}" class="obs-editable" style="width:220px;min-height:48px">${esc(row.observacao || "")}</textarea></td>`;
  }
  if (DATE_FIELDS.has(f)) {
    return `<td><input type="date" id="${inputId}" value="${esc(brToIso(row[f] || ""))}"></td>`;
  }
  if (f === "empresa") {
    return `<td><input type="text" id="${inputId}" class="edit-input wide" value="${esc(row.empresa || "")}"></td>`;
  }
  return `<td><input type="text" id="${inputId}" class="edit-input" value="${esc(row[f] || "")}"></td>`;
}
function snapshotCounts(rowsList) {
  const c = { ok: 0, parcial: 0, sem: 0, pend: 0 };
  rowsList.forEach((r) => {
    const s = r.situacao || "Pendente";
    if (s === "Totalmente conciliado") c.ok++;
    else if (s === "Parcialmente conciliado") c.parcial++;
    else if (s === "Sem movimentação") c.sem++;
    else c.pend++;
  });
  return c;
}
function formatDateTime(iso) {
  const dt = new Date(iso);
  if (isNaN(dt)) return "";
  return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function renderHistoricoTab(gkey) {
  const list = historico[gkey] || [];
  if (!list.length) {
    return `<div class="empty-state">Nenhuma competência arquivada ainda.<br>Use "📦 Arquivar competência" para guardar um snapshot do mês atual e poder consultá-lo depois.</div>`;
  }
  const items = list.map((snap) => {
    const c = snapshotCounts(snap.rows);
    return `
      <div class="access-item">
        <div class="access-item-title">
          <h4>${esc(snap.label)}</h4>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm" onclick="viewHistoricoSnapshot('${jsq(gkey)}', ${snap.id})">Ver / Editar</button>
            <button class="btn-danger-ghost" onclick="deleteHistoricoSnapshot('${jsq(gkey)}', ${snap.id})" title="Excluir">✕</button>
          </div>
        </div>
        <div class="sub" style="margin-bottom:0">Arquivado em ${esc(formatDateTime(snap.archivedAt))} · ${snap.rows.length} conta(s) · ${c.ok} concluído, ${c.parcial} parcial, ${c.sem} sem mov., ${c.pend} pendente</div>
      </div>
    `;
  }).join("");
  return `<div class="modal-toolbar" style="margin:0 0 12px">
      <p class="hint" style="margin:0;flex:1">Snapshots salvos das competências fechadas para este grupo/empresa.</p>
      <button class="btn btn-danger btn-sm" onclick="limparHistorico('${jsq(gkey)}')">🗑 Excluir histórico</button>
    </div>${items}`;
}
function openArchiveModal(key) {
  const groups = buildGroups();
  const g = groups.find((x) => x.key === key);
  if (!g) return;
  const freq = {};
  g.rows.forEach((r) => { if (r.competencia) freq[r.competencia] = (freq[r.competencia] || 0) + 1; });
  let suggestion = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || "";
  if (!suggestion) suggestion = MESES_PT[new Date().getMonth()];
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "archive-modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="width:420px">
      <h3>Arquivar competência</h3>
      <p class="hint" style="margin-top:0">Salva uma cópia do estado atual (${g.rows.length} conta(s)) no histórico deste grupo/empresa. Você poderá consultar depois na aba Histórico.</p>
      <label>Competência / Mês</label>
      <input type="text" id="ah-label" value="${esc(suggestion)}" placeholder="Ex: JUNHO/2026">
      <label style="display:flex;align-items:flex-start;gap:8px;margin-top:16px;cursor:pointer">
        <input type="checkbox" id="ah-reset" style="margin-top:3px">
        <span style="font-size:13px;color:#C7CBD1">Iniciar nova competência agora (limpa situação, observação e datas para recomeçar o próximo mês)</span>
      </label>
      <div class="actions">
        <button class="btn" onclick="closeArchiveModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="confirmArchive('${jsq(key)}')">Arquivar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("ah-label").focus();
}
function closeArchiveModal() { const el = document.getElementById("archive-modal-overlay"); if (el) el.remove(); }
function confirmArchive(key) {
  const label = document.getElementById("ah-label").value.trim();
  if (!label) { alert("Informe um nome para a competência."); return; }
  const reset = document.getElementById("ah-reset").checked;
  const groups = buildGroups();
  const g = groups.find((x) => x.key === key);
  if (!g) return;
  const cols = getColumnsForKey(key);
  const snap = { id: Date.now(), label, archivedAt: new Date().toISOString(), cols, rows: JSON.parse(JSON.stringify(g.rows)) };
  if (!historico[key]) historico[key] = [];
  historico[key].unshift(snap);
  saveHistorico();
  if (reset) {
    const ids = new Set(g.rows.map((r) => r.id));
    rows = rows.map((r) => ids.has(r.id) ? Object.assign({}, r, { situacao: "Pendente", observacao: "", saldo_batendo: "", data_conciliado: "", data_envio: "" }) : r);
    saveData();
  }
  closeArchiveModal();
  activeTab = "historico";
  render();
}
function viewHistoricoSnapshot(gkey, id) {
  const snap = (historico[gkey] || []).find((s) => s.id === id);
  if (!snap) return;
  const c = snapshotCounts(snap.rows);
  const rowsHtml = snap.rows.map((r, idx) => `<tr>${snap.cols.map((col) => renderSnapshotEditCell(r, col, idx)).join("")}</tr>`).join("");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "snapshot-modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="width:min(960px,94vw)">
      <h3>${esc(snap.label)}</h3>
      <p class="hint" style="margin-top:-10px">Arquivado em ${esc(formatDateTime(snap.archivedAt))} · ${snap.rows.length} conta(s) · ${c.ok} concluído, ${c.parcial} parcial, ${c.sem} sem mov., ${c.pend} pendente</p>
      <p class="hint" style="margin-top:-6px">Você pode editar os valores diretamente e clicar em "Salvar alterações".</p>
      <div class="table-wrap snapshot-table-wrap">
        <table>
          <thead><tr>${snap.cols.map((col) => `<th>${esc(col.label)}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="actions">
        <button class="btn" onclick="closeSnapshotModal()">Fechar sem salvar</button>
        <button class="btn btn-primary" onclick="saveSnapshotEdits('${jsq(gkey)}', ${snap.id})">💾 Salvar alterações</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
function saveSnapshotEdits(gkey, id) {
  const snap = (historico[gkey] || []).find((s) => s.id === id);
  if (!snap) return;
  snap.rows = snap.rows.map((row, idx) => {
    const newRow = Object.assign({}, row);
    snap.cols.forEach((col) => {
      const f = col.field;
      const el = document.getElementById(`snap-${idx}-${f}`);
      if (!el) return;
      newRow[f] = DATE_FIELDS.has(f) ? (el.value ? isoToBr(el.value) : "") : el.value;
    });
    return newRow;
  });
  saveHistorico();
  closeSnapshotModal();
  render();
}
function closeSnapshotModal() { const el = document.getElementById("snapshot-modal-overlay"); if (el) el.remove(); }
function deleteHistoricoSnapshot(gkey, id) {
  if (!confirm("Excluir este snapshot do histórico? Essa ação não pode ser desfeita.")) return;
  historico[gkey] = (historico[gkey] || []).filter((s) => s.id !== id);
  saveHistorico();
  render();
}
