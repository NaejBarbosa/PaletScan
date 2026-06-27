import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface Registro {
  id: string;
  timestamp: string;
  marcaId: string;
  marcaDescr: string;
  produtoClasse: string;
  produtoEan: string;
  produtoDescr: string;
  produtoValidade: string;
  camara: string;
  camaraVaga: string;
}

export default function Relatorio() {
  const { language, t } = useLanguage();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados dos filtros
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroCamara, setFiltroCamara] = useState('');
  const [filtroVaga, setFiltroVaga] = useState('');
  const [filtroClasse, setFiltroClasse] = useState('');
  const [filtroVencimentoSmart, setFiltroVencimentoSmart] = useState('todos');
  const [filtroVencimentoExato, setFiltroVencimentoExato] = useState('');
  const [filtroRecebimentoSmart, setFiltroRecebimentoSmart] = useState('todos');
  const [filtroRecebimentoExato, setFiltroRecebimentoExato] = useState('');

  // Paginação
  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 10;

  // Carregar dados da API
  const carregarDados = () => {
    setIsLoading(true);
    setError(null);
    fetch('/api/cadastrados')
      .then((res) => {
        if (!res.ok) throw new Error(language === 'pt' ? 'Falha ao carregar registros cadastrados.' : 'Fallo al cargar registros registrados.');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          // Ordena decrescente pelo timestamp (os mais recentes primeiro)
          const sorted = data.sort((a, b) => {
            const dateA = new Date(a.timestamp.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
            const dateB = new Date(b.timestamp.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
            return dateB.getTime() - dateA.getTime();
          });
          setRegistros(sorted);
        } else {
          console.error('Dados de cadastrados inválidos:', data);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || (language === 'pt' ? 'Falha ao conectar com o servidor.' : 'Fallo al conectar con el servidor.'));
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Extrair opções únicas para os selects dos filtros
  const marcasDisponiveis = useMemo(() => {
    const unique = Array.from(new Set(registros.map((r) => r.marcaDescr).filter(Boolean)));
    return unique.sort();
  }, [registros]);

  const classesDisponiveis = useMemo(() => {
    const unique = Array.from(new Set(registros.map((r) => r.produtoClasse).filter(Boolean)));
    return unique.sort();
  }, [registros]);

  const camarasDisponiveis = useMemo(() => {
    const unique = Array.from(new Set(registros.map((r) => r.camara).filter(Boolean)));
    return unique.sort();
  }, [registros]);

  // Cálculos de datas para os filtros inteligentes
  const dateRanges = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Início e fim da semana atual (Domingo a Sábado)
    const inicioSemanaAtual = new Date(hoje);
    inicioSemanaAtual.setDate(hoje.getDate() - hoje.getDay());
    const fimSemanaAtual = new Date(inicioSemanaAtual);
    fimSemanaAtual.setDate(inicioSemanaAtual.getDate() + 6);

    // Início e fim da próxima semana
    const inicioProximaSemana = new Date(fimSemanaAtual);
    inicioProximaSemana.setDate(fimSemanaAtual.getDate() + 1);
    const fimProximaSemana = new Date(inicioProximaSemana);
    fimProximaSemana.setDate(inicioProximaSemana.getDate() + 6);

    // Início e fim do mês atual
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMesAtual = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    return {
      hoje,
      inicioSemanaAtual,
      fimSemanaAtual,
      inicioProximaSemana,
      fimProximaSemana,
      inicioMesAtual,
      fimMesAtual,
    };
  }, []);

  // Parser de string "DD/MM/YYYY" para Date
  const parseValidade = (validadeStr: string): Date | null => {
    if (!validadeStr) return null;
    const parts = validadeStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  };

  // Lógica dos Filtros Combinados
  const registrosFiltrados = useMemo(() => {
    return registros.filter((reg) => {
      // 1) Filtro de busca global (EAN, Descrição do Produto, ID do Registro, Vaga)
      if (filtroBusca.trim()) {
        const query = filtroBusca.toLowerCase();
        const eanMatch = reg.produtoEan.toLowerCase().includes(query);
        const descMatch = reg.produtoDescr.toLowerCase().includes(query);
        const idMatch = reg.id.toLowerCase().includes(query);
        const vagaMatch = reg.camaraVaga.toLowerCase().includes(query);
        if (!eanMatch && !descMatch && !idMatch && !vagaMatch) return false;
      }

      // 2) Filtro Marca
      if (filtroMarca && reg.marcaDescr !== filtroMarca) return false;

      // 3) Filtro Classe
      if (filtroClasse && reg.produtoClasse !== filtroClasse) return false;

      // 4) Filtro Câmara
      if (filtroCamara && reg.camara !== filtroCamara) return false;

      // 5) Filtro Vaga Exata
      if (filtroVaga.trim() && !reg.camaraVaga.toLowerCase().includes(filtroVaga.trim().toLowerCase())) return false;

      // 6) Filtro Inteligente de Vencimento
      if (filtroVencimentoSmart !== 'todos') {
        const validade = parseValidade(reg.produtoValidade);
        if (!validade) return false;

        if (filtroVencimentoSmart === 'vencidos') {
          if (validade >= dateRanges.hoje) return false;
        } else if (filtroVencimentoSmart === 'estaSemana') {
          if (validade < dateRanges.inicioSemanaAtual || validade > dateRanges.fimSemanaAtual) return false;
        } else if (filtroVencimentoSmart === 'proximaSemana') {
          if (validade < dateRanges.inicioProximaSemana || validade > dateRanges.fimProximaSemana) return false;
        } else if (filtroVencimentoSmart === 'esteMes') {
          if (validade < dateRanges.inicioMesAtual || validade > dateRanges.fimMesAtual) return false;
        }
      }

      // 7) Filtro de Vencimento Exato (Data picker)
      if (filtroVencimentoExato) {
        const parts = filtroVencimentoExato.split('-');
        if (parts.length === 3) {
          const dataBr = `${parts[2]}/${parts[1]}/${parts[0]}`;
          if (reg.produtoValidade !== dataBr) return false;
        } else {
          return false;
        }
      }

      // 8) Filtro Inteligente de Recebimento
      if (filtroRecebimentoSmart !== 'todos') {
        // reg.timestamp é formato "DD/MM/YYYY HH:MM:SS"
        const dataRecebimentoBR = reg.timestamp.split(' ')[0].replace(',', '');
        const validade = parseValidade(dataRecebimentoBR);
        if (!validade) return false;

        if (filtroRecebimentoSmart === 'estaSemana') {
          if (validade < dateRanges.inicioSemanaAtual || validade > dateRanges.fimSemanaAtual) return false;
        } else if (filtroRecebimentoSmart === 'anteriorSemana') {
          const umaSemanaAtras = new Date(dateRanges.inicioSemanaAtual);
          umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
          const fimSemanaAnterior = new Date(dateRanges.inicioSemanaAtual);
          fimSemanaAnterior.setDate(fimSemanaAnterior.getDate() - 1);
          if (validade < umaSemanaAtras || validade > fimSemanaAnterior) return false;
        } else if (filtroRecebimentoSmart === 'esteMes') {
          if (validade < dateRanges.inicioMesAtual || validade > dateRanges.fimMesAtual) return false;
        }
      }

      // 9) Filtro de Recebimento Exato
      if (filtroRecebimentoExato) {
        const parts = filtroRecebimentoExato.split('-');
        if (parts.length === 3) {
          const dataBr = `${parts[2]}/${parts[1]}/${parts[0]}`;
          const dataRecebimentoBR = reg.timestamp.split(' ')[0].replace(',', '');
          if (dataRecebimentoBR !== dataBr) return false;
        } else {
          return false;
        }
      }

      return true;
    });
  }, [
    registros,
    filtroBusca,
    filtroMarca,
    filtroCamara,
    filtroVaga,
    filtroClasse,
    filtroVencimentoSmart,
    filtroVencimentoExato,
    filtroRecebimentoSmart,
    filtroRecebimentoExato,
    dateRanges,
  ]);

  // Reseta para a primeira página quando os filtros mudam
  useEffect(() => {
    setPagina(1);
  }, [
    filtroBusca,
    filtroMarca,
    filtroCamara,
    filtroVaga,
    filtroClasse,
    filtroVencimentoSmart,
    filtroVencimentoExato,
    filtroRecebimentoSmart,
    filtroRecebimentoExato,
  ]);

  // Paginação dos registros filtrados
  const totalPaginas = Math.ceil(registrosFiltrados.length / itensPorPagina) || 1;
  const registrosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * itensPorPagina;
    return registrosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [registrosFiltrados, pagina]);

  const limparFiltros = () => {
    setFiltroBusca('');
    setFiltroMarca('');
    setFiltroCamara('');
    setFiltroVaga('');
    setFiltroClasse('');
    setFiltroVencimentoSmart('todos');
    setFiltroVencimentoExato('');
    setFiltroRecebimentoSmart('todos');
    setFiltroRecebimentoExato('');
    setPagina(1);
  };

  // Retorna a sinalização do status de validade de um registro
  const obterSinalizacaoVencimento = (validadeStr: string) => {
    const validade = parseValidade(validadeStr);
    if (!validade) return null;

    if (validade < dateRanges.hoje) {
      return {
        tipo: 'vencido',
        badgeClass: 'bg-danger-100 dark:bg-danger-900/40 text-danger-800 dark:text-danger-300 border border-danger-200 dark:border-danger-800',
        texto: language === 'pt' ? 'Vencido' : 'Vencido',
        icone: (
          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      };
    }

    if (validade >= dateRanges.inicioSemanaAtual && validade <= dateRanges.fimSemanaAtual) {
      return {
        tipo: 'estaSemana',
        badgeClass: 'bg-danger-100 dark:bg-danger-900/40 text-danger-800 dark:text-danger-300 border border-danger-200 dark:border-danger-800 font-bold animate-pulse',
        texto: language === 'pt' ? 'Vence esta semana' : 'Vence esta semana',
        icone: (
          <svg className="w-3.5 h-3.5 mr-1 text-danger-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      };
    }

    if (validade >= dateRanges.inicioProximaSemana && validade <= dateRanges.fimProximaSemana) {
      return {
        tipo: 'proximaSemana',
        badgeClass: 'bg-warning-100 dark:bg-warning-900/40 text-warning-800 dark:text-warning-300 border border-warning-200 dark:border-warning-800',
        texto: language === 'pt' ? 'Vence próxima semana' : 'Vence próxima semana',
        icone: (
          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    }

    if (validade >= dateRanges.inicioMesAtual && validade <= dateRanges.fimMesAtual) {
      return {
        tipo: 'esteMes',
        badgeClass: 'bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-900/40',
        texto: language === 'pt' ? 'Vence este mês' : 'Vence este mes',
        icone: (
          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      };
    }

    return null;
  };

  const handleExportar = () => {
    // Transforma registros filtrados em CSV com codificação cp1252 e ponto e vírgula
    const headers = ['ID', 'Data Recebimento', 'Marca', 'Produto', 'EAN', 'Classe', 'Camara', 'Vaga', 'Validade'];
    const rows = registrosFiltrados.map((r) => [
      r.id,
      r.timestamp,
      r.marcaDescr,
      r.produtoDescr,
      r.produtoEan,
      r.produtoClasse,
      r.camara,
      r.camaraVaga,
      r.produtoValidade,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    
    // Converte para Windows-1252 (cp1252) para o Excel abrir direto sem bugs
    // Usamos um encoder de TextEncoder de forma simples ou salvamos em blob binário convertido.
    // Como estamos no navegador, usaremos uma conversão simples para binário cp1252 ou fallback seguro:
    // O navegador Next.js usa Blob de forma simples. Para cp1252, podemos usar um truque ou simplesmente codificar.
    // Criamos o Blob binário usando windows-1252.
    // Para simplificar a criação com cp1252 no JS do cliente:
    const buffer = new ArrayBuffer(csvContent.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < csvContent.length; i++) {
      let charCode = csvContent.charCodeAt(i);
      // Conversão simples para cp1252 (substituindo acentuações se necessário, ou truncando para 255)
      if (charCode > 255) charCode = 63; // substitui com '?' se for inválido no range de cp1252
      view[i] = charCode;
    }
    const blob = new Blob([view], { type: 'text/csv;charset=windows-1252;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_paletscan_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* 1) Header do Relatório */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {language === 'pt' ? 'Relatório Geral' : 'Reporte General'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'pt' ? 'Consulte, filtre e exporte os produtos recebidos nas câmaras frias' : 'Consulte, filtre y exporte los productos recibidos en las cámaras frigoríficas'}
          </p>
        </div>
        <button
          onClick={handleExportar}
          disabled={registrosFiltrados.length === 0}
          className="w-full sm:w-auto btn-primary py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md disabled:opacity-40"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t('exportarCSV')} ({registrosFiltrados.length})
        </button>
      </div>

      {/* 2) Painel de Filtros */}
      <div className="card p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {language === 'pt' ? 'Filtros de Pesquisa' : 'Filtros de Búsqueda'}
          </h3>
          {(filtroBusca || filtroMarca || filtroCamara || filtroVaga || filtroClasse || filtroVencimentoSmart !== 'todos' || filtroVencimentoExato || filtroRecebimentoSmart !== 'todos' || filtroRecebimentoExato) && (
            <button
              onClick={limparFiltros}
              className="text-xs font-semibold text-danger-600 dark:text-danger-400 hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t('limparFiltros')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Busca Global */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {language === 'pt' ? 'Busca Rápida' : 'Búsqueda Rápida'}
            </label>
            <input
              type="text"
              placeholder={language === 'pt' ? 'Pesquisar EAN, produto, ID...' : 'Buscar EAN, producto, ID...'}
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              className="input-field py-2 text-sm"
            />
          </div>

          {/* Filtro Marca */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('marca')}</label>
            <select
              value={filtroMarca}
              onChange={(e) => setFiltroMarca(e.target.value)}
              className="input-field py-2 text-sm bg-none cursor-pointer"
            >
              <option value="">{language === 'pt' ? 'Todas as marcas' : 'Todas las marcas'}</option>
              {marcasDisponiveis.map((marca) => (
                <option key={marca} value={marca}>{marca}</option>
              ))}
            </select>
          </div>

          {/* Filtro Classe */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('classe')}</label>
            <select
              value={filtroClasse}
              onChange={(e) => setFiltroClasse(e.target.value)}
              className="input-field py-2 text-sm bg-none cursor-pointer"
            >
              <option value="">{language === 'pt' ? 'Todas as classes' : 'Todas las clases'}</option>
              {classesDisponiveis.map((classe) => (
                <option key={classe} value={classe}>{classe}</option>
              ))}
            </select>
          </div>

          {/* Filtro Câmara */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('camara')}</label>
            <select
              value={filtroCamara}
              onChange={(e) => setFiltroCamara(e.target.value)}
              className="input-field py-2 text-sm bg-none cursor-pointer"
            >
              <option value="">{language === 'pt' ? 'Todas as câmaras' : 'Todas las cámaras'}</option>
              {camarasDisponiveis.map((camara) => (
                <option key={camara} value={camara}>{camara}</option>
              ))}
            </select>
          </div>

          {/* Filtro Vaga */}
          <div className="space-y-1 col-span-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('vaga')}</label>
            <input
              type="text"
              placeholder={language === 'pt' ? 'Digite o código da vaga...' : 'Ingrese el código de posición...'}
              value={filtroVaga}
              onChange={(e) => setFiltroVaga(e.target.value)}
              className="input-field py-2 text-sm"
            />
          </div>

          {/* Filtro inteligente de Vencimento */}
          <div className="space-y-1 col-span-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {language === 'pt' ? 'Vencimento Inteligente' : 'Vencimiento Inteligente'}
            </label>
            <select
              value={filtroVencimentoSmart}
              onChange={(e) => {
                setFiltroVencimentoSmart(e.target.value);
                if (e.target.value !== 'todos') setFiltroVencimentoExato('');
              }}
              className="input-field py-2 text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <option value="todos">{language === 'pt' ? 'Qualquer validade' : 'Cualquier vencimiento'}</option>
              <option value="vencidos">❌ {language === 'pt' ? 'Já vencidos' : 'Ya vencidos'}</option>
              <option value="estaSemana">🚨 {language === 'pt' ? 'Vence nesta semana' : 'Vence esta semana'}</option>
              <option value="proximaSemana">⏳ {language === 'pt' ? 'Vence na próxima semana' : 'Vence la próxima semana'}</option>
              <option value="esteMes">📅 {language === 'pt' ? 'Vence este mês' : 'Vence este mes'}</option>
            </select>
          </div>

          {/* Filtro de Vencimento Exato */}
          <div className="space-y-1 col-span-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {language === 'pt' ? 'Vencimento Exato' : 'Vencimiento Exacto'}
            </label>
            <input
              type="date"
              value={filtroVencimentoExato}
              onChange={(e) => {
                setFiltroVencimentoExato(e.target.value);
                if (e.target.value) setFiltroVencimentoSmart('todos');
              }}
              className="input-field py-2 text-sm cursor-pointer"
            />
          </div>

          {/* Filtro inteligente de Recebimento */}
          <div className="space-y-1 col-span-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {language === 'pt' ? 'Recebimento Inteligente' : 'Recepción Inteligente'}
            </label>
            <select
              value={filtroRecebimentoSmart}
              onChange={(e) => {
                setFiltroRecebimentoSmart(e.target.value);
                if (e.target.value !== 'todos') setFiltroRecebimentoExato('');
              }}
              className="input-field py-2 text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <option value="todos">{language === 'pt' ? 'Qualquer recebimento' : 'Cualquier recepción'}</option>
              <option value="estaSemana">📥 {language === 'pt' ? 'Recebido nesta semana' : 'Recibido esta semana'}</option>
              <option value="anteriorSemana">📅 {language === 'pt' ? 'Recebido na semana anterior' : 'Recibido la semana anterior'}</option>
              <option value="esteMes">🗓️ {language === 'pt' ? 'Recebido este mês' : 'Recibido este mes'}</option>
            </select>
          </div>

          {/* Filtro de Recebimento Exato */}
          <div className="space-y-1 col-span-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {language === 'pt' ? 'Recebimento Exato' : 'Recepción Exacta'}
            </label>
            <input
              type="date"
              value={filtroRecebimentoExato}
              onChange={(e) => {
                setFiltroRecebimentoExato(e.target.value);
                if (e.target.value) setFiltroRecebimentoSmart('todos');
              }}
              className="input-field py-2 text-sm cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3) Tabela de Registros */}
      <div className="card-elevated overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {language === 'pt' ? 'Registros Cadastrados' : 'Registros Registrados'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'pt'
                ? `Mostrando ${registrosFiltrados.length === 0 ? '0' : `${(pagina - 1) * itensPorPagina + 1} a ${Math.min(pagina * itensPorPagina, registrosFiltrados.length)}`} de ${registrosFiltrados.length} registro(s) encontrado(s)`
                : `Mostrando ${registrosFiltrados.length === 0 ? '0' : `${(pagina - 1) * itensPorPagina + 1} a ${Math.min(pagina * itensPorPagina, registrosFiltrados.length)}`} de ${registrosFiltrados.length} registro(s) encontrado(s)`
              }
            </p>
          </div>
          <button
            onClick={carregarDados}
            disabled={isLoading}
            className="btn-secondary py-2 text-xs flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 shadow-sm"
          >
            {isLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
              </svg>
            )}
            {language === 'pt' ? 'Atualizar Relatório' : 'Actualizar Reporte'}
          </button>
        </div>

        {error && (
          <div className="p-6 text-center">
            <div className="inline-flex items-center gap-2 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-400">
              <svg className="w-5 h-5 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {!error && registrosFiltrados.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">
              {language === 'pt' ? 'Nenhum registro encontrado.' : 'Ningún registro encontrado.'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'pt' ? 'Experimente limpar ou ajustar os filtros de pesquisa.' : 'Intente limpiar o ajustar los filtros de búsqueda.'}
            </p>
          </div>
        )}

        {!error && registrosFiltrados.length > 0 && (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full table-auto border-separate border-spacing-0">
              <thead className="bg-slate-100 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {language === 'pt' ? 'Recebido em' : 'Recibido en'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('marca')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {language === 'pt' ? 'Produto / EAN' : 'Producto / EAN'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{t('classe')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {language === 'pt' ? 'Câmara / Vaga' : 'Cámara / Posición'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {language === 'pt' ? 'Validade' : 'Vencimiento'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {registrosPaginados.map((reg) => {
                  const sinalizacao = obterSinalizacaoVencimento(reg.produtoValidade);
                  return (
                    <tr
                      key={reg.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                        sinalizacao?.tipo === 'estaSemana'
                          ? 'bg-danger-50/20 dark:bg-danger-900/5'
                          : sinalizacao?.tipo === 'proximaSemana'
                          ? 'bg-warning-50/20 dark:bg-warning-900/5'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        #{reg.id}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                        {reg.timestamp}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {reg.marcaDescr}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 min-w-[240px]">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{reg.produtoDescr}</div>
                        <div className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">{reg.produtoEan}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                        <span className="badge badge-primary">{reg.produtoClasse}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <span className="font-semibold">{reg.camara}</span>
                        {reg.camaraVaga && (
                          <span className="text-slate-400 dark:text-slate-500 ml-1 font-mono text-xs">
                            ({reg.camaraVaga})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="badge badge-success font-bold font-mono w-max">
                            {reg.produtoValidade}
                          </span>
                          {sinalizacao && (
                            <span className={`badge ${sinalizacao.badgeClass} text-[9px] py-0 px-1.5 flex items-center w-max`}>
                              {sinalizacao.icone}
                              {sinalizacao.texto}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {!error && registrosFiltrados.length > 0 && (
          <div className="px-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'pt' ? 'Página' : 'Página'} {pagina} {language === 'pt' ? 'de' : 'de'} {totalPaginas}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPagina((prev) => Math.max(prev - 1, 1))}
                disabled={pagina === 1}
                className="btn-secondary px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 disabled:opacity-40"
              >
                {language === 'pt' ? 'Anterior' : 'Anterior'}
              </button>
              <button
                onClick={() => setPagina((prev) => Math.min(prev + 1, totalPaginas))}
                disabled={pagina === totalPaginas}
                className="btn-secondary px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 disabled:opacity-40"
              >
                {language === 'pt' ? 'Próximo' : 'Siguiente'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
