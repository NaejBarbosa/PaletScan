import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BrowserMultiFormatReader } from '@zxing/library';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface ScannerProps {
  onDetected: (decodedText: string) => void;
  autoStartCamera?: boolean;
  autoStartGallery?: boolean;
  onClose?: () => void;
}

export default function Scanner({
  onDetected,
  autoStartCamera = false,
  autoStartGallery = false,
  onClose
}: ScannerProps) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);
  const transformWrapperRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (autoStartCamera) {
        startScanning();
      } else if (autoStartGallery) {
        fileInputRef.current?.click();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, autoStartCamera, autoStartGallery]);

  useEffect(() => {
    return () => {
      if (readerRef.current) readerRef.current.reset();
    };
  }, []);

  useEffect(() => {
    if (scanning) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [scanning]);

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    const handleCancel = () => {
      if (onClose) onClose();
    };

    input.addEventListener('cancel', handleCancel);
    return () => {
      input.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);


  const stopScanning = async () => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setScanning(false);
    if (onClose) onClose();
  };

  const startScanning = async () => {
    if (scanning) return;
    setProcessing(true);
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const constraints = { video: { facingMode: { exact: "environment" } } };
      await reader.decodeFromConstraints(constraints, videoRef.current!, (result) => {
        if (result && !processing) {
          const text = result.getText();
          if (text) {
            stopScanning();
            onDetected(text);
          }
        }
      });
      setScanning(true);
    } catch (err: any) {
      setDebugMessage('Erro ao acessar camera: ' + (err.message || 'verifique permissoes'));
      setTimeout(() => setDebugMessage(null), 5000);
      stopScanning();
    } finally {
      setProcessing(false);
    }
  };

  const detectWithNative = async (imageBitmap: ImageBitmap): Promise<string | null> => {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'data_matrix', 'aztec', 'pdf417', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'] });
      const barcodes = await detector.detect(imageBitmap);
      return barcodes[0]?.rawValue || null;
    } catch {
      return null;
    }
  };

  const detectWithZXing = async (imageUrl: string): Promise<string | null> => {
    const reader = new BrowserMultiFormatReader();
    try {
      const result = await reader.decodeFromImageUrl(imageUrl);
      return result ? result.getText() : null;
    } catch {
      return null;
    } finally {
      reader.reset();
    }
  };

  const detectCentralRegion = async () => {
    if (!containerRef.current || !imageElementRef.current) {
      setDebugMessage("Elementos nao carregados");
      return;
    }
    setProcessing(true);
    try {
      const container = containerRef.current;
      const img = imageElementRef.current;
      const wrapper = transformWrapperRef.current;

      const transformStyle = window.getComputedStyle(img).transform;
      let scale = 1, translateX = 0, translateY = 0;
      if (transformStyle && transformStyle !== 'none') {
        const matrix = transformStyle.match(/matrix\(([^)]+)\)/);
        if (matrix && matrix[1]) {
          const values = matrix[1].split(',').map(parseFloat);
          scale = Math.sqrt(values[0]*values[0] + values[1]*values[1]);
          translateX = values[4];
          translateY = values[5];
        }
      } else if (wrapper?.state) {
        scale = wrapper.state.scale || 1;
        translateX = wrapper.state.positionX || 0;
        translateY = wrapper.state.positionY || 0;
      }

      const containerRect = container.getBoundingClientRect();
      const cw = containerRect.width, ch = containerRect.height;
      const imgW = img.naturalWidth, imgH = img.naturalHeight;
      if (imgW === 0 || imgH === 0) throw new Error('Imagem nao carregada');

      const dispW = imgW * scale, dispH = imgH * scale;
      const left = translateX + (cw - dispW)/2;
      const top = translateY + (ch - dispH)/2;

      const boxSize = Math.min(cw, ch) * 0.6;
      const boxX = (cw - boxSize)/2;
      const boxY = (ch - boxSize)/2;

      const relX = (boxX - left) / scale;
      const relY = (boxY - top) / scale;
      const relW = boxSize / scale;
      const relH = boxSize / scale;

      if (relX < 0 || relY < 0 || relX+relW > imgW || relY+relH > imgH) {
        setDebugMessage("Area verde fora da imagem. Centralize e ajuste o zoom.");
        setProcessing(false);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.min(boxSize, 600);
      canvas.height = Math.min(boxSize, 600);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error();
      ctx.drawImage(img, relX, relY, relW, relH, 0, 0, canvas.width, canvas.height);

      const bitmap = await createImageBitmap(canvas);
      let decoded = await detectWithNative(bitmap);
      if (!decoded) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        decoded = await detectWithZXing(dataUrl);
      }

      if (decoded) {
        onDetected(decoded);
        fecharPreview();
      } else {
        setDebugMessage("Nenhum codigo detectado.");
      }
    } catch (err: any) {
      setDebugMessage(`Erro: ${err.message || err}`);
    } finally {
      setProcessing(false);
      setTimeout(() => setDebugMessage(null), 5000);
    }
  };

  const fecharPreview = () => {
    setImagePreviewUrl(null);
    setShowCrop(false);
    setDebugMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onClose) onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    const imageUrl = URL.createObjectURL(file);
    setImagePreviewUrl(imageUrl);
    let decoded: string | null = null;
    try {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      const maxDim = 1000;
      let width = img.width, height = img.height;
      if (width > maxDim || height > maxDim) {
        const scaleFactor = maxDim / Math.max(width, height);
        width = Math.floor(width * scaleFactor);
        height = Math.floor(height * scaleFactor);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      const bitmap = await createImageBitmap(canvas);
      decoded = await detectWithNative(bitmap);
      if (!decoded) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        decoded = await detectWithZXing(dataUrl);
      }
    } catch (err) {
      console.error(err);
    }
    if (decoded) {
      URL.revokeObjectURL(imageUrl);
      setProcessing(false);
      onDetected(decoded);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setProcessing(false);
    setShowCrop(true);
    setTimeout(() => {
      if (imageElementRef.current) {
        imageElementRef.current.src = imageUrl;
        setDebugMessage("Ajuste o codigo no quadrado verde e clique em DETECTAR");
      }
    }, 50);
  };

  return (
    <div className="relative">
      {/* Debug Message */}
      {debugMessage && (
        <div className="fixed inset-x-0 bottom-6 z-[110] flex justify-center items-center px-4 pointer-events-none animate-slideUp">
          <div className="pointer-events-auto inline-flex items-center gap-3 px-6 py-3.5 bg-slate-900/95 dark:bg-slate-950 text-white rounded-2xl shadow-elevated backdrop-blur-sm text-sm font-medium whitespace-nowrap max-w-full">
            <svg className="w-5 h-5 flex-shrink-0 text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {debugMessage}
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {showCrop && imagePreviewUrl && (
        <div className="fixed inset-0 bg-slate-900/95 dark:bg-slate-950/98 z-[150] flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="max-w-lg w-full text-center mb-6">
            <h3 className="text-white text-xl font-semibold mb-2">Ajuste o Codigo</h3>
            <p className="text-slate-400 text-sm">Posicione o codigo Data Matrix dentro da area verde</p>
          </div>

          <div ref={containerRef} className="relative w-full max-w-lg h-[50vh] bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-elevated">
            <TransformWrapper ref={transformWrapperRef} initialScale={1} minScale={0.5} maxScale={5} centerOnInit={true} limitToBounds={true}>
              <TransformComponent>
                <img ref={imageElementRef} src={imagePreviewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
              </TransformComponent>
            </TransformWrapper>

            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative">
                <div
                  className="border-4 border-success-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]"
                  style={{ width: '60vw', maxWidth: '300px', height: '60vw', maxHeight: '300px' }}
                />
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-success-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-success-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-success-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-success-400 rounded-br-lg" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={detectCentralRegion} disabled={processing} className="btn-success">
              {processing ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Detectar
                </>
              )}
            </button>
            <button onClick={fecharPreview} className="btn-danger">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Container Principal do Scanner (Compacto na página) */}
      {!(autoStartCamera || autoStartGallery) && (
        <div className="relative w-full overflow-hidden bg-slate-50 dark:bg-slate-900/10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 md:p-12 text-center">
          {/* Interface Inativa / Placeholder */}
          <div className={`flex flex-col items-center justify-center transition-opacity duration-300 ${!scanning ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
            {/* Ícone de câmera estilizado */}
            <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-4 border border-primary-100 dark:border-primary-900/30 shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            </div>

            <h3 className="text-slate-800 dark:text-slate-200 font-semibold text-base mb-1.5">
              {language === 'pt' ? 'Leitor de Código Desativado' : 'Lector de Código Desactivado'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-6 leading-relaxed">
              {language === 'pt' ? 'Inicie a câmera para escanear os códigos de barra dos produtos ou envie uma imagem diretamente da sua galeria.' : 'Inicie la cámara para escanear los códigos de barras de los productos o envíe una imagen directamente desde su galería.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button onClick={startScanning} className="btn-success flex items-center gap-2 shadow-md hover:shadow-lg transition-all" disabled={processing}>
                {processing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === 'pt' ? 'Iniciando...' : 'Iniciando...'}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {language === 'pt' ? 'Iniciar Câmera' : 'Iniciar Cámara'}
                  </>
                )}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm transition-all flex items-center gap-2"
                disabled={processing}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l2.586-2.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {language === 'pt' ? 'Ler da Galeria' : 'Leer de la Galería'}
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Portal para renderizar a câmera ativa direto no document.body para evitar clipping */}
      {mounted && createPortal(
        <div className={`fixed inset-0 z-[150] bg-black transition-opacity duration-300 ${
          scanning ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          {/* Vídeo com object-fit cover para zoom natural */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            autoPlay
          />

          {/* Overlay escurecido nas bordas com furo no meio (viewfinder) com cantos arredondados acompanhando o contorno */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
            <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
          </div>

          {/* Painel Superior Flutuante */}
          <div className="absolute top-6 inset-x-6 h-14 bg-white/10 dark:bg-black/45 backdrop-blur-md flex items-center justify-between px-5 z-20 rounded-2xl border border-white/10 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white text-xs font-semibold uppercase tracking-wider">{t('leitorAtivo')}</span>
            </div>
            <button
              onClick={stopScanning}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
              title="Fechar câmera"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Viewfinder central minimalista e elegante */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="relative w-64 h-64 md:w-80 md:h-80 animate-scale-in flex items-center justify-center">
              {/* Moldura externa translúcida sutil */}
              <div className="absolute inset-0 border border-white/15 rounded-3xl" />
              
              {/* Quatro cantos minimalistas finos */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-2xl" />

              {/* Foco central muito sutil */}
              <div className="w-16 h-16 border border-white/10 rounded-full animate-ping opacity-25" />
            </div>
          </div>

          {/* Instruções e controles na parte inferior */}
          <div className="absolute bottom-8 inset-x-6 flex flex-col items-center gap-4 z-20 animate-slideUp">
            <div className="bg-white/10 dark:bg-black/45 backdrop-blur-md px-4 py-2 rounded-full text-white text-[11px] font-semibold uppercase tracking-wider shadow-lg border border-white/10 text-center max-w-[280px]">
              {t('centralizeCodigo')}
            </div>

            <div className="flex gap-3 justify-center w-full max-w-[280px]">
              <button
                onClick={() => {
                  stopScanning();
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
                className="flex-1 h-11 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-white/10 shadow-lg"
                disabled={processing}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l2.586-2.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('galeria')}
              </button>
              
              <button
                onClick={stopScanning}
                className="flex-1 h-11 rounded-xl bg-red-500/80 hover:bg-red-600/90 active:scale-95 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg border border-red-600/30"
                disabled={processing}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('cancelar')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}