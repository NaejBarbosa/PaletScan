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
 * Extrai DUN, EAN e data de validade do texto bruto do Data Matrix
 * Agora aceita qualquer texto antes e depois, usando regex que captura
 * DUN de 14 dígitos e os próximos 8 dígitos (data de fabricação).
 */
function extrairDadosDataMatrix(qrData: string) {
  const clean = qrData.trim().replace(/\s/g, ''); // remove espaços e quebras de linha
  // Busca pelo padrão: 14 dígitos, ponto e vírgula, 8 dígitos
  const regex = /(\d{14});(\d{8})/;
  const match = clean.match(regex);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  const dun14 = match[1];            // ex: "27896419728751"
  const ean13 = dun14.substring(1);  // ex: "7896419728751"
  const dataFabStr = match[2];       // ex: "20260319"

  const anoFab = parseInt(dataFabStr.substring(0, 4), 10);
  const mesFab = parseInt(dataFabStr.substring(4, 6), 10);
  const diaFab = parseInt(dataFabStr.substring(6, 8), 10);

  if (!isValidDate(anoFab, mesFab, diaFab)) {
    return null;
  }

  const dataFabricacao = new Date(anoFab, mesFab - 1, diaFab);
  const dataValidade = new Date(dataFabricacao);
  dataValidade.setDate(dataValidade.getDate() + 365);

  const anoVal = dataValidade.getFullYear();
  const mesVal = dataValidade.getMonth() + 1;
  const diaVal = dataValidade.getDate();
  if (!isValidDate(anoVal, mesVal, diaVal)) {
    return null;
  }

  const validadeFormatada = formatToDDMMYYYY(dataValidade);

  return {
    dun: dun14,
    ean: ean13,
    validade: validadeFormatada,
  };
}

/**
 * Extrai DUN, EAN e data de validade do texto bruto
 * @param text - string escaneada
 * @returns objeto com dun?, ean, validade?, tipo
 */
export function extrairDados(text: string) {
  const clean = text.trim();
  console.log('[extrairDados] Texto bruto:', clean);

  // 1. Data Matrix completo
  const dmResult = extrairDadosDataMatrix(clean);
  if (dmResult) {
    console.log('[extrairDados] Data Matrix detectado -> DUN:', dmResult.dun, 'EAN:', dmResult.ean, 'Validade:', dmResult.validade);
    return { ...dmResult, tipo: 'datamatrix' as const };
  }

  // 2. QRCode com EAN + validade dd/mm/aaaa
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

  // 3. QRCode com EAN + validade YYYYMMDD
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

  // 4. DUN-14 isolado (14 dígitos) - ACEITA QUALQUER PRIMEIRO DÍGITO
  const dunRegex = /\b(\d{14})\b/;
  const dunMatch = clean.match(dunRegex);
  if (dunMatch) {
    const dun = dunMatch[1];
    const ean = dun.substring(1);
    console.log('[extrairDados] DUN-14 detectado -> DUN:', dun, 'EAN:', ean);
    return { dun, ean, validade: null, tipo: 'dun' as const };
  }

  // 5. EAN-13 isolado
  const eanRegex = /\b(\d{13})\b/;
  const eanMatch = clean.match(eanRegex);
  if (eanMatch) {
    const ean = eanMatch[1];
    console.log('[extrairDados] EAN isolado detectado -> EAN:', ean);
    return { ean, validade: null, tipo: 'ean' as const };
  }

  // 6. EAN-8 isolado
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