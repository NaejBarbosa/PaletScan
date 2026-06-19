// components/CadastroProdutoModal.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import Scanner from './Scanner';
import { extrairDados } from '../lib/regex';

interface Brand {
  marcaId: string;
  marcaDescr: string;
}

interface ProdutoValido {
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoEan: string;
  produtoDun: string;
  produtoConservacao: string;
  produtoDescr: string;
}

interface CadastroProdutoModalProps {
  initialEan?: string;
  initialDun?: string;
  produtosValidos: ProdutoValido[];
  onClose: () => void;
  onSuccess: (novoProduto: ProdutoValido) => void;
}

// Componente SearchableSelect customizado e acessível
function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  required = false
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string, lbl: string) => void;
  required?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincroniza o valor selecionado com o input de pesquisa
  useEffect(() => {
    const selected = options.find(o => o.value === value);
    setSearch(selected ? selected.label : '');
  }, [value, options]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const selected = options.find(o => o.value === value);
        setSearch(selected ? selected.label : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    return options.filter(opt =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      opt.value.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  return (
    <div className="relative mb-4 w-full" ref={containerRef}>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <li
                key={opt.value}
                onClick={() => {
                  onChange(opt.value, opt.label);
                  setSearch(opt.label);
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
              >
                {opt.label} {opt.value !== opt.label && <span className="text-xs text-slate-400">({opt.value})</span>}
              </li>
            ))
          ) : (
            <li className="px-4 py-2.5 text-sm text-slate-400 dark:text-slate-500">
              Nenhuma opção encontrada
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function CadastroProdutoModal({
  initialEan = '',
  initialDun = '',
  produtosValidos,
  onClose,
  onSuccess
}: CadastroProdutoModalProps) {
  const [eanInput, setEanInput] = useState(initialEan);
  const [dunInput, setDunInput] = useState(initialDun);
  const [marcaId, setMarcaId] = useState('');
  const [marcaDescr, setMarcaDescr] = useState('');
  const [produtoClasse, setProdutoClasse] = useState('');
  const [produtoConservacao, setProdutoConservacao] = useState('');
  const [produtoDescr, setProdutoDescr] = useState('');

  const [marcas, setMarcas] = useState<Brand[]>([]);
  const [activeScanField, setActiveScanField] = useState<'ean' | 'dun' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Carrega marcas cadastras do Google Sheets
  useEffect(() => {
    fetch('/api/marcas')
      .then(res => res.json())
      .then(data => setMarcas(data))
      .catch(err => console.error('Erro ao buscar marcas', err));
  }, []);

  // Extrai as opções únicas de Classe e Conservação da base existente no cliente
  const classeOptions = useMemo(() => {
    const unique = Array.from(new Set(produtosValidos.map(p => p.produtoClasse).filter(Boolean)));
    return unique.map(c => ({ value: c, label: c }));
  }, [produtosValidos]);

  const conservacaoOptions = useMemo(() => {
    const unique = Array.from(new Set(produtosValidos.map(p => p.produtoConservacao).filter(Boolean)));
    return unique.map(c => ({ value: c, label: c }));
  }, [produtosValidos]);

  const marcaOptions = useMemo(() => {
    return marcas.map(m => ({ value: m.marcaId, label: m.marcaDescr }));
  }, [marcas]);

  // Se o EAN foi validado mas não identificado, EAN é fixo.
  const isEanFixed = !!initialEan;
  // Se o DUN foi validado mas não identificado, DUN é fixo.
  const isDunFixed = !!initialDun;

  const handleScanDetected = (text: string) => {
    const dados = extrairDados(text);
    if (!dados) {
      setErrorMsg('Formato de código inválido ou não reconhecido.');
      setActiveScanField(null);
      return;
    }

    const { ean, dun } = dados;

    if (activeScanField === 'ean') {
      if (!ean) {
        setErrorMsg('Nenhum EAN válido foi detectado neste código.');
        setActiveScanField(null);
        return;
      }
      // Valida se EAN já existe na base
      const jaExiste = produtosValidos.some(p => p.produtoEan === ean);
      if (jaExiste) {
        setErrorMsg(`O EAN ${ean} já está cadastrado na base.`);
        setActiveScanField(null);
        return;
      }
      setEanInput(ean);
      setErrorMsg(null);
    } else if (activeScanField === 'dun') {
      if (!dun) {
        setErrorMsg('Nenhum DUN válido foi detectado neste código.');
        setActiveScanField(null);
        return;
      }
      // Valida se DUN já existe na base
      const jaExiste = produtosValidos.some(p => p.produtoDun === dun);
      if (jaExiste) {
        setErrorMsg(`O DUN ${dun} já está cadastrado na base.`);
        setActiveScanField(null);
        return;
      }
      setDunInput(dun);
      setErrorMsg(null);
    }

    setActiveScanField(null);
  };

  const handleGravar = async () => {
    setErrorMsg(null);

    // Validações básicas
    if (!eanInput.trim() || !dunInput.trim() || !marcaId || !produtoClasse || !produtoConservacao || !produtoDescr.trim()) {
      setErrorMsg('Todos os campos são de preenchimento obrigatório.');
      return;
    }

    // Validação de formato numérico
    if (!/^\d+$/.test(eanInput)) {
      setErrorMsg('O EAN deve conter apenas números.');
      return;
    }
    if (!/^\d+$/.test(dunInput)) {
      setErrorMsg('O DUN deve conter apenas números.');
      return;
    }

    // Validação de dígitos
    if (eanInput.length !== 8 && eanInput.length !== 13) {
      setErrorMsg('O EAN deve ter 8 ou 13 dígitos.');
      return;
    }
    if (dunInput.length !== 14) {
      setErrorMsg('O DUN deve ter exatamente 14 dígitos.');
      return;
    }

    // Verifica se já existem no banco
    const eanExiste = produtosValidos.some(p => p.produtoEan === eanInput && p.produtoEan !== initialEan);
    if (eanExiste) {
      setErrorMsg(`O EAN ${eanInput} já está cadastrado na base.`);
      return;
    }
    const dunExiste = produtosValidos.some(p => p.produtoDun === dunInput && p.produtoDun !== initialDun);
    if (dunExiste) {
      setErrorMsg(`O DUN ${dunInput} já está cadastrado na base.`);
      return;
    }

    setIsSaving(true);
    try {
      const novoProduto: ProdutoValido = {
        marcaId,
        marcaDescr,
        produtoClasse,
        produtoEan: eanInput,
        produtoDun: dunInput,
        produtoConservacao,
        produtoDescr,
      };

      const res = await fetch('/api/cadastrar-produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoProduto),
      });

      if (!res.ok) {
        let errMsg = 'Erro ao salvar no servidor.';
        try {
          const errorData = await res.json();
          if (errorData && errorData.error) {
            errMsg = errorData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      onSuccess(novoProduto);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar o produto. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4">
      {activeScanField ? (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col justify-between">
          <div className="bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center z-10">
            <h3 className="text-white text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Escaneando {activeScanField.toUpperCase()}
            </h3>
            <button
              onClick={() => setActiveScanField(null)}
              className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Cancelar Scanner
            </button>
          </div>
          <div className="flex-1 relative">
            <Scanner onDetected={handleScanDetected} />
          </div>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in my-8">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              Cadastrar Produto Não Identificado
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Preencha as especificações para registrar na base do Google Sheets.
            </p>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-danger-700 dark:text-danger-300">{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* EAN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  Produto EAN <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={eanInput}
                    onChange={(e) => setEanInput(e.target.value.replace(/\D/g, ''))}
                    disabled={isEanFixed}
                    placeholder="Ex: 7891234567890"
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  />
                  {!isEanFixed && (
                    <button
                      type="button"
                      onClick={() => setActiveScanField('ean')}
                      className="px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                      title="Escanear EAN"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* DUN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  Produto DUN <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dunInput}
                    onChange={(e) => setDunInput(e.target.value.replace(/\D/g, ''))}
                    disabled={isDunFixed}
                    placeholder="Ex: 17891234567897"
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  />
                  {!isDunFixed && (
                    <button
                      type="button"
                      onClick={() => setActiveScanField('dun')}
                      className="px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                      title="Escanear DUN"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* MARCA */}
            <SearchableSelect
              label="Marca"
              placeholder="Pesquisar ou selecionar marca..."
              options={marcaOptions}
              value={marcaId}
              required={true}
              onChange={(val, lbl) => {
                setMarcaId(val);
                setMarcaDescr(lbl);
              }}
            />

            {/* CLASSE */}
            <SearchableSelect
              label="Classe"
              placeholder="Pesquisar ou selecionar classe..."
              options={classeOptions}
              value={produtoClasse}
              required={true}
              onChange={(val) => setProdutoClasse(val)}
            />

            {/* CONSERVAÇÃO */}
            <SearchableSelect
              label="Conservação"
              placeholder="Pesquisar ou selecionar conservação..."
              options={conservacaoOptions}
              value={produtoConservacao}
              required={true}
              onChange={(val) => setProdutoConservacao(val)}
            />

            {/* DESCRIÇÃO PRODUTO */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                Descrição do Produto <span className="text-red-500">*</span>
              </label>
              <textarea
                value={produtoDescr}
                onChange={(e) => setProdutoDescr(e.target.value)}
                placeholder="Ex: SUCO DE UVA INTEGRAL 1L"
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all text-sm"
            >
              Descartar
            </button>
            <button
              onClick={handleGravar}
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Gravando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Gravar Dados
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
