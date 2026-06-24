import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import ProdutoAvatar from './ProdutoAvatar';
import { ProdutoValido, WatchlistItem } from './PesquisaProduto';

interface DetalheProdutoModalProps {
  produto: ProdutoValido;
  validade: string | null;
  isMatchCelebration: boolean;
  watchlist: WatchlistItem[];
  toggleWatchlist: (produto: ProdutoValido) => void;
  onClose: () => void;
  onVincularDun?: (produto: ProdutoValido) => void;
}

export default function DetalheProdutoModal({
  produto,
  validade,
  isMatchCelebration,
  watchlist,
  toggleWatchlist,
  onClose,
  onVincularDun,
}: DetalheProdutoModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isProductInWatchlist = watchlist.some((w) => w.produtoEan === produto.produtoEan);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm px-4">
      <div
        className={`card-elevated max-w-md w-full p-6 animate-scale-in relative overflow-hidden flex flex-col gap-4 ${
          isMatchCelebration
            ? 'border-2 border-success-500 shadow-elevated bg-gradient-to-b from-success-50/10 to-transparent dark:from-success-950/10 ring-4 ring-success-500/20'
            : ''
        }`}
      >
        {/* Decoração Especial de Radar Match */}
        {isMatchCelebration && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-success-500/10 rounded-bl-full pointer-events-none animate-pulse" />
        )}

        {/* Exibição da Imagem do Produto */}
        <ProdutoAvatar ean={produto.produtoEan} descricao={produto.produtoDescr} />

        {/* Cabeçalho do Modal */}
        <div className="flex items-start gap-4">
          {isMatchCelebration ? (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center flex-shrink-0 shadow-lg animate-bounce ring-4 ring-success-500/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a3 3 0 10-3 3h3zm0-3a1 1 0 100-2 1 1 0 000 2zm0 8a2 2 0 110-4 2 2 0 010 4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 110-8 4 4 0 010 8z" />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-extrabold ${isMatchCelebration ? 'text-success-700 dark:text-success-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {isMatchCelebration ? '🎯 PRODUTO LOCALIZADO!' : 'Ficha Técnica'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isMatchCelebration ? 'Este produto estava na sua Lista de Procurados.' : 'Dados cadastrais da base de dados.'}
            </p>
          </div>
        </div>

        {/* Informações cadastrais do produto */}
        {!showQRCode ? (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start gap-4 text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">Produto</span>
              <span className="text-slate-900 dark:text-slate-100 text-right font-bold">{produto.produtoDescr}</span>
            </div>
            <div className="flex justify-between items-start gap-4 text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">Marca</span>
              <span className="text-slate-900 dark:text-slate-100 text-right">{produto.marcaDescr}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">Classe</span>
              <span className="badge badge-primary">{produto.produtoClasse}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">Conservação</span>
              <span className={`badge ${
                produto.produtoConservacao?.toLowerCase().includes('congelado')
                  ? 'badge-primary'
                  : 'badge-warning'
              }`}>
                {produto.produtoConservacao || 'Não definida'}
              </span>
            </div>
            <div className="flex justify-between items-start gap-4 text-xs border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
              <span className="font-medium text-slate-500 dark:text-slate-400">EAN (Consumidor)</span>
              <span className="font-mono text-slate-900 dark:text-slate-100 text-right font-semibold">{produto.produtoEan}</span>
            </div>
            <div className="flex justify-between items-start gap-4 text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">DUN (Distribuição)</span>
              {produto.produtoDun ? (
                <span className="font-mono text-slate-900 dark:text-slate-100 text-right font-semibold">{produto.produtoDun}</span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 text-right italic font-normal">Não cadastrado</span>
              )}
            </div>
            {validade && (
              <div className="flex justify-between items-start gap-4 text-xs border-t border-dashed border-slate-200 dark:border-slate-700 pt-3 mt-2">
                <span className="font-semibold text-danger-600 dark:text-danger-400">Data de Vencimento</span>
                <span className="font-mono text-danger-700 dark:text-danger-400 text-right font-bold bg-danger-50 dark:bg-danger-950/30 px-2 py-0.5 rounded border border-danger-100 dark:border-danger-900/50">
                  {validade}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* QR Code grande e centralizado */
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center animate-scale-in">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4">
              Escaneie com o Rub para consultar o estoque
            </p>
            <div className="p-3 bg-white border-2 border-slate-100 dark:border-slate-800 rounded-xl shadow-inner">
              <QRCodeSVG
                value={produto.produtoEan}
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 mt-4 tracking-wider">
              EAN: {produto.produtoEan}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
              {produto.produtoDescr}
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-2">
          {!showQRCode ? (
            <button
              onClick={() => setShowQRCode(true)}
              className="btn-primary w-full text-sm font-bold"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Gerar QR Code (EAN)
            </button>
          ) : (
            <button
              onClick={() => setShowQRCode(false)}
              className="btn-secondary w-full text-sm font-bold"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar para os Detalhes
            </button>
          )}

          {!produto.produtoDun && onVincularDun && (
            <button
              onClick={() => onVincularDun(produto)}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border bg-primary-600 hover:bg-primary-700 text-white border-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800 transition-all shadow-md"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Vincular DUN
            </button>
          )}

          <button
            onClick={() => toggleWatchlist(produto)}
            className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-all ${
              isProductInWatchlist
                ? 'bg-danger-50 hover:bg-danger-100 text-danger-700 border-danger-200 dark:bg-danger-900/10 dark:hover:bg-danger-900/20 dark:text-danger-400 dark:border-danger-900/50'
                : 'bg-warning-50 hover:bg-warning-100 text-warning-800 border-warning-200 dark:bg-warning-900/10 dark:hover:bg-warning-900/20 dark:text-warning-400 dark:border-warning-900/50'
            }`}
          >
            {isProductInWatchlist ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remover da Lista de Procurados
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.243.58 1.8l-3.968 2.89a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.977-2.89a1 1 0 00-1.175 0l-3.979 2.89c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.98 9.87c-.779-.557-.38-1.8.58-1.8h4.907a1 1 0 00.95-.69l1.52-4.674z" />
                </svg>
                Adicionar à Lista de Procurados
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="btn-secondary w-full text-sm font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
