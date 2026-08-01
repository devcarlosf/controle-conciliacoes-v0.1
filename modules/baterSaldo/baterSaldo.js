/* =============================================================
 * Módulo: Bater Saldo (estrutura visual)
 *
 * ATENÇÃO: neste momento apenas a INTERFACE existe.
 * A lógica de conciliação NÃO está implementada — as funções
 * abaixo são pontos de extensão preparados para as próximas
 * versões:
 *
 *   - Conciliação Inteligente
 *   - PIX agrupado
 *   - Folha de pagamento
 *   - Regras por empresa
 *   - Associação automática banco x ERP
 * ============================================================= */

/* Estado isolado do módulo (não interfere no restante do sistema). */
const baterSaldoState = {
  empresa: "",
  competencia: "",
  ofx: null,     // { nome, tamanho }
  excel: null,   // { nome, tamanho }
  executando: false,
  resultado: null, // { encontrados, pendentes, diferencas, totalBanco, totalErp, diferenca }
};

/* Registro de estratégias futuras (nada roda ainda). */
const baterSaldoStrategies = {
  inteligente: null,
  pixAgrupado: null,
  folhaPagamento: null,
  regrasPorEmpresa: null,
};

function setBaterSaldoEmpresa(v) { baterSaldoState.empresa = v; render(); }
function setBaterSaldoCompetencia(v) { baterSaldoState.competencia = v; render(); }

function setBaterSaldoArquivo(tipo, input) {
  const f = input && input.files && input.files[0];
  if (!f) return;
  baterSaldoState[tipo] = { nome: f.name, tamanho: f.size };
  render();
}

function limparBaterSaldoArquivo(tipo, ev) {
  if (ev) ev.stopPropagation();
  baterSaldoState[tipo] = null;
  render();
}

/** Placeholder — a lógica de conciliação será implementada depois. */
function executarBaterSaldo() {
  if (!baterSaldoState.empresa) return notify("Selecione a empresa.", "info");
  if (!baterSaldoState.competencia) return notify("Informe a competência.", "info");
  if (!baterSaldoState.ofx || !baterSaldoState.excel) return notify("Envie o arquivo OFX e o Excel.", "info");
  notify("Módulo em preparação: a conciliação automática ainda não está ativa.", "info");
}

/* ---------- Render ---------- */
function bsFileBox(tipo, titulo, aceita, sub) {
  const f = baterSaldoState[tipo];
  return `
    <div class="bs-field">
      <label>${titulo}</label>
      <div class="bs-drop ${f ? "has-file" : ""}">
        <input type="file" accept="${aceita}" onchange="setBaterSaldoArquivo('${tipo}', this)">
        <span class="ico">${f ? "✅" : "⬆️"}</span>
        <div class="t">${f ? esc(f.nome) : "Selecionar arquivo"}</div>
        <div class="s">${f ? (Math.max(1, Math.round(f.tamanho / 1024)) + " KB · clique para trocar") : sub}</div>
      </div>
      ${f ? `<button class="btn btn-sm" onclick="limparBaterSaldoArquivo('${tipo}', event)">Remover arquivo</button>` : ""}
    </div>`;
}

function renderBaterSaldoResultado() {
  const r = baterSaldoState.resultado;
  if (!r) {
    return `
      <div class="bs-placeholder">
        <span class="ico">⚖️</span>
        Nenhuma conciliação executada ainda.<br>
        Preencha o painel à esquerda e clique em <b>Executar Conciliação</b>.
        <div class="bs-skeleton-rows">
          <div class="fm-skeleton" style="height:16px;width:70%;margin:0 auto"></div>
          <div class="fm-skeleton" style="height:16px;width:52%;margin:0 auto"></div>
          <div class="fm-skeleton" style="height:16px;width:60%;margin:0 auto"></div>
        </div>
      </div>`;
  }
  const money = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  return `
    <div class="bs-result-grid">
      <div class="bs-stat pos"><div class="k">Encontrados</div><div class="v">${r.encontrados}</div></div>
      <div class="bs-stat warn"><div class="k">Pendentes</div><div class="v">${r.pendentes}</div></div>
      <div class="bs-stat neg"><div class="k">Diferenças</div><div class="v">${r.diferencas}</div></div>
      <div class="bs-stat"><div class="k">Total Banco</div><div class="v">${money(r.totalBanco)}</div></div>
      <div class="bs-stat"><div class="k">Total ERP</div><div class="v">${money(r.totalErp)}</div></div>
      <div class="bs-stat ${Number(r.diferenca) === 0 ? "pos" : "neg"}"><div class="k">Diferença</div><div class="v">${money(r.diferenca)}</div></div>
    </div>`;
}

function renderBaterSaldo() {
  const groups = buildGroups();
  const opcoes = groups
    .map((g) => {
      const label = customLabels[g.key] != null ? customLabels[g.key] : g.label;
      return `<option value="${esc(g.key)}" ${baterSaldoState.empresa === g.key ? "selected" : ""}>${esc(label)}</option>`;
    })
    .join("");

  return `
    <div class="header">
      <div>
        <h1>Bater Saldo</h1>
        <p>Confronto entre extrato bancário (OFX) e lançamentos do ERP (Excel)</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="bs-badge-soon">Em preparação</span>
        <div class="save-indicator" id="save-indicator"></div>
      </div>
    </div>

    <div class="bs-layout">
      <!-- Painel esquerdo -->
      <section class="bs-panel">
        <h3 class="bs-panel-title">📥 Entrada de dados</h3>

        <div class="bs-field">
          <label>Empresa</label>
          <select onchange="setBaterSaldoEmpresa(this.value)">
            <option value="">Selecione a empresa...</option>
            ${opcoes}
          </select>
        </div>

        <div class="bs-field">
          <label>Competência</label>
          <input type="month" value="${esc(baterSaldoState.competencia)}" onchange="setBaterSaldoCompetencia(this.value)">
        </div>

        ${bsFileBox("ofx", "Arquivo OFX (banco)", ".ofx", "Extrato bancário em formato OFX")}
        ${bsFileBox("excel", "Arquivo Excel (ERP)", ".xlsx,.xls,.csv", "Relatório de lançamentos do ERP")}

        <button class="btn btn-primary bs-run" onclick="executarBaterSaldo()">
          ${baterSaldoState.executando ? `<span class="fm-spinner"></span> Processando...` : "⚖️ Executar Conciliação"}
        </button>

        <p class="bs-note">
          Estrutura preparada para: conciliação inteligente, PIX agrupado,
          folha de pagamento e regras por empresa.
        </p>
      </section>

      <!-- Painel direito -->
      <section class="bs-panel">
        <h3 class="bs-panel-title">📊 Resultado <span class="k">${baterSaldoState.competencia || "—"}</span></h3>
        ${renderBaterSaldoResultado()}
      </section>
    </div>
  `;
}
