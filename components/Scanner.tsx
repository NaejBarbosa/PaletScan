import { useRef, useState, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useTheme } from '../context/ThemeContext';

interface ScannerProps {
  onDetected: (decodedText: string) => void;
}

export default function Scanner({ onDetected }: ScannerProps) {
  const { theme } = useTheme();
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

  useEffect(() => {
    return () => {
      if (readerRef.current) readerRef.current.reset();
    };
  }, []);

  const stopScanning = async () => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setScanning(false);
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
    <div className="p-5">
      {/* Debug Message */}
      {debugMessage && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center items-center px-4 pointer-events-none animate-slideUp">
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
        <div className="fixed inset-0 bg-slate-900/95 dark:bg-slate-950/98 z-50 flex flex-col items-center justify-center p-4 animate-fade-in">
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

            {/* Crop Overlay */}
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
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

      {/* Video Preview */}
      <div className="relative bg-slate-900 rounded-xl overflow-hidden shadow-inner">
        <video
          ref={videoRef}
          className="w-full rounded-xl bg-slate-800"
          style={{ aspectRatio: '4/3' }}
          playsInline
          autoPlay
        />

        {/* Scanning Overlay */}
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="w-48 h-48 border-2 border-success-400 rounded-2xl animate-pulse-subtle" />
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-success-300 rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-success-300 rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-success-300 rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-success-300 rounded-br-lg" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mt-5 justify-center">
        {!scanning ? (
          <button onClick={startScanning} className="btn-success" disabled={processing}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Iniciar Scanner
          </button>
        ) : (
          <button onClick={stopScanning} className="btn-danger" disabled={processing}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Parar Scanner
          </button>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary"
          disabled={processing || scanning}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l2.586-2.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Ler da Galeria
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </div>
    </div>
  );
}
