import { useState, useMemo, useEffect } from 'react';
import { CAMARAS, VAGAS } from '../lib/config';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface VagaSelectorProps {
  onConfirm: (camara: string, vaga: string) => void;
}

export default function VagaSelector({ onConfirm }: VagaSelectorProps) {
  const { theme, toggleTheme } = useTheme();
  const { language, t } = useLanguage();
  const [camaraSelecionada, setCamaraSelecionada] = useState<string>('');
  const [vagaSelecionada, setVagaSelecionada] = useState<string>('');
  const [buscaVaga, setBuscaVaga] = useState<string>('');
  const [vagasOcupadas, setVagasOcupadas] = useState<{ camara: string; vaga: string }[]>([]);

  useEffect(() => {
    fetch('/api/vagas-ocupadas')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVagasOcupadas(data);
        }
      })
      .catch((err) => console.error('Erro ao buscar vagas ocupadas:', err));
  }, []);

  const isOcupada = useMemo(() => {
    if (!camaraSelecionada || !vagaSelecionada) return false;
    return vagasOcupadas.some(
      (v) =>
        v.camara.toLowerCase() === camaraSelecionada.toLowerCase() &&
        v.vaga.toLowerCase() === vagaSelecionada.toLowerCase()
    );
  }, [camaraSelecionada, vagaSelecionada, vagasOcupadas]);

  const vagasFiltradas = useMemo(() => {
    if (!buscaVaga.trim()) return VAGAS;
    return VAGAS.filter((v) =>
      v.toLowerCase().includes(buscaVaga.trim().toLowerCase())
    );
  }, [buscaVaga]);

  const podeConfirmar = camaraSelecionada !== '' && vagaSelecionada !== '' && !isOcupada;

  const handleConfirmar = () => {
    if (!podeConfirmar) return;
    onConfirm(camaraSelecionada, vagaSelecionada);
  };

  // Ícone de câmara fria / congelados
  const getCamaraIcon = (camara: string) => {
    const isCongelado = camara.toLowerCase().includes('congelado');
    return isCongelado ? (
      // Snowflake icon
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
      </svg>
    ) : (
      // Thermometer icon
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 3a3 3 0 00-3 3v8.586A5 5 0 1015 14.586V6a3 3 0 00-3-3H9z" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      {/* Card principal */}
      <div className="w-full max-w-lg animate-slideUp">

        {/* Header do card */}
        <div className="card-elevated overflow-hidden">
          <div className="bg-gradient-to-br from-primary-500 to-indigo-600 p-6 text-white animate-pulse-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold">
                    {language === 'pt' ? 'Selecionar Destino' : 'Seleccionar Destino'}
                  </h1>
                  <p className="text-primary-200 text-sm">
                    {language === 'pt' ? 'Câmara e vaga para esta sessão' : 'Cámara y posición para esta sesión'}
                  </p>
                </div>
              </div>

              {/* Botão de Tema */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-white/10 dark:bg-white/5 text-white hover:bg-white/20 transition-colors"
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

          <div className="p-6 space-y-6">

            {/* Seleção de Câmara */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                {t('camara')}
              </label>
              <div className="grid grid-cols-1 gap-2">
                {CAMARAS.map((camara) => {
                  const isSelected = camaraSelecionada === camara;
                  const isCongelado = camara.toLowerCase().includes('congelado');
                  return (
                    <button
                      key={camara}
                      id={`camara-${camara.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => {
                        setCamaraSelecionada(camara);
                        setVagaSelecionada('');
                      }}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200
                        ${isSelected
                          ? isCongelado
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'border-warning-500 bg-warning-50 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-700'
                        }
                      `}
                    >
                      <span className={`flex-shrink-0 ${isSelected
                        ? isCongelado ? 'text-primary-500' : 'text-warning-500'
                        : 'text-slate-400 dark:text-slate-500'}`}>
                        {getCamaraIcon(camara)}
                      </span>
                      <span className="font-medium">{camara}</span>
                      {isSelected && (
                        <span className="ml-auto">
                          <svg className="w-5 h-5 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seleção de Vaga */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                {t('vaga')}
              </label>

              {/* Campo de busca */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="busca-vaga"
                  type="text"
                  placeholder={language === 'pt' ? 'Buscar vaga... ex: A10' : 'Buscar posición... ej: A10'}
                  value={buscaVaga}
                  onChange={(e) => setBuscaVaga(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Grid de vagas */}
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                {vagasFiltradas.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 text-sm py-4">
                    {language === 'pt' ? 'Nenhuma vaga encontrada' : 'Ninguna posición encontrada'}
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {vagasFiltradas.map((vaga) => {
                      const isSelected = vagaSelecionada === vaga;
                      return (
                        <button
                          key={vaga}
                          id={`vaga-${vaga}`}
                          onClick={() => setVagaSelecionada(vaga)}
                          className={`
                            py-2 px-1 rounded-lg text-xs font-semibold transition-all duration-150 text-center
                            ${isSelected
                              ? 'bg-primary-600 text-white shadow-md scale-105'
                              : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300'
                            }
                          `}
                        >
                          {vaga}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Vaga selecionada: badge de confirmação ou erro de vaga ocupada */}
              {vagaSelecionada && (
                isOcupada ? (
                  <div className="mt-3 flex items-start gap-2 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg px-3 py-2 animate-scale-in">
                    <svg className="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs font-medium text-danger-700 dark:text-danger-300">
                      {language === 'pt' ? 'Esta combinação de câmara e vaga já está sendo utilizada.' : 'Esta combinación de cámara y posición ya está en uso.'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-900/20 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd" />
                    </svg>
                    <span>
                      {language === 'pt' ? 'Vaga selecionada' : 'Posición seleccionada'}: <strong>{vagaSelecionada}</strong>
                    </span>
                  </div>
                )
              )}
            </div>

            {/* Resumo da seleção */}
            {podeConfirmar && (
              <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-4 space-y-1 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  {language === 'pt' ? 'Resumo da Sessão' : 'Resumen de la Sesión'}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('camara')}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{camaraSelecionada}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('vaga')}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{vagaSelecionada}</span>
                </div>
              </div>
            )}

            {/* Botão confirmar */}
            <button
              id="btn-confirmar-vaga"
              onClick={handleConfirmar}
              disabled={!podeConfirmar}
              className={`
                w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2
                ${podeConfirmar
                  ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }
              `}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {podeConfirmar 
                ? (language === 'pt' ? 'Confirmar e Iniciar Scanner' : 'Confirmar e Iniciar Lector') 
                : (language === 'pt' ? 'Selecione câmara e vaga' : 'Seleccione cámara y posición')
              }
            </button>

          </div>
        </div>

        {/* Rodapé informativo */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-4">
          {language === 'pt' 
            ? 'A câmara e vaga ficam fixas durante toda a sessão de escaneamento' 
            : 'La cámara y posición quedan fijas durante toda la sesión de escaneo'
          }
        </p>
      </div>
    </div>
  );
}
