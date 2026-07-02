import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ENABLE_QRCODE_GENERATION } from '../lib/config';

export type Language = 'pt' | 'es';

export const translations = {
  pt: {
    // Menu Principal
    appTitle: 'PaletScan',
    menuSubtitle: 'Logística inteligente e controle automatizado de recebimento para câmaras frias.',
    menuRegEntrada: 'Registrar Entrada',
    menuRegEntradaDesc: 'Escaneie códigos Data Matrix, QR Code ou códigos de barras dos produtos. Valide compatibilidade com a câmara fria e defina a vaga correta de armazenamento.',
    menuStartProcess: 'Iniciar Processo',
    menuRelGeral: 'Relatório Geral',
    menuRelGeralDesc: 'Consulte todos os produtos já armazenados. Realize buscas avançadas, aplique filtros inteligentes por datas de validade e recebimento, e acompanhe alertas de vencimento.',
    menuViewReports: 'Visualizar Relatórios',
    menuPesquisa: 'Pesquisa e Consulta',
    menuPesquisaDesc: ENABLE_QRCODE_GENERATION 
      ? 'Consulte a ficha técnica de produtos via busca avançada (Fuzzy Search) ou leitura de código EAN/DUN. Gerencie o radar de produtos procurados (Watchlist) e gere QR Codes para integração.'
      : 'Consulte a ficha técnica de produtos via busca avançada (Fuzzy Search) ou leitura de código EAN/DUN. Gerencie o radar de produtos procurados (Watchlist).',
    menuOpenQuery: 'Abrir Consulta',

    // Header & Sessao
    recebimento: 'Recebimento',
    trocar: 'trocar',
    leitorAtivo: 'Leitor Ativo',
    galeria: 'Galeria',
    cancelar: 'Cancelar',
    centralizeCodigo: 'Centralize o código no quadro',
    camara: 'Câmara',
    vaga: 'Vaga',

    // Stats
    produtosNaBase: 'Produtos na Base',
    escaneados: 'Escaneados',
    pendentes: 'Pendentes',

    // Detalhes Produto
    produto: 'Produto',
    marca: 'Marca',
    classe: 'Classe',
    conservacao: 'Conservação',
    eanConsumidor: 'EAN (Consumidor)',
    dunDistribuicao: 'DUN (Distribuição)',
    dataVencimento: 'Data de Vencimento',
    dataRecebimento: 'Data de Recebimento',
    fichaTecnica: 'Ficha Técnica',
    dadosCadastrais: 'Dados cadastrais da base de dados.',
    produtoDetectado: 'Produto Detectado',
    confirmeDados: 'Confirme os dados antes de adicionar',

    // Vaga Selector & Cadastro
    selecionarPosicao: 'Selecionar Posição de Armazenamento',
    definirDestino: 'Defina a câmara fria e a vaga de destino para iniciar a sessão de recebimento.',
    confirmarSessao: 'Confirmar e Iniciar',
    selecionarCamara: 'Selecionar Câmara',
    selecionarVaga: 'Selecionar Vaga',

    // Watchlist & Modais
    vencimentoUltrapassado: 'Atenção: Vencimento Ultrapassado!',
    produtoVencido: 'Este produto está com a data de vencimento ultrapassada. Não armazene na câmara fria.',
    adicionarFila: 'Adicionar à Fila',
    confirmarEntrada: 'Confirmar Entrada',
    produtoCompativel: 'Produto compatível com a câmara fria selecionada.',
    produtoIncompativel: 'Produto incompatível com esta câmara fria!',

    // Relatório & Pesquisa
    pesquisarProdutos: 'Pesquisar produtos na base...',
    buscarArmazenados: 'Buscar itens armazenados...',
    limparFiltros: 'Limpar Filtros',
    exportarCSV: 'Exportar CSV',
    totalItens: 'Total de Itens',
    nenhumItem: 'Nenhum item encontrado.',
    carregando: 'Carregando...',
    acoes: 'Ações',
    excluir: 'Excluir',

    // Mensagens de Alerta / Toast
    toastErroValidar: 'Erro ao validar o código de barras.',
    toastSucessoSalvar: 'Produto salvo com sucesso.',
    toastVagaOcupada: 'Esta vaga já está sendo utilizada por outro produto.',
  },
  es: {
    // Menu Principal
    appTitle: 'PaletScan',
    menuSubtitle: 'Logística inteligente y control automatizado de recepción para cámaras frigoríficas.',
    menuRegEntrada: 'Registrar Entrada',
    menuRegEntradaDesc: 'Escanee códigos Data Matrix, códigos QR o códigos de barras de los productos. Valide compatibilidad con la cámara frigorífica y defina la posición correcta de almacenamiento.',
    menuStartProcess: 'Iniciar Proceso',
    menuRelGeral: 'Reporte General',
    menuRelGeralDesc: 'Consulte todos los productos ya almacenados. Realice búsquedas avanzadas, aplique filtros inteligentes por fechas de vencimiento y recepción, y realice el seguimiento de alertas de vencimiento.',
    menuViewReports: 'Ver Reportes',
    menuPesquisa: 'Búsqueda y Consulta',
    menuPesquisaDesc: ENABLE_QRCODE_GENERATION
      ? 'Consulte la ficha técnica de productos mediante búsqueda avanzada (Fuzzy Search) o lectura de código EAN/DUN. Gestione el radar de productos buscados (Watchlist) y genere códigos QR para su integración.'
      : 'Consulte la ficha técnica de productos mediante búsqueda avanzada (Fuzzy Search) o lectura de código EAN/DUN. Gestione el radar de productos buscados (Watchlist).',
    menuOpenQuery: 'Abrir Consulta',

    // Header & Sessao
    recebimento: 'Recepción',
    trocar: 'cambiar',
    leitorAtivo: 'Lector Activo',
    galeria: 'Galería',
    cancelar: 'Cancelar',
    centralizeCodigo: 'Centralice el código en el cuadro',
    camara: 'Cámara',
    vaga: 'Posición',

    // Stats
    produtosNaBase: 'Productos en Base',
    escaneados: 'Escaneados',
    pendentes: 'Pendientes',

    // Detalhes Produto
    produto: 'Producto',
    marca: 'Marca',
    classe: 'Clase',
    conservacao: 'Conservación',
    eanConsumidor: 'EAN (Consumidor)',
    dunDistribuicao: 'DUN (Distribución)',
    dataVencimento: 'Fecha de Vencimiento',
    dataRecebimento: 'Fecha de Recepción',
    fichaTecnica: 'Ficha Técnica',
    dadosCadastrais: 'Datos de registro de la base de datos.',
    produtoDetectado: 'Producto Detectado',
    confirmeDados: 'Confirme los datos antes de agregar',

    // Vaga Selector & Cadastro
    selecionarPosicao: 'Seleccionar Posición de Almacenamiento',
    definirDestino: 'Defina la cámara frigorífica y la posición de destino para iniciar la sesión de recepción.',
    confirmarSessao: 'Confirmar e Iniciar',
    selecionarCamara: 'Seleccionar Cámara',
    selecionarVaga: 'Seleccionar Posición',

    // Watchlist & Modais
    vencimentoUltrapassado: 'Atención: ¡Vencimiento Superado!',
    produtoVencido: 'Este producto tiene la fecha de vencimiento vencida. No lo almacene en la cámara frigorífica.',
    adicionarFila: 'Agregar a la Fila',
    confirmarEntrada: 'Confirmar Entrada',
    produtoCompativel: 'Producto compatible con la cámara frigorífica seleccionada.',
    produtoIncompativel: '¡Producto incompatible con esta cámara frigorífica!',

    // Relatório & Pesquisa
    pesquisarProdutos: 'Buscar productos en la base...',
    buscarArmazenados: 'Buscar artículos almacenados...',
    limparFiltros: 'Limpiar Filtros',
    exportarCSV: 'Exportar CSV',
    totalItens: 'Total de Artículos',
    nenhumItem: 'Ningún artículo encontrado.',
    carregando: 'Cargando...',
    acoes: 'Acciones',
    excluir: 'Eliminar',

    // Mensagens de Alerta / Toast
    toastErroValidar: 'Error al validar el código de barras.',
    toastSucessoSalvar: 'Producto guardado con éxito.',
    toastVagaOcupada: 'Esta posición ya está siendo utilizada por otro producto.',
  }
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['pt']) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('pt');

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language | null;
    if (savedLang === 'pt' || savedLang === 'es') {
      setLanguage(savedLang);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: keyof typeof translations['pt']): string => {
    const translationSet = translations[language] || translations['pt'];
    return translationSet[key] || translations['pt'][key] || String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
