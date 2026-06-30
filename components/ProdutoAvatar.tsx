import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';

interface ProdutoAvatarProps {
  ean: string;
  descricao: string;
}

export default function ProdutoAvatar({ ean, descricao }: ProdutoAvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Normaliza o EAN para ter exatamente 13 dígitos, preservando/adicionando zeros à esquerda
  const normalizedEan = ean ? ean.trim().padStart(13, '0') : '';

  // Reseta o estado de erro caso o EAN mude para que outros produtos carreguem corretamente
  useEffect(() => {
    setHasError(false);
  }, [ean]);

  return (
    <div className="w-full aspect-square bg-white rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0">
      {hasError ? (
        <div className="w-full h-full flex items-center justify-center text-slate-300 animate-fade-in">
          <Package className="w-24 h-24 stroke-[1.5]" />
        </div>
      ) : (
        <img
          src={`/imagens_produtos/${normalizedEan}.webp`}
          alt={descricao}
          onError={() => setHasError(true)}
          className="w-full h-auto max-h-[40vh] object-contain rounded-lg select-none animate-fade-in self-center"
        />
      )}
    </div>
  );
}
