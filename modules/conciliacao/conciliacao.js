/* =============================================================
 * Modulo: modules/conciliacao/conciliacao.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- render: GROUP DETAIL ----------
function renderGroupDetail() {
  const groups = buildGroups();
  const g = groups.find((x) => x.key === view.key);
  if (!g) { view = { type: "home" }; return renderHome(); }

  const type = getType(g.key);
  const cols = getColumnsForKey(g.key);
  const displayLabel = customLabels[g.key] != null ? customLabels[g.key] : g.label;
  const desc = customDescriptions[g.key] || "";
  const hasReport = reports[g.key] && (reports[g.key].url || reports[g.key].senha);
  const keyEsc = jsq(g.key);

  const header = `
    <div class="header">
      <div>
        <div class="breadcrumb"><a onclick="goHome()">← Todas as empresas</a></div>
        <h1>${esc(displayLabel)} <span class="type-tag ${type}">${type === 'controladoria' ? 'Controladoria' : 'Fin. Americano'}</span></h1>
        <p>${g.isGrupo ? `${g.companies.size} empresa(s) neste grupo` : "Empresa individual"}${desc ? " · " + esc(desc) : ""}</p>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="openGroupSettings('${keyEsc}')">⚙ Configurações</button>
          ${hasReport ? `<button class="btn btn-sm" onclick="openReportModal('${keyEsc}')">📄 Relatório</button>` : ''}
          <button class="btn btn-sm" onclick="openArchiveModal('${keyEsc}')">📦 Arquivar competência</button>
          <button class="btn btn-sm" style="color:#F87171" onclick="openDeleteGroupModal('${keyEsc}')">🗑 Excluir</button>
        </div>
      </div>
      <div class="save-indicator" id="save-indicator"></div>
    </div>

    <div class="tabs">
      <button class="tab ${activeTab==='conciliacoes'?'active':''}" onclick="setTab('conciliacoes')">Conciliações</button>
      <button class="tab ${activeTab==='lembretes'?'active':''}" onclick="setTab('lembretes')">🔔 Lembretes${(() => { const n = (reminders[g.key]||[]).filter(r => { const i = computeReminderDueInfo(r); return i && i.status !== "concluido"; }).length; return n ? ` (${n})` : ""; })()}</button>
      <button class="tab ${activeTab==='historico'?'active':''}" onclick="setTab('historico')">🗂 Histórico${(historico[g.key]||[]).length ? ` (${(historico[g.key]||[]).length})` : ''}</button>
      <button class="tab ${activeTab==='acessos'?'active':''}" onclick="setTab('acessos')">🔐 Acessos</button>
      <button class="tab ${activeTab==='importacoes'?'active':''}" onclick="setTab('importacoes')">📥 Importações${(importacoes[g.key]||[]).length ? ` (${(importacoes[g.key]||[]).length})` : ''}</button>
    </div>
  `;

  if (activeTab === "acessos") {
    return header + renderAccessTab(g.key);
  }
  if (activeTab === "importacoes") {
    return header + renderImportTab(g.key);
  }
  if (activeTab === "historico") {
    return header + renderHistoricoTab(g.key);
  }
  if (activeTab === "lembretes") {
    return header + renderRemindersTab(g.key);
  }

  return header + renderConciliacoesTab(g, cols);
}

function renderConciliacoesTab(g, cols) {
  const term = groupSearch.trim().toLowerCase();
  let list = g.rows.filter((r) => {
    for (const col of cols) {
      const active = columnFilters[col.field];
      if (!active) continue;
      const raw = col.field === "situacao" ? (r.situacao || "Pendente") : (r[col.field] || "");
      if (active === "__EMPTY__") { if (raw !== "") return false; }
      else if (raw !== active) return false;
    }
    if (categoryFilter) {
      const rc = getRowCategory(r.id);
      if (categoryFilter === "__NONE__") { if (rc) return false; }
      else if (rc !== categoryFilter) return false;
    }
    if (!term) return true;
    const rc = getRowCategory(r.id);
    return [r.empresa, r.banco, r.observacao, r.competencia, rc].filter(Boolean).some((v) => v.toLowerCase().includes(term));
  });

  if (sortField) {
    list = list.slice().sort((a, b) => {
      const cmp = compareValues(a, b, sortField);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const counts = { total: g.rows.length, ok: 0, parcial: 0, sem: 0, pend: 0 };
  g.rows.forEach((r) => {
    const s = r.situacao || "Pendente";
    if (s === "Totalmente conciliado") counts.ok++;
    else if (s === "Parcialmente conciliado") counts.parcial++;
    else if (s === "Sem movimentação") counts.sem++;
    else counts.pend++;
  });
  const semData = g.rows.filter((r) => !r.data_conciliado && !r.data_envio).length;
  const semObs = g.rows.filter((r) => !r.observacao).length;

  const rowsHtml = bulkDateEdit
    ? list.map((row) => renderBulkEditRow(row, cols)).join("")
    : list.map((row) => renderDisplayRow(row, cols)).join("");
  const colspan = cols.length + 1;

  const quickFilters = [
    { key: "", label: "Todos", count: g.rows.length },
    { key: "pendente", label: "Pendentes", count: counts.pend },
    { key: "parcial", label: "Parciais", count: counts.parcial },
    { key: "sem_data", label: "Sem data", count: semData },
    { key: "sem_obs", label: "Sem observação", count: semObs },
  ];
  const activeQuick = currentQuickFilter();

  return `
    <div class="summary-grid">
      <div class="summary-card"><div class="summary-icon" style="background:rgba(79,195,232,.12);color:#4FC3E8">Σ</div><div><div class="label">Total de contas</div><div class="value" style="color:#4FC3E8">${counts.total}</div></div></div>
      <div class="summary-card"><div class="summary-icon" style="background:rgba(52,211,153,.12);color:#34D399">✓</div><div><div class="label">Totalmente conciliado</div><div class="value" style="color:#34D399">${counts.ok}</div></div></div>
      <div class="summary-card"><div class="summary-icon" style="background:rgba(251,191,36,.12);color:#FBBF24">◐</div><div><div class="label">Parcialmente conciliado</div><div class="value" style="color:#FBBF24">${counts.parcial}</div></div></div>
      <div class="summary-card"><div class="summary-icon" style="background:rgba(154,161,172,.14);color:#9AA1AC">–</div><div><div class="label">Sem movimentação</div><div class="value" style="color:#9AA1AC">${counts.sem}</div></div></div>
      <div class="summary-card"><div class="summary-icon" style="background:rgba(248,113,113,.12);color:#F87171">!</div><div><div class="label">Pendente</div><div class="value" style="color:#F87171">${counts.pend}</div></div></div>
    </div>

    <div class="quick-filters">
      ${quickFilters.map((qf) => `<button class="quick-filter-chip ${activeQuick === qf.key ? "active" : ""}" onclick="applyQuickFilter('${qf.key}')">${esc(qf.label)} <b>${qf.count}</b></button>`).join("")}
    </div>

    ${renderCategoryFilterBar(g.rows)}

    <div class="toolbar">
      <input type="text" class="search-input" placeholder="Buscar por empresa, banco, categoria, observação..." value="${esc(groupSearch)}" oninput="onSearchGroup(this.value)">
      ${!bulkDateEdit && hasActiveColumnFilters() ? `<button class="btn" onclick="clearColumnFilters()">Limpar filtros de coluna</button>` : ""}
      <button class="btn" onclick="openCategoryManager()" title="Gerenciar categorias disponíveis">🏷 Categorias</button>
      ${bulkDateEdit ? `
        <button class="btn btn-sm" onclick="fillAllBulkDatesToday('${jsq(g.key)}')" title="Preenche a data principal de todas as linhas com a data de ontem">📅 Preencher ontem em todas</button>
        <button class="btn btn-primary" onclick="saveBulkDateEdit()">💾 Salvar todas as datas</button>
        <button class="btn" onclick="cancelBulkDateEdit()">Cancelar</button>
      ` : `
        <button class="btn" onclick="startBulkDateEdit('${jsq(g.key)}')" title="Editar a data de cada conta de uma só vez, sem abrir uma por uma">🗓 Editar todas as datas</button>
        <button class="btn btn-primary" onclick="addRowToGroup('${jsq(g.key)}', ${g.isGrupo})">+ Nova linha</button>
      `}
    </div>

    ${bulkDateEdit ? `<p class="hint" style="margin:-4px 0 10px">Ajuste a data de cada linha abaixo (ou use "Preencher ontem em todas") e clique em "Salvar todas as datas" ao final. Cada conta mantém seu próprio valor até você alterá-lo.</p>` : ""}

    <p class="count-line">Exibindo ${list.length} de ${g.rows.length} contas</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${cols.map((c) => {
              const active = sortField === c.field;
              const arrow = active ? `<span class="sort-arrow">${sortDir === "asc" ? "▲" : "▼"}</span>` : "";
              return `<th class="sortable" onclick="onSortColumn('${c.field}')" title="Ordenar por ${esc(c.label)}">${esc(c.label)}${arrow}</th>`;
            }).join("")}<th></th>
          </tr>
          <tr class="filter-row">${cols.map((c) => `<th>${renderColumnFilterSelect(c, g.rows)}</th>`).join("")}<th></th></tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="${colspan}" style="padding:32px;text-align:center;color:#9AA5AF;">Nenhum registro encontrado.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function currentQuickFilter() {
  if (columnFilters.situacao === "Pendente") return "pendente";
  if (columnFilters.situacao === "Parcialmente conciliado") return "parcial";
  if (columnFilters.data_conciliado === "__EMPTY__") return "sem_data";
  if (columnFilters.observacao === "__EMPTY__") return "sem_obs";
  return "";
}
function applyQuickFilter(kind) {
  Object.keys(columnFilters).forEach((k) => (columnFilters[k] = ""));
  if (kind === "pendente") columnFilters.situacao = "Pendente";
  else if (kind === "parcial") columnFilters.situacao = "Parcialmente conciliado";
  else if (kind === "sem_data") columnFilters.data_conciliado = "__EMPTY__";
  else if (kind === "sem_obs") columnFilters.observacao = "__EMPTY__";
  render();
}
function fillAllBulkDatesToday(gkey) {
  const field = getType(gkey) === "controladoria" ? "data_envio" : "data_conciliado";
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const iso = d.toISOString().slice(0, 10);
  Object.keys(bulkDraft).forEach((id) => { bulkDraft[id][field] = isoToBr(iso); });
  render();
}

function renderSituacaoCell(row) {
  const sit = row.situacao || "Pendente";
  const st = situacaoStyle(sit);
  const isOpen = openStatusId === row.id;
  const optionsHtml = SITUACOES.map((s) => {
    const os = situacaoStyle(s);
    const active = s === sit;
    return `<button type="button" class="status-option ${active ? "active" : ""}" onclick="event.stopPropagation(); onSituacaoChange(${row.id}, '${jsq(s)}')"><span class="status-dot" style="background:${os.dot}"></span>${esc(s)}</button>`;
  }).join("");
  return `<td>
    <div class="status-dropdown-wrap">
      <button type="button" class="status-trigger" style="background:${st.bg};color:${st.text};border-color:${st.border}" onclick="event.stopPropagation(); toggleStatusDropdown(${row.id})">
        <span class="status-dot" style="background:${st.dot}"></span>${esc(sit)}<span class="status-caret">▾</span>
      </button>
      ${isOpen ? `<div class="status-popover">${optionsHtml}</div>` : ""}
    </div>
  </td>`;
}
function toggleStatusDropdown(id) {
  openStatusId = openStatusId === id ? null : id;
  render();
}
function renderObservacaoCell(row) {
  return `<td class="obs-cell"><textarea class="obs-editable" placeholder="Adicionar observação, pendência ou anotação..." oninput="onObservacaoInput(${row.id}, this.value)">${esc(row.observacao)}</textarea></td>`;
}

function renderDisplayCell(row, col) {
  const f = col.field;
  if (f === "situacao") return renderSituacaoCell(row);
  if (f === "observacao") return renderObservacaoCell(row);
  const v = row[f] || "";
  if (DATE_FIELDS.has(f)) return `<td>${v ? `<span class="date-highlight">${esc(v)}</span>` : "—"}</td>`;
  if (f === "empresa") return `<td class="empresa-cell">${esc(v) || "—"}</td>`;
  if (f === "banco") {
    const cat = getRowCategory(row.id);
    return `<td class="banco-cell"><div class="banco-wrap"><span class="banco-name">${esc(v) || "—"}</span>${renderCategoryBadge(cat)}</div></td>`;
  }
  return `<td>${esc(v) || "—"}</td>`;
}
function renderDisplayRow(row, cols) {
  return `<tr>${cols.map(c => renderDisplayCell(row, c)).join("")}<td class="row-actions">
    <button class="btn btn-sm" onclick="openEditModal(${row.id})" title="Editar todos os campos">✎ Editar</button>
    <button class="icon-btn danger" onclick="deleteRow(${row.id})" title="Excluir lançamento">🗑</button>
  </td></tr>`;
}

function renderBulkDateCell(row, col) {
  const f = col.field;
  const d = bulkDraft[row.id] || {};
  const val = d[f] !== undefined ? d[f] : (row[f] || "");
  if (DATE_FIELDS.has(f)) {
    const inputId = `bulk-date-${row.id}-${f}`;
    return `<td><div class="date-edit-cell"><input type="date" id="${inputId}" class="edit-input" value="${esc(brToIso(val))}" onchange="updateBulkDraft(${row.id}, '${f}', this.value)"><button type="button" class="mini-today-btn" onclick="setBulkDateToday(${row.id}, '${f}', '${inputId}')">Ontem</button></div></td>`;
  }
  if (f === "competencia") {
    return `<td><input type="text" class="edit-input" style="width:80px" value="${esc(val)}" oninput="updateBulkDraftText(${row.id}, '${f}', this.value)"></td>`;
  }
  if (f === "situacao") {
    const sit = row.situacao || "Pendente";
    const st = situacaoStyle(sit);
    return `<td><span class="badge" style="background:${st.bg};color:${st.text};border:1px solid ${st.border}"><span class="status-dot" style="background:${st.dot};margin-right:6px"></span>${esc(sit)}</span></td>`;
  }
  if (f === "observacao") return `<td><span class="obs-display">${esc(row.observacao) || "—"}</span></td>`;
  if (f === "empresa") return `<td class="empresa-cell">${esc(row.empresa) || "—"}</td>`;
  return `<td>${esc(row[f]) || "—"}</td>`;
}
function setBulkDateToday(rowId, field, inputId) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const iso = d.toISOString().slice(0, 10);
  updateBulkDraft(rowId, field, iso);
  const el = document.getElementById(inputId);
  if (el) el.value = iso;
}
function renderBulkEditRow(row, cols) {
  return `<tr>${cols.map((c) => renderBulkDateCell(row, c)).join("")}<td class="row-actions"></td></tr>`;
}
function startBulkDateEdit(gkey) {
  const groups = buildGroups();
  const g = groups.find((x) => x.key === gkey);
  if (!g) return;
  bulkDraft = {};
  g.rows.forEach((r) => {
    bulkDraft[r.id] = {
      saldo_batendo: r.saldo_batendo || "",
      data_conciliado: r.data_conciliado || "",
      data_envio: r.data_envio || "",
      competencia: r.competencia || "",
    };
  });
  bulkDateEdit = true;
  render();
}
function updateBulkDraft(rowId, field, isoValue) {
  if (!bulkDraft[rowId]) bulkDraft[rowId] = {};
  bulkDraft[rowId][field] = isoValue ? isoToBr(isoValue) : "";
}
function updateBulkDraftText(rowId, field, value) {
  if (!bulkDraft[rowId]) bulkDraft[rowId] = {};
  bulkDraft[rowId][field] = value;
}
function saveBulkDateEdit() {
  rows = rows.map((r) => (bulkDraft[r.id] ? Object.assign({}, r, bulkDraft[r.id]) : r));
  saveData();
  bulkDateEdit = false;
  bulkDraft = {};
  render();
}
function cancelBulkDateEdit() {
  bulkDateEdit = false;
  bulkDraft = {};
  render();
}
