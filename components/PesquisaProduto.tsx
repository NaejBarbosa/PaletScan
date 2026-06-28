// components/PesquisaProduto.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import * as fuzzball from 'fuzzball';
import Scanner from './Scanner';
import { extrairDados } from '../lib/regex';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import CadastroProdutoModal from './CadastroProdutoModal';
import DetalheProdutoModal from './DetalheProdutoModal';

export interface ProdutoValido {
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoEan: string;
  produtoDun: string;
  produtoConservacao: string;
  produtoDescr: string;
}

export interface WatchlistItem extends ProdutoValido {
  localizado?: boolean;
}

const obterProdutoPorCodigo = (ean: string | undefined, dun: string | undefined, base: ProdutoValido[]): ProdutoValido | undefined => {
  if (dun) {
    let prod = base.find((p) => p.produtoDun === dun);
    if (prod) return prod;
    // Derivação matemática de EAN a partir de DUN
    const ean12 = dun.substring(1, 13);
    let soma = 0;
    for (let i = 0; i < ean12.length; i++) {
      const val = parseInt(ean12[i], 10);
      soma += val * (i % 2 === 0 ? 1 : 3);
    }
    const resto = soma % 10;
    const dv = ((10 - resto) % 10).toString();
    const eanDerivado = ean12 + dv;
    return base.find((p) => p.produtoEan === eanDerivado);
  }
  if (ean) {
    return base.find((p) => p.produtoEan === ean);
  }
  return undefined;
};

interface PesquisaProdutoProps {
  produtosValidos: ProdutoValido[];
  onProdutoCadastrado?: (novoProduto: ProdutoValido, foiVinculado?: boolean) => void;
}

export default function PesquisaProduto({ produtosValidos, onProdutoCadastrado }: PesquisaProdutoProps) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  
  const [innerTab, setInnerTab] = useState<'radar' | 'busca'>('radar');
  
  // Lista de monitorados no Radar (Watchlist) carregado de localStorage
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [novoEanProcurado, setNovoEanProcurado] = useState('');
  const [showAddManual, setShowAddManual] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Estados dos modais internos
  const [selectedProduct, setSelectedProduct] = useState<ProdutoValido | null>(null);
  const [selectedProductValidade, setSelectedProductValidade] = useState<string | null>(null);
  const [isWatchlistMatch, setIsWatchlistMatch] = useState(false);
  const [isMatchCelebration, setIsMatchCelebration] = useState(false);
  const [cadastroNaoIdentificado, setCadastroNaoIdentificado] = useState<{
    ean: string;
    dun: string;
    produtoParaVincular?: ProdutoValido;
    adicionarWatchlist?: boolean;
  } | null>(null);

  // Estados para busca textual fuzzy
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Efeito de debounce para a busca textual fuzzy
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 180);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('watchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (err) {
        console.error('Erro ao ler watchlist do localStorage', err);
      }
    }
  }, []);

  const showToast = (message: string, type: 'info' | 'success' | 'error') => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, 2800);
    return () => clearTimeout(timer);
  };

  const saveWatchlist = (newList: WatchlistItem[]) => {
    setWatchlist(newList);
    localStorage.setItem('watchlist', JSON.stringify(newList));
  };

  const toggleLocalizado = (ean: string) => {
    const newList = watchlist.map((item) => {
      if (item.produtoEan === ean) {
        const nextState = !item.localizado;
        return { ...item, localizado: nextState };
      }
      return item;
    });
    saveWatchlist(newList);
  };

  // Cadastro de produto não identificado
  const handleCadastroProdutoSuccess = (novoProduto: ProdutoValido, foiVinculado?: boolean) => {
    setCadastroNaoIdentificado(null);
    if (onProdutoCadastrado) {
      onProdutoCadastrado(novoProduto, foiVinculado);
    }
    
    // Se o cadastro foi disparado da Watchlist, adiciona no radar
    if (cadastroNaoIdentificado?.adicionarWatchlist) {
      if (!watchlist.some((p) => p.produtoEan === novoProduto.produtoEan)) {
        const newList = [...watchlist, { ...novoProduto, localizado: false }];
        saveWatchlist(newList);
      }
    }
    
    // Sucesso
    showToast(t('toastSucessoSalvar'), 'success');
  };

  // Normalização de string para o fuzzy
  const removeAccents = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Evita resetar se a digitação no input for lenta
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Lógica de busca fuzzy usando fuzzball
  const filteredProducts = useMemo(() => {
    const cleanTerm = debouncedSearchTerm.trim();
    if (!cleanTerm || cleanTerm.length < 2) return [];

    const termNorm = removeAccents(cleanTerm);
    
    // Monta a string de busca de forma análoga ao app.py (Marca + Descrição + Classe)
    const textsNorm = produtosValidos.map((prod) => 
      removeAccents(`${prod?.marcaDescr || ''} ${prod?.produtoDescr || ''} ${prod?.produtoClasse || ''}`)
    );

    // Executa a extração usando o token_set_ratio do fuzzball (idêntico ao rapidfuzz do Python)
    // Usamos limite de 30 e cutoff de 40 de similaridade (r[1] >= 40)
    const results = fuzzball.extract(termNorm, textsNorm, {
      scorer: fuzzball.token_set_ratio,
      limit: 30,
      cutoff: 40
    });

    // Retorna os produtos correspondentes ordenados pelo índice retornado, garantindo que não são nulos/indefinidos
    return results
      .map((r) => produtosValidos[r[2]])
      .filter((prod): prod is ProdutoValido => !!(prod && prod.produtoEan && prod.produtoDescr));
  }, [debouncedSearchTerm, produtosValidos]);

  // 2. Lógica para Adicionar Produto na Watchlist (Radar)
  const toggleWatchlist = (product: ProdutoValido) => {
    const index = watchlist.findIndex((p) => p.produtoEan === product.produtoEan);
    let newList = [...watchlist];
    if (index >= 0) {
      newList.splice(index, 1);
      showToast(language === 'pt' ? 'Produto removido do Radar' : 'Producto eliminado del Radar', 'info');
    } else {
      newList.push({ ...product, localizado: false });
      showToast(language === 'pt' ? 'Produto adicionado ao Radar!' : '¡Producto agregado al Radar!', 'success');
    }
    saveWatchlist(newList);
  };

  const handleAddManualEan = (e: React.FormEvent) => {
    e.preventDefault();
    const text = novoEanProcurado.trim();
    if (!text) return;

    // Aplica a validação de Regex do Registrar Entrada
    const dados = extrairDados(text);
    
    const eanProcurado = dados?.ean || (text.length === 13 ? text : undefined);
    const dunProcurado = dados?.dun || (text.length === 14 ? text : undefined);
    
    if (!dados && text.length !== 13 && text.length !== 14 && text.length !== 8) {
      showToast(language === 'pt' ? 'Código de barras ou Data Matrix inválido.' : 'Código de barras o Data Matrix inválido.', 'error');
      return;
    }

    // Busca o produto correspondente na base
    const product = produtosValidos.find(
      (p) => 
        (dunProcurado && p.produtoDun === dunProcurado) || 
        (eanProcurado && p.produtoEan === eanProcurado) ||
        (p.produtoEan === text || p.produtoDun === text)
    );

    if (!product) {
      showToast(language === 'pt' ? 'Código não cadastrado na base de produtos. Abrindo cadastro...' : 'Código no registrado en la base de productos. Abriendo registro...', 'info');
      setCadastroNaoIdentificado({
        ean: eanProcurado || (text.length !== 14 ? text : ''),
        dun: dunProcurado || (text.length === 14 ? text : ''),
        adicionarWatchlist: true
      });
      return;
    }

    if (watchlist.some((p) => p.produtoEan === product.produtoEan)) {
      showToast(language === 'pt' ? 'Este produto já está cadastrado na lista de procurados.' : 'Este producto ya está registrado en la lista de buscados.', 'info');
      return;
    }

    const newList = [...watchlist, { ...product, localizado: false }];
    saveWatchlist(newList);
    setNovoEanProcurado('');
    setShowAddManual(false);
    showToast(language === 'pt' ? 'Produto adicionado ao Radar!' : '¡Producto agregado al Radar!', 'success');
  };

  // 3. Lógica para Leitura Rápida (Scanner)
  const handleDetectedScan = (text: string) => {
    const dados = extrairDados(text);
    if (!dados) {
      showToast(language === 'pt' ? 'Código inválido. Tente novamente.' : 'Código inválido. Inténtelo de nuevo.', 'error');
      return;
    }

    const { ean, dun, validade } = dados;
    const foundProduct = obterProdutoPorCodigo(ean, dun, produtosValidos);

    if (!foundProduct) {
      showToast(language === 'pt' ? `Código ${dun || ean} não identificado no cadastro. Abrindo cadastro...` : `Código ${dun || ean} no identificado. Abriendo registro...`, 'info');
      setCadastroNaoIdentificado({
        ean: ean || '',
        dun: dun || ''
      });
      return;
    }

    // Verifica se produto escaneado está na watchlist e ainda não foi localizado
    const isMatched = watchlist.some((w) => w.produtoEan === foundProduct.produtoEan && !w.localizado);
    
    setIsWatchlistMatch(isMatched);
    if (isMatched) {
      // Dispara confetes e celebração no modal
      setIsMatchCelebration(true);
      showToast(language === 'pt' ? '⚡ Radar Match! Produto procurado detectado!' : '⚡ ¡Radar Match! ¡Producto buscado detectado!', 'success');
      
      // Auto marca como localizado se escaneado
      const index = watchlist.findIndex((p) => p.produtoEan === foundProduct.produtoEan);
      if (index >= 0 && !watchlist[index].localizado) {
        const newList = [...watchlist];
        newList[index] = { ...newList[index], localizado: true };
        saveWatchlist(newList);
      }
    } else {
      setIsMatchCelebration(false);
    }

    setSelectedProduct(foundProduct);
    setSelectedProductValidade(validade || null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Abas Internas */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm max-w-md mx-auto">
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
          {language === 'pt' ? 'Scanner & Radar' : 'Lector & Radar'}
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
          {language === 'pt' ? 'Busca por Texto' : 'Búsqueda por Texto'}
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
                  {language === 'pt' ? 'Leitura Rápida e Consulta de EAN/DUN' : 'Lectura Rápida y Consulta de EAN/DUN'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'pt' ? 'Escaneie um código para ver detalhes do produto imediatamente, sem cadastrar validade.' : 'Escanee un código para ver los detalles del producto de inmediato, sin registrar vencimiento.'}
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
                  🎯 {language === 'pt' ? 'Lista de Procurados' : 'Lista de Buscados'}
                </h3>
                <button
                  onClick={() => setShowAddManual(!showAddManual)}
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  {showAddManual ? 'Cancelar' : (language === 'pt' ? 'Adicionar EAN' : 'Agregar EAN')}
                </button>
              </div>

              {/* Form Manual de Adicionar EAN */}
              {showAddManual && (
                <form onSubmit={handleAddManualEan} className="mb-4 space-y-2 animate-slideDown">
                  <input
                    type="text"
                    placeholder={language === 'pt' ? 'Digite o EAN ou DUN...' : 'Ingrese el EAN o DUN...'}
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
                    {language === 'pt' 
                      ? 'Nenhum produto monitorado no radar. Adicione produtos na busca por texto para acompanhar.' 
                      : 'Ningún producto monitoreado en el radar. Agregue productos en la búsqueda de texto para realizar el seguimiento.'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                  {watchlist.map((prod) => (
                    <div
                      key={prod.produtoEan}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        prod.localizado
                          ? 'bg-slate-100/50 dark:bg-slate-900/20 border-slate-200/30 dark:border-slate-800/30 opacity-75'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      {/* Checkbox para toggle manual de localizado */}
                      <button
                        onClick={() => toggleLocalizado(prod.produtoEan)}
                        className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center flex-shrink-0 mr-2 ${
                          prod.localizado
                            ? 'bg-success-100 border-success-200 text-success-600 dark:bg-success-900/30 dark:border-success-800 dark:text-success-400 hover:bg-success-200'
                            : 'bg-white border-slate-200 text-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-500'
                        }`}
                        title={prod.localizado ? (language === 'pt' ? "Marcar como não localizado" : "Marcar como no localizado") : (language === 'pt' ? "Marcar como localizado" : "Marcar como localizado")}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          setIsWatchlistMatch(true);
                          setIsMatchCelebration(false);
                          setSelectedProduct(prod);
                        }}
                        className="flex-1 text-left min-w-0 pr-2 group"
                      >
                        <p className={`text-xs font-bold transition-colors truncate ${
                          prod.localizado
                            ? 'line-through text-slate-400 dark:text-slate-500 font-normal'
                            : 'text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400'
                        }`}>
                          {prod.produtoDescr}
                        </p>
                        <p className={`text-[10px] truncate ${
                          prod.localizado ? 'text-slate-400 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {prod.marcaDescr} · {prod.produtoEan}
                        </p>
                      </button>
                      <button
                        onClick={() => toggleWatchlist(prod)}
                        className="p-1.5 rounded bg-slate-200/60 hover:bg-danger-100 dark:bg-slate-800/50 text-slate-500 hover:text-danger-600 dark:hover:text-danger-400 transition-colors flex items-center justify-center flex-shrink-0"
                        title={language === 'pt' ? "Remover do Radar" : "Eliminar del Radar"}
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
              placeholder={language === 'pt' ? "Pesquise por marca, produto, EAN ou DUN (ex: sobrecoxa bandeja sadia)..." : "Busque por marca, producto, EAN o DUN (ej: sobrecoxa bandeja sadia)..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="input-field pl-11"
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Listagem de Resultados */}
          {searchTerm.trim().length < 2 ? (
            <div className="text-center py-12 px-4 text-slate-400 dark:text-slate-500">
              <svg className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15" />
              </svg>
              <p className="text-sm font-medium">
                {language === 'pt' ? 'Digite pelo menos 2 caracteres para pesquisar' : 'Ingrese al menos 2 caracteres para buscar'}
              </p>
              <p className="text-xs mt-1 text-slate-500">
                {language === 'pt' ? 'A pesquisa filtra instantaneamente na base de dados de produtos válidos.' : 'La búsqueda filtra instantáneamente en la base de datos de productos válidos.'}
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 dark:text-slate-500">
              <p className="text-sm font-medium">
                {language === 'pt' ? 'Nenhum produto correspondente encontrado.' : 'Ningún producto correspondiente encontrado.'}
              </p>
              <p className="text-xs mt-1 text-slate-500">
                {language === 'pt' ? 'Verifique a grafia dos termos ou tente buscar por códigos de barras.' : 'Verifique la ortografía de los términos o intente buscar por códigos de barras.'}
              </p>
            </div>
          ) : (
            <div ref={searchResultsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredProducts.map((prod) => (
                <button
                  key={`${prod.produtoEan}-${prod.produtoDun || ''}-${prod.marcaId}-${prod.produtoDescr}`}
                  onClick={() => {
                    setIsWatchlistMatch(watchlist.some((w) => w.produtoEan === prod.produtoEan));
                    setIsMatchCelebration(false);
                    
                    const dadosExtraidos = extrairDados(debouncedSearchTerm.trim());
                    let matchesProduct = false;
                    if (dadosExtraidos) {
                      const derivedProd = obterProdutoPorCodigo(dadosExtraidos.ean, dadosExtraidos.dun, produtosValidos);
                      matchesProduct = derivedProd ? (derivedProd.produtoEan === prod.produtoEan) : false;
                    }
                    if (dadosExtraidos && dadosExtraidos.validade && matchesProduct) {
                      setSelectedProductValidade(dadosExtraidos.validade);
                    } else {
                      setSelectedProductValidade(null);
                    }
                    
                    setSelectedProduct(prod);
                  }}
                  className="group card p-4 hover:border-primary-500/50 hover:scale-[1.01] hover:shadow-card-hover transition-[border-color,transform,box-shadow] duration-200 text-left flex flex-col justify-between"
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
                      {language === 'pt' ? 'Detalhes' : 'Detalles'}
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
        <DetalheProdutoModal
          key={selectedProduct.produtoEan}
          produto={selectedProduct}
          validade={selectedProductValidade}
          isMatchCelebration={isMatchCelebration}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          onClose={() => {
            setSelectedProduct(null);
            setIsMatchCelebration(false);
          }}
          onVincularDun={(prod) => {
            setSelectedProduct(null);
            setIsMatchCelebration(false);
            setCadastroNaoIdentificado({
              ean: prod.produtoEan,
              dun: '',
              produtoParaVincular: prod
            });
          }}
        />
      )}

      {/* Modal de cadastro de produto não identificado */}
      {mounted && cadastroNaoIdentificado && createPortal(
        <CadastroProdutoModal
          initialEan={cadastroNaoIdentificado.ean}
          initialDun={cadastroNaoIdentificado.dun}
          initialProdutoParaVincular={cadastroNaoIdentificado.produtoParaVincular}
          produtosValidos={produtosValidos}
          onClose={() => setCadastroNaoIdentificado(null)}
          onSuccess={handleCadastroProdutoSuccess}
        />,
        document.body
      )}

      {/* Toast flutuante para feedback */}
      {toast && (
        <div className="fixed inset-x-0 top-6 z-[110] flex justify-center items-center px-4 pointer-events-none">
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
