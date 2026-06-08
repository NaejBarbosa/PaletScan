// pages/index.tsx
import { useState, useEffect } from 'react';
import Scanner from '../components/Scanner';
import AutocompleteManual from '../components/AutocompleteManual';
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
    setTimeout(() => setToast(null), 3000);
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
    showToast(`📤 Gravando ${itensRegistrados.length} produto(s)...`, 'info');

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
      showToast(`✅ ${itensRegistrados.length} produto(s) gravado(s) com sucesso!`, 'success');
      setItensRegistrados([]);
      setScannedEans(new Set());
    } else {
      showToast('❌ Erro ao gravar um ou mais produtos. Tente novamente.', 'error');
    }
  };

  const removerItemDaLista = (id: string) => {
    setItensRegistrados((prev) => prev.filter((item) => item.id !== id));
  };

  const handleQRCode = (text: string) => {
    const dados = extrairDados(text);
    if (!dados) {
      showToast('Formato inválido. Escaneie um Data Matrix válido.', 'error');
      return;
    }
    const { ean, validade } = dados;
    if (scannedEans.has(ean)) {
      showToast('⚠️ Este código já foi adicionado à lista nesta sessão.', 'error');
      return;
    }
    const produtoEncontrado = produtosValidos.find((p) => p.produtoEan === ean);
    setConfirmacao({ ean, validade, produto: produtoEncontrado });
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

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Scanner de Produtos
            </h1>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Leitura de Data Matrix e registro automático
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-all duration-300 backdrop-blur-sm ${
              theme === 'dark' 
                ? 'bg-gray-800/80 text-yellow-400 hover:bg-gray-700/80' 
                : 'bg-white/80 text-gray-700 hover:bg-gray-200/80'
            } shadow-lg`}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Scanner Card */}
        <div className={`rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm border ${
          theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'
        } transition-all duration-300`}>
          <Scanner onDetected={handleQRCode} />
        </div>

        {/* Modal de confirmação */}
        {confirmacao && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className={`rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all duration-300 scale-100 ${
              theme === 'dark' ? 'bg-gray-800/90 border border-gray-700' : 'bg-white/90 border border-gray-200'
            } backdrop-blur-sm`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                  <span className="text-white text-xl">📦</span>
                </div>
                <h2 className="text-2xl font-bold">Produto detectado</h2>
              </div>
              <div className={`mb-6 rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100/80'}`}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-semibold">EAN:</span>
                  <span className="font-mono">{confirmacao.ean}</span>
                  <span className="font-semibold">Validade:</span>
                  <span>{confirmacao.validade}</span>
                </div>
                {confirmacao.produto ? (
                  <div className="mt-3 pt-3 border-t border-gray-500/30">
                    <p><span className="font-semibold">Marca:</span> {confirmacao.produto.marcaDescr}</p>
                    <p className="mt-1"><span className="font-semibold">Produto:</span> {confirmacao.produto.produtoDescr}</p>
                    <p className="mt-1"><span className="font-semibold">Classe:</span> {confirmacao.produto.produtoClasse}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-red-400 font-semibold text-sm">⚠️ Produto não encontrado na base. Cadastro manual necessário.</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={handleAdicionarLista} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2">
                  ➕ Adicionar
                </button>
                <button onClick={handleNovaLeitura} className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl transition-all duration-200">
                  📷 Nova leitura
                </button>
                <button onClick={handleDescartar} className="w-full bg-gray-500/80 hover:bg-gray-600/80 text-white font-semibold py-3 rounded-xl transition-all duration-200">
                  ❌ Descartar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cadastro manual */}
        {modoManual && currentScan && (
          <div className={`mt-8 rounded-2xl shadow-xl p-6 border ${
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'
          } backdrop-blur-sm transition-all duration-300`}>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <span className="text-amber-400">⚠️</span> Produto não encontrado na base
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                <span className="text-xs uppercase tracking-wide opacity-70">EAN lido</span>
                <p className="font-mono text-lg font-bold">{currentScan.ean}</p>
              </div>
              <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                <span className="text-xs uppercase tracking-wide opacity-70">Validade calculada</span>
                <p className="text-lg font-bold">{currentScan.validade}</p>
              </div>
            </div>
            <AutocompleteManual
              produtosValidos={produtosValidos}
              onSelect={handleManualSubmit}
              validadeAtual={currentScan.validade}
            />
          </div>
        )}

        {/* Lista de produtos pendentes */}
        {itensRegistrados.length > 0 && (
          <div className={`mt-10 rounded-2xl shadow-xl p-4 border ${
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'
          } backdrop-blur-sm transition-all duration-300`}>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-blue-400">📋</span> Produtos adicionados (pendentes)
              </h2>
              <button
                onClick={gravarTodosNoBanco}
                disabled={isSubmitting}
                className={`px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md flex items-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? '⏳ Gravando...' : '💾 Gravar todos'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100/80'}>
                  <tr>
                    <th className="px-4 py-2 text-left rounded-l-xl">EAN</th>
                    <th className="px-4 py-2 text-left">Marca</th>
                    <th className="px-4 py-2 text-left">Produto</th>
                    <th className="px-4 py-2 text-left">Validade</th>
                    <th className="px-4 py-2 text-left rounded-r-xl">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itensRegistrados.map((item) => (
                    <tr key={item.id} className="border-t border-gray-500/20 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs">{item.ean}</td>
                      <td className="px-4 py-2">{item.marcaDescr}</td>
                      <td className="px-4 py-2">{item.produtoDescr}</td>
                      <td className="px-4 py-2 font-medium">{item.validade}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => removerItemDaLista(item.id)}
                          className="text-red-500 hover:text-red-400 transition-colors text-sm flex items-center gap-1"
                        >
                          🗑️ Remover
                        </button>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-4 opacity-60 text-center">
              * Itens apenas na lista local. Clique em "Gravar todos" para salvar permanentemente.
            </p>
          </div>
        )}
      </div>

      {/* Toast de notificação */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl backdrop-blur-md transition-all duration-300 animate-fadeIn flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-600/90 text-white' :
          toast.type === 'error' ? 'bg-red-600/90 text-white' :
          'bg-blue-600/90 text-white'
        }`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span className="font-medium">{toast.message}</span>
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