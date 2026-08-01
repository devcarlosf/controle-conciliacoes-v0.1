/* =============================================================
 * Modulo: modules/auditoria/lembretes.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- Lembretes de documentos ----------
function currentCycleKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function computeReminderDueInfo(rem) {
  if (!rem.ativo) return null;
  const todayD = new Date();
  todayD.setHours(0, 0, 0, 0);
  const antecedencia = Number.isFinite(rem.antecedenciaDias) ? rem.antecedenciaDias : 0;

  if (rem.frequencia === "unica") {
    const status = rem.status || "pendente";
    if (!rem.dataUnica) return null;
    const due = new Date(rem.dataUnica + "T00:00:00");
    const diffDays = Math.round((due - todayD) / 86400000);
    let categoria = null;
    if (status === "pendente") {
      const alertaDate = new Date(due);
      alertaDate.setDate(alertaDate.getDate() - antecedencia);
      if (diffDays < 0) categoria = "atrasado";
      else if (todayD >= alertaDate) categoria = "proximo";
    }
    return { status, dueDateBr: isoToBr(rem.dataUnica), diffDays, categoria, cycleKey: null };
  }

  // mensal
  const y = todayD.getFullYear(), m = todayD.getMonth();
  const curKey = currentCycleKey(todayD);
  const cyc = rem.statusCycle; // { key, status }
  let cycleY = y, cycleM = m;
  if (cyc && cyc.key === curKey && (cyc.status === "solicitado" || cyc.status === "recebido")) {
    cycleM = m === 11 ? 0 : m + 1;
    cycleY = m === 11 ? y + 1 : y;
  }
  const cdim = new Date(cycleY, cycleM + 1, 0).getDate();
  const dia = Math.min(rem.diaMes || 1, cdim);
  const due = new Date(cycleY, cycleM, dia);
  const cycleKeyForDue = cycleY + "-" + String(cycleM + 1).padStart(2, "0");
  let status = "pendente";
  if (cyc && cyc.key === cycleKeyForDue) status = cyc.status;
  const diffDays = Math.round((due - todayD) / 86400000);
  let categoria = null;
  if (status === "pendente") {
    const alertaDate = new Date(due);
    alertaDate.setDate(alertaDate.getDate() - antecedencia);
    if (diffDays < 0) categoria = "atrasado";
    else if (todayD >= alertaDate) categoria = "proximo";
  }
  const dueIso = cycleY + "-" + String(cycleM + 1).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
  return { status, dueDateBr: isoToBr(dueIso), diffDays, categoria, cycleKey: cycleKeyForDue };
}
function reminderStatusStyle(tag) {
  switch (tag) {
    case "atrasado": return { bg: "rgba(239,68,68,.12)", text: "var(--text-primary)", border: "rgba(239,68,68,.35)", label: "Atrasado" };
    case "proximo": return { bg: "rgba(245,158,11,.12)", text: "var(--text-primary)", border: "rgba(245,158,11,.35)", label: "Próximo a solicitar" };
    case "solicitado": return { bg: "rgba(79,195,232,.12)", text: "var(--text-primary)", border: "rgba(79,195,232,.35)", label: "Solicitado" };
    case "recebido": return { bg: "rgba(34,197,94,.12)", text: "var(--text-primary)", border: "rgba(34,197,94,.35)", label: "Recebido" };
    default: return { bg: "rgba(148,163,184,.12)", text: "var(--text-primary)", border: "rgba(148,163,184,.30)", label: "Programado" };
  }
}
function reminderTag(info) {
  if (info.status === "solicitado") return "solicitado";
  if (info.status === "recebido") return "recebido";
  return info.categoria || "programado";
}
function renderRemindersHomePanel(groups) {
  const items = [];
  groups.forEach((g) => {
    (reminders[g.key] || []).forEach((rem) => {
      const info = computeReminderDueInfo(rem);
      if (!info || info.status !== "pendente" || !info.categoria) return;
      const gname = customLabels[g.key] != null ? customLabels[g.key] : g.label;
      items.push({ gkey: g.key, gname, rem, info });
    });
  });
  const atrasados = items.filter((it) => it.info.categoria === "atrasado").sort((a, b) => a.info.diffDays - b.info.diffDays);
  const proximos = items.filter((it) => it.info.categoria === "proximo").sort((a, b) => a.info.diffDays - b.info.diffDays);
  const total = items.length;

  const byGroup = {};
  items.forEach((it) => { byGroup[it.gname] = (byGroup[it.gname] || 0) + 1; });
  const groupChips = Object.keys(byGroup).sort((a, b) => byGroup[b] - byGroup[a])
    .map((name) => `<span class="reminder-group-chip">${esc(name)} <b>${byGroup[name]}</b></span>`).join("");

  function renderList(list, emptyMsg) {
    if (!list.length) return `<div class="reminder-empty-sub">${emptyMsg}</div>`;
    return list.map((it) => {
      const st = reminderStatusStyle(it.info.categoria);
      return `
        <div class="reminder-row">
          <div class="reminder-main" onclick="openGroup('${jsq(it.gkey)}')">
            <div class="reminder-doc">${esc(it.rem.documento)}</div>
            <div class="reminder-sub">${esc(it.gname)} · vence ${esc(it.info.dueDateBr)}</div>
          </div>
          <span class="badge" style="background:${st.bg};color:${st.text};border:1px solid ${st.border}">${st.label}</span>
          <button class="msg-btn" title="Gerar mensagem de solicitação" onclick="event.stopPropagation(); openTemplatePicker('${jsq(it.gkey)}','${jsq(it.rem.id)}')">💬 Solicitar</button>
          <button class="btn btn-sm" onclick="event.stopPropagation(); setReminderStatus('${jsq(it.gkey)}','${jsq(it.rem.id)}','solicitado')">✓ Solicitado</button>
        </div>
      `;
    }).join("");
  }

  if (!total) {
    return `
      <div class="reminder-card">
        <div class="reminder-header"><h3>🔔 Lembretes de documentos</h3><span class="hint">Nada pendente no momento</span><span class="reminder-header-actions"><button class="calendar-open-btn" title="Abrir calendário de documentos" onclick="openCalendarModal()">📅 Calendário</button></span></div>
      </div>
    `;
  }

  return `
    <div class="reminder-card">
      <div class="reminder-header"><h3>🔔 Lembretes de documentos</h3><span class="hint">${total} pendência(s) no total</span><span class="reminder-header-actions"><button class="calendar-open-btn" title="Abrir calendário de documentos" onclick="openCalendarModal()">📅 Calendário</button></span></div>
      ${groupChips ? `<div class="reminder-group-summary">${groupChips}</div>` : ""}
      <div class="reminder-section-label reminder-section-atrasado">⚠ Atrasados ${atrasados.length ? `(${atrasados.length})` : ""}</div>
      ${renderList(atrasados, "Nenhum documento atrasado.")}
      <div class="reminder-section-label reminder-section-proximo">🕒 Próximos a solicitar ${proximos.length ? `(${proximos.length})` : ""}</div>
      ${renderList(proximos, "Nada previsto para os próximos dias.")}
    </div>
  `;
}
function renderRemindersTab(gkey) {
  const list = reminders[gkey] || [];
  const withInfo = list.map((rem) => ({ rem, info: computeReminderDueInfo(rem) })).filter((x) => x.info);
  const pendentes = withInfo.filter((x) => x.info.status === "pendente").sort((a, b) => a.info.diffDays - b.info.diffDays);
  const aguardando = withInfo.filter((x) => x.info.status === "solicitado");
  const recebidos = withInfo.filter((x) => x.info.status === "recebido");

  function row({ rem, info }, actionsHtml) {
    const st = reminderStatusStyle(reminderTag(info));
    const freqLabel = rem.frequencia === "mensal" ? `Mensal · dia ${rem.diaMes}` : `Data única`;
    const antLabel = rem.antecedenciaDias ? ` · aviso ${rem.antecedenciaDias}d antes` : "";
    return `
      <div class="access-item">
        <div class="access-item-title">
          <h4>${esc(rem.documento)}</h4>
          <div style="display:flex;gap:4px">${actionsHtml}</div>
        </div>
        <div class="sub">${esc(freqLabel)}${antLabel} · vence ${esc(info.dueDateBr)}${rem.observacao ? " · " + esc(rem.observacao) : ""}</div>
        <span class="badge" style="background:${st.bg};color:${st.text};border:1px solid ${st.border}">${st.label}</span>
      </div>
    `;
  }

  const pendentesHtml = pendentes.map((x) => row(x, `
    <button class="msg-btn" onclick="openTemplatePicker('${jsq(gkey)}','${jsq(x.rem.id)}')">💬 Solicitar</button>
    <button class="btn btn-sm" onclick="setReminderStatus('${jsq(gkey)}','${jsq(x.rem.id)}','solicitado')">✓ Solicitado</button>
    <button class="btn btn-sm" onclick="openReminderModal('${jsq(gkey)}','${jsq(x.rem.id)}')">✎</button>
  `)).join("");

  const aguardandoHtml = aguardando.length ? `
    <p class="hint" style="margin:18px 0 8px">Aguardando recebimento</p>
    ${aguardando.map((x) => row(x, `
      <button class="btn btn-sm" onclick="setReminderStatus('${jsq(gkey)}','${jsq(x.rem.id)}','recebido')">✓ Recebido</button>
      <button class="btn btn-sm" onclick="reopenReminder('${jsq(gkey)}','${jsq(x.rem.id)}')">↺</button>
    `)).join("")}
  ` : "";

  const recebidosHtml = recebidos.length ? `
    <p class="hint" style="margin:18px 0 8px">Recebidos</p>
    ${recebidos.map((x) => `
      <div class="access-item" style="opacity:.6">
        <div class="access-item-title">
          <h4>${esc(x.rem.documento)}</h4>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm" onclick="reopenReminder('${jsq(gkey)}','${jsq(x.rem.id)}')">Reabrir</button>
            <button class="btn-danger-ghost" onclick="deleteReminder('${jsq(gkey)}','${jsq(x.rem.id)}')" title="Excluir">✕</button>
          </div>
        </div>
        <div class="sub" style="margin-bottom:0">Recebido${x.rem.frequencia === "mensal" ? " · o próximo ciclo abrirá automaticamente" : ""}</div>
      </div>
    `).join("")}
  ` : "";

  return `
    <div class="toolbar"><button class="btn btn-primary btn-sm" onclick="openReminderModal('${jsq(gkey)}')">+ Novo lembrete</button></div>
    ${pendentes.length ? pendentesHtml : `<div class="empty-state">Nenhum lembrete pendente.<br>Use "+ Novo lembrete" para cadastrar documentos que precisam ser solicitados periodicamente a este cliente.</div>`}
    ${aguardandoHtml}
    ${recebidosHtml}
  `;
}
function openReminderModal(gkey, id) {
  const list = reminders[gkey] || [];
  const rem = id ? list.find((r) => r.id === id) : null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "reminder-modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="width:440px">
      <h3>${rem ? "Editar lembrete" : "Novo lembrete"}</h3>
      <label>Documento / solicitação</label>
      <input type="text" id="rm-doc" placeholder="Ex: Extrato bancário Itaú, Fatura do cartão..." value="${rem ? esc(rem.documento) : ""}">
      <label style="margin-top:14px">Frequência</label>
      <select id="rm-freq" onchange="onReminderFreqChange()">
        <option value="mensal" ${!rem || rem.frequencia === "mensal" ? "selected" : ""}>Mensal (todo mês)</option>
        <option value="unica" ${rem && rem.frequencia === "unica" ? "selected" : ""}>Data específica (única)</option>
      </select>
      <div id="rm-mensal-field" style="margin-top:14px">
        <label>Dia do mês da solicitação</label>
        <input type="number" id="rm-dia" min="1" max="28" value="${rem && rem.diaMes ? rem.diaMes : 5}">
      </div>
      <div id="rm-unica-field" style="margin-top:14px; display:none">
        <label>Data da solicitação</label>
        <input type="date" id="rm-data" value="${rem && rem.dataUnica ? rem.dataUnica : ""}">
      </div>
      <label style="margin-top:14px">Antecedência do lembrete (dias antes da data)</label>
      <input type="number" id="rm-antecedencia" min="0" max="60" value="${rem && Number.isFinite(rem.antecedenciaDias) ? rem.antecedenciaDias : settings.antecedenciaPadrao}">
      <p class="hint" style="margin-top:4px">O lembrete passa a aparecer como "Próximo a solicitar" a partir dessa quantidade de dias antes da data.</p>
      <label style="margin-top:14px">Observação (opcional)</label>
      <textarea id="rm-obs" style="width:100%;min-height:50px" placeholder="Detalhe, contato do cliente, etc.">${rem ? esc(rem.observacao || "") : ""}</textarea>
      <div class="actions">
        ${rem ? `<button class="btn-danger-ghost" style="margin-right:auto" onclick="deleteReminder('${jsq(gkey)}','${jsq(rem.id)}')">Excluir</button>` : ""}
        <button class="btn" onclick="closeReminderModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveReminder('${jsq(gkey)}'${rem ? `,'${jsq(rem.id)}'` : ""})">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  onReminderFreqChange();
  document.getElementById("rm-doc").focus();
}
function onReminderFreqChange() {
  const freq = document.getElementById("rm-freq").value;
  document.getElementById("rm-mensal-field").style.display = freq === "mensal" ? "block" : "none";
  document.getElementById("rm-unica-field").style.display = freq === "unica" ? "block" : "none";
}
function closeReminderModal() { const el = document.getElementById("reminder-modal-overlay"); if (el) el.remove(); }
function saveReminder(gkey, id) {
  const documento = document.getElementById("rm-doc").value.trim();
  if (!documento) { alert("Informe o nome do documento/solicitação."); return; }
  const freq = document.getElementById("rm-freq").value;
  const obs = document.getElementById("rm-obs").value.trim();
  let ant = parseInt(document.getElementById("rm-antecedencia").value, 10);
  if (!Number.isFinite(ant) || ant < 0) ant = 0;
  if (!reminders[gkey]) reminders[gkey] = [];
  let rem = id ? reminders[gkey].find((r) => r.id === id) : null;
  if (!rem) {
    rem = { id: "r" + Date.now(), ativo: true, status: "pendente", statusCycle: null };
    reminders[gkey].push(rem);
  }
  rem.documento = documento;
  rem.frequencia = freq;
  rem.observacao = obs;
  rem.antecedenciaDias = ant;
  if (freq === "mensal") {
    let dia = parseInt(document.getElementById("rm-dia").value, 10);
    if (!dia || dia < 1) dia = 1;
    if (dia > 28) dia = 28;
    rem.diaMes = dia;
    rem.dataUnica = null;
  } else {
    const data = document.getElementById("rm-data").value;
    if (!data) { alert("Informe a data do lembrete."); return; }
    rem.dataUnica = data;
    if (!rem.status) rem.status = "pendente";
  }
  saveReminders();
  closeReminderModal();
  render();
}
function deleteReminder(gkey, id) {
  if (!confirm("Excluir este lembrete? Essa ação não pode ser desfeita.")) return;
  reminders[gkey] = (reminders[gkey] || []).filter((r) => r.id !== id);
  saveReminders();
  closeReminderModal();
  render();
}
function setReminderStatus(gkey, id, newStatus) {
  const rem = (reminders[gkey] || []).find((r) => r.id === id);
  if (!rem) return;
  if (rem.frequencia === "unica") {
    rem.status = newStatus;
  } else {
    let cycleKey;
    if (rem.statusCycle && rem.statusCycle.status === "solicitado" && newStatus === "recebido") {
      cycleKey = rem.statusCycle.key;
    } else {
      const info = computeReminderDueInfo(rem);
      cycleKey = info && info.cycleKey ? info.cycleKey : currentCycleKey(new Date());
    }
    rem.statusCycle = { key: cycleKey, status: newStatus };
  }
  saveReminders();
  render();
}
function reopenReminder(gkey, id) {
  const rem = (reminders[gkey] || []).find((r) => r.id === id);
  if (!rem) return;
  if (rem.frequencia === "unica") rem.status = "pendente";
  else rem.statusCycle = null;
  saveReminders();
  render();
}
