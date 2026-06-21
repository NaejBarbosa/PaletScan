// components/PesquisaProduto.tsx
import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Scanner from './Scanner';
import { extrairDados } from '../lib/regex';
import { useTheme } from '../context/ThemeContext';

export interface ProdutoValido {
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoEan: string;
  produtoDun: string;
  produtoConservacao: string;
  produtoDescr: string;
}

interface PesquisaProdutoProps {
  produtosValidos: ProdutoValido[];
}

export default function PesquisaProduto({ produtosValidos }: PesquisaProdutoProps) {
  const { theme } = useTheme();
  
  // Abas internas: 'radar' (Scanner + Watchlist) ou 'pesquisa' (Fuzzy Search)
  const [innerTab, setInnerTab] = useState<'radar' | 'busca'>('radar');
  
  // Estados para Busca Fuzzy
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Watchlist (Radar)
  const [watchlist, setWatchlist] = useState<ProdutoValido[]>([]);
  const [novoEanProcurado, setNovoEanProcurado] = useState('');
  const [showAddManual, setShowAddManual] = useState(false);

  // Estados para o Modal de Detalhes
  const [selectedProduct, setSelectedProduct] = useState<ProdutoValido | null>(null);
  const [isWatchlistMatch, setIsWatchlistMatch] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Carregar e persistir a Watchlist no localStorage
  useEffect(() => {
    const saved = localStorage.getItem('radar_watchlist');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setWatchlist(parsed);
      } catch (e) {
        console.error('Erro ao ler watchlist do localStorage', e);
      }
    }
  }, []);

  const saveWatchlist = (list: ProdutoValido[]) => {
    setWatchlist(list);
    localStorage.setItem('radar_watchlist', JSON.stringify(list));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Lógica de Busca Fuzzy
  const removeAccents = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const terms = removeAccents(searchTerm).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    // 1. Filtra os produtos que possuem TODOS os termos pesquisados (Fuzzy Check)
    const matches = produtosValidos.filter((prod) => {
      const matchText = removeAccents(`${prod.produtoDescr} ${prod.marcaDescr} ${prod.produtoEan} ${prod.produtoDun}`);
      return terms.every((term) => matchText.includes(term));
    });

    // 2. Calcula a pontuação de relevância para ordenar os resultados
    const scored = matches.map((prod) => {
      const titleNorm = removeAccents(prod.produtoDescr || '');
      const brandNorm = removeAccents(prod.marcaDescr || '');
      const searchNorm = removeAccents(searchTerm);
      const combinedNorm = `${brandNorm} ${titleNorm}`;

      let score = 0;

      // Correspondência exata da frase de busca inteira
      if (titleNorm.includes(searchNorm)) {
        score += 1000;
      } else if (combinedNorm.includes(searchNorm)) {
        score += 800;
      }

      // Correspondência de termos individuais
      terms.forEach((term, idx) => {
        const isCommonWord = term.length <= 2;
        
        // Match de Marca
        if (brandNorm === term) {
          score += isCommonWord ? 50 : 300;
        } else if (brandNorm.includes(term)) {
          score += isCommonWord ? 20 : 100;
        }

        // Match de Descrição (posição)
        const pos = titleNorm.indexOf(term);
        if (pos === 0) {
          score += isCommonWord ? 30 : 200; // Começa com a palavra chave
        } else if (pos > 0) {
          // Pontua melhor os matches que ocorrem mais próximos ao início da descrição
          score += isCommonWord ? 10 : Math.max(0, 100 - Math.floor(pos / 2));
        }

        // Match exato de palavra inteira (Word Boundary)
        const wordRegex = new RegExp('\\b' + term + '\\b');
        if (wordRegex.test(titleNorm)) {
          score += isCommonWord ? 15 : 80;
        }

        // Par de termos consecutivos na busca que aparecem contíguos na descrição
        if (idx < terms.length - 1) {
          const nextTerm = terms[idx + 1];
          const pair = `${term} ${nextTerm}`;
          if (titleNorm.includes(pair)) {
            score += 150;
          }
        }
      });

      // Penalidade de comprimento do título (Length Penalty)
      // Favorece produtos com títulos mais curtos e diretos quando ocorrem empates
      score += Math.max(0, 100 - titleNorm.length);

      return { prod, score };
    });

    // 3. Ordena de forma decrescente pelo score de relevância
    scored.sort((a, b) => b.score - a.score);

    return scored.map((item) => item.prod);
  }, [searchTerm, produtosValidos]);

  // 2. Lógica para Adicionar Produto na Watchlist (Radar)
  const toggleWatchlist = (product: ProdutoValido) => {
    const index = watchlist.findIndex((p) => p.produtoEan === product.produtoEan);
    let newList = [...watchlist];
    if (index >= 0) {
      newList.splice(index, 1);
      showToast('Produto removido do Radar', 'info');
    } else {
      newList.push(product);
      showToast('Produto adicionado ao Radar!', 'success');
    }
    saveWatchlist(newList);
  };

  const handleAddManualEan = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEan = novoEanProcurado.trim();
    if (!cleanEan) return;

    // Busca o produto correspondente na base
    const product = produtosValidos.find(
      (p) => p.produtoEan === cleanEan || p.produtoDun === cleanEan
    );

    if (!product) {
      showToast('Código de barras (EAN/DUN) não encontrado na base de produtos.', 'error');
      return;
    }

    if (watchlist.some((p) => p.produtoEan === product.produtoEan)) {
      showToast('Este produto já está cadastrado na lista de procurados.', 'info');
      return;
    }

    const newList = [...watchlist, product];
    saveWatchlist(newList);
    setNovoEanProcurado('');
    setShowAddManual(false);
    showToast('Produto adicionado ao Radar!', 'success');
  };

  // 3. Lógica para Leitura Rápida (Scanner)
  const handleDetectedScan = (text: string) => {
    const dados = extrairDados(text);
    if (!dados) {
      showToast('Código inválido. Tente novamente.', 'error');
      return;
    }

    const { ean, dun } = dados;
    let foundProduct: ProdutoValido | undefined;

    if (dun) {
      foundProduct = produtosValidos.find((p) => p.produtoDun === dun);
    } else if (ean) {
      foundProduct = produtosValidos.find((p) => p.produtoEan === ean);
    }

    if (!foundProduct) {
      showToast(`Código ${dun || ean} não identificado no cadastro.`, 'error');
      return;
    }

    // Verifica se pertence à Lista de Procurados (Watchlist)
    const isMatch = watchlist.some((p) => p.produtoEan === foundProduct?.produtoEan);
    
    setIsWatchlistMatch(isMatch);
    setSelectedProduct(foundProduct);
    setShowQRCode(false);

    if (isMatch) {
      showToast('🎯 PRODUTO LOCALIZADO NO RADAR!', 'success');
    } else {
      showToast('Produto localizado na base!', 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Abas Internas de Operação */}
      <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/40 dark:border-slate-700/40 max-w-md mx-auto animate-fadeIn">
        <button
          onClick={() => setInnerTab('radar')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
            innerTab === 'radar'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md scale-[1.02]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Scanner & Radar
        </button>
        <button
          onClick={() => setInnerTab('busca')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
            innerTab === 'busca'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md scale-[1.02]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Busca por Texto
        </button>
      </div>

      {/* Conteúdo da Aba 1: Scanner & Radar */}
      {innerTab === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1 e 2: Scanner */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-elevated overflow-hidden animate-slideUp" style={{ animationDelay: '50ms' }}>
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
                  </span>
                  Leitura Rápida e Consulta de EAN/DUN
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Escaneie um código para ver detalhes do produto imediatamente, sem cadastrar validade.
                </p>
              </div>
              <div className="p-1">
                <Scanner onDetected={handleDetectedScan} />
              </div>
            </div>
          </div>

          {/* Coluna 3: Lista de Procurados (Radar) */}
          <div className="space-y-6">
            <div className="card p-5 animate-slideUp relative overflow-hidden" style={{ animationDelay: '100ms' }}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-warning-500/5 dark:bg-warning-500/10 rounded-bl-full pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  🎯 Lista de Procurados
                </h3>
                <button
                  onClick={() => setShowAddManual(!showAddManual)}
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  {showAddManual ? 'Cancelar' : 'Adicionar EAN'}
                </button>
              </div>

              {/* Form Manual de Adicionar EAN */}
              {showAddManual && (
                <form onSubmit={handleAddManualEan} className="mb-4 space-y-2 animate-slideDown">
                  <input
                    type="text"
                    placeholder="Digite o EAN ou DUN..."
                    value={novoEanProcurado}
                    onChange={(e) => setNovoEanProcurado(e.target.value)}
                    className="input-field py-2 text-sm"
                  />
                  <button type="submit" className="btn-primary w-full py-2 text-xs">
                    Confirmar Código
                  </button>
                </form>
              )}

              {/* Listagem */}
              {watchlist.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Nenhum produto monitorado no radar. Adicione produtos na busca por texto para acompanhar.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                  {watchlist.map((prod) => (
                    <div
                      key={prod.produtoEan}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800 transition-all text-left"
                    >
                      <button
                        onClick={() => {
                          setIsWatchlistMatch(true);
                          setSelectedProduct(prod);
                          setShowQRCode(false);
                        }}
                        className="flex-1 text-left min-w-0 pr-2 group"
                      >
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                          {prod.produtoDescr}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {prod.marcaDescr} · {prod.produtoEan}
                        </p>
                      </button>
                      <button
                        onClick={() => toggleWatchlist(prod)}
                        className="p-1 rounded bg-slate-200/60 hover:bg-danger-100 dark:bg-slate-800 dark:hover:bg-danger-900/30 text-slate-500 hover:text-danger-600 dark:hover:text-danger-400 transition-colors flex items-center justify-center"
                        title="Remover do Radar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 2: Busca por Texto */}
      {innerTab === 'busca' && (
        <div className="card p-6 space-y-6 animate-slideUp">
          {/* Input de Busca */}
          <div className="relative">
            <input
              type="text"
              placeholder="Pesquise por marca, produto, EAN ou DUN (ex: sobrecoxa bandeja sadia)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-11"
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Listagem de Resultados */}
          {searchTerm.trim() === '' ? (
            <div className="text-center py-12 px-4 text-slate-400 dark:text-slate-500">
              <svg className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15" />
              </svg>
              <p className="text-sm font-medium">Digite algum termo para pesquisar na base local</p>
              <p className="text-xs mt-1 text-slate-500">A pesquisa filtra instantaneamente na base de dados de produtos válidos.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 dark:text-slate-500">
              <p className="text-sm font-medium">Nenhum produto correspondente encontrado.</p>
              <p className="text-xs mt-1 text-slate-500">Verifique a grafia dos termos ou tente buscar por códigos de barras.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredProducts.map((prod) => (
                <button
                  key={prod.produtoEan}
                  onClick={() => {
                    setIsWatchlistMatch(watchlist.some((w) => w.produtoEan === prod.produtoEan));
                    setSelectedProduct(prod);
                    setShowQRCode(false);
                  }}
                  className="group card p-4 hover:border-primary-500/50 hover:scale-[1.01] hover:shadow-card-hover transition-all duration-300 text-left flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="badge badge-primary text-[10px] truncate max-w-[120px]">{prod.marcaDescr}</span>
                      <span className="badge badge-success text-[10px]">{prod.produtoClasse}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                      {prod.produtoDescr}
                    </h4>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono">EAN: {prod.produtoEan}</span>
                    <span className="font-semibold text-primary-600 dark:text-primary-400 group-hover:underline flex items-center gap-0.5">
                      Detalhes
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes do Produto */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm px-4">
          <div
            className={`card-elevated max-w-md w-full p-6 animate-scale-in relative overflow-hidden ${
              isWatchlistMatch
                ? 'border-2 border-success-500 shadow-success-500/10'
                : ''
            }`}
          >
            {/* Decoração Especial de Radar Match */}
            {isWatchlistMatch && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-success-500/10 rounded-bl-full pointer-events-none animate-pulse" />
            )}

            {/* Cabeçalho do Modal */}
            <div className="flex items-start gap-4 mb-5">
              {isWatchlistMatch ? (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center flex-shrink-0 shadow-lg animate-bounce">
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
                <h3 className={`text-lg font-extrabold ${isWatchlistMatch ? 'text-success-700 dark:text-success-400' : 'text-slate-900 dark:text-slate-100'}`}>
                  {isWatchlistMatch ? '🎯 PRODUTO LOCALIZADO!' : 'Ficha Técnica'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isWatchlistMatch ? 'Este produto estava na sua Lista de Procurados.' : 'Dados cadastrais da base de dados.'}
                </p>
              </div>
            </div>

            {/* Informações */}
            {!showQRCode ? (
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 mb-5 space-y-3">
                <div className="flex justify-between items-start gap-4 text-xs">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Produto</span>
                  <span className="text-slate-900 dark:text-slate-100 text-right font-bold">{selectedProduct.produtoDescr}</span>
                </div>
                <div className="flex justify-between items-start gap-4 text-xs">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Marca</span>
                  <span className="text-slate-900 dark:text-slate-100 text-right">{selectedProduct.marcaDescr}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Classe</span>
                  <span className="badge badge-primary">{selectedProduct.produtoClasse}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Conservação</span>
                  <span className={`badge ${
                    selectedProduct.produtoConservacao?.toLowerCase().includes('congelado')
                      ? 'badge-primary'
                      : 'badge-warning'
                  }`}>
                    {selectedProduct.produtoConservacao || 'Não definida'}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-4 text-xs border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                  <span className="font-medium text-slate-500 dark:text-slate-400">EAN (Consumidor)</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 text-right font-semibold">{selectedProduct.produtoEan}</span>
                </div>
                {selectedProduct.produtoDun && (
                  <div className="flex justify-between items-start gap-4 text-xs">
                    <span className="font-medium text-slate-500 dark:text-slate-400">DUN (Distribuição)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100 text-right font-semibold">{selectedProduct.produtoDun}</span>
                  </div>
                )}
              </div>
            ) : (
              /* QR Code grande e centralizado */
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 mb-5 text-center flex flex-col items-center justify-center animate-scale-in">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4">
                  Escaneie com outro smartphone no sistema Rub
                </p>
                <div className="p-3 bg-white border-2 border-slate-100 dark:border-slate-800 rounded-xl shadow-inner">
                  <QRCodeSVG
                    value={selectedProduct.produtoEan}
                    size={220}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 mt-4 tracking-wider">
                  EAN: {selectedProduct.produtoEan}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
                  {selectedProduct.produtoDescr}
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

              <button
                onClick={() => toggleWatchlist(selectedProduct)}
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-all ${
                  watchlist.some((w) => w.produtoEan === selectedProduct.produtoEan)
                    ? 'bg-danger-50 hover:bg-danger-100 text-danger-700 border-danger-200 dark:bg-danger-900/10 dark:hover:bg-danger-900/20 dark:text-danger-400 dark:border-danger-900/50'
                    : 'bg-warning-50 hover:bg-warning-100 text-warning-800 border-warning-200 dark:bg-warning-900/10 dark:hover:bg-warning-900/20 dark:text-warning-400 dark:border-warning-900/50'
                }`}
              >
                {watchlist.some((w) => w.produtoEan === selectedProduct.produtoEan) ? (
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
                onClick={() => setSelectedProduct(null)}
                className="btn-secondary w-full text-sm font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast flutuante para feedback */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-[60] flex justify-center items-center px-4 pointer-events-none">
          <div className={`pointer-events-auto flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border max-w-md w-full sm:w-auto animate-toast ${
            toast.type === 'success'
              ? 'bg-white dark:bg-slate-900 border-success-300 dark:border-success-800 text-success-700 dark:text-success-400'
              : toast.type === 'error'
              ? 'bg-white dark:bg-slate-900 border-danger-300 dark:border-danger-800 text-danger-700 dark:text-danger-400'
              : 'bg-white dark:bg-slate-900 border-primary-300 dark:border-primary-800 text-primary-700 dark:text-primary-400'
          }`}>
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-semibold text-sm text-center break-words leading-tight">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
