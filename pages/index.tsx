import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import Scanner from '../components/Scanner';
import DataValidadeInput from '../components/DataValidadeInput';
import CadastroProdutoModal from '../components/CadastroProdutoModal';
import VagaSelector from '../components/VagaSelector';
import Relatorio from '../components/Relatorio';
import MenuPrincipal from '../components/MenuPrincipal';
import PesquisaProduto, { WatchlistItem } from '../components/PesquisaProduto';
import { extrairDados } from '../lib/regex';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import ProdutoAvatar from '../components/ProdutoAvatar';

interface ProdutoValido {
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoEan: string;
  produtoDun: string;
  produtoConservacao: string;
  produtoDescr: string;
}

interface ItemRegistrado {
  id: string;
  ean: string;
  dun: string;
  validade: string;
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoDescr: string;
  produtoConservacao: string;
  dataRegistro: Date;
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

function HomeContent() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'menu' | 'scan' | 'relatorio' | 'pesquisa'>('menu');
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ===== SESSÃO: câmara e vaga =====
  const [sessaoAtiva, setSessaoAtiva] = useState<{ camara: string; vaga: string } | null>(null);

  const iniciarSessao = (camara: string, vaga: string) => {
    setSessaoAtiva({ camara, vaga });
  };

  const redefinirSessao = () => {
    setSessaoAtiva(null);
    setItensRegistrados([]);
    setScannedEans(new Set());
    setConfirmacao(null);
    setCurrentScan(null);
    setPendingProduct(null);
    setModoValidadeManual(false);
    setCadastroNaoIdentificado(null);
  };
  // ==================================

  const [produtosValidos, setProdutosValidos] = useState<ProdutoValido[]>([]);
  const [scannedEans, setScannedEans] = useState<Set<string>>(new Set());
  const [currentScan, setCurrentScan] = useState<{ ean: string; dun: string; validade: string } | null>(null);
  const [pendingProduct, setPendingProduct] = useState<ProdutoValido | null>(null);
  const [modoValidadeManual, setModoValidadeManual] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{
    ean: string;
    dun: string;
    validade: string;
    produto: ProdutoValido;
  } | null>(null);
  const [isWatchlistMatch, setIsWatchlistMatch] = useState(false);
  const [itensRegistrados, setItensRegistrados] = useState<ItemRegistrado[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cadastroNaoIdentificado, setCadastroNaoIdentificado] = useState<{ ean: string; dun: string; validadeTemp?: string } | null>(null);
  const [isRefreshingBase, setIsRefreshingBase] = useState(false);

  const recarregarBase = () => {
    setIsRefreshingBase(true);
    fetch('/api/validar')
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao buscar banco_valida');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setProdutosValidos(data);
        } else {
          console.error('Dados de validar inválidos (não é array):', data);
        }
      })
      .catch((err) => console.error('Erro ao carregar base', err))
      .finally(() => setIsRefreshingBase(false));
  };

  useEffect(() => {
    recarregarBase();
  }, []);

  const checkPendingWatchlist = (ean: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('radar_watchlist');
      if (saved) {
        const parsed: WatchlistItem[] = JSON.parse(saved);
        return parsed.some((p) => p.produtoEan === ean && !p.localizado);
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      zIndex: 9999,
    });

    const duration = 2 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3 + 0.1, y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.3 + 0.6, y: Math.random() - 0.2 } });
    }, 200);
  };

  useEffect(() => {
    if (confirmacao) {
      const isMatch = checkPendingWatchlist(confirmacao.ean);
      setIsWatchlistMatch(isMatch);
      if (isMatch) {
        triggerConfetti();
        // Marca como localizado no localStorage do Radar
        try {
          const saved = localStorage.getItem('radar_watchlist');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const newList = parsed.map((item: any) => {
                if (item.produtoEan === confirmacao.ean) {
                  return { ...item, localizado: true };
                }
                return item;
              });
              localStorage.setItem('radar_watchlist', JSON.stringify(newList));
            }
          }
        } catch (e) {
          console.error('Erro ao marcar localizado no localStorage', e);
        }
      }
    } else {
      setIsWatchlistMatch(false);
    }
  }, [confirmacao]);

  const showToast = (message: string, type: 'info' | 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const adicionarItemNaLista = (produto: ProdutoValido, ean: string, dun: string, validade: string) => {
    const novoItem: ItemRegistrado = {
      id: `${Date.now()}-${ean}-${Math.random()}`,
      ean,
      dun,
      validade,
      marcaId: produto.marcaId,
      marcaDescr: produto.marcaDescr,
      produtoClasse: produto.produtoClasse,
      produtoDescr: produto.produtoDescr,
      produtoConservacao: produto.produtoConservacao,
      dataRegistro: new Date(),
    };
    setItensRegistrados((prev) => [...prev, novoItem]);
    setScannedEans((prev) => new Set(prev).add(ean));
  };

  const gravarTodosNoBanco = async () => {
    if (itensRegistrados.length === 0) {
      showToast('Nenhum item na lista para gravar.', 'error');
      return;
    }

    if (!sessaoAtiva) {
      showToast('Sessão sem câmara/vaga definida. Redefina a sessão.', 'error');
      return;
    }

    setIsSubmitting(true);
    showToast(`Gravando ${itensRegistrados.length} produto(s)...`, 'info');

    let sucesso = true;
    for (const item of itensRegistrados) {
      const registro = {
        marcaId: item.marcaId,
        marcaDescr: item.marcaDescr,
        produtoClasse: item.produtoClasse,
        produtoEan: item.ean,
        produtoDescr: item.produtoDescr,
        produtoValidade: item.validade,
        camara: sessaoAtiva.camara,
        camaraVaga: sessaoAtiva.vaga,
      };
      try {
        const res = await fetch('/api/cadastrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registro),
        });
        if (!res.ok) sucesso = false;
      } catch (error) {
        sucesso = false;
      }
    }

    if (sucesso) {
      showToast(`${itensRegistrados.length} produto(s) gravado(s) com sucesso!`, 'success');
      setTimeout(() => {
        redefinirSessao();
        setIsSubmitting(false);
      }, 3000);
    } else {
      setIsSubmitting(false);
      showToast('Erro ao gravar um ou mais produtos. Tente novamente.', 'error');
    }
  };

  const removerItemDaLista = (id: string) => {
    setItensRegistrados((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCadastroProdutoSuccess = (novoProduto: ProdutoValido, foiVinculado?: boolean) => {
    setProdutosValidos((prev) => [...prev, novoProduto]);
    const ean = novoProduto.produtoEan;
    const dun = novoProduto.produtoDun;
    const validadeTemp = cadastroNaoIdentificado?.validadeTemp || '';
    setCadastroNaoIdentificado(null);
    showToast(foiVinculado ? 'Produto vinculado com sucesso!' : 'Produto cadastrado com sucesso!', 'success');



    if (validadeTemp) {
      setConfirmacao({
        ean,
        dun,
        validade: validadeTemp,
        produto: novoProduto,
      });
    } else {
      setCurrentScan({ ean, dun, validade: '' });
      setPendingProduct(novoProduto);
      setModoValidadeManual(true);
    }
  };

  const processarLeituraComBase = (text: string, baseProdutos: ProdutoValido[]) => {
    const safeBase = Array.isArray(baseProdutos) ? baseProdutos : [];
    const dados = extrairDados(text);
    if (!dados) {
      showToast('Formato inválido. Escaneie um Data Matrix, QRCode ou código de barras válido.', 'error');
      return;
    }
    let { ean, dun, validade, tipo } = dados;

    // ========== CORREÇÃO: Sempre usar os dados da base quando disponíveis ==========
    const produtoEncontrado = obterProdutoPorCodigo(ean, dun, safeBase);

    if (!produtoEncontrado) {
      showToast(`Código ${dun || ean} não identificado na base. Abrindo cadastro...`, 'info');
      setCadastroNaoIdentificado({
        ean: ean || '',
        dun: dun || '',
        validadeTemp: validade || ''
      });
      return;
    }

    // ✅ Resolve o EAN e o DUN a partir da base e do código
    ean = produtoEncontrado.produtoEan;
    if (produtoEncontrado.produtoDun) {
      dun = produtoEncontrado.produtoDun;
    }
    // ========== FIM DA CORREÇÃO ==========

    // Valida duplicidade usando o EAN resolvido (seja pelo scan ou pela base)
    if (ean && scannedEans.has(ean)) {
      showToast('Este código já foi adicionado à lista nesta sessão.', 'error');
      return;
    }

    // Se já veio com validade (ex: QRCode com data), mostra confirmação direta
    if (validade) {
      setConfirmacao({ ean, dun: dun || '', validade, produto: produtoEncontrado });
    } else {
      // Aguarda digitar a validade (caso não tenha vindo no código)
      setCurrentScan({ ean, dun: dun || '', validade: '' });
      setPendingProduct(produtoEncontrado);
      setModoValidadeManual(true);
    }
  };

  const handleQRCode = (text: string) => {
    const baseValida = Array.isArray(produtosValidos) ? produtosValidos : [];
    processarLeituraComBase(text, baseValida);
  };

  const handleValidadeConfirm = (validade: string) => {
    if (!currentScan || !pendingProduct) return;
    setConfirmacao({
      ean: currentScan.ean,
      dun: currentScan.dun || pendingProduct.produtoDun,
      validade,
      produto: pendingProduct,
    });
    setModoValidadeManual(false);
    setCurrentScan(null);
    setPendingProduct(null);
  };

  const handleValidadeCancel = () => {
    setModoValidadeManual(false);
    setCurrentScan(null);
    setPendingProduct(null);
  };

  const handleAdicionarLista = () => {
    if (!confirmacao) return;
    const { ean, dun, validade, produto } = confirmacao;

    // Validação de Compatibilidade de Conservação
    if (sessaoAtiva) {
      const camara = sessaoAtiva.camara.toLowerCase();
      const conservacao = (produto.produtoConservacao || '').toLowerCase();

      const isCamaraCongelado = camara.includes('congelado');
      const isCamaraResfriado = camara.includes('resfriado');

      const isProdCongelado = conservacao.includes('congelado');
      const isProdResfriado = conservacao.includes('resfriado');

      if (isCamaraCongelado && !isProdCongelado) {
        showToast(`Produto com conservação "${produto.produtoConservacao || 'Não definida'}" é incompatível com a câmara "${sessaoAtiva.camara}".`, 'error');
        return;
      }
      if (isCamaraResfriado && !isProdResfriado) {
        showToast(`Produto com conservação "${produto.produtoConservacao || 'Não definida'}" é incompatível com a câmara "${sessaoAtiva.camara}".`, 'error');
        return;
      }
    }

    adicionarItemNaLista(produto, ean, dun, validade);
    setConfirmacao(null);
  };

  const handleNovaLeitura = () => setConfirmacao(null);
  const handleDescartar = () => setConfirmacao(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Botão de voltar quando não estiver no menu inicial */}
              {activeTab !== 'menu' && (
                <button
                  onClick={() => setActiveTab('menu')}
                  className="p-2 mr-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 transition-all flex items-center justify-center shadow-sm"
                  title="Voltar ao Painel Inicial"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              )}

              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-md animate-pulse-subtle">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <path d="M6 10.5l6-3.5 6 3.5-6 3.5-6-3.5z" />
                  <path d="M6 14.5l6-3.5 6 3.5-6 3.5-6-3.5z" />
                  <path d="M6 10.5v4l6 3.5v-4M12 14v4l6-3.5v-4" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-none tracking-tight">
                    Palet<span className="text-primary-600 dark:text-primary-500">Scan</span>
                  </h1>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-wider uppercase">
                    v1.2
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide uppercase">
                    Recebimento
                  </span>
                  {sessaoAtiva && activeTab === 'scan' && (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">
                        {sessaoAtiva.camara} · {sessaoAtiva.vaga}
                      </span>
                      <button
                        id="btn-redefinir-sessao"
                        onClick={redefinirSessao}
                        title="Redefinir câmara/vaga"
                        className="text-[9px] text-slate-400 dark:text-slate-500 hover:text-danger-500 dark:hover:text-danger-400 transition-colors underline font-medium"
                      >
                        (trocar)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Apenas botão de tema no Header (Navegação principal movida para o Painel Inicial) */}
            <div className="flex items-center gap-3">
              {/* Seletor de Idioma PT / ES */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200/50 dark:border-slate-700/50 shadow-sm text-xs font-semibold">
                <button
                  onClick={() => setLanguage('pt')}
                  className={`px-2 py-1 rounded-lg transition-all active:scale-95 text-[10px] sm:text-xs ${
                    language === 'pt'
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title="Português"
                >
                  PT
                </button>
                <button
                  onClick={() => setLanguage('es')}
                  className={`px-2 py-1 rounded-lg transition-all active:scale-95 text-[10px] sm:text-xs ${
                    language === 'es'
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title="Español"
                >
                  ES
                </button>
              </div>

              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700/50 transition-colors shadow-sm"
                aria-label="Alternar tema"
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'menu' ? (
          <MenuPrincipal
            onSelectScan={() => setActiveTab('scan')}
            onSelectRelatorio={() => setActiveTab('relatorio')}
            onSelectPesquisa={() => setActiveTab('pesquisa')}
          />
        ) : activeTab === 'relatorio' ? (
          <Relatorio />
        ) : activeTab === 'pesquisa' ? (
          <PesquisaProduto 
            produtosValidos={produtosValidos} 
            onProdutoCadastrado={handleCadastroProdutoSuccess}
          />
        ) : !sessaoAtiva ? (
          <VagaSelector onConfirm={iniciarSessao} />
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-4 animate-slideUp" style={{ animationDelay: '0ms' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Produtos na Base</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{produtosValidos.length}</p>
                  </div>
                </div>
              </div>
              <div className="card p-4 animate-slideUp" style={{ animationDelay: '50ms' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-success-600 dark:text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Escaneados</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{scannedEans.size}</p>
                  </div>
                </div>
              </div>
              <div className="card p-4 animate-slideUp" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pendentes</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{itensRegistrados.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Scanner Card */}
            <div className="card-elevated overflow-hidden animate-slideUp" style={{ animationDelay: '150ms' }}>
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Escaneador de Código
                </h2>
              </div>
              <Scanner onDetected={handleQRCode} />
            </div>

            {/* Lista de produtos pendentes com coluna Conservação após Classe */}
            {itensRegistrados.length > 0 && (
              <div className="card-elevated overflow-hidden animate-slideUp">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {language === 'pt' ? 'Produtos Adicionados' : 'Productos Agregados'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {language === 'pt' 
                          ? `${itensRegistrados.length} item(ns) aguardando gravação` 
                          : `${itensRegistrados.length} artículo(s) esperando grabación`
                        }
                      </p>
                    </div>
                  </div>
                  <button onClick={gravarTodosNoBanco} disabled={isSubmitting} className="btn-success">
                    {isSubmitting ? (language === 'pt' ? 'Gravando...' : 'Guardando...') : (language === 'pt' ? 'Gravar Todos' : 'Guardar Todos')}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full table-auto border-separate border-spacing-0">
                    <thead className="bg-slate-100 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('marca')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('produto')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('classe')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('conservacao')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{language === 'pt' ? 'Validade' : 'Vencimiento'}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{language === 'pt' ? 'Ações' : 'Acciones'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {itensRegistrados.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{item.marcaDescr}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{item.produtoDescr}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <span className="badge badge-primary">{item.produtoClasse}</span>
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <span className={`badge ${
                              item.produtoConservacao?.toLowerCase().includes('congelado')
                                ? 'badge-primary'
                                : 'badge-warning'
                            }`}>
                              {item.produtoConservacao || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <span className="badge badge-success">{item.validade}</span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => removerItemDaLista(item.id)}
                              disabled={isSubmitting}
                              className="p-2 rounded-lg text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Remover item"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="w-full py-8 text-center border-t border-slate-200/30 dark:border-slate-800/30 mt-12">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase">
          PaletScan · Recebimento & Câmaras Frias
        </p>
        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium tracking-wide">
          Designed & Developed by <span className="font-bold text-slate-500 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">Jean Barbosa</span>
        </p>
      </footer>

      {/* Modal de confirmação com backdrop corrigido e conservação */}
      {mounted && confirmacao && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className={`card-elevated max-w-md w-full p-6 animate-scale-in m-4 relative overflow-hidden ${
            isWatchlistMatch
              ? 'border-2 border-success-500 shadow-elevated bg-gradient-to-b from-success-50/10 to-transparent dark:from-success-950/10 ring-4 ring-success-500/20'
              : ''
          }`}>
            {/* Decoração Especial de Radar Match */}
            {isWatchlistMatch && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-success-500/10 rounded-bl-full pointer-events-none animate-pulse" />
            )}

            {/* Exibição da Imagem do Produto */}
            <div className="mb-4">
              <ProdutoAvatar ean={confirmacao.ean} descricao={confirmacao.produto.produtoDescr} />
            </div>

            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 mb-5 space-y-3">
              <div className="flex justify-between items-start gap-4 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">{t('produto')}</span>
                <span className="text-slate-900 dark:text-slate-100 text-right font-bold">{confirmacao.produto.produtoDescr}</span>
              </div>
              <div className="flex justify-between items-start gap-4 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">{t('marca')}</span>
                <span className="text-slate-900 dark:text-slate-100 text-right">{confirmacao.produto.marcaDescr}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">{t('classe')}</span>
                <span className="badge badge-primary">{confirmacao.produto.produtoClasse}</span>
              </div>
              {confirmacao.produto.produtoConservacao && (
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-500 dark:text-slate-400">{t('conservacao')}</span>
                  <span className={`badge ${
                    confirmacao.produto.produtoConservacao.toLowerCase().includes('congelado') 
                      ? 'badge-primary' 
                      : 'badge-warning'
                  }`}>
                    {confirmacao.produto.produtoConservacao}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-start gap-4 text-xs border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                <span className="font-medium text-slate-500 dark:text-slate-400">{t('eanConsumidor')}</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 text-right font-semibold">{confirmacao.ean}</span>
              </div>
              <div className="flex justify-between items-start gap-4 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">{t('dunDistribuicao')}</span>
                {confirmacao.dun ? (
                  <span className="font-mono text-slate-900 dark:text-slate-100 text-right font-semibold">{confirmacao.dun}</span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 text-right italic font-normal">{language === 'pt' ? 'Não cadastrado' : 'No registrado'}</span>
                )}
              </div>
              {confirmacao.validade && (
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
                    return checkIsVencido(confirmacao.validade) ? (
                      <div className="relative overflow-visible flex items-center justify-end">
                        <span className="absolute -inset-1 rounded bg-red-500 animate-ping opacity-75" />
                        <span className="relative font-mono text-white bg-red-600 px-2.5 py-1 rounded font-bold border border-red-700 text-xs shadow-md animate-pulse whitespace-nowrap">
                          🚨 {confirmacao.validade} ({language === 'pt' ? 'VENCIDO' : 'VENCIDO'})
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 text-right font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded border border-emerald-100 dark:border-emerald-900/50 text-xs whitespace-nowrap">
                        {confirmacao.validade}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={handleAdicionarLista} className="btn-success w-full">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {language === 'pt' ? 'Adicionar à Lista' : 'Agregar a la Lista'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleNovaLeitura} className="btn-secondary">
                  {language === 'pt' ? 'Nova Leitura' : 'Nueva Lectura'}
                </button>
                <button onClick={handleDescartar} className="btn-danger">
                  {language === 'pt' ? 'Descartar' : 'Descartar'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal DataValidadeInput com backdrop corrigido */}
      {mounted && modoValidadeManual && currentScan && createPortal(
        <DataValidadeInput
          ean={currentScan.ean}
          onConfirm={handleValidadeConfirm}
          onCancel={handleValidadeCancel}
        />,
        document.body
      )}

      {/* Modal de cadastro de produto não identificado */}
      {mounted && cadastroNaoIdentificado && createPortal(
        <CadastroProdutoModal
          initialEan={cadastroNaoIdentificado.ean}
          initialDun={cadastroNaoIdentificado.dun}
          produtosValidos={produtosValidos}
          onClose={() => setCadastroNaoIdentificado(null)}
          onSuccess={handleCadastroProdutoSuccess}
        />,
        document.body
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-[110] flex justify-center items-center px-4 pointer-events-none">
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
            {toast.type === 'info' && (
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span className="font-medium text-sm text-center break-words leading-tight">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <HomeContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}