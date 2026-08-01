/* =============================================================
 * Modulo: modules/dashboard/dashboard.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- aging (tempo sem conciliar) ----------
function daysSinceLastConciliado(g) {
  const type = getType(g.key);
  const field = type === "controladoria" ? "data_envio" : "data_conciliado";
  let maxIso = null;
  g.rows.forEach((r) => {
    const iso = brToIso(r[field] || "");
    if (iso && (!maxIso || iso > maxIso)) maxIso = iso;
  });
  if (!maxIso) return null;
  const last = new Date(maxIso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - last) / 86400000);
  return { days, lastDate: isoToBr(maxIso) };
}
function setAgingFilter(includeControladoria) { agingIncludeControladoria = includeControladoria; render(); }
function renderAgingChart(groups) {
  const source = groups.filter((g) => agingIncludeControladoria || getType(g.key) !== "controladoria");
  const list = source
    .map((g) => {
      const info = daysSinceLastConciliado(g);
      return info ? Object.assign({ daysSince: info.days, lastDateBr: info.lastDate }, g) : null;
    })
    .filter((x) => x && x.daysSince > 0)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 8);

  const toggle = `
    <div class="aging-toggle">
      <button class="aging-toggle-btn ${!agingIncludeControladoria ? "active" : ""}" onclick="setAgingFilter(false)">Fin. Americano</button>
      <button class="aging-toggle-btn ${agingIncludeControladoria ? "active" : ""}" onclick="setAgingFilter(true)">Todos os tipos</button>
    </div>
  `;

  if (!list.length) {
    return `
      <div class="aging-card">
        <div class="aging-header">
          <div><h3>⏱ Sem conciliar há mais tempo</h3><span class="hint">Com base na última data registrada</span></div>
          ${toggle}
        </div>
        <div class="aging-empty">✓ Tudo em dia por aqui — nenhuma pendência de longa data encontrada.</div>
      </div>
    `;
  }

  const maxDays = Math.max(...list.map((x) => x.daysSince), 1);
  const rowsHtml = list.map((g, i) => {
    const pct = Math.max(8, Math.round((g.daysSince / maxDays) * 100));
    const label = customLabels[g.key] != null ? customLabels[g.key] : g.label;
    let tier;
    if (g.daysSince >= settings.agingVermelho) tier = { c1: "#F59E0B", c2: "#EF4444", chipBg: "rgba(239,68,68,.14)", chipText: "#F87171" };
    else if (g.daysSince >= settings.agingAmarelo) tier = { c1: "#22B8E0", c2: "#F59E0B", chipBg: "rgba(245,158,11,.14)", chipText: "#FBBF24" };
    else tier = { c1: "#1AA6D6", c2: "#22B8E0", chipBg: "rgba(26,166,214,.14)", chipText: "#4FC3E8" };
    return `
      <div class="aging-row" onclick="openGroup('${jsq(g.key)}')" title="Última conciliação registrada: ${esc(g.lastDateBr)}">
        <div class="aging-rank">${i + 1}</div>
        <div class="aging-main">
          <div class="aging-name">${esc(label)}</div>
          <div class="aging-bar-track"><div class="aging-bar-fill" style="width:${pct}%;background:linear-gradient(90deg, ${tier.c1}, ${tier.c2})"></div></div>
        </div>
        <div class="aging-days-badge" style="background:${tier.chipBg};color:${tier.chipText}">${g.daysSince}d</div>
      </div>
    `;
  }).join("");

  return `
    <div class="aging-card">
      <div class="aging-header">
        <div><h3>⏱ Sem conciliar há mais tempo</h3><span class="hint">Com base na última data registrada · clique para abrir</span></div>
        ${toggle}
      </div>
      ${rowsHtml}
    </div>
  `;
}

// ---------- render: HOME ----------
function renderHome() {
  const groups = buildGroups();
  const term = search.trim().toLowerCase();
  const groupNames = Array.from(new Set(rows.map((r) => r.grupo && r.grupo.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filtered = groups.filter((g) => {
    if (homeGroupFilter === "__UNGROUPED__") { if (g.isGrupo) return false; }
    else if (homeGroupFilter && g.key !== homeGroupFilter) return false;
    if (homeTypeFilter && getType(g.key) !== homeTypeFilter) return false;
    if (!term) return true;
    if (g.label.toLowerCase().includes(term)) return true;
    if (customLabels[g.key] && customLabels[g.key].toLowerCase().includes(term)) return true;
    if (customDescriptions[g.key] && customDescriptions[g.key].toLowerCase().includes(term)) return true;
    return Array.from(g.companies).some((c) => c.toLowerCase().includes(term));
  });

  const cards = filtered.map((g) => {
    const counts = { ok: 0, parcial: 0, sem: 0, pend: 0 };
    g.rows.forEach((r) => {
      const s = r.situacao || "Pendente";
      if (s === "Totalmente conciliado") counts.ok++;
      else if (s === "Parcialmente conciliado") counts.parcial++;
      else if (s === "Sem movimentação") counts.sem++;
      else counts.pend++;
    });
    const total = g.rows.length || 1;
    const bar = (n, color) => n ? `<div style="width:${(n/total*100)}%;background:${color}"></div>` : "";
    const sub = g.isGrupo
      ? `${g.companies.size} empresa${g.companies.size !== 1 ? "s" : ""} · ${g.rows.length} conta${g.rows.length !== 1 ? "s" : ""}`
      : `${g.rows.length} conta${g.rows.length !== 1 ? "s" : ""}`;
    const isPinned = pinned.has(g.key);
    const keyEsc = jsq(g.key);
    const displayLabel = customLabels[g.key] != null ? customLabels[g.key] : g.label;
    const badgeText = customBadges[g.key] != null ? customBadges[g.key] : "Semanal";
    const desc = customDescriptions[g.key] || "";
    const hasReport = reports[g.key] && (reports[g.key].url || reports[g.key].senha);
    const type = getType(g.key);
    return `
      <button class="group-card ${isPinned ? 'pinned' : ''}" onclick="openGroup('${keyEsc}')">
        <span class="pin-btn ${isPinned ? 'active' : ''}" title="${isPinned ? 'Remover destaque' : 'Destacar (lembrete semanal)'}" onclick="togglePin('${keyEsc}', event)">${isPinned ? '★' : '☆'}</span>
        <span class="gear-btn" title="Configurações" onclick="openGroupSettings('${keyEsc}', event)">⚙</span>
        <span class="trash-btn" title="Excluir" onclick="openDeleteGroupModal('${keyEsc}', event)">🗑</span>
        ${isPinned ? `<div class="weekly-badge">★ ${esc(badgeText)}<span class="badge-edit" title="Editar etiqueta" onclick="editBadgeText('${keyEsc}', event)">✎</span></div>` : ''}
        <div class="name">${esc(displayLabel)}</div>
        <div class="type-tag ${type}">${type === 'controladoria' ? 'Controladoria' : 'Fin. Americano'}</div>
        <div class="sub">${sub}</div>
        ${desc ? `<div class="desc">${esc(desc)}</div>` : ''}
        <div class="bars">
          ${bar(counts.ok, "#22C55E")}${bar(counts.parcial, "#F59E0B")}${bar(counts.sem, "#9AA1AC")}${bar(counts.pend, "#EF4444")}
        </div>
        <div class="stats">
          <span><span class="dot" style="background:#22C55E"></span>${counts.ok} concluído</span>
          <span><span class="dot" style="background:#F59E0B"></span>${counts.parcial} parcial</span>
          <span><span class="dot" style="background:#EF4444"></span>${counts.pend} pendente</span>
        </div>
        ${hasReport ? `<div><span class="report-btn" onclick="openReportModal('${keyEsc}', event)">📄 Relatório</span></div>` : ''}
      </button>
    `;
  }).join("");

  return `
    <div class="header">
      <div>
        <h1>Controle de Conciliações</h1>
        <p>Selecione um grupo ou empresa para ver os detalhes</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="save-indicator" id="save-indicator"></div>
        <button class="btn btn-sm" onclick="openEmpresasManager()" title="Cadastro de empresas">🏢 Empresas</button>
        <button class="settings-gear-btn" onclick="openSettingsModal()" title="Configurações gerais">⚙</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab ${homeTab==='painel'?'active':''}" onclick="setHomeTab('painel')">📊 Painel</button>
      <button class="tab ${homeTab==='empresas'?'active':''}" onclick="setHomeTab('empresas')">🏢 Empresas/Grupos${filtered.length ? ` (${filtered.length})` : ''}</button>
    </div>

    ${homeTab === 'painel' ? `
      <div class="home-panels">
        ${renderRemindersHomePanel(groups)}
        ${renderAgingChart(groups)}
      </div>
    ` : `
      <div class="toolbar-home">
        <input type="text" class="search-input" placeholder="Buscar grupo ou empresa..." value="${esc(search)}" oninput="onSearchHome(this.value)">
        <select class="col-filter" style="max-width:210px" onchange="onHomeGroupFilter(this.value)">
          <option value="">Todos os grupos</option>
          <option value="__UNGROUPED__" ${homeGroupFilter === "__UNGROUPED__" ? "selected" : ""}>Sem grupo (individual)</option>
          ${groupNames.map((n) => `<option value="${esc(n)}" ${homeGroupFilter === n ? "selected" : ""}>${esc(n)}</option>`).join("")}
        </select>
        <select class="col-filter" style="max-width:200px" onchange="onHomeTypeFilter(this.value)">
          <option value="">Todos os tipos</option>
          <option value="americano" ${homeTypeFilter === "americano" ? "selected" : ""}>Financeiro Americano</option>
          <option value="controladoria" ${homeTypeFilter === "controladoria" ? "selected" : ""}>Controladoria</option>
        </select>
        ${(homeGroupFilter || homeTypeFilter) ? `<button class="btn" onclick="clearHomeFilters()">Limpar filtros</button>` : ""}
        <button class="btn" onclick="openEmpresasManager()">🏢 Gerenciar empresas</button>
        <button class="btn btn-primary" onclick="openNewModal()">+ Nova empresa</button>
      </div>

      <p class="count-line">${filtered.length} grupo${filtered.length !== 1 ? "s" : ""}/empresa${filtered.length !== 1 ? "s" : ""}</p>

      ${filtered.length ? `<div class="group-grid">${cards}</div>` : `<div class="empty-state">Nenhum grupo ou empresa encontrado.</div>`}
    `}
  `;
}
