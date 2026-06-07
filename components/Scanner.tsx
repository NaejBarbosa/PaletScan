// components/Scanner.tsx
import { useRef, useState, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface ScannerProps {
  onDetected: (decodedText: string) => void;
}

export default function Scanner({ onDetected }: ScannerProps) {
  // Estados da câmera
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  // Estados do zoom/pan
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);
  const transformWrapperRef = useRef<any>(null);

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
    } catch {
      alert('Não foi possível acessar a câmera traseira.');
      stopScanning();
    } finally {
      setProcessing(false);
    }
  };

  // ========== DETECÇÃO (nativa + fallback) ==========
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

  const detectFromImageBitmap = async (bitmap: ImageBitmap): Promise<string | null> => {
    let text = await detectWithNativeAPI(bitmap);
    if (!text) {
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

  // ========== EXTRAÇÃO DA REGIÃO CENTRAL USANDO CANVAS OCULTO ==========
  const detectCentralRegion = async () => {
    if (!containerRef.current || !imageElementRef.current) {
      alert('Imagem não carregada corretamente.');
      return;
    }

    setProcessing(true);
    try {
      const container = containerRef.current;
      const imgElement = imageElementRef.current;
      const wrapper = transformWrapperRef.current;

      if (!wrapper) throw new Error('TransformWrapper não inicializado');

      // Obtém o estado atual da transformação (escala e posição)
      const { scale, positionX, positionY } = wrapper.state;
      
      // Dimensões do container (área visível)
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      
      // Tamanho original da imagem
      const imgNaturalWidth = imgElement.naturalWidth;
      const imgNaturalHeight = imgElement.naturalHeight;
      
      // Tamanho da imagem exibida após escala
      const imgDisplayWidth = imgNaturalWidth * scale;
      const imgDisplayHeight = imgNaturalHeight * scale;
      
      // Posição da imagem dentro do container (considerando o pan)
      const imgLeft = positionX + (containerWidth - imgDisplayWidth) / 2;
      const imgTop = positionY + (containerHeight - imgDisplayHeight) / 2;
      
      // Tamanho do quadrado verde (60% do menor lado do container)
      const boxSize = Math.min(containerWidth, containerHeight) * 0.6;
      const boxX = (containerWidth - boxSize) / 2;
      const boxY = (containerHeight - boxSize) / 2;
      
      // Coordenadas da região central em relação à imagem original
      const relativeX = (boxX - imgLeft) / scale;
      const relativeY = (boxY - imgTop) / scale;
      const relativeW = boxSize / scale;
      const relativeH = boxSize / scale;
      
      // Valida se a região está dentro da imagem original
      if (relativeX < 0 || relativeY < 0 || relativeX + relativeW > imgNaturalWidth || relativeY + relativeH > imgNaturalHeight) {
        alert('A área de leitura está fora da imagem. Centralize a imagem e ajuste o zoom para que o código fique dentro do quadrado verde.');
        setProcessing(false);
        return;
      }
      
      // Cria um canvas temporário para extrair a região exata
      const canvas = document.createElement('canvas');
      canvas.width = boxSize;
      canvas.height = boxSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível criar canvas');
      
      // Desenha a parte correspondente da imagem original
      ctx.drawImage(
        imgElement,
        relativeX, relativeY, relativeW, relativeH,
        0, 0, boxSize, boxSize
      );
      
      // Converte o canvas para ImageBitmap e tenta detectar
      const bitmap = await createImageBitmap(canvas);
      const decoded = await detectFromImageBitmap(bitmap);
      
      if (decoded) {
        onDetected(decoded);
        fecharPreview();
      } else {
        alert('Nenhum código detectado na área verde. Tente ajustar o zoom e posição para que o código fique bem nítido dentro do quadrado.');
      }
    } catch (err) {
      console.error('Erro detalhado:', err);
      alert('Erro ao processar a região central. Verifique o console para mais detalhes.');
    } finally {
      setProcessing(false);
    }
  };

  const fecharPreview = () => {
    setImagePreviewUrl(null);
    setShowCrop(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ========== UPLOAD E TENTATIVA AUTOMÁTICA ==========
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    const imageUrl = URL.createObjectURL(file);
    setImagePreviewUrl(imageUrl);

    // Tentativa de detecção automática (imagem inteira)
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

    // Se falhou, abre o modo manual com zoom/pan
    setProcessing(false);
    setShowCrop(true);
    // Aguarda o elemento img ser montado no modal
    setTimeout(() => {
      if (imageElementRef.current) {
        imageElementRef.current.src = imageUrl;
      }
    }, 50);
  };

  // ========== RENDER ==========
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Modal de ajuste manual */}
      {showCrop && imagePreviewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col items-center justify-center p-4">
          <h3 className="text-white text-lg mb-2 text-center">
            Arraste e dê zoom para posicionar o código <strong className="text-green-400">dentro do quadrado verde</strong>
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
            {/* Máscara central (quadrado verde com fundo escuro ao redor) */}
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
            • 1 dedo: arrastar • 2 dedos: zoom
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