/* =============================================================
 * Modulo: modules/auditoria/calendario.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- Calendário de Documentos ----------
function openCalendarModal() {
  const today = new Date();
  if (calendarView.year == null) { calendarView.year = today.getFullYear(); calendarView.month = today.getMonth(); }
  calendarView.open = true;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "calendar-overlay";
  overlay.innerHTML = renderCalendarModal();
  document.body.appendChild(overlay);
}
function closeCalendarModal() { calendarView.open = false; const el = document.getElementById("calendar-overlay"); if (el) el.remove(); }
function refreshCalendar() { const el = document.getElementById("calendar-overlay"); if (el) el.innerHTML = renderCalendarModal(); }
function calendarNav(delta) {
  let m = calendarView.month + delta;
  let y = calendarView.year;
  if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
  calendarView.month = m; calendarView.year = y;
  refreshCalendar();
}
function calendarTodayNav() {
  const t = new Date(); calendarView.year = t.getFullYear(); calendarView.month = t.getMonth();
  refreshCalendar();
}
function onCalendarFilter(kind, value) {
  if (kind === "group") calendarView.filterGroup = value;
  else if (kind === "status") calendarView.filterStatus = value;
  refreshCalendar();
}
function collectCalendarItems(year, month) {
  // Retorna itens para o mês/ano informado: { gkey, gname, rem, dueDate:Date, statusTag }
  const groups = buildGroups();
  const items = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cycleKey = year + "-" + String(month + 1).padStart(2, "0");
  const today = new Date(); today.setHours(0,0,0,0);
  const cdim = lastDay.getDate();
  groups.forEach((g) => {
    if (calendarView.filterGroup && g.key !== calendarView.filterGroup) return;
    (reminders[g.key] || []).forEach((rem) => {
      if (!rem.ativo) return;
      const gname = customLabels[g.key] != null ? customLabels[g.key] : g.label;
      let due, status;
      if (rem.frequencia === "unica") {
        if (!rem.dataUnica) return;
        const [Y, M, D] = rem.dataUnica.split("-").map(Number);
        if (Y !== year || (M - 1) !== month) return;
        due = new Date(Y, M - 1, D);
        status = rem.status || "pendente";
      } else {
        const dia = Math.min(rem.diaMes || 1, cdim);
        due = new Date(year, month, dia);
        const cyc = rem.statusCycle;
        status = (cyc && cyc.key === cycleKey) ? cyc.status : "pendente";
      }
      // Categoria visual (apenas se pendente)
      let tag = status;
      if (status === "pendente") {
        const diff = Math.round((due - today) / 86400000);
        const ant = Number.isFinite(rem.antecedenciaDias) ? rem.antecedenciaDias : 0;
        if (diff < 0) tag = "atrasado";
        else if (diff <= ant) tag = "proximo";
        else tag = "pendente";
      }
      if (calendarView.filterStatus && tag !== calendarView.filterStatus) return;
      items.push({ gkey: g.key, gname, rem, dueDate: due, statusTag: tag });
    });
  });
  return items;
}
function renderCalendarModal() {
  const y = calendarView.year, m = calendarView.month;
  const items = collectCalendarItems(y, m);
  const byDay = {};
  items.forEach((it) => {
    const d = it.dueDate.getDate();
    (byDay[d] = byDay[d] || []).push(it);
  });
  const groups = buildGroups();
  const groupOptions = groups.map((g) => {
    const label = customLabels[g.key] != null ? customLabels[g.key] : g.label;
    return `<option value="${esc(g.key)}" ${calendarView.filterGroup === g.key ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");
  const firstOfMonth = new Date(y, m, 1);
  const startDow = firstOfMonth.getDay(); // 0 = Dom
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const isCurMonth = today.getFullYear() === y && today.getMonth() === m;
  const dow = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  let cells = "";
  // Preencher dias anteriores em cinza para completar a primeira semana
  const prevDaysToShow = startDow;
  const prevMonthLastDay = new Date(y, m, 0).getDate();
  for (let i = prevDaysToShow; i > 0; i--) {
    cells += `<div class="cal-cell other"><span class="cal-day-num">${prevMonthLastDay - i + 1}</span></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayItems = (byDay[d] || []).slice().sort((a,b) => a.gname.localeCompare(b.gname, "pt-BR"));
    const isToday = isCurMonth && today.getDate() === d;
    const itemsHtml = dayItems.map((it) => `
      <div class="cal-item status-${it.statusTag}" title="${esc(it.gname)} — ${esc(it.rem.documento)}" onclick="calendarGoToItem('${jsq(it.gkey)}')">
        ${esc(it.rem.documento)} · ${esc(it.gname)}
      </div>
    `).join("");
    cells += `<div class="cal-cell ${isToday ? "today" : ""}"><span class="cal-day-num">${d}</span>${itemsHtml}</div>`;
  }
  // completar até múltiplo de 7
  const totalCells = prevDaysToShow + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    cells += `<div class="cal-cell other"><span class="cal-day-num">${i}</span></div>`;
  }
  return `
    <div class="modal cal-modal">
      <h3>📅 Calendário de Documentos</h3>
      <div class="cal-toolbar">
        <div class="cal-nav">
          <button class="btn btn-sm" onclick="calendarNav(-1)">‹</button>
          <span class="cal-month-label">${MESES_PT[m]} / ${y}</span>
          <button class="btn btn-sm" onclick="calendarNav(1)">›</button>
          <button class="btn btn-sm" onclick="calendarTodayNav()">Hoje</button>
        </div>
        <select class="col-filter" style="max-width:240px" onchange="onCalendarFilter('group', this.value)">
          <option value="">Todas as empresas/grupos</option>
          ${groupOptions}
        </select>
        <select class="col-filter" style="max-width:200px" onchange="onCalendarFilter('status', this.value)">
          <option value="">Todos os status</option>
          <option value="atrasado" ${calendarView.filterStatus === "atrasado" ? "selected" : ""}>⚠ Atrasado</option>
          <option value="proximo" ${calendarView.filterStatus === "proximo" ? "selected" : ""}>🕒 Próximo a solicitar</option>
          <option value="pendente" ${calendarView.filterStatus === "pendente" ? "selected" : ""}>Programado</option>
          <option value="solicitado" ${calendarView.filterStatus === "solicitado" ? "selected" : ""}>Solicitado</option>
          <option value="recebido" ${calendarView.filterStatus === "recebido" ? "selected" : ""}>Recebido</option>
        </select>
        ${(calendarView.filterGroup || calendarView.filterStatus) ? `<button class="btn btn-sm" onclick="calendarView.filterGroup='';calendarView.filterStatus='';refreshCalendar()">Limpar filtros</button>` : ""}
        <span style="margin-left:auto"><button class="btn" onclick="closeCalendarModal()">Fechar</button></span>
      </div>
      <div class="cal-grid">
        ${dow.map((d) => `<div class="cal-dow">${d}</div>`).join("")}
        ${cells}
      </div>
      <div class="cal-legend">
        <span><span class="swatch" style="background:rgba(239,68,68,.4)"></span>Atrasado</span>
        <span><span class="swatch" style="background:rgba(245,158,11,.45)"></span>Próximo a solicitar</span>
        <span><span class="swatch" style="background:rgba(139,150,163,.35)"></span>Programado</span>
        <span><span class="swatch" style="background:rgba(79,195,232,.45)"></span>Solicitado</span>
        <span><span class="swatch" style="background:rgba(34,197,94,.45)"></span>Recebido</span>
      </div>
    </div>
  `;
}
function calendarGoToItem(gkey) {
  closeCalendarModal();
  view = { type: "group", key: gkey };
  activeTab = "lembretes";
  render();
}
