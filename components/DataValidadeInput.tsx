import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface DataValidadeInputProps {
  ean: string;
  onConfirm: (validade: string) => void;
  onCancel: () => void;
}

export default function DataValidadeInput({ ean, onConfirm, onCancel }: DataValidadeInputProps) {
  const { language, t } = useLanguage();
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const diaRef = useRef<HTMLInputElement>(null);
  const mesRef = useRef<HTMLInputElement>(null);
  const anoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    diaRef.current?.focus();
  }, []);

  const isValidDate = (year: number, month: number, day: number): boolean => {
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  const handleConfirm = () => {
    const d = parseInt(dia, 10);
    const m = parseInt(mes, 10);
    const a = parseInt(ano, 10);

    if (isNaN(d) || isNaN(m) || isNaN(a)) {
      setErro(language === 'pt' ? 'Preencha todos os campos' : 'Complete todos los campos');
      return;
    }

    if (!isValidDate(a, m, d)) {
      setErro(language === 'pt' ? 'Data inválida. Verifique dia, mês e ano' : 'Fecha inválida. Verifique día, mes y año');
      return;
    }

    const validade = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${a}`;
    onConfirm(validade);
  };

  const handleInput = (
    value: string,
    setter: (v: string) => void,
    maxLen: number,
    nextRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    const clean = value.replace(/\D/g, '').slice(0, maxLen);
    setter(clean);
    setErro(null);

    if (clean.length === maxLen && nextRef?.current) {
      nextRef.current.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    prevRef?: React.RefObject<HTMLInputElement | null>,
    nextRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef?.current) {
        nextRef.current.focus();
      } else {
        handleConfirm();
      }
    }
    if (e.key === 'Backspace' && e.currentTarget.value === '' && prevRef?.current) {
      prevRef.current.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
      {/* Modal card com margem para não encostar nas bordas */}
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in m-4">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'pt' ? 'Inserir Validade' : 'Ingresar Vencimiento'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'pt' ? 'EAN detectado sem data de vencimento' : 'EAN detectado sin fecha de vencimiento'}
              </p>
            </div>
          </div>
        </div>

        {/* EAN */}
        <div className="px-5 pb-4">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">EAN</span>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tracking-wider">{ean}</span>
          </div>
        </div>

        {/* Date Inputs */}
        <div className="px-5 pb-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
            {t('dataVencimento')}
          </label>

          <div className="flex items-center justify-center gap-1 sm:gap-2">
            {/* Dia */}
            <div className="flex-1 max-w-[80px]">
              <input
                ref={diaRef}
                type="text"
                inputMode="numeric"
                placeholder="DD"
                value={dia}
                onChange={(e) => handleInput(e.target.value, setDia, 2, mesRef)}
                onKeyDown={(e) => handleKeyDown(e, undefined, mesRef)}
                className="w-full h-14 text-center text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                maxLength={2}
                aria-label="Dia"
              />
              <span className="block text-center text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium uppercase tracking-wide">
                {language === 'pt' ? 'Dia' : 'Día'}
              </span>
            </div>

            {/* Separator */}
            <div className="flex items-center justify-center h-14 pb-4">
              <span className="text-2xl font-bold text-slate-400 dark:text-slate-600">/</span>
            </div>

            {/* Mês */}
            <div className="flex-1 max-w-[80px]">
              <input
                ref={mesRef}
                type="text"
                inputMode="numeric"
                placeholder="MM"
                value={mes}
                onChange={(e) => handleInput(e.target.value, setMes, 2, anoRef)}
                onKeyDown={(e) => handleKeyDown(e, diaRef, anoRef)}
                className="w-full h-14 text-center text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                maxLength={2}
                aria-label="Mês"
              />
              <span className="block text-center text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium uppercase tracking-wide">
                {language === 'pt' ? 'Mês' : 'Mes'}
              </span>
            </div>

            {/* Separator */}
            <div className="flex items-center justify-center h-14 pb-4">
              <span className="text-2xl font-bold text-slate-400 dark:text-slate-600">/</span>
            </div>

            {/* Ano */}
            <div className="flex-[1.5] max-w-[110px]">
              <input
                ref={anoRef}
                type="text"
                inputMode="numeric"
                placeholder="AAAA"
                value={ano}
                onChange={(e) => handleInput(e.target.value, setAno, 4)}
                onKeyDown={(e) => handleKeyDown(e, mesRef)}
                className="w-full h-14 text-center text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all"
                maxLength={4}
                aria-label="Ano"
              />
              <span className="block text-center text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium uppercase tracking-wide">
                {language === 'pt' ? 'Ano' : 'Año'}
              </span>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="mt-3 flex items-start gap-2 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-medium text-danger-700 dark:text-danger-300">{erro}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            className="w-full h-12 inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {language === 'pt' ? 'Confirmar Validade' : 'Confirmar Vencimiento'}
          </button>
          <button
            onClick={onCancel}
            className="w-full h-10 inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl transition-all active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t('cancelar')}
          </button>
        </div>
      </div>
    </div>
  );
}