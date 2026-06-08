// components/Scanner.tsx
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
      alert('Erro ao acessar câmera: ' + (err.message || 'verifique permissões'));
      stopScanning();
    } finally {
      setProcessing(false);
    }
  };

  const detectWithNative = async (imageBitmap: ImageBitmap): Promise<string | null> => {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'data_matrix', 'aztec', 'pdf417'] });
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
      setDebugMessage("❌ Elementos não carregados");
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
      if (imgW === 0 || imgH === 0) throw new Error('Imagem não carregada');

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
        setDebugMessage("⚠️ Área verde fora da imagem. Centralize e ajuste o zoom.");
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
        setDebugMessage("❌ Nenhum código detectado.");
      }
    } catch (err: any) {
      setDebugMessage(`💥 Erro: ${err.message || err}`);
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
        setDebugMessage("🔎 Ajuste o código no quadrado verde e clique em DETECTAR");
      }
    }, 50);
  };

  return (
    <div className="p-5">
      {debugMessage && (
        <div className="fixed bottom-6 left-6 right-6 bg-black/80 backdrop-blur-sm text-white p-3 rounded-xl z-50 text-center text-sm font-medium shadow-xl">
          {debugMessage}
        </div>
      )}
      {showCrop && imagePreviewUrl && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <h3 className="text-white text-xl mb-4 font-semibold">Posicione o código no quadrado verde</h3>
          <div ref={containerRef} className="relative w-full max-w-lg h-[60vh] bg-black/50 rounded-2xl overflow-hidden border-2 border-white/20">
            <TransformWrapper ref={transformWrapperRef} initialScale={1} minScale={0.5} maxScale={5} centerOnInit={true} limitToBounds={true}>
              <TransformComponent>
                <img ref={imageElementRef} src={imagePreviewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </TransformComponent>
            </TransformWrapper>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="border-4 border-green-500 rounded-xl" style={{ width: '60%', height: '60%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)' }} />
            </div>
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={detectCentralRegion} disabled={processing} className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg">
              🔍 DETECTAR
            </button>
            <button onClick={fecharPreview} className="px-6 py-2 bg-red-500/80 hover:bg-red-600/80 text-white font-semibold rounded-xl transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}
      <video ref={videoRef} className="w-full rounded-xl border-2 border-gray-600 shadow-inner" style={{ aspectRatio: '4/3' }} playsInline autoPlay />
      <div className="flex flex-wrap gap-4 mt-6 justify-center">
        {!scanning ? (
          <button onClick={startScanning} className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-200 font-medium shadow-md flex items-center gap-2" disabled={processing}>
            ▶ Iniciar Scanner
          </button>
        ) : (
          <button onClick={stopScanning} className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl transition-all duration-200 font-medium shadow-md flex items-center gap-2" disabled={processing}>
            ⏹ Parar Scanner
          </button>
        )}
        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 font-medium shadow-md flex items-center gap-2" disabled={processing || scanning}>
          📁 Ler da Galeria
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </div>
    </div>
  );
}