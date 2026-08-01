/* =============================================================
 * Módulo: Exportações
 * Utilidades reutilizáveis de download/exportação usadas pelo
 * backup e preparadas para os próximos relatórios (Bater Saldo).
 * Nada aqui altera dados: apenas gera arquivos.
 * ============================================================= */

/** Faz o download de um conteúdo qualquer como arquivo. */
function baixarArquivo(nomeArquivo, conteudo, mime) {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Converte uma matriz simples em CSV (separador ";" para Excel pt-BR). */
function paraCSV(linhas) {
  return linhas
    .map((linha) => linha.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
}

/** Exporta uma matriz como CSV. */
function exportarCSV(nomeArquivo, linhas) {
  baixarArquivo(nomeArquivo, "\uFEFF" + paraCSV(linhas), "text/csv;charset=utf-8");
}

/** Exporta uma matriz como planilha .xlsx (usa a lib XLSX já carregada). */
function exportarXLSX(nomeArquivo, linhas, nomeAba) {
  if (typeof XLSX === "undefined") return;
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomeAba || "Dados");
  XLSX.writeFile(wb, nomeArquivo);
}
