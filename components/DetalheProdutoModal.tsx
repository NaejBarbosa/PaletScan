import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import ProdutoAvatar from './ProdutoAvatar';
import { ProdutoValido, WatchlistItem } from './PesquisaProduto';
import { useLanguage } from '../context/LanguageContext';

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
  const { language, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  const isPendingMatch = watchlist.some((w) => w.produtoEan === produto.produtoEan && !w.localizado);
  const showMatchStyle = isMatchCelebration || isPendingMatch;

  const triggerSpectacularConfetti = () => {
    // Primeiro disparo em leque duplo
    confetti({
      particleCount: 120,
      spread: 60,
      origin: { x: 0.2, y: 0.65 },
      zIndex: 9999,
      colors: ['#06b6d4', '#6366f1', '#10b981']
    });
    confetti({
      particleCount: 120,
      spread: 60,
      origin: { x: 0.8, y: 0.65 },
      zIndex: 9999,
      colors: ['#06b6d4', '#6366f1', '#10b981']
    });

    // Loop de comemoração contínua por 1.5 segundos
    const duration = 1.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999, colors: ['#06b6d4', '#6366f1', '#10b981'] };

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 40 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3 + 0.1, y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3 + 0.6, y: Math.random() - 0.2 } });
    }, 200);
  };

  useEffect(() => {
    setMounted(true);
    if (showMatchStyle) {
      triggerSpectacularConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMatchStyle]);

  if (!mounted) return null;

  const isProductInWatchlist = watchlist.some((w) => w.produtoEan === produto.produtoEan);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm px-4">
      <div
        className={`card-elevated max-w-md w-full p-6 animate-scale-in relative overflow-hidden flex flex-col gap-4 ${
          showMatchStyle
            ? 'border border-emerald-500/30 dark:border-emerald-400/20 shadow-lg shadow-emerald-500/5 bg-gradient-to-b from-emerald-50/5 to-transparent dark:from-emerald-950/5'
            : ''
        }`}
      >
        {/* Badge de Destaque Sutil e Elegante no Topo */}
        {showMatchStyle && (
          <div className="flex justify-center mt-1 mb-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-2 border border-emerald-200/50 dark:border-emerald-800/30 shadow-sm animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{language === 'pt' ? 'Produto encontrado!' : '¡Producto encontrado!'}</span>
            </div>
          </div>
        )}

        {/* Exibição da Imagem do Produto */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative p-1.5 flex items-center justify-center">
            {showMatchStyle && (
              <span className="absolute inset-1.5 rounded-2xl bg-emerald-500 animate-ping opacity-75 pointer-events-none" />
            )}
            <div className={showMatchStyle 
              ? 'relative rounded-2xl overflow-hidden border-4 border-emerald-500 dark:border-emerald-400 shadow-lg shadow-emerald-500/50 animate-pulse transition-all duration-300'
              : ''
            }>
              <ProdutoAvatar ean={produto.produtoEan} descricao={produto.produtoDescr} />
            </div>
          </div>
        </div>

        {/* Informações cadastrais do produto */}
        {!showQRCode ? (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start gap-4 text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t('produto')}</span>
              <span className="text-slate-900 dark:text-slate-100 text-right font-bold">{produto.produtoDescr}</span>
            </div>
            <div className="flex justify-between items-start gap-4 text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t('marca')}</span>
              <span className="text-slate-900 dark:text-slate-100 text-right">{produto.marcaDescr}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t('classe')}</span>
              <span className="badge badge-primary">{produto.produtoClasse}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t('conservacao')}</span>
              <span className={`badge ${
                produto.produtoConservacao?.toLowerCase().includes('congelado')
                  ? 'badge-primary'
                  : 'badge-warning'
              }`}>
                {produto.produtoConservacao || (language === 'pt' ? 'Não definida' : 'No definida')}
              </span>
            </div>
            <div className="flex justify-between items-start gap-4 text-xs border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t('eanConsumidor')}</span>
              <span className="font-mono text-slate-900 dark:text-slate-100 text-right font-semibold">{produto.produtoEan}</span>
            </div>
            <div className="flex justify-between items-start gap-4 text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t('dunDistribuicao')}</span>
              {produto.produtoDun ? (
                <span className="font-mono text-slate-900 dark:text-slate-100 text-right font-semibold">{produto.produtoDun}</span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 text-right italic font-normal">
                  {language === 'pt' ? 'Não cadastrado' : 'No registrado'}
                </span>
              )}
            </div>
            {validade && (
              <div className="flex justify-between items-center gap-4 text-xs border-t border-dashed border-slate-200 dark:border-slate-700 pt-3 mt-2 overflow-visible">
                <span className="font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{t('dataVencimento')}</span>
                {(() => {
                  const checkIsVencido = (dateStr: string | null): boolean => {
                    if (!dateStr) return false;
                    const parts = dateStr.split('/');
                    if (parts.length !== 3) return false;
                    const dia = parseInt(parts[0], 10);
                    const mes = parseInt(parts[1], 10) - 1;
                    const ano = parseInt(parts[2], 10);
                    const dataValidade = new Date(ano, mes, dia);
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    return dataValidade < hoje;
                  };
                  return checkIsVencido(validade) ? (
                    <div className="relative overflow-visible flex items-center justify-end">
                      <span className="absolute -inset-1 rounded bg-red-500 animate-ping opacity-75" />
                      <span className="relative font-mono text-white bg-red-600 px-2.5 py-1 rounded font-bold border border-red-700 text-xs shadow-md animate-pulse whitespace-nowrap">
                        🚨 {validade} ({language === 'pt' ? 'VENCIDO' : 'VENCIDO'})
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 text-right font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded border border-emerald-100 dark:border-emerald-900/50 text-xs whitespace-nowrap">
                      {validade}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          /* QR Code grande e centralizado */
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center animate-scale-in">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4">
              {language === 'pt' ? 'Escaneie com o Rub para consultar o estoque' : 'Escanee con el Rub para consultar el stock'}
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[260px] mx-auto break-words text-center leading-relaxed">
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
              {language === 'pt' ? 'Gerar QR Code (EAN)' : 'Generar código QR (EAN)'}
            </button>
          ) : (
            <button
              onClick={() => setShowQRCode(false)}
              className="btn-secondary w-full text-sm font-bold"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {language === 'pt' ? 'Voltar para os Detalhes' : 'Volver a los Detalles'}
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
                {language === 'pt' ? 'Remover da Lista de Procurados' : 'Eliminar de la Lista de Buscados'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.243.58 1.8l-3.968 2.89a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.977-2.89a1 1 0 00-1.175 0l-3.979 2.89c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.98 9.87c-.779-.557-.38-1.8.58-1.8h4.907a1 1 0 00.95-.69l1.52-4.674z" />
                </svg>
                {language === 'pt' ? 'Adicionar à Lista de Procurados' : 'Agregar a la Lista de Buscados'}
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="btn-secondary w-full text-sm font-semibold"
          >
            {language === 'pt' ? 'Fechar' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
