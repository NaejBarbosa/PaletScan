// pages/index.tsx
import { useState, useEffect } from 'react';
import Scanner from '../components/Scanner';
import AutocompleteManual from '../components/AutocompleteManual';
import { extrairDados } from '../lib/regex';

interface ProdutoValido {
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoEan: string;
  produtoDescr: string;
}

interface ConfirmacaoData {
  ean: string;
  validade: string;
  produto?: ProdutoValido;
}

export default function Home() {
  const [produtosValidos, setProdutosValidos] = useState<ProdutoValido[]>([]);
  const [scannedEans, setScannedEans] = useState<Set<string>>(new Set());
  const [currentScan, setCurrentScan] = useState<{ ean: string; validade: string } | null>(null);
  const [modoManual, setModoManual] = useState(false);
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoData | null>(null);

  useEffect(() => {
    fetch('/api/validar')
      .then((res) => res.json())
      .then((data) => setProdutosValidos(data))
      .catch((err) => console.error('Erro ao carregar base', err));
  }, []);

  const salvarRegistro = async (registro: any, ean: string) => {
    try {
      const res = await fetch('/api/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro),
      });
      if (res.ok) {
        setScannedEans((prev) => new Set(prev).add(ean));
        alert('✅ Registro salvo com sucesso!');
        return true;
      } else {
        alert('❌ Erro ao salvar');
        return false;
      }
    } catch (error) {
      alert('❌ Erro de conexão');
      return false;
    }
  };

  const handleQRCode = (text: string) => {
    // ALERTA DE DEPURAÇÃO: texto bruto recebido
    alert(`[Index] Texto bruto recebido: ${text}`);
    
    const dados = extrairDados(text);
    if (!dados) {
      alert(`[Index] Formato inválido. Texto: ${text}`);
      return;
    }

    alert(`[Index] Extraído: EAN=${dados.ean}, Validade=${dados.validade}`);

    const { ean, validade } = dados;

    if (scannedEans.has(ean)) {
      alert('⚠️ Este código já foi processado anteriormente.');
      return;
    }

    const produtoEncontrado = produtosValidos.find((p) => p.produtoEan === ean);
    setConfirmacao({ ean, validade, produto: produtoEncontrado });
    alert(`[Index] Exibindo modal de confirmação para EAN ${ean}`);
  };

  const handleConfirmacaoSalvar = async () => {
    if (!confirmacao) return;
    const { ean, validade, produto } = confirmacao;

    if (produto) {
      const registro = {
        marcaId: produto.marcaId,
        marcaDescr: produto.marcaDescr,
        produtoClasse: produto.produtoClasse,
        produtoEan: ean,
        produtoDescr: produto.produtoDescr,
        produtoValidade: validade,
      };
      await salvarRegistro(registro, ean);
    } else {
      setCurrentScan({ ean, validade });
      setModoManual(true);
    }
    setConfirmacao(null);
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
    await salvarRegistro(registro, currentScan.ean);
    setModoManual(false);
    setCurrentScan(null);
  };

  return (
    <main className="min-h-screen p-4 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Scanner de Produtos</h1>

      <Scanner onDetected={handleQRCode} />

      {confirmacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">📋 Dados extraídos</h2>
            <div className="mb-4 space-y-2">
              <p><strong>EAN:</strong> {confirmacao.ean}</p>
              <p><strong>Validade:</strong> {confirmacao.validade}</p>
              {confirmacao.produto ? (
                <>
                  <p><strong>Marca:</strong> {confirmacao.produto.marcaDescr}</p>
                  <p><strong>Produto:</strong> {confirmacao.produto.produtoDescr}</p>
                  <p><strong>Classe:</strong> {confirmacao.produto.produtoClasse}</p>
                </>
              ) : (
                <p className="text-red-600">
                  <strong>⚠️ Produto não encontrado na base!</strong><br />
                  Será necessário cadastro manual.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmacaoSalvar}
                className="bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                {confirmacao.produto ? '✅ Salvar dados' : '📝 Ir para cadastro manual'}
              </button>
              <button
                onClick={handleNovaLeitura}
                className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                📷 Fazer mais leitura
              </button>
              <button
                onClick={handleDescartar}
                className="bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
              >
                ❌ Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {modoManual && currentScan && (
        <div className="mt-6 p-4 bg-white rounded shadow">
          <h2 className="text-xl font-semibold">Produto não encontrado na base</h2>
          <p><strong>EAN:</strong> {currentScan.ean}</p>
          <p><strong>Validade calculada:</strong> {currentScan.validade}</p>
          <AutocompleteManual
            produtosValidos={produtosValidos}
            onSelect={(produto, validadeFinal) => handleManualSubmit(produto, validadeFinal)}
            validadeAtual={currentScan.validade}
          />
        </div>
      )}
    </main>
  );
}