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

  // Estados do upload com zoom/pan
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  // Transformações da imagem (pan e zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(1);

  // Limpeza da câmera
  useEffect(() => {
    return () => {
      if (readerRef.current) readerRef.current.reset();
    };
  }, []);

  // ========== CÂMERA (igual antes) ==========
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

  // Detecta código em um ImageBitmap (retorno)
  const detectFromImageBitmap = async (bitmap: ImageBitmap): Promise<string | null> => {
    let text = await detectWithNativeAPI(bitmap);
    if (!text) {
      // fallback: cria canvas temporário para gerar dataURL
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(bitmap, 0, 0);
      const dataUrl = canvas.toDataURL();
      text = await detectWithZXing(dataUrl);
    }
    return text;
  };

  // ========== ZOOM E PAN NA IMAGEM ==========
  const updateCanvas = () => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    const container = imageContainerRef.current;
    if (!container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Tamanho do canvas igual ao container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Aplica transformação (translação + escala)
    ctx.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
    ctx.scale(transform.scale, transform.scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    // Desenha a máscara: área externa escura/borrada
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const boxSize = Math.min(canvas.width, canvas.height) * 0.6; // área quadrada 60% do menor lado
    const boxX = centerX - boxSize / 2;
    const boxY = centerY - boxSize / 2;

    // Desenha retângulo escuro por toda a tela e depois recorta o quadrado central
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(boxX, boxY, boxSize, boxSize);
    ctx.globalCompositeOperation = 'source-over';

    // Desenha borda verde ao redor da área de leitura
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxSize, boxSize);
  };

  // Eventos de pan (mouse / toque único)
  const handlePanStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsPanning(true);
    setPanStart({ x: clientX - transform.x, y: clientY - transform.y });
  };

  const handlePanMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPanning) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setTransform({
      x: clientX - panStart.x,
      y: clientY - panStart.y,
      scale: transform.scale,
    });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // Eventos de zoom (pinch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      setInitialDistance(distance);
      setInitialScale(transform.scale);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.hypot(dx, dy);
      const scaleFactor = newDistance / initialDistance;
      let newScale = initialScale * scaleFactor;
      newScale = Math.min(Math.max(0.5, newScale), 5);
      setTransform({ ...transform, scale: newScale });
    }
  };

  const handleTouchEnd = () => {
    setInitialDistance(null);
  };

  // ========== EXTRAIR REGIÃO CENTRAL E DETECTAR ==========
  const detectCentralRegion = async () => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    setProcessing(true);
    try {
      const container = imageContainerRef.current;
      if (!container) return;

      const boxSize = Math.min(canvas.width, canvas.height) * 0.6;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const cropX = centerX - boxSize / 2;
      const cropY = centerY - boxSize / 2;

      // Extrai os pixels da região central (coordenadas do canvas)
      const imageData = canvas.getContext('2d')?.getImageData(cropX, cropY, boxSize, boxSize);
      if (!imageData) throw new Error('Não foi possível extrair a região');

      const offCanvas = document.createElement('canvas');
      offCanvas.width = boxSize;
      offCanvas.height = boxSize;
      offCanvas.getContext('2d')?.putImageData(imageData, 0, 0);

      // Converte para ImageBitmap para detecção
      const bitmap = await createImageBitmap(offCanvas);
      const decoded = await detectFromImageBitmap(bitmap);

      if (decoded) {
        onDetected(decoded);
        fecharPreview();
      } else {
        alert('Nenhum código detectado na área central. Ajuste a posição e o zoom para que o código fique dentro do quadrado verde.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao processar a região central.');
    } finally {
      setProcessing(false);
    }
  };

  const fecharPreview = () => {
    setImagePreviewUrl(null);
    setShowCrop(false);
    setTransform({ x: 0, y: 0, scale: 1 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    originalImageRef.current = null;
  };

  // ========== UPLOAD DA IMAGEM (tenta auto, depois manual) ==========
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    const imageUrl = URL.createObjectURL(file);
    setImagePreviewUrl(imageUrl);

    // Tentativa automática
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
      const bitmap = await createImageBitmap(canvas);
      decoded = await detectFromImageBitmap(bitmap);
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

    // Falhou -> abre modo zoom/pan
    setProcessing(false);
    setShowCrop(true);
    const img = new Image();
    img.onload = () => {
      originalImageRef.current = img;
      // Reinicia transformação
      setTransform({ x: 0, y: 0, scale: 1 });
      setTimeout(() => updateCanvas(), 10);
    };
    img.src = imageUrl;
  };

  // Atualiza canvas quando a imagem ou transformação mudar
  useEffect(() => {
    if (showCrop && originalImageRef.current) {
      updateCanvas();
    }
  }, [showCrop, transform, originalImageRef.current]);

  // Observer para redimensionamento do container
  useEffect(() => {
    if (!showCrop) return;
    const resizeObserver = new ResizeObserver(() => updateCanvas());
    if (imageContainerRef.current) resizeObserver.observe(imageContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [showCrop]);

  // ========== RENDER ==========
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Modal com zoom/pan */}
      {showCrop && imagePreviewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col items-center justify-center p-4">
          <h3 className="text-white text-lg mb-2">Arraste e dê zoom para posicionar o código no quadrado verde</h3>
          <div
            ref={imageContainerRef}
            className="relative w-full max-w-lg h-[60vh] bg-black rounded-lg overflow-hidden touch-none"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              onMouseDown={handlePanStart}
              onMouseMove={handlePanMove}
              onMouseUp={handlePanEnd}
              onMouseLeave={handlePanEnd}
              onTouchStart={(e) => { handlePanStart(e); handleTouchStart(e); }}
              onTouchMove={(e) => { handlePanMove(e); handleTouchMove(e); }}
              onTouchEnd={(e) => { handlePanEnd(); handleTouchEnd(); }}
              style={{ touchAction: 'none' }}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={detectCentralRegion}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              {processing ? 'Detectando...' : 'Detectar na área verde'}
            </button>
            <button
              onClick={fecharPreview}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Cancelar
            </button>
          </div>
          <p className="text-gray-300 text-sm mt-2">
            Use um dedo para arrastar • Dois dedos para zoom
          </p>
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