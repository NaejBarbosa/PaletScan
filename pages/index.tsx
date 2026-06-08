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
    produto?: ProdutoValido;   // ✅ corrigido: era "produit"
  } | null>(null);
  const [itensRegistrados, setItensRegistrados] = useState<ItemRegistrado[]>([]);

  useEffect(() => {
    fetch('/api/validar')
      .then((res) => res.json())
      .then((data) => setProdutosValidos(data))
      .catch((err) => console.error('Erro ao carregar base', err));
  }, []);

  const salvarRegistro = async (registro: any, ean: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro),
      });
      if (res.ok) {
        setScannedEans((prev) => new Set(prev).add(ean));
        return true;
      } else {
        alert('❌ Erro ao salvar no banco_cadastro');
        return false;
      }
    } catch (error) {
      alert('❌ Erro de conexão');
      return false;
    }
  };

  const adicionarItemRegistrado = (produto: ProdutoValido, ean: string, validade: string) => {
    const novoItem: ItemRegistrado = {
      id: `${Date.now()}-${ean}`,
      ean,
      validade,
      marcaId: produto.marcaId,
      marcaDescr: produto.marcaDescr,
      produtoClasse: produto.produtoClasse,
      produtoDescr: produto.produtoDescr,
      dataRegistro: new Date(),
    };
    setItensRegistrados((prev) => [...prev, novoItem]);
  };

  const handleQRCode = (text: string) => {
    const dados = extrairDados(text);
    if (!dados) {
      alert(`❌ Formato inválido\n\nTexto recebido:\n${text}`);
      return;
    }
    const { ean, validade } = dados;
    if (scannedEans.has(ean)) {
      alert('⚠️ Este código já foi processado.');
      return;
    }
    const produtoEncontrado = produtosValidos.find((p) => p.produtoEan === ean);
    setConfirmacao({ ean, validade, produto: produtoEncontrado });
  };

  const handleGravar = async () => {
    if (!confirmacao) return;
    const { ean, validade, produto } = confirmacao;
    if (!produto) {
      setCurrentScan({ ean, validade });
      setModoManual(true);
      setConfirmacao(null);
      return;
    }
    const registro = {
      marcaId: produto.marcaId,
      marcaDescr: produto.marcaDescr,
      produtoClasse: produto.produtoClasse,
      produtoEan: ean,
      produtoDescr: produto.produtoDescr,
      produtoValidade: validade,
    };
    const sucesso = await salvarRegistro(registro, ean);
    if (sucesso) {
      adicionarItemRegistrado(produto, ean, validade);
      alert('✅ Produto registrado com sucesso!');
      setConfirmacao(null);
    }
  };

  const handleNovaLeitura = () => {
    setConfirmacao(null);
  };

  const handleDescartar = () => {
    setConfirmacao(null);
  };

  const handleManualSubmit = async (produto: ProdutoValido, validadeFinal: string) => {
    if (!currentScan) return;
    const registro = {
      marcaId: produto.marcaId,
      marcaDescr: produto.marcaDescr,
      produtoClasse: produto.produtoClasse,
      produtoEan: currentScan.ean,
      produtoDescr: produto.produtoDescr,
      produtoValidade: validadeFinal,
    };
    const sucesso = await salvarRegistro(registro, currentScan.ean);
    if (sucesso) {
      adicionarItemRegistrado(produto, currentScan.ean, validadeFinal);
      alert('✅ Produto manual registrado!');
    }
    setModoManual(false);
    setCurrentScan(null);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Cabeçalho com título e botão de tema */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Scanner de Produtos
          </h1>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-all duration-200 ${
              theme === 'dark' ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Scanner com fundo adaptado */}
        <div className={`rounded-xl shadow-lg overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <Scanner onDetected={handleQRCode} />
        </div>

        {/* Modal de confirmação */}
        {confirmacao && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 ${theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}`}>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">📦 Produto detectado</h2>
              <div className={`mb-4 rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <p className="mb-1"><span className="font-semibold">EAN:</span> {confirmacao.ean}</p>
                <p className="mb-1"><span className="font-semibold">Validade:</span> {confirmacao.validade}</p>
                {confirmacao.produto ? (
                  <>
                    <p className="mb-1"><span className="font-semibold">Marca:</span> {confirmacao.produto.marcaDescr}</p>
                    <p className="mb-1"><span className="font-semibold">Produto:</span> {confirmacao.produto.produtoDescr}</p>
                    <p><span className="font-semibold">Classe:</span> {confirmacao.produto.produtoClasse}</p>
                  </>
                ) : (
                  <p className="text-red-500 font-semibold">⚠️ Produto não encontrado na base. Será necessário cadastro manual.</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={handleGravar} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors">
                  💾 Gravar no banco_cadastro
                </button>
                <button onClick={handleNovaLeitura} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors">
                  📷 Nova leitura
                </button>
                <button onClick={handleDescartar} className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition-colors">
                  ❌ Descartar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cadastro manual */}
        {modoManual && currentScan && (
          <div className={`mt-6 rounded-xl shadow-lg p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-semibold mb-3">Produto não encontrado na base</h2>
            <p className="mb-1"><strong>EAN:</strong> {currentScan.ean}</p>
            <p className="mb-4"><strong>Validade calculada:</strong> {currentScan.validade}</p>
            <AutocompleteManual
              produtosValidos={produtosValidos}
              onSelect={handleManualSubmit}
              validadeAtual={currentScan.validade}
            />
          </div>
        )}

        {/* Tabela de produtos registrados */}
        {itensRegistrados.length > 0 && (
          <div className={`mt-8 rounded-xl shadow-lg p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-3">📋 Produtos registrados nesta sessão</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className={theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}>
                  <tr>
                    <th className="border p-2">EAN</th>
                    <th className="border p-2">Marca</th>
                    <th className="border p-2">Produto</th>
                    <th className="border p-2">Validade</th>
                    <th className="border p-2">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {itensRegistrados.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="border p-2 font-mono">{item.ean}</td>
                      <td className="border p-2">{item.marcaDescr}</td>
                      <td className="border p-2">{item.produtoDescr}</td>
                      <td className="border p-2">{item.validade}</td>
                      <td className="border p-2">{new Date(item.dataRegistro).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-2 opacity-70">* Registros já salvos no banco_cadastro</p>
          </div>
        )}
      </div>
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