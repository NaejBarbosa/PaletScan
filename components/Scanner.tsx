// components/Scanner.tsx
import { useRef, useState, useEffect } from 'react';
import {
  BrowserMultiFormatReader,
  NotFoundException,
  ChecksumException,
  FormatException,
} from '@zxing/library';

interface ScannerProps {
  onDetected: (decodedText: string) => void;
}

export default function Scanner({ onDetected }: ScannerProps) {
  // Estados da câmera
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  // Estados do upload manual com crop
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpeza da câmera
  useEffect(() => {
    return () => {
      if (readerRef.current) readerRef.current.reset();
    };
  }, []);

  // ========== CÂMERA ==========
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
      await reader.decodeFromConstraints(constraints, videoRef.current!, (result, err) => {
        if (result && !processing) {
          const text = result.getText();
          if (text) {
            stopScanning();
            onDetected(text);
          }
        }
      });
      setScanning(true);
    } catch (err) {
      alert('Não foi possível acessar a câmera traseira.');
      stopScanning();
    } finally {
      setProcessing(false);
    }
  };

  // ========== DETECÇÃO NATIVA + FALLBACK ==========
  const detectWithNativeAPI = async (imageBitmap: ImageBitmap): Promise<string | null> => {
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

  // Detecta código a partir de um canvas (região recortada)
  const detectFromCanvas = async (canvas: HTMLCanvasElement): Promise<string | null> => {
    const imageBitmap = await createImageBitmap(canvas);
    let text = await detectWithNativeAPI(imageBitmap);
    if (!text) {
      const dataUrl = canvas.toDataURL();
      text = await detectWithZXing(dataUrl);
    }
    return text;
  };

  // ========== PREVIEW E CROP MANUAL ==========
  const drawImageWithCrop = () => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajusta canvas para caber na tela (largura máxima 400px)
    const maxWidth = 400;
    const scale = maxWidth / img.width;
    const displayWidth = img.width * scale;
    const displayHeight = img.height * scale;
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

    // Desenha retângulo de crop
    if (cropRect.w > 0 && cropRect.h > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.fillStyle = 'rgba(0,255,0,0.2)';
      ctx.fillRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    setCropRect({ x, y, w: 0, h: 0 });
    setIsDrawing(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    let x = (clientX - rect.left) * (canvas.width / rect.width);
    let y = (clientY - rect.top) * (canvas.height / rect.height);
    // Garante coordenadas dentro do canvas
    x = Math.min(Math.max(0, x), canvas.width);
    y = Math.min(Math.max(0, y), canvas.height);
    setCropRect(prev => ({
      x: prev.x,
      y: prev.y,
      w: x - prev.x,
      h: y - prev.y,
    }));
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const detectRegion = async () => {
    if (!canvasRef.current || cropRect.w <= 5 || cropRect.h <= 5) {
      alert('Desenhe um retângulo ao redor do código (arraste o dedo/rato sobre a imagem).');
      return;
    }

    setProcessing(true);
    try {
      // Recorta a região do canvas
      const canvas = canvasRef.current;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = cropRect.w;
      offCanvas.height = cropRect.h;
      const ctx = offCanvas.getContext('2d');
      ctx?.drawImage(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h);

      const decoded = await detectFromCanvas(offCanvas);
      if (decoded) {
        onDetected(decoded);
        fecharPreview();
      } else {
        alert('Nenhum código encontrado na região selecionada. Tente ajustar o retângulo.');
      }
    } catch (err) {
      alert('Erro ao detectar nesta região.');
    } finally {
      setProcessing(false);
    }
  };

  const fecharPreview = () => {
    setImagePreviewUrl(null);
    setShowCrop(false);
    setCropRect({ x: 0, y: 0, w: 0, h: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (originalImageRef.current) originalImageRef.current = null;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    const imageUrl = URL.createObjectURL(file);
    setImagePreviewUrl(imageUrl);

    // Tenta detectar automaticamente primeiro
    let decoded: string | null = null;
    try {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const imageBitmap = await createImageBitmap(canvas);
      decoded = await detectWithNativeAPI(imageBitmap);
      if (!decoded) decoded = await detectWithZXing(imageUrl);
    } catch (err) {
      console.error(err);
    }

    if (decoded) {
      // Detectou automaticamente
      URL.revokeObjectURL(imageUrl);
      setProcessing(false);
      onDetected(decoded);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Falhou → entra no modo de crop manual
    setProcessing(false);
    setShowCrop(true);
    // Carrega a imagem para o crop
    const img = new Image();
    img.onload = () => {
      originalImageRef.current = img;
      drawImageWithCrop();
    };
    img.src = imageUrl;
  };

  // ========== RENDER ==========
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Preview com crop manual */}
      {showCrop && imagePreviewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center p-4">
          <h3 className="text-white text-lg mb-2">Ajuste o retângulo sobre o código</h3>
          <canvas
            ref={canvasRef}
            className="border-2 border-white max-w-full"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onTouchStart={handleCanvasMouseDown}
            onTouchMove={handleCanvasMouseMove}
            onTouchEnd={handleCanvasMouseUp}
            style={{ touchAction: 'none' }}
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={detectRegion}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              {processing ? 'Detectando...' : 'Detectar nesta região'}
            </button>
            <button
              onClick={fecharPreview}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Cancelar
            </button>
          </div>
          <p className="text-gray-300 text-sm mt-2">Toque e arraste para desenhar o retângulo</p>
        </div>
      )}

      {/* Câmera */}
      <video
        ref={videoRef}
        className="w-full max-w-sm rounded border bg-black"
        style={{ aspectRatio: '4/3' }}
        playsInline
        autoPlay
      />

      <div className="flex gap-2">
        {!scanning ? (
          <button onClick={startScanning} className="px-4 py-2 bg-green-600 text-white rounded" disabled={processing}>
            Iniciar Scanner
          </button>
        ) : (
          <button onClick={stopScanning} className="px-4 py-2 bg-red-600 text-white rounded" disabled={processing}>
            Parar Scanner
          </button>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-blue-600 text-white rounded"
          disabled={processing || scanning}
        >
          {processing ? 'Processando...' : 'Ler da Galeria'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </div>
    </div>
  );
}