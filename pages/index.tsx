import { useState, useEffect } from 'react';
import Scanner from '../components/Scanner';
import AutocompleteManual from '../components/AutocompleteManual';
import DataValidadeInput from '../components/DataValidadeInput';
import { extrairDados } from '../lib/regex';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

interface ProdutoValido {
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoEan: string;
  produtoDescr: string;
}

interface ItemRegistrado {
  id: string;
  ean: string;
  validade: string;
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoDescr: string;
  dataRegistro: Date;
}

function HomeContent() {
  const { theme, toggleTheme } = useTheme();
  const [produtosValidos, setProdutosValidos] = useState<ProdutoValido[]>([]);
  const [scannedEans, setScannedEans] = useState<Set<string>>(new Set());
  const [currentScan, setCurrentScan] = useState<{ ean: string; validade: string } | null>(null);
  const [modoManual, setModoManual] = useState(false);
  const [modoValidadeManual, setModoValidadeManual] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{
    ean: string;
    validade: string;
    produto?: ProdutoValido;
  } | null>(null);
  const [itensRegistrados, setItensRegistrados] = useState<ItemRegistrado[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/validar')
      .then((res) => res.json())
      .then((data) => setProdutosValidos(data))
      .catch((err) => console.error('Erro ao carregar base', err));
  }, []);

  const showToast = (message: string, type: 'info' | 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const adicionarItemNaLista = (produto: ProdutoValido, ean: string, validade: string) => {
    const novoItem: ItemRegistrado = {
      id: `${Date.now()}-${ean}-${Math.random()}`,
      ean,
      validade,
      marcaId: produto.marcaId,
      marcaDescr: produto.marcaDescr,
      produtoClasse: produto.produtoClasse,
      produtoDescr: produto.produtoDescr,
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

    setIsSubmitting(false);

    if (sucesso) {
      showToast(`${itensRegistrados.length} produto(s) gravado(s) com sucesso!`, 'success');
      setItensRegistrados([]);
      setScannedEans(new Set());
    } else {
      showToast('Erro ao gravar um ou mais produtos. Tente novamente.', 'error');
    }
  };

  const removerItemDaLista = (id: string) => {
    setItensRegistrados((prev) => prev.filter((item) => item.id !== id));
  };

  const handleQRCode = (text: string) => {
    const dados = extrairDados(text);
    if (!dados) {
      showToast('Formato inválido. Escaneie um Data Matrix, QRCode ou código de barras válido.', 'error');
      return;
    }
    const { ean, validade, tipo } = dados;
    if (scannedEans.has(ean)) {
      showToast('Este código já foi adicionado à lista nesta sessão.', 'error');
      return;
    }
    // Se o tipo é apenas EAN (sem validade), abre o modal de validade manual
    if (tipo === 'ean') {
      setCurrentScan({ ean, validade: '' });
      setModoValidadeManual(true);
      return;
    }
    const produtoEncontrado = produtosValidos.find((p) => p.produtoEan === ean);
    setConfirmacao({ ean, validade: validade!, produto: produtoEncontrado });
  };

  const handleAdicionarLista = () => {
    if (!confirmacao) return;
    const { ean, validade, produto } = confirmacao;
    if (!produto) {
      setCurrentScan({ ean, validade });
      setModoManual(true);
      setConfirmacao(null);
      return;
    }
    adicionarItemNaLista(produto, ean, validade);
    setConfirmacao(null);
  };

  const handleNovaLeitura = () => setConfirmacao(null);
  const handleDescartar = () => setConfirmacao(null);

  const handleManualSubmit = (produto: ProdutoValido, validadeFinal: string) => {
    if (!currentScan) return;
    adicionarItemNaLista(produto, currentScan.ean, validadeFinal);
    setModoManual(false);
    setCurrentScan(null);
  };

  const handleValidadeConfirm = (validade: string) => {
    if (!currentScan) return;
    const produtoEncontrado = produtosValidos.find((p) => p.produtoEan === currentScan.ean);
    if (produtoEncontrado) {
      setConfirmacao({ ean: currentScan.ean, validade, produto: produtoEncontrado });
    } else {
      setModoManual(true);
      setCurrentScan({ ean: currentScan.ean, validade });
    }
    setModoValidadeManual(false);
  };

  const handleValidadeCancel = () => {
    setModoValidadeManual(false);
    setCurrentScan(null);
  };

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
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Escaneamento de Codigo de Barras / QRCode / Data Matrix
                </p>
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
              Escaneador de Codigo
            </h2>
          </div>
          <Scanner onDetected={handleQRCode} />
        </div>

        {/* Modal de confirmação */}
        {confirmacao && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card-elevated max-w-md w-full p-6 animate-scale-in">
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
                <div className="flex justify-between items-start gap-4 text-sm">
                  <span className="font-medium text-slate-500 dark:text-slate-400">EAN</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 text-right break-all">{confirmacao.ean}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Validade</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{confirmacao.validade}</span>
                </div>
                {confirmacao.produto ? (
                  <>
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
                    </div>
                  </>
                ) : (
                  <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-3 mt-3">
                    <p className="text-sm text-warning-800 dark:text-warning-200 font-medium">Produto nao encontrado na base. Sera necessario cadastro manual.</p>
                  </div>
                )}
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Nova Leitura
                  </button>
                  <button onClick={handleDescartar} className="btn-danger">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inserir validade manualmente */}
        {modoValidadeManual && currentScan && (
          <DataValidadeInput
            ean={currentScan.ean}
            onConfirm={handleValidadeConfirm}
            onCancel={handleValidadeCancel}
          />
        )}

        {/* Cadastro manual */}
        {modoManual && currentScan && (
          <div className="card border-warning-200 dark:border-warning-800 animate-slideUp">
            <div className="p-4 bg-warning-50 dark:bg-warning-900/20 border-b border-warning-200 dark:border-warning-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/40 flex items-center justify-center">
                  <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-warning-800 dark:text-warning-200">Produto Nao Encontrado</h2>
                  <p className="text-sm text-warning-600 dark:text-warning-400">Selecione manualmente na lista abaixo</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">EAN Lido</span>
                  <p className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 break-all">{currentScan.ean}</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Validade Informada</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{currentScan.validade}</p>
                </div>
              </div>
              <AutocompleteManual
                produtosValidos={produtosValidos}
                onSelect={handleManualSubmit}
                validadeAtual={currentScan.validade}
              />
            </div>
          </div>
        )}

        {/* Lista de produtos pendentes */}
        {itensRegistrados.length > 0 && (
          <div className="card-elevated overflow-hidden animate-slideUp" style={{ animationDelay: '200ms' }}>
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
                    {itensRegistrados.length} item(ns) aguardando gravacao
                  </p>
                </div>
              </div>
              <button
                onClick={gravarTodosNoBanco}
                disabled={isSubmitting}
                className="btn-success"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Gravando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Gravar Todos
                  </>
                )}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-100 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">EAN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Marca</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Validade</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {itensRegistrados.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors animate-slideUp"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-slate-900 dark:text-slate-100">{item.ean}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{item.marcaDescr}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{item.produtoDescr}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge badge-success text-xs">{item.validade}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removerItemDaLista(item.id)}
                          className="p-2 rounded-lg text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
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

            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Itens armazenados localmente. Clique em "Gravar Todos" para salvar permanentemente no sistema.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center items-center px-4 pointer-events-none animate-slideUp">
          <div className={`pointer-events-auto inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-elevated max-w-full ${
            toast.type === 'success' ? 'bg-success-600 text-white' :
            toast.type === 'error' ? 'bg-danger-600 text-white' :
            'bg-primary-600 text-white'
          }`}>
            {toast.type === 'success' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span className="font-medium text-sm whitespace-nowrap">{toast.message}</span>
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
