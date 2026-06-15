// pages/api/marcas.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSheetData } from '../../lib/googleSheets';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const sheetId = process.env.BANCO_VALIDA_SHEET_ID as string;
    // Colunas A..B na aba banco_valida_marca: marca-id, marca-descr
    const data = await getSheetData(sheetId, 'banco_valida_marca!A:B');
    // Ignorar cabeçalho (linha 1)
    const rows = data.slice(1).map((row) => ({
      marcaId: row[0] || '',
      marcaDescr: row[1] || '',
    })).filter(item => item.marcaId !== '');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar marcas:', error);
    res.status(500).json({ error: 'Erro ao buscar banco_valida_marca' });
  }
}
