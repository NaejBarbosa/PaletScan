// components/CadastroProdutoModal.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import * as fuzzball from 'fuzzball';
import Scanner from './Scanner';
import { extrairDados } from '../lib/regex';
import { useLanguage } from '../context/LanguageContext';

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
  initialProdutoParaVincular?: ProdutoValido;
  produtosValidos: ProdutoValido[];
  onClose: () => void;
  onSuccess: (novoProduto: ProdutoValido, foiVinculado?: boolean) => void;
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
  initialProdutoParaVincular,
  produtosValidos,
  onClose,
  onSuccess
}: CadastroProdutoModalProps) {
  const { language, t } = useLanguage();

  const [eanInput, setEanInput] = useState(initialProdutoParaVincular ? initialProdutoParaVincular.produtoEan : initialEan);
  const [dunInput, setDunInput] = useState(initialDun);
  const [marcaId, setMarcaId] = useState(initialProdutoParaVincular ? initialProdutoParaVincular.marcaId : '');
  const [marcaDescr, setMarcaDescr] = useState(initialProdutoParaVincular ? initialProdutoParaVincular.marcaDescr : '');
  const [produtoClasse, setProdutoClasse] = useState(initialProdutoParaVincular ? initialProdutoParaVincular.produtoClasse : '');
  const [produtoConservacao, setProdutoConservacao] = useState(initialProdutoParaVincular ? initialProdutoParaVincular.produtoConservacao : '');
  const [produtoDescr, setProdutoDescr] = useState(initialProdutoParaVincular ? initialProdutoParaVincular.produtoDescr : '');

  const [marcas, setMarcas] = useState<Brand[]>([]);
  const [activeScanField, setActiveScanField] = useState<'ean' | 'dun' | null>(null);
  const [scanType, setScanType] = useState<'camera' | 'gallery' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para Vinculação de DUN
  const [vincularDun, setVincularDun] = useState(!!initialDun || !!initialProdutoParaVincular);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoValido | null>(initialProdutoParaVincular || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const [showEanMenu, setShowEanMenu] = useState(false);
  const eanMenuRef = useRef<HTMLDivElement>(null);
  const [showDunMenu, setShowDunMenu] = useState(false);
  const dunMenuRef = useRef<HTMLDivElement>(null);

  // Efeito de debounce para a busca avançada
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 180);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reseta rolagem da busca avançada
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchResultsRef.current) {
        searchResultsRef.current.scrollTop = 0;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [debouncedSearchTerm]);

  // Fecha o menu de QR Code ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (eanMenuRef.current && !eanMenuRef.current.contains(event.target as Node)) {
        setShowEanMenu(false);
      }
      if (dunMenuRef.current && !dunMenuRef.current.contains(event.target as Node)) {
        setShowDunMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Função auxiliar para normalizar string
  const removeAccents = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Produtos elegíveis: cadastrados que não possuem DUN
  const produtosElegiveis = useMemo(() => {
    return produtosValidos.filter(p => !p.produtoDun);
  }, [produtosValidos]);

  // Lógica de busca fuzzy usando fuzzball
  const filteredProducts = useMemo(() => {
    const cleanTerm = debouncedSearchTerm.trim();
    if (!cleanTerm || cleanTerm.length < 2) return [];

    const termNorm = removeAccents(cleanTerm);
    const textsNorm = produtosElegiveis.map((prod) => 
      removeAccents(`${prod?.marcaDescr || ''} ${prod?.produtoDescr || ''} ${prod?.produtoClasse || ''}`)
    );

    const results = fuzzball.extract(termNorm, textsNorm, {
      scorer: fuzzball.token_set_ratio,
      limit: 30,
      cutoff: 40
    });

    return results
      .map((r) => produtosElegiveis[r[2]])
      .filter((prod): prod is ProdutoValido => !!(prod && prod.produtoEan && prod.produtoDescr));
  }, [debouncedSearchTerm, produtosElegiveis]);

  const handleSelecionarProduto = (prod: ProdutoValido | null) => {
    setProdutoSelecionado(prod);
    if (prod) {
      setEanInput(prod.produtoEan);
      setMarcaId(prod.marcaId);
      setMarcaDescr(prod.marcaDescr);
      setProdutoClasse(prod.produtoClasse);
      setProdutoConservacao(prod.produtoConservacao);
      setProdutoDescr(prod.produtoDescr);
    } else {
      setEanInput(initialEan);
      setMarcaId('');
      setMarcaDescr('');
      setProdutoClasse('');
      setProdutoConservacao('');
      setProdutoDescr('');
    }
    setErrorMsg(null);
  };

  const handleToggleVincular = (active: boolean) => {
    setVincularDun(active);
    handleSelecionarProduto(null);
    setSearchTerm('');
  };

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
      setErrorMsg(language === 'pt' ? 'Formato de código inválido ou não reconhecido.' : 'Formato de código inválido o no reconocido.');
      setActiveScanField(null);
      return;
    }

    const { ean, dun } = dados;

    if (activeScanField === 'ean') {
      if (!ean) {
        setErrorMsg(language === 'pt' ? 'Nenhum EAN válido foi detectado neste código.' : 'No se detectó ningún EAN válido en este código.');
        setActiveScanField(null);
        return;
      }

      if (vincularDun) {
        // Fluxo de Vinculação: o produto DEVE existir na base e NÃO ter DUN cadastrado
        const produtoExistente = produtosValidos.find(p => p.produtoEan === ean);
        if (!produtoExistente) {
          setErrorMsg(language === 'pt' ? `O EAN ${ean} não foi encontrado na base de produtos.` : `El EAN ${ean} no fue encontrado en la base de productos.`);
          setActiveScanField(null);
          return;
        }
        if (produtoExistente.produtoDun) {
          setErrorMsg(language === 'pt' ? `O produto correspondente ao EAN ${ean} já possui o DUN ${produtoExistente.produtoDun} vinculado.` : `El producto correspondiente al EAN ${ean} ya tiene el DUN ${produtoExistente.produtoDun} vinculado.`);
          setActiveScanField(null);
          return;
        }
        // Se existir e não tiver DUN, seleciona e carrega no modal
        handleSelecionarProduto(produtoExistente);
        setErrorMsg(null);
      } else {
        // Fluxo de Cadastro Manual Novo: o EAN NÃO deve existir na base
        const jaExiste = produtosValidos.some(p => p.produtoEan === ean);
        if (jaExiste) {
          setErrorMsg(language === 'pt' ? `O EAN ${ean} já está cadastrado na base.` : `El EAN ${ean} ya está registrado en la base.`);
          setActiveScanField(null);
          return;
        }
        setEanInput(ean);
        setErrorMsg(null);
      }
    } else if (activeScanField === 'dun') {
      if (!dun) {
        setErrorMsg(language === 'pt' ? 'Nenhum DUN válido foi detectado neste código.' : 'No se detectó ningún DUN válido en este código.');
        setActiveScanField(null);
        return;
      }
      // Valida se DUN já existe na base
      const jaExiste = produtosValidos.some(p => p.produtoDun === dun);
      if (jaExiste) {
        setErrorMsg(language === 'pt' ? `O DUN ${dun} já está cadastrado na base.` : `El DUN ${dun} ya está registrado en la base.`);
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
    if (vincularDun) {
      if (!produtoSelecionado) {
        setErrorMsg(language === 'pt' ? 'Você precisa selecionar um produto elegível para realizar a vinculação.' : 'Debe seleccionar un producto elegible para realizar la vinculación.');
        return;
      }
      if (!dunInput.trim()) {
        setErrorMsg(language === 'pt' ? 'O código DUN é obrigatório para a vinculação.' : 'El código DUN es obligatorio para la vinculación.');
        return;
      }
    } else {
      if (!eanInput.trim() || !dunInput.trim() || !marcaId || !produtoClasse || !produtoConservacao || !produtoDescr.trim()) {
        setErrorMsg(language === 'pt' ? 'Todos os campos são de preenchimento obrigatório.' : 'Todos los campos son obligatorios.');
        return;
      }
    }

    // Validação de formato numérico
    if (!/^\d+$/.test(eanInput)) {
      setErrorMsg(language === 'pt' ? 'O EAN deve conter apenas números.' : 'El EAN debe contener solo números.');
      return;
    }
    if (!/^\d+$/.test(dunInput)) {
      setErrorMsg(language === 'pt' ? 'O DUN deve conter apenas números.' : 'El DUN debe contener solo números.');
      return;
    }

    // Validação de dígitos
    if (eanInput.length !== 8 && eanInput.length !== 13) {
      setErrorMsg(language === 'pt' ? 'O EAN deve ter 8 ou 13 dígitos.' : 'El EAN debe tener 8 o 13 dígitos.');
      return;
    }
    if (dunInput.length !== 14) {
      setErrorMsg(language === 'pt' ? 'O DUN deve ter exatamente 14 dígitos.' : 'El DUN debe tener exactamente 14 dígitos.');
      return;
    }

    // Verifica se já existem no banco (apenas valida EAN se não for vinculação)
    if (!vincularDun) {
      const eanExiste = produtosValidos.some(p => p.produtoEan === eanInput && p.produtoEan !== initialEan);
      if (eanExiste) {
        setErrorMsg(language === 'pt' ? `O EAN ${eanInput} já está cadastrado na base.` : `El EAN ${eanInput} ya está registrado en la base.`);
        return;
      }
    }
    const dunExiste = produtosValidos.some(p => p.produtoDun === dunInput && p.produtoDun !== initialDun);
    if (dunExiste) {
      setErrorMsg(language === 'pt' ? `O DUN ${dunInput} já está cadastrado na base.` : `El DUN ${dunInput} ya está registrado en la base.`);
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
        body: JSON.stringify({
          ...novoProduto,
          vincular: vincularDun,
        }),
      });

      if (!res.ok) {
        let errMsg = language === 'pt' ? 'Erro ao salvar no servidor.' : 'Error al guardar en el servidor.';
        try {
          const errorData = await res.json();
          if (errorData && errorData.error) {
            errMsg = errorData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      onSuccess(novoProduto, vincularDun);
    } catch (err: any) {
      setErrorMsg(err.message || (language === 'pt' ? 'Erro ao salvar o produto. Tente novamente.' : 'Error al guardar el producto. Inténtelo de nuevo.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4">
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in my-8">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-xl bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center mb-2.5 shadow-sm">
              <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {language === 'pt' ? 'Cadastrar Produto Não Identificado' : 'Registrar Producto No Identificado'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {language === 'pt' ? 'Preencha as especificações para registrar na base do Google Sheets.' : 'Complete las especificaciones para registrar en la base de Google Sheets.'}
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
                  {language === 'pt' ? 'Produto EAN' : 'Producto EAN'} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={eanInput}
                    onChange={(e) => setEanInput(e.target.value.replace(/\D/g, ''))}
                    disabled={isEanFixed || vincularDun}
                    placeholder="Ex: 7891234567890"
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  />

                  {vincularDun && !produtoSelecionado && (
                    <div className="relative" ref={eanMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowEanMenu(!showEanMenu)}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all flex items-center justify-center shadow-sm"
                        title="Escanear EAN (QR Code)"
                      >
                        <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </button>
                      
                      {showEanMenu && (
                        <div className="absolute right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1 min-w-[150px] flex flex-col gap-0.5 animate-scale-in">
                          <button
                            type="button"
                            onClick={() => {
                              setShowEanMenu(false);
                              setActiveScanField('ean');
                              setScanType('camera');
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                            </svg>
                            {language === 'pt' ? 'Usar Câmera' : 'Usar Cámara'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEanMenu(false);
                              setActiveScanField('ean');
                              setScanType('gallery');
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l2.586-2.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {language === 'pt' ? 'Buscar Galeria' : 'Buscar Galería'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* DUN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  {language === 'pt' ? 'Produto DUN' : 'Producto DUN'} <span className="text-red-500">*</span>
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
                    <div className="relative" ref={dunMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowDunMenu(!showDunMenu)}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all flex items-center justify-center shadow-sm"
                        title="Escanear DUN (QR Code)"
                      >
                        <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </button>
                      
                      {showDunMenu && (
                        <div className="absolute right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1 min-w-[150px] flex flex-col gap-0.5 animate-scale-in">
                          <button
                            type="button"
                            onClick={() => {
                              setShowDunMenu(false);
                              setActiveScanField('dun');
                              setScanType('camera');
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                            </svg>
                            {language === 'pt' ? 'Usar Câmera' : 'Usar Cámara'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowDunMenu(false);
                              setActiveScanField('dun');
                              setScanType('gallery');
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l2.586-2.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {language === 'pt' ? 'Buscar Galeria' : 'Buscar Galería'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Opção de Deslizar para Vincular DUN ao EAN elegível */}
            {!!dunInput && (
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 transition-all duration-300">
                <div className="flex flex-col pr-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    {language === 'pt' ? 'Vincular DUN a EAN Cadastrado' : 'Vincular DUN a EAN Registrado'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                    {language === 'pt' ? 'Associar este código DUN a um produto da base que não possui DUN' : 'Asociar este código DUN a un producto de la base que no posee DUN'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleVincular(!vincularDun)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    vincularDun ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      vincularDun ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Campo de Consulta / Pesquisa Avançada */}
            {vincularDun && !produtoSelecionado && (
              <div className="space-y-3 animate-fadeIn">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
                  {language === 'pt' ? 'Pesquisa Avançada do Produto' : 'Búsqueda Avanzada del Producto'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={language === 'pt' ? 'Busque por marca, descrição ou classe (mínimo 2 letras)...' : 'Busque por marca, descripción o clase (mínimo 2 letras)...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2.5 pl-10 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {searchTerm.trim().length >= 2 && (
                  <div ref={searchResultsRef} className="max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg divide-y divide-slate-100 dark:divide-slate-800 animate-slideDown">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((prod) => (
                        <button
                          key={`${prod.produtoEan}-${prod.marcaId}-${prod.produtoDescr}`}
                          type="button"
                          onClick={() => handleSelecionarProduto(prod)}
                          className="w-full px-4 py-2.5 text-left text-xs hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-700 dark:text-slate-300 transition-colors flex justify-between items-center"
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{prod.produtoDescr}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{prod.marcaDescr} · EAN: {prod.produtoEan}</p>
                          </div>
                          <span className="badge badge-success text-[9px] flex-shrink-0">{prod.produtoClasse}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500">
                        {language === 'pt' ? 'Nenhum produto sem DUN encontrado.' : 'Ningún producto sin DUN encontrado.'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Produto Selecionado para Vinculação */}
            {vincularDun && produtoSelecionado && (
              <div className="p-3.5 bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 rounded-xl flex items-center justify-between animate-fadeIn">
                <div className="min-w-0 flex-1 pr-3">
                  <span className="text-[10px] uppercase font-bold text-primary-600 dark:text-primary-400">
                    {language === 'pt' ? 'Produto Elegível Selecionado' : 'Producto Elegible Seleccionado'}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">{produtoSelecionado.produtoDescr}</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{produtoSelecionado.marcaDescr} · EAN: {produtoSelecionado.produtoEan}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelecionarProduto(null)}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {language === 'pt' ? 'Alterar' : 'Cambiar'}
                </button>
              </div>
            )}

            {/* Campos adicionais (visíveis se for cadastro manual OU se produto estiver selecionado no vinculo) */}
            {(!vincularDun || (vincularDun && !!produtoSelecionado)) && (
              <div className="space-y-4 animate-fadeIn">
                {/* MARCA */}
                {vincularDun ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      {t('marca')}
                    </label>
                    <input
                      type="text"
                      value={marcaDescr}
                      disabled={true}
                      className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 disabled:text-slate-500 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                ) : (
                  <SearchableSelect
                    label={t('marca')}
                    placeholder={language === 'pt' ? 'Pesquisar ou selecionar marca...' : 'Buscar o seleccionar marca...'}
                    options={marcaOptions}
                    value={marcaId}
                    required={true}
                    onChange={(val, lbl) => {
                      setMarcaId(val);
                      setMarcaDescr(lbl);
                    }}
                  />
                )}

                {/* CLASSE */}
                {vincularDun ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      {t('classe')}
                    </label>
                    <input
                      type="text"
                      value={produtoClasse}
                      disabled={true}
                      className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 disabled:text-slate-500 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                ) : (
                  <SearchableSelect
                    label={t('classe')}
                    placeholder={language === 'pt' ? 'Pesquisar ou selecionar classe...' : 'Buscar o seleccionar clase...'}
                    options={classeOptions}
                    value={produtoClasse}
                    required={true}
                    onChange={(val) => setProdutoClasse(val)}
                  />
                )}

                {/* CONSERVAÇÃO */}
                {vincularDun ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      {t('conservacao')}
                    </label>
                    <input
                      type="text"
                      value={produtoConservacao}
                      disabled={true}
                      className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 disabled:text-slate-500 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                ) : (
                  <SearchableSelect
                    label={t('conservacao')}
                    placeholder={language === 'pt' ? 'Pesquisar ou selecionar conservação...' : 'Buscar o seleccionar conservación...'}
                    options={conservacaoOptions}
                    value={produtoConservacao}
                    required={true}
                    onChange={(val) => setProdutoConservacao(val)}
                  />
                )}

                {/* DESCRIÇÃO PRODUTO */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    {language === 'pt' ? 'Descrição do Produto' : 'Descripción del Producto'} {!vincularDun && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={produtoDescr}
                    onChange={(e) => setProdutoDescr(e.target.value)}
                    disabled={vincularDun}
                    placeholder="Ex: SUCO DE UVA INTEGRAL 1L"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:border-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all text-sm"
            >
              {language === 'pt' ? 'Cancelar' : 'Cancelar'}
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
                  {language === 'pt' ? 'Gravando...' : 'Guardando...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {vincularDun 
                    ? (language === 'pt' ? 'Confirmar Vinculação' : 'Confirmar Vinculación')
                    : (language === 'pt' ? 'Gravar no Sheets' : 'Guardar en Sheets')
                  }
                </>
              )}
            </button>
          </div>
      </div>

      {activeScanField && (
        <Scanner
          onDetected={handleScanDetected}
          autoStartCamera={scanType === 'camera'}
          autoStartGallery={scanType === 'gallery'}
          onClose={() => {
            setActiveScanField(null);
            setScanType(null);
          }}
        />
      )}
    </div>
  );
}
