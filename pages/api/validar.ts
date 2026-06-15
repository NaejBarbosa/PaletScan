// pages/api/validar.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSheetData } from '../../lib/googleSheets';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  try {
    const sheetId = process.env.BANCO_VALIDA_SHEET_ID as string;
    // Colunas A..G: marca-id, marca-descr, produto-classe, produto-ean, produto-dun, produto-conservacao, produto-descr
    const data = await getSheetData(sheetId, 'banco_valida!A:G');
    // Ignorar cabeçalho (linha 1)
    const rows = data.slice(1).map((row) => ({
      marcaId: row[0],
      marcaDescr: row[1],
      produtoClasse: row[2],
      produtoEan: row[3],
      produtoDun: row[4] || '',
      produtoConservacao: row[5] || '',
      produtoDescr: row[6] || row[4] || '', // Fallback para coluna antiga se não houver 7 colunas
    }));
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar banco_valida' });
  }
}