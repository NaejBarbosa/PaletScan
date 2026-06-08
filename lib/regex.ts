// lib/regex.ts

/**
 * Valida se uma data é real (considera anos bissextos)
 * @param year - ano (ex: 2026)
 * @param month - mês (1-12)
 * @param day - dia (1-31)
 */
function isValidDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Formata uma data Date para dd/mm/aaaa
 */
function formatToDDMMYYYY(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Extrai EAN e data de validade do texto bruto do Data Matrix
 * @param qrData - string no formato "315315;17896419732515;202603197004783;"
 * @returns objeto com ean (13 dígitos) e validade (dd/mm/aaaa) ou null
 */
export function extrairDados(qrData: string) {
  const clean = qrData.trim();
  console.log('[extrairDados] Texto bruto:', clean);

  // Regex: captura os 13 dígitos do EAN (após o "1") e os 8 dígitos da data de fabricação
  const regex = /^\d+;1(\d{13});(\d{8})/;
  const match = clean.match(regex);

  if (!match || !match[1] || !match[2]) {
    console.error('[extrairDados] Regex falhou. Texto:', clean);
    return null;
  }

  const ean13 = match[1];           // ex: "7896419732515"
  const dataFabStr = match[2];      // ex: "20260319"

  // Converte string "YYYYMMDD" para números
  const anoFab = parseInt(dataFabStr.substring(0, 4), 10);
  const mesFab = parseInt(dataFabStr.substring(4, 6), 10);
  const diaFab = parseInt(dataFabStr.substring(6, 8), 10);

  // Valida a data de fabricação
  if (!isValidDate(anoFab, mesFab, diaFab)) {
    console.error('[extrairDados] Data de fabricação inválida:', dataFabStr);
    return null;
  }

  // Cria objeto Date para a fabricação (atenção: mês zero-indexed)
  const dataFabricacao = new Date(anoFab, mesFab - 1, diaFab);

  // Calcula validade = fabricação + 365 dias
  const dataValidade = new Date(dataFabricacao);
  dataValidade.setDate(dataValidade.getDate() + 365);

  // Valida se a data resultante é real (ex: 31/12/2024 + 365 dias = 31/12/2025)
  const anoVal = dataValidade.getFullYear();
  const mesVal = dataValidade.getMonth() + 1;
  const diaVal = dataValidade.getDate();
  if (!isValidDate(anoVal, mesVal, diaVal)) {
    console.error('[extrairDados] Data de validade calculada inválida:', dataValidade);
    return null;
  }

  const validadeFormatada = formatToDDMMYYYY(dataValidade);

  console.log('[extrairDados] Sucesso -> EAN:', ean13, 'Validade:', validadeFormatada);

  return {
    ean: ean13,
    validade: validadeFormatada,      // dd/mm/aaaa
  };
}