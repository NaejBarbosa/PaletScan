import { useState, useEffect } from 'react';
import Scanner from '../components/Scanner';
import DataValidadeInput from '../components/DataValidadeInput';
import CadastroProdutoModal from '../components/CadastroProdutoModal';
import VagaSelector from '../components/VagaSelector';
import { extrairDados } from '../lib/regex';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

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

function HomeContent() {
  const { theme, toggleTheme } = useTheme();

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

  const handleCadastroProdutoSuccess = (novoProduto: ProdutoValido) => {
    setProdutosValidos((prev) => [...prev, novoProduto]);
    const ean = novoProduto.produtoEan;
    const dun = novoProduto.produtoDun;
    const validadeTemp = cadastroNaoIdentificado?.validadeTemp || '';
    setCadastroNaoIdentificado(null);
    showToast('Produto cadastrado com sucesso!', 'success');

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
    let produtoEncontrado: ProdutoValido | undefined = undefined;

    // 1) Se temos DUN (do código), busca o produto pelo DUN
    if (dun) {
      produtoEncontrado = safeBase.find((p) => p.produtoDun === dun);
      if (!produtoEncontrado) {
        showToast(`DUN ${dun} não identificado na base. Abrindo cadastro...`, 'info');
        // Como o EAN não é auto-derivado, eanInicial será '' (vazio) para permitir escanear/digitar
        const eanInicial = ean || '';
        setCadastroNaoIdentificado({ ean: eanInicial, dun, validadeTemp: validade || '' });
        return;
      }
      // ✅ Usa o EAN cadastrado na base
      ean = produtoEncontrado.produtoEan;
    }
    // 2) Senão, busca pelo EAN (caso o código seja só EAN)
    else if (ean) {
      produtoEncontrado = safeBase.find((p) => p.produtoEan === ean);
      if (!produtoEncontrado) {
        showToast(`EAN ${ean} não identificado na base. Abrindo cadastro...`, 'info');
        setCadastroNaoIdentificado({ ean, dun: dun || '', validadeTemp: validade || '' });
        return;
      }
      // ✅ Busca o DUN correspondente na base (se existir)
      if (produtoEncontrado.produtoDun) {
        dun = produtoEncontrado.produtoDun;
      }
    }
    // 3) Caso não tenha nem DUN nem EAN reconhecido (fallback)
    else {
      showToast('Código não possui DUN ou EAN válido.', 'error');
      return;
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

  const handleQRCode = async (text: string) => {
    showToast('Validando com a base em tempo real...', 'info');
    try {
      const res = await fetch('/api/validar');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProdutosValidos(data);
          processarLeituraComBase(text, data);
          return;
        }
      }
      const baseValida = Array.isArray(produtosValidos) ? produtosValidos : [];
      processarLeituraComBase(text, baseValida);
    } catch (err) {
      console.error('Erro ao atualizar base no escaneamento:', err);
      const baseValida = Array.isArray(produtosValidos) ? produtosValidos : [];
      processarLeituraComBase(text, baseValida);
    }
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

  // ===== Tela de seleção de câmara/vaga =====
  if (!sessaoAtiva) {
    return <VagaSelector onConfirm={iniciarSessao} />;
  }
  // ============================================

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Controle de Recebimento
                </h1>
                {/* Badge câmara/vaga da sessão */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {sessaoAtiva.camara} · {sessaoAtiva.vaga}
                  </span>
                  <button
                    id="btn-redefinir-sessao"
                    onClick={redefinirSessao}
                    title="Redefinir câmara/vaga"
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-danger-500 dark:hover:text-danger-400 transition-colors underline underline-offset-2"
                  >
                    redefinir
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 animate-slideUp" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Produtos Adicionados
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {itensRegistrados.length} item(ns) aguardando gravação
                  </p>
                </div>
              </div>
              <button onClick={gravarTodosNoBanco} disabled={isSubmitting} className="btn-success">
                {isSubmitting ? 'Gravando...' : 'Gravar Todos'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-auto border-separate border-spacing-0">
                <thead className="bg-slate-100 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Marca</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Classe</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Conservação</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Validade</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Ações</th>
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
      </main>

      {/* Modal de confirmação com backdrop corrigido e conservação */}
      {confirmacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="card-elevated max-w-md w-full p-6 animate-scale-in m-4">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-500 to-success-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Produto Detectado</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Confirme os dados antes de adicionar</p>
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 mb-5 space-y-3">
              {confirmacao.dun && (
                <div className="flex justify-between items-start gap-4 text-sm">
                  <span className="font-medium text-slate-500 dark:text-slate-400">DUN</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 text-right break-all">{confirmacao.dun}</span>
                </div>
              )}
              <div className="flex justify-between items-start gap-4 text-sm">
                <span className="font-medium text-slate-500 dark:text-slate-400">EAN</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 text-right break-all">{confirmacao.ean}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-slate-500 dark:text-slate-400">Validade</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{confirmacao.validade}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3 space-y-2">
                <div className="flex justify-between items-start gap-4 text-sm">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Marca</span>
                  <span className="text-slate-900 dark:text-slate-100 text-right">{confirmacao.produto.marcaDescr}</span>
                </div>
                <div className="flex justify-between items-start gap-4 text-sm">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Produto</span>
                  <span className="text-slate-900 dark:text-slate-100 text-right">{confirmacao.produto.produtoDescr}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Classe</span>
                  <span className="badge badge-primary">{confirmacao.produto.produtoClasse}</span>
                </div>
                {/* Conservação */}
                {confirmacao.produto.produtoConservacao && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Conservação</span>
                    <span className={`badge ${
                      confirmacao.produto.produtoConservacao.toLowerCase().includes('congelado') 
                        ? 'badge-primary' 
                        : 'badge-warning'
                    }`}>
                      {confirmacao.produto.produtoConservacao}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={handleAdicionarLista} className="btn-success w-full">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Adicionar a Lista
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleNovaLeitura} className="btn-secondary">
                  Nova Leitura
                </button>
                <button onClick={handleDescartar} className="btn-danger">
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal DataValidadeInput com backdrop corrigido */}
      {modoValidadeManual && currentScan && (
        <DataValidadeInput
          ean={currentScan.ean}
          onConfirm={handleValidadeConfirm}
          onCancel={handleValidadeCancel}
        />
      )}

      {/* Modal de cadastro de produto não identificado */}
      {cadastroNaoIdentificado && (
        <CadastroProdutoModal
          initialEan={cadastroNaoIdentificado.ean}
          initialDun={cadastroNaoIdentificado.dun}
          produtosValidos={produtosValidos}
          onClose={() => setCadastroNaoIdentificado(null)}
          onSuccess={handleCadastroProdutoSuccess}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center items-center px-4 pointer-events-none">
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
      <HomeContent />
    </ThemeProvider>
  );
}