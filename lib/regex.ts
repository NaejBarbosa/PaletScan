// lib/regex.ts

/**
 * Valida se uma data é real (considera anos bissextos)
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
 * Valida se uma data no formato dd/mm/aaaa é real
 * @param dateStr - string no formato dd/mm/aaaa
 * @returns true se data válida, false caso contrário
 */
export function validarDataReal(dateStr: string): boolean {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(regex);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  return isValidDate(year, month, day);
}

/**
 * Extrai EAN e data de validade do texto bruto do Data Matrix
 * @param qrData - string no formato "315315;17896419732515;202603197004783;"
 * @returns objeto com ean (13 dígitos) e validade (dd/mm/aaaa) ou null
 */
function extrairDadosDataMatrix(qrData: string) {
  const clean = qrData.trim();
  // Regex: captura os 13 dígitos do EAN (após o "1") e os 8 dígitos da data de fabricação
  const regex = /^\d+;1(\d{13});(\d{8})/;
  const match = clean.match(regex);

  if (!match || !match[1] || !match[2]) {
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
    return null;
  }

  // Cria objeto Date para a fabricação (atenção: mês zero-indexed)
  const dataFabricacao = new Date(anoFab, mesFab - 1, diaFab);

  // Calcula validade = fabricação + 365 dias
  const dataValidade = new Date(dataFabricacao);
  dataValidade.setDate(dataValidade.getDate() + 365);

  // Valida se a data resultante é real
  const anoVal = dataValidade.getFullYear();
  const mesVal = dataValidade.getMonth() + 1;
  const diaVal = dataValidade.getDate();
  if (!isValidDate(anoVal, mesVal, diaVal)) {
    return null;
  }

  const validadeFormatada = formatToDDMMYYYY(dataValidade);

  return {
    ean: ean13,
    validade: validadeFormatada,      // dd/mm/aaaa
  };
}

/**
 * Extrai EAN e data de validade do texto bruto
 * @param text - string escaneada (pode ser Data Matrix, QRCode, código de barras, etc.)
 * @returns { ean: string, validade: string | null, tipo: 'datamatrix' | 'ean_validade' | 'ean' | null }
 */
export function extrairDados(text: string) {
  const clean = text.trim();
  console.log('[extrairDados] Texto bruto:', clean);

  // Tentativa 1: Data Matrix completo (formato: "315315;17896419732515;202603197004783;")
  const dmResult = extrairDadosDataMatrix(clean);
  if (dmResult) {
    console.log('[extrairDados] Data Matrix detectado -> EAN:', dmResult.ean, 'Validade:', dmResult.validade);
    return { ...dmResult, tipo: 'datamatrix' as const };
  }

  // Tentativa 2: QRCode com EAN + validade dd/mm/aaaa (ex: "7896419732515;31/12/2025")
  const eanValidadeRegex = /^(\d{13})\s*;\s*(\d{2})\/(\d{2})\/(\d{4})/;
  const eanValidadeMatch = clean.match(eanValidadeRegex);
  if (eanValidadeMatch) {
    const ean = eanValidadeMatch[1];
    const day = parseInt(eanValidadeMatch[2], 10);
    const month = parseInt(eanValidadeMatch[3], 10);
    const year = parseInt(eanValidadeMatch[4], 10);
    if (isValidDate(year, month, day)) {
      const validade = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      console.log('[extrairDados] EAN+Validade detectado -> EAN:', ean, 'Validade:', validade);
      return { ean, validade, tipo: 'ean_validade' as const };
    }
  }

  // Tentativa 3: QRCode com EAN + validade YYYYMMDD (ex: "7896419732515;20251231")
  const eanValidadeYYYYMMDDRegex = /^(\d{13})\s*;\s*(\d{4})(\d{2})(\d{2})/;
  const eanValidadeYYYYMMDDMatch = clean.match(eanValidadeYYYYMMDDRegex);
  if (eanValidadeYYYYMMDDMatch) {
    const ean = eanValidadeYYYYMMDDMatch[1];
    const year = parseInt(eanValidadeYYYYMMDDMatch[2], 10);
    const month = parseInt(eanValidadeYYYYMMDDMatch[3], 10);
    const day = parseInt(eanValidadeYYYYMMDDMatch[4], 10);
    if (isValidDate(year, month, day)) {
      const validade = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      console.log('[extrairDados] EAN+Validade YYYYMMDD detectado -> EAN:', ean, 'Validade:', validade);
      return { ean, validade, tipo: 'ean_validade' as const };
    }
  }

  // Tentativa 4: Código de barras com EAN + outro número (ex: "789641973251512345")
  // Procura por EAN-13 com 13 dígitos delimitado por word boundary
  const eanRegex = /\b(\d{13})\b/;
  const eanMatch = clean.match(eanRegex);
  if (eanMatch) {
    const ean = eanMatch[1];
    console.log('[extrairDados] EAN isolado detectado -> EAN:', ean);
    return { ean, validade: null, tipo: 'ean' as const };
  }

  // Tentativa 5: EAN com 8 dígitos (EAN-8)
  const ean8Regex = /\b(\d{8})\b/;
  const ean8Match = clean.match(ean8Regex);
  if (ean8Match) {
    const ean = ean8Match[1];
    console.log('[extrairDados] EAN-8 detectado -> EAN:', ean);
    return { ean, validade: null, tipo: 'ean' as const };
  }

  console.error('[extrairDados] Nenhum formato reconhecido. Texto:', clean);
  return null;
}
