/* =============================================================
 * Camada de dados: estado em memoria + persistencia em localStorage.
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

/* Finance Manager */
/* =========================================================================
 * ARMAZENAMENTO (localStorage)
 * Toda a aplicação grava em UMA única chave, com a estrutura:
 *
 *   {
 *     versao: 3,
 *     empresa:       [ { id, nome, grupo, criadoEm } ],      // cadastro
 *     configuracao:  { settings, categorias, modelos },       // preferências
 *     conciliacoes:  { [empresa]: [ lançamentos ] },          // por empresa
 *     historico:     { [chave]:   [ competências arquivadas ] },
 *     arquivos:      { [chave]:   [ acessos/credenciais ] },
 *     dashboard:     { pinned, labels, badges, descricoes,
 *                      relatorios, tipos, lembretes, categoriasPorLinha }
 *   }
 *
 * O sistema inicia SEM nenhum dado. Nada é gravado automaticamente antes
 * de o usuário cadastrar a primeira empresa.
 * ====================================================================== */
const DB_KEY = "conciliacoes:v3";
const BACKUP_KEY = "conciliacoes:v3:backup";
const DEFAULT_CATEGORIES = [];

/** Estrutura vazia — usada no primeiro acesso e ao limpar o sistema. */
function emptyDb() {
  return {
    versao: 3,
    empresa: [],
    configuracao: { settings: defaultSettings(), categorias: [], modelos: [], modelosImportacao: [] },
    conciliacoes: {},
    historico: {},
    arquivos: {},
    importacoes: {},
    dashboard: { pinned: [], labels: {}, badges: {}, descricoes: {}, relatorios: {}, tipos: {}, lembretes: {}, categoriasPorLinha: {} },
  };
}
function defaultSettings() {
  return { theme: "light", antecedenciaPadrao: 3, agingAmarelo: 14, agingVermelho: 30 };
}
let empresasCadastro = []; // [{ id, nome, grupo, criadoEm }]
let pinned = new Set();
let customLabels = {};
let customBadges = {};
let customDescriptions = {};
let reports = {};
let customTypes = {}; // key -> "americano" | "controladoria"
let accesses = {};    // key -> [{ id, banco, usuario, senha, agencia, conta, codigos, observacoes }]
let historico = {};   // key -> [{ id, label, archivedAt, cols, rows }]
let reminders = {};   // key -> [{ id, documento, frequencia, diaMes, dataUnica, antecedenciaDias, observacao, ativo, status, statusCycle }]
let templates = [];   // [{ id, nome, categoria, texto }]
let importacoes = {};   // key -> [{ id, nome, formato, importadoEm, resumo, lancamentos }]
let importModels = [];  // [{ id, nome, mapa, assinatura }] modelos de importação salvos
let bankCategories = {}; // rowId -> category name
let categoryList = []; // available categories
let categoryFilter = ""; // active filter (empty = all)
let categoryManagerOpen = false;
let settings = { theme: "light", antecedenciaPadrao: 3, agingAmarelo: 14, agingVermelho: 30 };
// Estado do calendário/central
let calendarView = { open: false, year: null, month: null, filterGroup: "", filterStatus: "" };
const SITUACOES = ["Totalmente conciliado", "Parcialmente conciliado", "Sem movimentação", "Pendente"];
const MESES_PT = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];


// ---------- state ----------
let rows = [];
let view = { type: "home" };
let search = "";
let groupSearch = "";
let activeTab = "conciliacoes";
let columnFilters = { empresa: "", banco: "", saldo_batendo: "", data_conciliado: "", data_envio: "", competencia: "", situacao: "", observacao: "" };
let sortField = null;
let sortDir = "asc";
let openStatusId = null;
let homeTab = "painel";
let bulkDateEdit = false;
let bulkDraft = {};
let homeGroupFilter = "";
let homeTypeFilter = "";
let agingIncludeControladoria = false;
let saveTimer = null;

const COLUMNS_AMERICANO = [
  { field: "empresa", label: "Empresa" },
  { field: "banco", label: "Banco" },
  { field: "saldo_batendo", label: "Saldo batendo" },
  { field: "data_conciliado", label: "Data conciliado" },
  { field: "competencia", label: "Competência" },
  { field: "situacao", label: "Situação" },
  { field: "observacao", label: "Observação" }
];
const COLUMNS_CONTROLADORIA = [
  { field: "empresa", label: "Empresa" },
  { field: "banco", label: "Banco" },
  { field: "data_envio", label: "Data de envio" },
  { field: "situacao", label: "Situação" },
  { field: "observacao", label: "Observação" }
];
const DATE_FIELDS = new Set(["saldo_batendo", "data_conciliado", "data_envio"]);

// ---------- storage ----------

/** Lê o banco completo do localStorage (sem nunca gravar nada). */
function readDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? Object.assign(emptyDb(), parsed) : emptyDb();
  } catch (e) {
    return emptyDb();
  }
}

/** Grava o banco completo. */
function writeDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    showSaved();
    return true;
  } catch (e) {
    notify("Não foi possível salvar (armazenamento cheio).", "erro");
    return false;
  }
}

/** Carrega o banco para o estado em memória da aplicação. */
function loadAll() {
  const db = readDb();
  hydrate(db);
}

/** Distribui a estrutura do banco nas variáveis de estado. */
function hydrate(db) {
  db = Object.assign(emptyDb(), db || {});
  empresasCadastro = Array.isArray(db.empresa) ? db.empresa : [];

  // Conciliações separadas por empresa -> lista única em memória
  rows = [];
  Object.keys(db.conciliacoes || {}).forEach((empresa) => {
    (db.conciliacoes[empresa] || []).forEach((r) => rows.push(Object.assign({}, r, { empresa })));
  });
  rows.sort((a, b) => (a.id || 0) - (b.id || 0));

  const cfg = db.configuracao || {};
  settings = Object.assign(defaultSettings(), cfg.settings || {});
  categoryList = Array.isArray(cfg.categorias) ? cfg.categorias.slice() : [];
  templates = Array.isArray(cfg.modelos) ? cfg.modelos.slice() : [];
  importModels = Array.isArray(cfg.modelosImportacao) ? cfg.modelosImportacao.slice() : [];
  importacoes = db.importacoes || {};

  historico = db.historico || {};
  accesses = db.arquivos || {};

  const dash = db.dashboard || {};
  pinned = new Set(Array.isArray(dash.pinned) ? dash.pinned : []);
  customLabels = dash.labels || {};
  customBadges = dash.badges || {};
  customDescriptions = dash.descricoes || {};
  reports = dash.relatorios || {};
  customTypes = dash.tipos || {};
  bankCategories = dash.categoriasPorLinha || {};
  reminders = dash.lembretes || {};
  Object.keys(reminders).forEach((k) => {
    (reminders[k] || []).forEach((r) => {
      if (r.status === undefined) r.status = r.concluido ? "recebido" : "pendente";
      if (r.antecedenciaDias === undefined) r.antecedenciaDias = settings.antecedenciaPadrao;
      if (r.statusCycle === undefined) r.statusCycle = null;
    });
  });
}

/** Monta a estrutura do banco a partir do estado em memória. */
function snapshotDb() {
  const conciliacoes = {};
  rows.forEach((r) => {
    const empresa = r.empresa || "(sem empresa)";
    (conciliacoes[empresa] = conciliacoes[empresa] || []).push(r);
  });
  return {
    versao: 3,
    empresa: empresasCadastro,
    configuracao: { settings, categorias: categoryList, modelos: templates, modelosImportacao: importModels },
    conciliacoes,
    historico,
    arquivos: accesses,
    importacoes,
    dashboard: {
      pinned: Array.from(pinned),
      labels: customLabels,
      badges: customBadges,
      descricoes: customDescriptions,
      relatorios: reports,
      tipos: customTypes,
      lembretes: reminders,
      categoriasPorLinha: bankCategories,
    },
  };
}

/** Persiste TODO o estado atual. Função única usada por toda a aplicação. */
function persist() { return writeDb(snapshotDb()); }

// Aliases mantidos por compatibilidade com o restante do código.
const saveData = persist;
const savePinned = persist;
const saveLabels = persist;
const saveBadges = persist;
const saveDescriptions = persist;
const saveReports = persist;
const saveTypes = persist;
const saveAccesses = persist;
const saveHistorico = persist;
const saveReminders = persist;
const saveSettings = persist;
const saveTemplates = persist;
const saveBankCategories = persist;
const saveCategoryList = persist;

function showSaved() {
  const els = [document.getElementById("save-indicator"), document.getElementById("save-indicator-side")].filter(Boolean);
  if (!els.length) return;
  els.forEach((el) => { el.textContent = "✓ salvo"; el.classList.add("saved"); });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { els.forEach((el) => { el.textContent = ""; el.classList.remove("saved"); }); }, 1500);
}
