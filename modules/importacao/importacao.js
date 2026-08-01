/* =============================================================
 * Modulo: modules/importacao/importacao.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

/* =========================================================================
 * MÓDULO DE IMPORTAÇÕES (100% local, sem servidor / API / banco de dados)
 * Formatos: OFX, Excel (.xlsx/.xls) e CSV.
 * Os arquivos ficam salvos por empresa/grupo em db.importacoes[chave].
 * NADA é gravado antes da confirmação do usuário na pré-visualização.
 * ====================================================================== */

/** Campos que o sistema entende em um lançamento importado. */
const IMPORT_FIELDS = [
  { key: "data",       label: "Data",        obrigatorio: true },
  { key: "valor",      label: "Valor",       obrigatorio: true },
  { key: "descricao",  label: "Descrição" },
  { key: "tipo",       label: "Tipo" },
  { key: "documento",  label: "Documento" },
  { key: "cliente",    label: "Cliente" },
  { key: "fornecedor", label: "Fornecedor" },
];

/** Modelos prontos (Omie, Saipos) + Personalizado. Usados só como sugestão. */
const IMPORT_PRESETS = [
  {
    id: "omie", nome: "Omie",
    aliases: {
      data: ["data", "data de lancamento", "data lancamento", "data movimento", "dt lancamento"],
      valor: ["valor", "valor r$", "valor (r$)", "valor documento", "valor lancamento"],
      descricao: ["descricao", "observacao", "historico", "complemento"],
      tipo: ["tipo", "natureza", "tipo lancamento", "operacao"],
      documento: ["documento", "n documento", "numero documento", "nro documento", "num doc"],
      cliente: ["cliente", "nome cliente", "razao social cliente"],
      fornecedor: ["fornecedor", "nome fornecedor", "razao social fornecedor"],
    },
  },
  {
    id: "saipos", nome: "Saipos",
    aliases: {
      data: ["data movimento", "data", "dt lancamento", "data pagamento", "data competencia"],
      valor: ["valor", "valor total", "vl total", "total"],
      descricao: ["descricao", "observacoes", "observacao", "historico"],
      tipo: ["tipo", "tipo movimento", "movimento", "operacao", "entrada saida"],
      documento: ["documento", "n doc", "nro doc", "numero"],
      cliente: ["cliente", "nome cliente"],
      fornecedor: ["fornecedor", "nome fornecedor"],
    },
  },
  { id: "personalizado", nome: "Modelo personalizado", aliases: {} },
];

/** Pré-visualização em memória (nunca gravada até a confirmação). */
let importPreview = null;

function normHeader(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Converte diferentes formatos de data para ISO (yyyy-mm-dd). */
function parseImportDate(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = (Number(y) > 60 ? "19" : "20") + y;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`; // OFX
  if (/^\d+(\.\d+)?$/.test(s)) { // serial do Excel
    const n = Number(s);
    if (n > 20000 && n < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return d.toISOString().slice(0, 10);
    }
  }
  return "";
}

/** Converte valores em formato brasileiro/americano para número. */
function parseImportValor(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/\s/g, "").replace(/r\$/i, "");
  let neg = /^\(.*\)$/.test(s) || /-/.test(s) || /\bD$/i.test(s);
  s = s.replace(/[()CD]/gi, "").replace(/-/g, "");
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

function fmtImportMoney(n) {
  return (n < 0 ? "-" : "") + "R$ " + Math.abs(Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtImportDate(iso) {
  if (!iso) return "—";
  const p = String(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

/** Calcula o resumo (quantidade, período, entradas, saídas, saldo). */
function computeImportResumo(lancs) {
  const datas = lancs.map((l) => l.data).filter(Boolean).sort();
  let entradas = 0, saidas = 0;
  lancs.forEach((l) => { const v = Number(l.valor) || 0; if (v >= 0) entradas += v; else saidas += v; });
  return {
    quantidade: lancs.length,
    dataInicial: datas[0] || "",
    dataFinal: datas[datas.length - 1] || "",
    entradas, saidas, saldo: entradas + saidas,
  };
}

// ---------- Parsers (executados no próprio navegador) ----------

/** CSV com detecção de delimitador e suporte a aspas. */
function parseCsvText(text) {
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = text.split("\n")[0] || "";
  const delim = [";", ",", "\t", "|"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (aspas) {
      if (c === '"') { if (text[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === delim) { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  const validas = linhas.filter((l) => l.some((c) => String(c).trim() !== ""));
  if (!validas.length) return { headers: [], linhas: [] };
  return { headers: validas[0].map((h) => String(h).trim()), linhas: validas.slice(1) };
}

/** Excel via SheetJS (leitura local do arquivo). */
function parseExcelBuffer(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
  if (!matriz.length) return { headers: [], linhas: [] };
  const headerIdx = matriz.findIndex((l) => l.filter((c) => String(c).trim() !== "").length >= 2);
  const idx = headerIdx < 0 ? 0 : headerIdx;
  return { headers: (matriz[idx] || []).map((h) => String(h).trim()), linhas: matriz.slice(idx + 1) };
}

/** OFX (extrato bancário) — extrai as transações STMTTRN. */
function parseOfxText(text) {
  const tags = (bloco, tag) => {
    const m = bloco.match(new RegExp("<" + tag + ">([^<\\r\\n]*)", "i"));
    return m ? m[1].trim() : "";
  };
  const blocos = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  return blocos.map((b) => {
    const valor = parseFloat(String(tags(b, "TRNAMT")).replace(",", ".")) || 0;
    const memo = tags(b, "MEMO");
    const name = tags(b, "NAME");
    const tipo = tags(b, "TRNTYPE") || (valor >= 0 ? "CREDIT" : "DEBIT");
    return {
      data: parseImportDate(tags(b, "DTPOSTED")),
      valor,
      descricao: memo || name,
      tipo: tipo === "CREDIT" ? "Entrada" : tipo === "DEBIT" ? "Saída" : tipo,
      documento: tags(b, "CHECKNUM") || tags(b, "FITID"),
      cliente: valor >= 0 ? name : "",
      fornecedor: valor < 0 ? name : "",
    };
  });
}

// ---------- Aba Importações ----------

function renderImportTab(gkey) {
  const keyEsc = jsq(gkey);
  const arquivos = importacoes[gkey] || [];
  const cards = arquivos.map((a) => {
    const r = a.resumo || {};
    return `
    <div class="access-item">
      <div class="access-item-title">
        <h4>${a.formato === "ofx" ? "🏦" : a.formato === "csv" ? "📄" : "📊"} ${esc(a.nome)}</h4>
        <div style="display:flex;gap:4px">
          <button class="btn-ghost" onclick="verImportacao('${keyEsc}', ${a.id})" title="Ver lançamentos">👁</button>
          <button class="btn-danger-ghost" onclick="excluirImportacao('${keyEsc}', ${a.id})" title="Excluir arquivo">✕</button>
        </div>
      </div>
      <div class="access-fields">
        <div class="access-field"><div class="k">Registros</div><div class="v"><span class="val">${r.quantidade || 0}</span></div></div>
        <div class="access-field"><div class="k">Período</div><div class="v"><span class="val">${fmtImportDate(r.dataInicial)} → ${fmtImportDate(r.dataFinal)}</span></div></div>
        <div class="access-field"><div class="k">Entradas</div><div class="v"><span class="val">${fmtImportMoney(r.entradas || 0)}</span></div></div>
        <div class="access-field"><div class="k">Saídas</div><div class="v"><span class="val">${fmtImportMoney(r.saidas || 0)}</span></div></div>
        <div class="access-field"><div class="k">Saldo</div><div class="v"><span class="val">${fmtImportMoney(r.saldo || 0)}</span></div></div>
        <div class="access-field"><div class="k">Importado em</div><div class="v"><span class="val">${esc(a.importadoEm || "")}</span></div></div>
      </div>
    </div>`;
  }).join("");

  return `
    <div class="toolbar">
      <label class="btn btn-primary file-btn">🏦 Importar OFX
        <input type="file" accept=".ofx,.OFX,text/plain" onchange="onImportFile(event, '${keyEsc}', 'ofx')">
      </label>
      <label class="btn file-btn">📊 Importar Excel
        <input type="file" accept=".xlsx,.xls" onchange="onImportFile(event, '${keyEsc}', 'excel')">
      </label>
      <label class="btn file-btn">📄 Importar CSV
        <input type="file" accept=".csv,text/csv" onchange="onImportFile(event, '${keyEsc}', 'csv')">
      </label>
      <span class="hint">Processamento 100% local — nada é enviado para a internet e nada é salvo antes da sua confirmação.</span>
    </div>
    ${arquivos.length ? cards : `<div class="empty-state">Nenhum arquivo importado para esta empresa. Importe um OFX, Excel ou CSV.</div>`}
  `;
}

/** Lê o arquivo escolhido e abre a pré-visualização (sem salvar nada). */
function onImportFile(ev, gkey, formato) {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      if (formato === "excel") {
        const { headers, linhas } = parseExcelBuffer(e.target.result);
        abrirPreviewTabular(gkey, file.name, "excel", headers, linhas);
      } else if (formato === "csv") {
        const { headers, linhas } = parseCsvText(String(e.target.result));
        abrirPreviewTabular(gkey, file.name, "csv", headers, linhas);
      } else {
        const lancs = parseOfxText(String(e.target.result));
        if (!lancs.length) { notify("Nenhuma transação encontrada no OFX.", "erro"); return; }
        importPreview = { gkey, nome: file.name, formato: "ofx", headers: [], linhas: [], mapa: {}, lancamentos: lancs, modeloId: "" };
        renderImportPreviewModal();
      }
    } catch (err) {
      notify("Erro ao ler o arquivo: " + err.message, "erro");
    }
  };
  reader.onerror = () => notify("Não foi possível ler o arquivo.", "erro");
  if (formato === "excel") reader.readAsArrayBuffer(file);
  else reader.readAsText(file, "ISO-8859-1");
}

/** Prepara a pré-visualização de Excel/CSV com reconhecimento de modelo. */
function abrirPreviewTabular(gkey, nome, formato, headers, linhas) {
  if (!headers.length) { notify("Não foi possível identificar o cabeçalho do arquivo.", "erro"); return; }
  const assinatura = headers.map(normHeader).filter(Boolean).join("|");
  const salvo = importModels.find((m) => m.assinatura === assinatura);
  let mapa = {}, modeloId = "";
  if (salvo) { mapa = Object.assign({}, salvo.mapa); modeloId = "salvo:" + salvo.id; notify(`Modelo "${salvo.nome}" reconhecido automaticamente.`); }
  else { const auto = detectarMapa(headers); mapa = auto.mapa; modeloId = auto.presetId; }
  importPreview = { gkey, nome, formato, headers, linhas, assinatura, mapa, modeloId, lancamentos: [] };
  aplicarMapaPreview();
  renderImportPreviewModal();
}

/** Tenta casar os cabeçalhos com os modelos Omie/Saipos. */
function detectarMapa(headers) {
  let melhor = { presetId: "personalizado", mapa: {}, score: 0 };
  IMPORT_PRESETS.forEach((preset) => {
    if (!Object.keys(preset.aliases).length) return;
    const mapa = {}; let score = 0;
    IMPORT_FIELDS.forEach((f) => {
      const aliases = preset.aliases[f.key] || [];
      const idx = headers.findIndex((h) => aliases.includes(normHeader(h)));
      if (idx >= 0) { mapa[f.key] = String(idx); score++; }
    });
    if (score > melhor.score) melhor = { presetId: preset.id, mapa, score };
  });
  return melhor;
}

/** Converte as linhas brutas em lançamentos usando o mapeamento atual. */
function aplicarMapaPreview() {
  if (!importPreview || importPreview.formato === "ofx") return;
  const { linhas, mapa } = importPreview;
  const get = (linha, campo) => {
    const i = mapa[campo];
    if (i === undefined || i === "") return "";
    const v = Array.isArray(linha) ? linha[Number(i)] : "";
    return v == null ? "" : v;
  };
  importPreview.lancamentos = linhas.map((l) => {
    const valor = parseImportValor(get(l, "valor"));
    const tipoBruto = String(get(l, "tipo") || "").trim();
    const negativoPorTipo = /^(s|saida|saída|d|debito|débito|pagamento|despesa)/i.test(tipoBruto);
    return {
      data: parseImportDate(get(l, "data")),
      valor: negativoPorTipo ? -Math.abs(valor) : valor,
      descricao: String(get(l, "descricao") || "").trim(),
      tipo: tipoBruto || (valor >= 0 ? "Entrada" : "Saída"),
      documento: String(get(l, "documento") || "").trim(),
      cliente: String(get(l, "cliente") || "").trim(),
      fornecedor: String(get(l, "fornecedor") || "").trim(),
    };
  }).filter((l) => l.data || l.valor || l.descricao);
}

function onImportModeloChange(valor) {
  if (!importPreview) return;
  importPreview.modeloId = valor;
  if (valor.startsWith("salvo:")) {
    const m = importModels.find((x) => x.id === Number(valor.slice(6)));
    if (m) importPreview.mapa = Object.assign({}, m.mapa);
  } else {
    const preset = IMPORT_PRESETS.find((p) => p.id === valor);
    if (preset && Object.keys(preset.aliases).length) {
      const mapa = {};
      IMPORT_FIELDS.forEach((f) => {
        const aliases = preset.aliases[f.key] || [];
        const idx = importPreview.headers.findIndex((h) => aliases.includes(normHeader(h)));
        if (idx >= 0) mapa[f.key] = String(idx);
      });
      importPreview.mapa = mapa;
    } else importPreview.mapa = {};
  }
  aplicarMapaPreview();
  renderImportPreviewModal();
}

function onImportCampoChange(campo, valor) {
  if (!importPreview) return;
  importPreview.mapa[campo] = valor;
  aplicarMapaPreview();
  renderImportPreviewModal();
}

/** Monta/atualiza o modal de pré-visualização. */
function renderImportPreviewModal() {
  if (!importPreview) return;
  const p = importPreview;
  const resumo = computeImportResumo(p.lancamentos);
  const tabular = p.formato !== "ofx";
  const opcoesHeaders = (campo) => [`<option value="">— não usar —</option>`].concat(
    p.headers.map((h, i) => `<option value="${i}" ${String(p.mapa[campo]) === String(i) ? "selected" : ""}>${esc(h || "Coluna " + (i + 1))}</option>`)
  ).join("");

  const mapeamento = !tabular ? "" : `
    <div class="import-config">
      <label>Modelo de importação</label>
      <select onchange="onImportModeloChange(this.value)">
        ${IMPORT_PRESETS.map((m) => `<option value="${m.id}" ${p.modeloId === m.id ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}
        ${importModels.map((m) => `<option value="salvo:${m.id}" ${p.modeloId === "salvo:" + m.id ? "selected" : ""}>💾 ${esc(m.nome)}</option>`).join("")}
      </select>
      <div class="import-map-grid">
        ${IMPORT_FIELDS.map((f) => `
          <div>
            <label>${f.label}${f.obrigatorio ? " *" : ""}</label>
            <select onchange="onImportCampoChange('${f.key}', this.value)">${opcoesHeaders(f.key)}</select>
          </div>`).join("")}
      </div>
      <label class="import-check">
        <input type="checkbox" id="imp-salvar-modelo" ${p.salvarModelo ? "checked" : ""} onchange="importPreview.salvarModelo = this.checked; document.getElementById('imp-nome-modelo').disabled = !this.checked;">
        Salvar este mapeamento como modelo (reconhecido automaticamente nas próximas importações)
      </label>
      <input type="text" id="imp-nome-modelo" placeholder="Nome do modelo" value="${esc(p.nomeModelo || p.nome.replace(/\.[^.]+$/, ""))}" ${p.salvarModelo ? "" : "disabled"}>
    </div>`;

  const amostra = p.lancamentos.slice(0, 20);
  const tabela = `
    <div class="table-wrap snapshot-table-wrap" style="margin-top:12px">
      <table>
        <thead><tr>${IMPORT_FIELDS.map((f) => `<th>${f.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${amostra.length ? amostra.map((l) => `
            <tr>
              <td>${fmtImportDate(l.data)}</td>
              <td style="color:${l.valor < 0 ? "#F87171" : "#34D399"}">${fmtImportMoney(l.valor)}</td>
              <td>${esc(l.descricao)}</td>
              <td>${esc(l.tipo)}</td>
              <td>${esc(l.documento)}</td>
              <td>${esc(l.cliente)}</td>
              <td>${esc(l.fornecedor)}</td>
            </tr>`).join("") : `<tr><td colspan="7" style="text-align:center;padding:16px">Selecione ao menos as colunas de Data e Valor.</td></tr>`}
        </tbody>
      </table>
    </div>
    ${p.lancamentos.length > 20 ? `<div class="hint" style="margin-top:6px">Mostrando 20 de ${p.lancamentos.length} registros.</div>` : ""}`;

  const html = `
    <div class="modal modal-lg" style="width:920px;max-width:96vw">
      <h3>Pré-visualização — ${esc(p.nome)}</h3>
      <div class="import-resumo">
        <div><span class="k">Registros</span><strong>${resumo.quantidade}</strong></div>
        <div><span class="k">Data inicial</span><strong>${fmtImportDate(resumo.dataInicial)}</strong></div>
        <div><span class="k">Data final</span><strong>${fmtImportDate(resumo.dataFinal)}</strong></div>
        <div><span class="k">Entradas</span><strong style="color:#34D399">${fmtImportMoney(resumo.entradas)}</strong></div>
        <div><span class="k">Saídas</span><strong style="color:#F87171">${fmtImportMoney(resumo.saidas)}</strong></div>
        <div><span class="k">Saldo</span><strong>${fmtImportMoney(resumo.saldo)}</strong></div>
      </div>
      ${mapeamento}
      ${tabela}
      <div class="actions">
        <button class="btn" onclick="cancelarImportacao()">Cancelar</button>
        <button class="btn btn-primary" onclick="confirmarImportacao()" ${resumo.quantidade ? "" : "disabled"}>Confirmar importação</button>
      </div>
    </div>`;
  const overlay = document.getElementById("import-preview-overlay");
  if (overlay) overlay.innerHTML = html;
  else openModal("import-preview-overlay", html, cancelarImportacao);
}

function cancelarImportacao() {
  importPreview = null;
  closeModal("import-preview-overlay");
}

/** Só aqui os dados são gravados — após confirmação explícita. */
function confirmarImportacao() {
  if (!importPreview) return;
  const p = importPreview;
  if (!p.lancamentos.length) { notify("Nada para importar.", "erro"); return; }
  const lista = importacoes[p.gkey] || [];
  const nextId = lista.length ? Math.max(...lista.map((x) => x.id)) + 1 : 1;
  lista.unshift({
    id: nextId,
    nome: p.nome,
    formato: p.formato,
    importadoEm: new Date().toLocaleString("pt-BR"),
    resumo: computeImportResumo(p.lancamentos),
    lancamentos: p.lancamentos,
  });
  importacoes[p.gkey] = lista;

  const chk = document.getElementById("imp-salvar-modelo");
  if (chk && chk.checked && p.assinatura) {
    const nome = (document.getElementById("imp-nome-modelo").value || p.nome).trim();
    const existente = importModels.find((m) => m.assinatura === p.assinatura);
    if (existente) { existente.nome = nome; existente.mapa = Object.assign({}, p.mapa); }
    else importModels.push({ id: Date.now(), nome, mapa: Object.assign({}, p.mapa), assinatura: p.assinatura });
  }

  persist();
  importPreview = null;
  closeModal("import-preview-overlay");
  render();
  notify("Importação concluída.");
}

/** Mostra os lançamentos já importados de um arquivo. */
function verImportacao(gkey, id) {
  const arq = (importacoes[gkey] || []).find((a) => a.id === id);
  if (!arq) return;
  const r = arq.resumo || {};
  openModal("import-view-overlay", `
    <div class="modal modal-lg" style="width:920px;max-width:96vw">
      <h3>${esc(arq.nome)}</h3>
      <div class="import-resumo">
        <div><span class="k">Registros</span><strong>${r.quantidade || 0}</strong></div>
        <div><span class="k">Data inicial</span><strong>${fmtImportDate(r.dataInicial)}</strong></div>
        <div><span class="k">Data final</span><strong>${fmtImportDate(r.dataFinal)}</strong></div>
        <div><span class="k">Entradas</span><strong style="color:#34D399">${fmtImportMoney(r.entradas || 0)}</strong></div>
        <div><span class="k">Saídas</span><strong style="color:#F87171">${fmtImportMoney(r.saidas || 0)}</strong></div>
        <div><span class="k">Saldo</span><strong>${fmtImportMoney(r.saldo || 0)}</strong></div>
      </div>
      <div class="table-wrap snapshot-table-wrap" style="margin-top:12px">
        <table>
          <thead><tr>${IMPORT_FIELDS.map((f) => `<th>${f.label}</th>`).join("")}</tr></thead>
          <tbody>
            ${(arq.lancamentos || []).map((l) => `
              <tr>
                <td>${fmtImportDate(l.data)}</td>
                <td style="color:${l.valor < 0 ? "#F87171" : "#34D399"}">${fmtImportMoney(l.valor)}</td>
                <td>${esc(l.descricao)}</td>
                <td>${esc(l.tipo)}</td>
                <td>${esc(l.documento)}</td>
                <td>${esc(l.cliente)}</td>
                <td>${esc(l.fornecedor)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="actions"><button class="btn" onclick="closeModal('import-view-overlay')">Fechar</button></div>
    </div>`);
}

function excluirImportacao(gkey, id) {
  const arq = (importacoes[gkey] || []).find((a) => a.id === id);
  if (!arq) return;
  if (!confirmar(`Excluir o arquivo importado "${arq.nome}"?\n\nEsta ação não pode ser desfeita.`)) return;
  importacoes[gkey] = (importacoes[gkey] || []).filter((a) => a.id !== id);
  persist();
  render();
  notify("Arquivo excluído.");
}
