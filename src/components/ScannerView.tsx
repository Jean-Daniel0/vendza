import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ScanQrCode, Flashlight, FlashlightOff, ImagePlus, Keyboard, ShieldCheck, CheckCircle2, AlertTriangle, Package, MapPin, RefreshCw, Camera } from 'lucide-react';
import jsQR from 'jsqr';
import { Order } from '../types';
import { precheckScan, cleanCode } from '../lib/scanParse';

interface ScannerViewProps {
  orders: Order[];
  // Résultat renvoyé par le serveur : seul l'ACHETEUR peut confirmer la réception
  onConfirmDelivery: (orderId: string, code?: string) => Promise<{ success: boolean; message: string }> | void;
  onNavigate: (view: string) => void;
  currentUserId?: string;
  // QR lu depuis l'appareil photo du téléphone (lien ?confirm=<id>&code=<code>)
  initialScan?: string;
}

type Step = 'scan' | 'review' | 'success';
type CamState = 'starting' | 'on' | 'denied' | 'unsupported';

const gdes = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} Gdes`;
const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export const ScannerView: React.FC<ScannerViewProps> = ({ orders, onConfirmDelivery, onNavigate, currentUserId, initialScan }) => {
  const [step, setStep] = useState<Step>('scan');
  const [manual, setManual] = useState(false);
  const [camState, setCamState] = useState<CamState>('starting');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<{ order: Order; code: string } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [pickId, setPickId] = useState('');
  const [pickCode, setPickCode] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastErrorAt = useRef(0);

  const pending = orders.filter(o => o.clientId === currentUserId && o.status === 'payee');

  const handleText = useCallback((text: string, extraCode?: string): boolean => {
    const r = precheckScan(orders, currentUserId, text, extraCode);
    if (r.ok === false) { setError(r.message); lastErrorAt.current = Date.now(); return false; }
    setError('');
    setFound({ order: r.order, code: r.code });
    setStep('review');
    return true;
  }, [orders, currentUserId]);

  // QR ouvert avec l'appareil photo du téléphone : on passe directement à la vérification
  useEffect(() => {
    if (initialScan && step === 'scan') handleText(initialScan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScan, orders.length]);

  // Caméra : démarre toute seule sur l'écran de scan, s'arrête dès qu'on le quitte
  useEffect(() => {
    if (step !== 'scan' || manual) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;

    const stop = () => {
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setTorchOn(false); setTorchAvailable(false);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCamState('unsupported'); return; }
      setCamState('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; v.setAttribute('playsinline', 'true'); await v.play().catch(() => {}); }
        const caps: any = stream.getVideoTracks()[0]?.getCapabilities?.() || {};
        setTorchAvailable(!!caps.torch);
        setCamState('on');

        const tick = () => {
          if (stopped) return;
          const video = videoRef.current;
          if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            // un QR invalide ne doit pas déclencher une rafale d'erreurs : une toutes les 2 secondes au plus
            if (res?.data && (Date.now() - lastErrorAt.current > 2000)) {
              if (handleText(res.data)) { stop(); return; }
            }
          }
          timer = setTimeout(tick, 140);
        };
        tick();
      } catch (e: any) {
        if (!stopped) setCamState(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'unsupported');
      }
    })();

    return () => { stopped = true; stop(); };
  }, [step, manual, handleText]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] }); setTorchOn(!torchOn); } catch { setError("La lampe n'est pas disponible sur cet appareil."); }
  };

  // Photo du QR depuis la galerie (si la caméra est refusée ou difficile à cadrer)
  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const cx = c.getContext('2d');
      cx?.drawImage(img, 0, 0, c.width, c.height);
      const d = cx?.getImageData(0, 0, c.width, c.height);
      const res = d ? jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' }) : null;
      URL.revokeObjectURL(url);
      if (res?.data) handleText(res.data); else setError('Aucun QR trouvé sur cette photo. Rapprochez-vous et réessayez.');
    };
    img.onerror = () => { URL.revokeObjectURL(url); setError("Impossible de lire cette image."); };
    img.src = url;
  };

  const verifyManual = () => {
    setError('');
    if (!pickId) { setError('Choisissez la commande à confirmer.'); return; }
    const order = pending.find(o => o.id === pickId);
    if (!order) { setError('Cette commande n’est plus en attente de livraison.'); return; }
    handleText(order.id, pickCode);
  };

  const confirm = async () => {
    if (!found || isConfirming) return;
    setIsConfirming(true); setError('');
    try {
      const result = await onConfirmDelivery(found.order.id, found.code);
      if (result && result.success === false) { setError(result.message); return; }
      setSuccessMsg((result && result.message) || 'Le paiement est libéré au vendeur.');
      setStep('success'); setFound(null);
    } catch (e: any) {
      setError(e?.message || 'Validation impossible. Réessayez.');
    } finally { setIsConfirming(false); }
  };

  const backToScan = () => { setFound(null); setError(''); setManual(false); setPickCode(''); setStep('scan'); };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-4 space-y-4 font-sans">
      <style>{`@keyframes vz-scan{0%{top:8%}50%{top:88%}100%{top:8%}}@media (prefers-reduced-motion:reduce){.vz-line{animation:none!important}}`}</style>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onNavigate('client-dashboard')} aria-label="Retour au tableau de bord"
          className="h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-extrabold text-slate-900 leading-tight">Scanner le code QR</h1>
          <p className="text-[11px] text-slate-500 leading-tight">Confirmez la réception de votre colis</p>
        </div>
      </div>

      <div aria-live="polite">
        {error && step !== 'success' && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}
      </div>

      {step === 'scan' && !manual && (
        <section className="space-y-3">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-slate-950 shadow-lg">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />

            {camState === 'on' && (
              <>
                <div className="absolute left-1/2 top-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-3xl shadow-[0_0_0_999px_rgba(2,6,23,0.58)]">
                  {['left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-3xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl'].map(c => (
                    <span key={c} className={`absolute h-9 w-9 border-teal-400 ${c}`} />
                  ))}
                  <span className="vz-line absolute inset-x-3 h-0.5 rounded-full bg-gradient-to-r from-transparent via-teal-300 to-transparent" style={{ animation: 'vz-scan 2.4s ease-in-out infinite' }} />
                </div>
                <p className="absolute inset-x-0 bottom-5 px-6 text-center text-xs font-bold text-white drop-shadow">Placez le QR du vendeur dans le cadre</p>
              </>
            )}

            {camState === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
                <RefreshCw size={22} className="animate-spin" />
                <p className="text-xs font-bold">Ouverture de la caméra…</p>
              </div>
            )}

            {(camState === 'denied' || camState === 'unsupported') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-200">
                <Camera size={30} className="text-slate-400" />
                <p className="text-sm font-extrabold">{camState === 'denied' ? 'Accès à la caméra refusé' : 'Caméra indisponible'}</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {camState === 'denied' ? 'Autorisez la caméra dans les réglages du navigateur, ou utilisez une des options ci-dessous.' : 'Utilisez une photo du QR ou saisissez le code du vendeur.'}
                </p>
              </div>
            )}

            {torchAvailable && camState === 'on' && (
              <button type="button" onClick={toggleTorch} aria-label={torchOn ? 'Éteindre la lampe' : 'Allumer la lampe'} aria-pressed={torchOn}
                className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur cursor-pointer">
                {torchOn ? <FlashlightOff size={18} /> : <Flashlight size={18} />}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <ImagePlus size={16} /> Choisir une photo
              <input type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
            </label>
            <button type="button" onClick={() => { setError(''); setManual(true); }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Keyboard size={16} /> Saisir le code
            </button>
          </div>

          <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[11px] leading-snug text-slate-500">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-teal-600" />
            Le vendeur vous montre le QR de son ticket à la livraison. Vos Gourdes ne lui sont versées qu'après votre confirmation.
          </p>
        </section>
      )}

      {step === 'scan' && manual && (
        <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">Saisir le code du vendeur</h2>
          {pending.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">Aucune commande n'est en attente de livraison sur votre compte.</p>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">1. Choisissez la commande</legend>
                {pending.map(o => (
                  <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-xs ${pickId === o.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                    <input type="radio" name="pick-order" className="accent-teal-600" checked={pickId === o.id} onChange={() => setPickId(o.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-slate-800">{o.items.map(i => i.productNom).join(', ')}</span>
                      <span className="font-mono text-[10px] text-slate-400">#{shortId(o.id)} · {gdes(o.total)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">2. Code affiché sous le QR du vendeur</span>
                <input value={pickCode} onChange={e => setPickCode(cleanCode(e.target.value))} inputMode="text" autoCapitalize="characters" autoComplete="off" maxLength={12} placeholder="ABCD EFGH"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center font-mono text-lg font-black uppercase tracking-[0.3em] text-slate-800 focus:border-teal-500 focus:outline-none" />
              </label>
              <button type="button" onClick={verifyManual} disabled={!pickId || pickCode.length < 6}
                className="w-full rounded-2xl bg-teal-600 py-3 text-xs font-extrabold uppercase tracking-wide text-white disabled:opacity-40 cursor-pointer">Vérifier</button>
            </>
          )}
          <button type="button" onClick={backToScan} className="flex w-full items-center justify-center gap-2 rounded-2xl py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 cursor-pointer">
            <ScanQrCode size={15} /> Revenir au scan
          </button>
        </section>
      )}

      {step === 'review' && found && (
        <section className="space-y-3">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 bg-teal-50 px-4 py-3 text-xs font-extrabold text-teal-700">
              <CheckCircle2 size={16} /> QR reconnu : commande #{shortId(found.order.id)}
            </div>
            <div className="space-y-3 p-4 text-xs">
              <ul className="space-y-1.5">
                {found.order.items.map((it, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-start gap-2 text-slate-800"><Package size={14} className="mt-0.5 shrink-0 text-slate-400" /><span className="font-bold">{it.productNom}{it.qte > 1 ? ` x${it.qte}` : ''}</span></span>
                    <span className="shrink-0 font-mono text-slate-600">{gdes(it.prix * it.qte)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-dashed border-slate-300 pt-3 text-sm font-black text-slate-900">
                <span>Total</span><span>{gdes(found.order.total)}</span>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><MapPin size={13} /> {found.order.commune}{found.order.departement ? `, ${found.order.departement}` : ''}</p>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-snug text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Ne confirmez que si vous avez le colis en main et l'avez vérifié. Le paiement sera libéré au vendeur.
          </p>

          <button type="button" onClick={confirm} disabled={isConfirming}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 py-3.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-lg disabled:opacity-50 cursor-pointer">
            {isConfirming ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isConfirming ? 'Validation…' : 'Confirmer la réception'}
          </button>
          <button type="button" onClick={backToScan} disabled={isConfirming} className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            Ce n'est pas la bonne commande
          </button>
        </section>
      )}

      {step === 'success' && (
        <section className="space-y-4 rounded-3xl border-2 border-emerald-500 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckCircle2 size={34} /></div>
          <h2 className="text-base font-black uppercase text-teal-700">Réception confirmée</h2>
          <p className="text-xs leading-relaxed text-slate-600">{successMsg}</p>
          <button type="button" onClick={() => onNavigate('client-dashboard')} className="w-full rounded-2xl bg-[#0c1445] py-3 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer">Retour à mes commandes</button>
        </section>
      )}
    </div>
  );
};
