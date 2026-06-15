// pages/api/cadastrar-produto.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSheetData, updateRow } from '../../lib/googleSheets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    marcaId,
    marcaDescr,
    produtoClasse,
    produtoEan,
    produtoDun,
    produtoConservacao,
    produtoDescr,
  } = req.body;

  if (!produtoEan || !produtoDescr || !marcaId || !produtoClasse || !produtoConservacao) {
    return res.status(400).json({ error: 'Dados obrigatórios incompletos' });
  }

  try {
    const sheetId = process.env.BANCO_VALIDA_SHEET_ID;
    if (!sheetId) {
      return res.status(500).json({ error: 'Erro: A variável de ambiente BANCO_VALIDA_SHEET_ID não está configurada no servidor.' });
    }

    // Para evitar que o Sheets API tente adivinhar as colunas e desvie a gravação 
    // (ex: gravando em B:H em vez de A:G), nós calculamos a próxima linha livre 
    // e gravamos diretamente no intervalo exato usando a função UPDATE.
    
    // Busca os dados da coluna A para saber a quantidade total de linhas
    console.log('[API Cadastrar Produto] Obtendo tamanho atual da planilha...');
    const colAData = await getSheetData(sheetId, 'banco_valida!A:A');
    const nextRow = colAData.length + 1;
    const targetRange = `banco_valida!A${nextRow}:G${nextRow}`;

    const rowValues = [
      marcaId,
      marcaDescr,
      produtoClasse,
      produtoEan,
      produtoDun || '',
      produtoConservacao,
      produtoDescr,
    ];

    console.log(`[API Cadastrar Produto] Gravando na linha ${nextRow} (Intervalo: ${targetRange}) na planilha:`, sheetId);
    console.log('[API Cadastrar Produto] Conteúdo da linha:', JSON.stringify(rowValues));

    // Gravação forçada nas colunas A a G da próxima linha
    const result = await updateRow(sheetId, targetRange, rowValues);

    console.log('[API Cadastrar Produto] Sucesso no Sheets API! Retorno:', JSON.stringify(result));

    res.status(200).json({ success: true, details: result });
  } catch (error: any) {
    console.error('Erro ao cadastrar produto:', error);
    const msg = error?.message || error?.toString() || 'Erro interno do servidor';
    res.status(500).json({ error: `Erro na gravação do Sheets: ${msg}` });
  }
}
