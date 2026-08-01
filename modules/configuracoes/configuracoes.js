/* =============================================================
 * Modulo: modules/configuracoes/configuracoes.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

// ---------- Configurações gerais ----------
function openSettingsModal() {
  openModal("settings-modal-overlay", `
    <div class="modal" style="width:440px">
      <h3>⚙ Configurações gerais</h3>
      <label>Tema</label>
      <div class="aging-toggle" style="width:100%">
        <button class="aging-toggle-btn" style="flex:1" onclick="setThemeSetting('dark')">🌙 Escuro${settings.theme !== "light" ? " ✓" : ""}</button>
        <button class="aging-toggle-btn" style="flex:1" onclick="setThemeSetting('light')">☀ Claro${settings.theme === "light" ? " ✓" : ""}</button>
      </div>
      <label style="margin-top:16px">Antecedência padrão para novos lembretes (dias)</label>
      <input type="number" id="cfg-antecedencia" min="0" max="60" value="${settings.antecedenciaPadrao}">
      <p class="hint" style="margin-top:4px">Sugerido automaticamente ao cadastrar um novo lembrete.</p>
      <label style="margin-top:16px">Limites do gráfico "Sem conciliar há mais tempo"</label>
      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <span class="hint">Alerta (âmbar) a partir de (dias)</span>
          <input type="number" id="cfg-aging-amarelo" min="1" value="${settings.agingAmarelo}">
        </div>
        <div style="flex:1">
          <span class="hint">Crítico (vermelho) a partir de (dias)</span>
          <input type="number" id="cfg-aging-vermelho" min="1" value="${settings.agingVermelho}">
        </div>
      </div>
      <label style="margin-top:18px">Backup e manutenção</label>
      <div class="backup-grid">
        <button class="btn" onclick="exportarJSON()">⬇ Exportar JSON</button>
        <button class="btn file-btn">⬆ Importar JSON<input type="file" accept="application/json,.json" onchange="importarJSON(event)"></button>
        <button class="btn" onclick="restaurarBackup()">↩ Restaurar backup</button>
        <button class="btn btn-danger" onclick="limparSistema()">🗑 Limpar sistema</button>
      </div>
      <p class="hint">Uma cópia de segurança é guardada automaticamente antes de importar ou limpar.</p>
      <div class="actions">
        <button class="btn" style="margin-right:auto" onclick="openTemplatesManager()">💬 Modelos de mensagens</button>
        <button class="btn" onclick="closeSettingsModal()">Fechar</button>
        <button class="btn btn-primary" onclick="saveSettingsModal()">Salvar</button>
      </div>
    </div>`);
}
function closeSettingsModal() { closeModal("settings-modal-overlay"); }
function setThemeSetting(theme) {
  settings.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  saveSettings();
  closeSettingsModal();
  openSettingsModal();
}
function saveSettingsModal() {
  let ant = parseInt(document.getElementById("cfg-antecedencia").value, 10);
  if (!Number.isFinite(ant) || ant < 0) ant = 0;
  settings.antecedenciaPadrao = ant;
  const am = parseInt(document.getElementById("cfg-aging-amarelo").value, 10);
  const vm = parseInt(document.getElementById("cfg-aging-vermelho").value, 10);
  if (Number.isFinite(am) && am > 0) settings.agingAmarelo = am;
  if (Number.isFinite(vm) && vm > 0) settings.agingVermelho = vm;
  saveSettings();
  closeSettingsModal();
  render();
}
