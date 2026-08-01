/* =============================================================
 * Utilidades reutilizaveis: datas, ordenacao, escape, grupos, toasts.
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- date helpers ----------
function brToIso(br) {
  if (!br) return "";
  const m = String(br).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
}
function isoToBr(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// ---------- sorting ----------
function compareValues(a, b, field) {
  let va = field === "situacao" ? (a.situacao || "Pendente") : (a[field]);
  let vb = field === "situacao" ? (b.situacao || "Pendente") : (b[field]);
  va = va == null ? "" : va;
  vb = vb == null ? "" : vb;
  const aEmpty = va === "", bEmpty = vb === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (DATE_FIELDS.has(field)) {
    const da = brToIso(va), db = brToIso(vb);
    return da.localeCompare(db);
  }
  return String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
}
function onSortColumn(field) {
  if (sortField === field) { sortDir = sortDir === "asc" ? "desc" : "asc"; }
  else { sortField = field; sortDir = "asc"; }
  render();
}

// ---------- helpers ----------
function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function jsq(s) { return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
function situacaoStyle(sit) {
  switch (sit) {
    case "Totalmente conciliado": return { bg: "rgba(34,197,94,.12)", text: "var(--text-primary)", border: "rgba(34,197,94,.35)", dot: "#22C55E" };
    case "Parcialmente conciliado": return { bg: "rgba(245,158,11,.12)", text: "var(--text-primary)", border: "rgba(245,158,11,.35)", dot: "#F59E0B" };
    case "Sem movimentação": return { bg: "rgba(148,163,184,.12)", text: "var(--text-primary)", border: "rgba(148,163,184,.30)", dot: "#94A3B8" };
    default: return { bg: "rgba(239,68,68,.12)", text: "var(--text-primary)", border: "rgba(239,68,68,.35)", dot: "#EF4444" };
  }
}
function groupKey(row) { return row.grupo && row.grupo.trim() ? row.grupo.trim() : row.empresa; }
function getType(key) { return customTypes[key] === "controladoria" ? "controladoria" : "americano"; }
function getColumnsForKey(key) { return getType(key) === "controladoria" ? COLUMNS_CONTROLADORIA : COLUMNS_AMERICANO; }

function buildGroups() {
  const map = new Map();
  rows.forEach((r) => {
    const key = groupKey(r);
    if (!map.has(key)) {
      map.set(key, { key, label: key, isGrupo: !!(r.grupo && r.grupo.trim()), companies: new Set(), rows: [] });
    }
    const g = map.get(key);
    g.companies.add(r.empresa);
    g.rows.push(r);
  });
  return Array.from(map.values()).sort((a, b) => {
    const ap = pinned.has(a.key) ? 0 : 1;
    const bp = pinned.has(b.key) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

/* =========================================================================
 * MENSAGENS (toast) E CONFIRMAÇÕES
 * ====================================================================== */

/** Exibe uma mensagem flutuante. tipo: "ok" | "erro" | "info" */
function notify(mensagem, tipo) {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast toast-" + (tipo || "ok");
  el.textContent = mensagem;
  host.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 250); }, 2600);
}

/** Confirmação padrão de ações destrutivas. */
function confirmar(mensagem) { return window.confirm(mensagem); }

/** Cria (ou substitui) um modal na tela, retornando o elemento overlay. */
function openModal(id, innerHtml, onClose) {
  closeModal(id);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = id;
  overlay.innerHTML = innerHtml;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) { closeModal(id); if (onClose) onClose(); } });
  document.body.appendChild(overlay);
  return overlay;
}
/** Fecha um modal pelo id. */
function closeModal(id) { const el = document.getElementById(id); if (el) el.remove(); }

/** Valor de um input do DOM, já com trim. */
function fieldValue(id) { const el = document.getElementById(id); return el ? String(el.value).trim() : ""; }

/** Normaliza nomes para comparação (sem acento, sem caixa, sem espaços extras). */
function normalizeName(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Próximo id sequencial dos lançamentos. */
function nextRowId() { return rows.length ? Math.max(...rows.map((r) => r.id || 0)) + 1 : 1; }
