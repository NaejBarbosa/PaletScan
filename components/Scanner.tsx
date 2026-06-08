// components/Scanner.tsx
import { useRef, useState, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface ScannerProps {
  onDetected: (decodedText: string) => void;
}

export default function Scanner({ onDetected }: ScannerProps) {
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

  // ========== PRÉ-PROCESSAMENTO AVANÇADO ==========
  const preprocessImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // 1. Equalização de histograma (aumenta contraste)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      const idx = Math.floor(gray);
      histogram[idx]++;
    }
    let cdf = 0;
    const total = canvas.width * canvas.height;
    const equalized = new Array(256);
    for (let i = 0; i < 256; i++) {
      cdf += histogram[i];
      equalized[i] = Math.floor((cdf / total) * 255);
    }
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      const newGray = equalized[Math.floor(gray)];
      data[i] = newGray;
      data[i+1] = newGray;
      data[i+2] = newGray;
    }

    // 2. Aplicar nitidez (sharpening) para realçar bordas
    const sharpened = new Uint8ClampedArray(data.length);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const width = canvas.width;
    const height = canvas.height;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const val = data[idx];
            sum += val * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * width + x) * 4;
        sharpened[idx] = Math.min(255, Math.max(0, sum));
        sharpened[idx+1] = sharpened[idx];
        sharpened[idx+2] = sharpened[idx];
        sharpened[idx+3] = 255;
      }
    }

    // 3. Binarização adaptativa (threshold local)
    const binary = new Uint8ClampedArray(sharpened.length);
    const blockSize = 15;
    const constant = 10;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -blockSize/2; dy <= blockSize/2; dy++) {
          for (let dx = -blockSize/2; dx <= blockSize/2; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = (ny * width + nx) * 4;
              sum += sharpened[idx];
              count++;
            }
          }
        }
        const threshold = (sum / count) - constant;
        const idx = (y * width + x) * 4;
        const value = sharpened[idx] > threshold ? 255 : 0;
        binary[idx] = value;
        binary[idx+1] = value;
        binary[idx+2] = value;
        binary[idx+3] = 255;
      }
    }

    const resultImageData = new ImageData(binary, width, height);
    ctx.putImageData(resultImageData, 0, 0);
    return canvas;
  };

  // ========== DETECÇÃO COM MÚLTIPLAS TENTATIVAS ==========
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

  const detectWithMultipleUpscaling = async (canvas: HTMLCanvasElement): Promise<string | null> => {
    // Tenta várias escalas (original, 2x, 3x) para melhorar a detecção
    const scales = [1, 2, 3];
    for (const scale of scales) {
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = canvas.width * scale;
      scaledCanvas.height = canvas.height * scale;
      const ctx = scaledCanvas.getContext('2d');
      ctx?.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
      
      let bitmap = await createImageBitmap(scaledCanvas);
      let decoded = await detectWithNative(bitmap);
      if (decoded) return decoded;
      
      const dataUrl = scaledCanvas.toDataURL();
      decoded = await detectWithZXing(dataUrl);
      if (decoded) return decoded;
    }
    return null;
  };

  const detectCentralRegion = async () => {
    if (!containerRef.current || !imageElementRef.current) {
      setDebugMessage("❌ Elementos não carregados");
      return;
    }
    setProcessing(true);
    setDebugMessage("🔍 Processando com pré-processamento avançado...");
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

      setDebugMessage(`📐 Área: X=${Math.round(relX)} Y=${Math.round(relY)} ${Math.round(relW)}x${Math.round(relH)} | Img: ${imgW}x${imgH}`);

      if (relX < 0 || relY < 0 || relX+relW > imgW || relY+relH > imgH) {
        setDebugMessage("⚠️ Área verde fora da imagem. Centralize e ajuste o zoom.");
        setProcessing(false);
        return;
      }

      // Extrai a região central em alta resolução
      const canvas = document.createElement('canvas');
      canvas.width = boxSize;
      canvas.height = boxSize;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, relX, relY, relW, relH, 0, 0, boxSize, boxSize);

      // Aplica pré-processamento avançado
      const processedCanvas = preprocessImage(canvas);
      
      // Tenta detectar com múltiplas escalas
      let decoded = await detectWithMultipleUpscaling(processedCanvas);
      
      // Se ainda falhou, tenta uma última vez com o canvas original (sem redimensionar muito)
      if (!decoded) {
        setDebugMessage("🎨 Última tentativa: binarização extrema...");
        const extremeCanvas = document.createElement('canvas');
        extremeCanvas.width = canvas.width;
        extremeCanvas.height = canvas.height;
        const extCtx = extremeCanvas.getContext('2d');
        extCtx?.drawImage(canvas, 0, 0);
        const imageData = extCtx?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            const threshold = 128;
            const bw = gray > threshold ? 255 : 0;
            data[i] = bw;
            data[i+1] = bw;
            data[i+2] = bw;
          }
          extCtx?.putImageData(imageData, 0, 0);
          decoded = await detectWithMultipleUpscaling(extremeCanvas);
        }
      }

      if (decoded) {
        setDebugMessage(`✅ Sucesso: ${decoded}`);
        onDetected(decoded);
        fecharPreview();
      } else {
        setDebugMessage("❌ Nenhum código detectado. Tente mais zoom e centralização.");
      }
    } catch (err: any) {
      setDebugMessage(`💥 Erro: ${err.message || err}`);
    } finally {
      setProcessing(false);
      setTimeout(() => setDebugMessage(null), 4000);
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
    setDebugMessage("📤 Carregando imagem...");
    const imageUrl = URL.createObjectURL(file);
    setImagePreviewUrl(imageUrl);

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
      const processed = preprocessImage(canvas);
      const bitmap = await createImageBitmap(processed);
      decoded = await detectWithNative(bitmap);
      if (!decoded) {
        const dataUrl = processed.toDataURL();
        decoded = await detectWithZXing(dataUrl);
      }
    } catch (err) {
      console.error(err);
    }

    if (decoded) {
      URL.revokeObjectURL(imageUrl);
      setProcessing(false);
      setDebugMessage(null);
      onDetected(decoded);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setProcessing(false);
    setShowCrop(true);
    setTimeout(() => {
      if (imageElementRef.current) {
        imageElementRef.current.src = imageUrl;
        setDebugMessage("🔎 Ajuste o código no quadrado verde e clique em Detectar");
      }
    }, 50);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {debugMessage && (
        <div className="fixed bottom-4 left-4 right-4 bg-yellow-800 text-white p-3 rounded-lg z-50 text-center text-sm shadow-lg">
          {debugMessage}
        </div>
      )}

      {showCrop && imagePreviewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col items-center justify-center p-4">
          <h3 className="text-white text-lg mb-2 text-center">
            Posicione o código <strong className="text-green-400">dentro do quadrado verde</strong>
          </h3>
          <div
            ref={containerRef}
            className="relative w-full max-w-lg h-[60vh] bg-black rounded-lg overflow-hidden"
            style={{ touchAction: 'none' }}
          >
            <TransformWrapper
              ref={transformWrapperRef}
              initialScale={1}
              minScale={0.5}
              maxScale={5}
              centerOnInit={true}
              limitToBounds={true}
              panning={{ velocityDisabled: true }}
              pinch={{ step: 5 }}
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img
                  ref={imageElementRef}
                  src={imagePreviewUrl}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  draggable={false}
                  crossOrigin="anonymous"
                />
              </TransformComponent>
            </TransformWrapper>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="border-4 border-green-500"
                style={{
                  width: '60%',
                  height: '60%',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
                }}
              />
            </div>
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
            🖱️ 1 dedo: arrastar • ✌️ 2 dedos: zoom
          </p>
        </div>
      )}

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