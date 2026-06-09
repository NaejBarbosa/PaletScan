import { useState } from 'react';

interface DataValidadeInputProps {
  ean: string;
  onConfirm: (validade: string) => void;
  onCancel: () => void;
}

export default function DataValidadeInput({ ean, onConfirm, onCancel }: DataValidadeInputProps) {
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [erro, setErro] = useState<string | null>(null);

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
      setErro('Preencha todos os campos');
      return;
    }

    if (!isValidDate(a, m, d)) {
      setErro('Data invalida. Verifique dia, mes e ano');
      return;
    }

    const validade = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${a}`;
    onConfirm(validade);
  };

  const handleInput = (value: string, setter: (v: string) => void, maxLen: number) => {
    const clean = value.replace(/\D/g, '').slice(0, maxLen);
    setter(clean);
    setErro(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-elevated max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Inserir Validade</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">O codigo lido contem apenas o EAN. Informe a data de vencimento manualmente.</p>
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 mb-5">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">EAN Detectado</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{ean}</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Data de Vencimento (obrigatoria)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD"
              value={dia}
              onChange={(e) => handleInput(e.target.value, setDia, 2)}
              className="input flex-1 text-center font-mono"
              maxLength={2}
            />
            <span className="text-slate-400 font-bold text-lg">/</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM"
              value={mes}
              onChange={(e) => handleInput(e.target.value, setMes, 2)}
              className="input flex-1 text-center font-mono"
              maxLength={2}
            />
            <span className="text-slate-400 font-bold text-lg">/</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="AAAA"
              value={ano}
              onChange={(e) => handleInput(e.target.value, setAno, 4)}
              className="input flex-[2] text-center font-mono"
              maxLength={4}
            />
          </div>
          {erro && (
            <p className="mt-2 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {erro}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={handleConfirm} className="btn-success w-full">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Confirmar Validade
          </button>
          <button onClick={onCancel} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
