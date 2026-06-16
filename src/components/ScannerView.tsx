import React, { useState, useEffect, useRef } from 'react';
import { Video, Check, Key } from 'lucide-react';
import { Order } from '../types';
import jsQR from 'jsqr';

interface ScannerViewProps {
  orders: Order[];
  onConfirmDelivery: (orderId: string) => void;
  onNavigate: (view: string) => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  orders,
  onConfirmDelivery,
  onNavigate
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [manualId, setManualId] = useState<string>('');
  
  // States of detected order
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [scanError, setScanError] = useState<string>('');
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Parse scanned text to find actual Order ID (supporting URLs and raw IDs)
  const parseScannedText = (text: string): string => {
    const raw = text.trim();
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const url = new URL(raw);
        const idParam = url.searchParams.get('id');
        if (idParam) return idParam;
      }
    } catch (_) {}
    
    if (raw.includes('?id=')) {
      const parts = raw.split('?id=');
      if (parts[1]) {
        return parts[1].split('&')[0];
      }
    }
    
    return raw;
  };

  // Search active orders matching this id
  const handleSimulateScan = (scannedText: string) => {
    setScanError('');
    setScanSuccess(false);
    
    const searchId = parseScannedText(scannedText);
    if (!searchId) return;

    const found = orders.find(o => 
      o.id.toLowerCase() === searchId.toLowerCase() || 
      o.id.toLowerCase().includes(searchId.toLowerCase())
    );

    if (found) {
      setScannedOrder(found);
    } else {
      setScanError(`✕ Commande introuvable pour la référence "${searchId}".`);
      setScannedOrder(null);
    }
  };

  // Setup actual web camera streaming and interval scanning
  useEffect(() => {
    let intervalId: any = null;

    const startCamera = async () => {
      setScanError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(e => console.error("Error playing stream:", e));
        }

        intervalId = setInterval(() => {
          if (!videoRef.current) return;
          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const qrCodeResult = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (qrCodeResult && qrCodeResult.data) {
                handleSimulateScan(qrCodeResult.data);
                setCameraActive(false);
              }
            }
          }
        }, 350);

      } catch (err) {
        console.error('Camera access error:', err);
        setScanError("Impossible d'accéder à la caméra ou permission refusée. Veuillez utiliser la saisie manuelle.");
        setCameraActive(false);
      }
    };

    if (cameraActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      stopCamera();
    };
  }, [cameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Validate transaction
  const executeValidation = () => {
    if (!scannedOrder) return;
    onConfirmDelivery(scannedOrder.id);
    setScanSuccess(true);
    setScannedOrder(null);
    setCameraActive(false);
    setManualId('');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center space-y-1.5">
        <h1 className="font-serif text-lg font-bold tracking-tight text-slate-800 flex items-center justify-center gap-1.5">
          💥 Validation de Livraison Vendza
        </h1>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Scannez le QR Code du ticket marchand ou saisissez l'identifiant pour libérer le versement garanti au vendeur.
        </p>
      </div>

      {scanSuccess ? (
        /* Success animation card */
        <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 text-center space-y-4 max-w-md mx-auto shadow-lg animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-3xl mx-auto shadow-md animate-bounce">
            <Check size={32} />
          </div>
          <h2 className="font-serif text-[#0d9488] text-base font-black uppercase">Livraison validée avec succès !</h2>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Le reçu est bien enregistré. Les Gourdes de la commande ont été débloquées et automatiquement créditées sur le compte mobile du vendeur.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl max-w-xs mx-auto text-[10.5px] font-bold text-slate-500">
            ✓ Garantie libérée · Statut mis à jour
          </div>
          <button
            onClick={() => {
              setScanSuccess(false);
              onNavigate('client-dashboard');
            }}
            className="w-full max-w-xs py-2.5 bg-[#0c1445] text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Retourner au Tableau de Bord
          </button>
        </div>
      ) : scannedOrder ? (
        /* Detected Order Card for confirmation */
        <div className="bg-white border-2 border-blue-400 rounded-3xl p-6 text-center space-y-4 max-w-md mx-auto shadow-lg animate-scale-up">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-serif text-xl mx-auto border-2 border-blue-200">
            VZ
          </div>
          <h2 className="font-serif text-[#0c1445] text-base font-extrabold">Commande Détectée !</h2>
          
          <div className="bg-slate-50 border rounded-xl p-3 text-left space-y-2 text-xs">
            <p className="text-slate-500 font-mono text-[9px] truncate">ID: {scannedOrder.id}</p>
            <p><strong>Acheteur :</strong> {scannedOrder.clientNom}</p>
            <p><strong>Zone de colis :</strong> {scannedOrder.commune} ({scannedOrder.departement})</p>
            <p><strong>Total Commande :</strong> <span className="font-mono font-bold text-blue-600">{scannedOrder.total} Gdes</span></p>
            <p><strong>Statut :</strong> <span className="text-amber-500 font-bold uppercase tracking-wider">{scannedOrder.status}</span></p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setScannedOrder(null)}
              className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-500 cursor-pointer"
            >
              Réessayer
            </button>
            <button
              onClick={executeValidation}
              className="flex-2 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-extrabold text-xs tracking-wider uppercase rounded-lg shadow-md cursor-pointer"
            >
              ✅ Confirmer Réception
            </button>
          </div>
        </div>
      ) : (
        /* Standard scanning interface */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 max-w-4xl mx-auto">
          {/* Left panel: Camera block */}
          <div className="md:col-span-7 bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
                <Video size={14} className="text-blue-500" /> Caméra de scan
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cameraActive ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {cameraActive ? '● Active' : 'Inactive'}
              </span>
            </div>

            {/* Hidden Canvas to capture frame data */}
            <canvas id="hidden-scan-canvas" className="hidden" />

            {/* Video Box */}
            <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden flex flex-col justify-between items-center p-3 select-none">
              {cameraActive ? (
                <>
                  <video 
                    ref={videoRef} 
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline 
                    muted
                  />
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-md animate-bounce top-1/4 z-10" />
                  <div className="absolute border-4 border-[#0d9488] border-dashed w-36 h-36 rounded-xl animate-pulse opacity-90 inset-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-widest bg-slate-900/60 p-1.5 rounded">VENDZA SCAN</span>
                  </div>
                  <span className="absolute bottom-3 bg-slate-900/80 text-white text-[9.5px] px-3 py-1 rounded-full border border-white/10 flex items-center gap-1 z-10 font-sans">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    Pointez sur le QR proposé par le vendeur
                  </span>
                </>
              ) : (
                <div className="my-auto text-center space-y-2">
                  <span className="text-3xl">📷</span>
                  <p className="text-slate-400 text-xs font-bold">Caméra désactivée</p>
                  <p className="text-[10px] text-slate-500 max-w-xs">Appuyez sur démarrer pour activer votre caméra et scanner la livraison.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCameraActive(!cameraActive)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                  cameraActive 
                    ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                    : 'bg-[#0d9488] hover:bg-teal-700 text-white shadow-md'
                }`}
              >
                {cameraActive ? 'Arrêter la caméra' : 'Démarrer la caméra de scan'}
              </button>
            </div>
            

          </div>

          {/* Right panel: Saisie manuelle section */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-white border border-slate-100 p-4 rounded-3xl shadow-xs space-y-3">
              <div className="text-xs font-bold text-[#0c1445] flex items-center gap-1.5 uppercase tracking-wide">
                <Key size={13} className="text-blue-500" /> Saisie de l'ID colis
              </div>
              
              <p className="text-[10.5px] text-slate-400 leading-normal">
                Saisissez ou collez simplement l'identifiant pour valider la livraison :
              </p>

              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Coller l'identifiant de commande ici..."
                  className="w-full py-2.5 px-3 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:border-blue-600"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                />
                
                <button
                  type="button"
                  onClick={() => handleSimulateScan(manualId)}
                  className="w-full py-2 bg-blue-50 text-[#0d9488] hover:bg-[#0d9488] hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Vérifier la livraison de conformité
                </button>
              </div>

              {scanError && (
                <p className="p-2 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100">
                  {scanError}
                </p>
              )}
            </div>

            {/* Instruction block */}
            <div className="bg-white border border-slate-100 p-4 rounded-3xl shadow-xs space-y-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block pb-1 border-b border-slate-50">Instructions</span>
              <div className="space-y-2 text-[10.5px] text-slate-500 leading-normal font-medium">
                <p>1. Le vendeur présente le colis avec son QR code imprimé ou affiché.</p>
                <p>2. L'acheteur scanne le QR code à l'aide de sa caméra ou saisit l'identifiant.</p>
                <p>3. Les fonds de la commande sont instantanément reversés au vendeur.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
