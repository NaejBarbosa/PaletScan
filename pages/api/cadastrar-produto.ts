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
    pesarCod,
    vincular,
  } = req.body;

  if (!produtoEan || !produtoDescr || !marcaId || !produtoClasse || !produtoConservacao) {
    return res.status(400).json({ error: 'Dados obrigatórios incompletos' });
  }

  try {
    const sheetId = process.env.BANCO_VALIDA_SHEET_ID;
    if (!sheetId) {
      return res.status(500).json({ error: 'Erro: A variável de ambiente BANCO_VALIDA_SHEET_ID não está configurada no servidor.' });
    }

    const rowValues = [
      marcaId,
      marcaDescr,
      produtoClasse,
      produtoEan,
      produtoDun || '',
      produtoConservacao,
      produtoDescr,
      pesarCod || '',
    ];

    if (vincular) {
      console.log(`[API Cadastrar Produto] Modo vinculação ativo. Buscando EAN ${produtoEan}...`);
      const allRows = await getSheetData(sheetId, 'banco_valida!A:H');
      // Procura a linha com base no EAN (coluna D, índice 3)
      // allRows[0] é o cabeçalho, então a linha real da planilha é index + 1
      const rowIndex = allRows.findIndex((row, idx) => idx > 0 && row[3] === produtoEan);

      if (rowIndex !== -1) {
        const sheetLine = rowIndex + 1;
        const targetRange = `banco_valida!A${sheetLine}:H${sheetLine}`;
        console.log(`[API Cadastrar Produto] EAN localizado na linha ${sheetLine}. Atualizando intervalo ${targetRange}...`);
        
        // Mantém o pesarCod existente se o novo estiver vazio e houver valor anterior
        if (!rowValues[7] && allRows[rowIndex] && allRows[rowIndex][7]) {
          rowValues[7] = allRows[rowIndex][7];
        }

        const result = await updateRow(sheetId, targetRange, rowValues);
        return res.status(200).json({ success: true, details: result, updatedLine: sheetLine });
      } else {
        console.warn(`[API Cadastrar Produto] EAN ${produtoEan} não encontrado para vinculação. Realizando inserção padrão...`);
      }
    }

    // Para evitar que o Sheets API tente adivinhar as colunas e desvie a gravação 
    // (ex: gravando em B:I em vez de A:H), nós calculamos a próxima linha livre 
    // e gravamos diretamente no intervalo exato usando a função UPDATE.
    
    // Busca os dados da coluna A para saber a quantidade total de linhas
    console.log('[API Cadastrar Produto] Obtendo tamanho atual da planilha...');
    const colAData = await getSheetData(sheetId, 'banco_valida!A:A');
    const nextRow = colAData.length + 1;
    const targetRange = `banco_valida!A${nextRow}:H${nextRow}`;

    console.log(`[API Cadastrar Produto] Gravando na linha ${nextRow} (Intervalo: ${targetRange}) na planilha:`, sheetId);
    console.log('[API Cadastrar Produto] Conteúdo da linha:', JSON.stringify(rowValues));

    // Gravação forçada nas colunas A a H da próxima linha
    const result = await updateRow(sheetId, targetRange, rowValues);

    console.log('[API Cadastrar Produto] Sucesso no Sheets API! Retorno:', JSON.stringify(result));

    res.status(200).json({ success: true, details: result });
  } catch (error: any) {
    console.error('Erro ao cadastrar produto:', error);
    const msg = error?.message || error?.toString() || 'Erro interno do servidor';
    res.status(500).json({ error: `Erro na gravação do Sheets: ${msg}` });
  }
}
