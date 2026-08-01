/* =============================================================
 * Modulo: modules/backup/backup.js
 * Codigo original preservado - apenas reorganizado em arquivos.
 * ============================================================= */

/* =========================================================================
 * BACKUP: EXPORTAR / IMPORTAR / RESTAURAR / LIMPAR
 * ====================================================================== */

/** Baixa um arquivo JSON com todos os dados do sistema. */
function exportarJSON() {
  const dados = JSON.stringify(snapshotDb(), null, 2);
  const blob = new Blob([dados], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conciliacoes-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Backup exportado.");
}

/** Importa um arquivo JSON gerado pela exportação. */
function importarJSON(ev) {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  if (!confirmar("Importar este arquivo irá SUBSTITUIR todos os dados atuais.\nUma cópia de segurança do estado atual será guardada.\n\nContinuar?")) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== "object") throw new Error("formato inválido");
      guardarBackupAtual();
      hydrate(parsed);
      persist();
      view = { type: "home" };
      document.documentElement.setAttribute("data-theme", settings.theme === "light" ? "light" : "dark");
      closeModal("settings-modal-overlay");
      render();
      notify("Backup importado com sucesso.");
    } catch (e) {
      notify("Arquivo inválido: não foi possível importar.", "erro");
    }
  };
  reader.readAsText(file);
}

/** Guarda uma cópia de segurança do estado atual (usada antes de ações destrutivas). */
function guardarBackupAtual() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ criadoEm: new Date().toISOString(), dados: snapshotDb() }));
  } catch (e) {}
}

/** Restaura a última cópia de segurança automática. */
function restaurarBackup() {
  let backup = null;
  try { backup = JSON.parse(localStorage.getItem(BACKUP_KEY) || "null"); } catch (e) {}
  if (!backup || !backup.dados) { notify("Nenhuma cópia de segurança disponível.", "erro"); return; }
  const quando = formatDateTime ? formatDateTime(backup.criadoEm) : backup.criadoEm;
  if (!confirmar(`Restaurar a cópia de segurança de ${quando}?\nOs dados atuais serão substituídos.`)) return;
  hydrate(backup.dados);
  persist();
  view = { type: "home" };
  document.documentElement.setAttribute("data-theme", settings.theme === "light" ? "light" : "dark");
  closeModal("settings-modal-overlay");
  render();
  notify("Backup restaurado.");
}

/** Apaga TODO o conteúdo do sistema (com dupla confirmação). */
function limparSistema() {
  if (!confirmar("LIMPAR SISTEMA\n\nTodos os dados (empresas, lançamentos, histórico, lembretes, acessos e configurações) serão apagados.\n\nDeseja continuar?")) return;
  if (!confirmar("Confirma definitivamente? Uma cópia de segurança será guardada para restauração.")) return;
  guardarBackupAtual();
  hydrate(emptyDb());
  persist();
  view = { type: "home" };
  document.documentElement.setAttribute("data-theme", "dark");
  closeModal("settings-modal-overlay");
  render();
  notify("Sistema limpo.");
}

/** Exclui todo o histórico arquivado de um grupo/empresa. */
function limparHistorico(gkey) {
  const qtd = (historico[gkey] || []).length;
  if (!qtd) { notify("Não há histórico para excluir.", "info"); return; }
  if (!confirmar(`Excluir todos os ${qtd} registros do histórico deste grupo/empresa?`)) return;
  delete historico[gkey];
  persist();
  render();
  notify("Histórico excluído.");
}
