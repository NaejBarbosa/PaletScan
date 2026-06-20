// pages/api/log-vercel.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Evitar armazenamento em cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { tipo, mensagem } = req.body;
    
    if (tipo === 'error') {
      console.error(`[CLIENT-ERROR] ${mensagem}`);
    } else {
      console.log(`[CLIENT-LOG] ${mensagem}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[log-vercel] Erro ao registrar log:', error);
    return res.status(500).json({ error: 'Erro interno ao processar log' });
  }
}
