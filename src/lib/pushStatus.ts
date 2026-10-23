import { useCallback, useEffect, useRef, useState } from 'react';
import OneSignal from 'react-onesignal';
import type { PushStatus } from './pushPrompt';

function read(): PushStatus {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return { supported: false, permission: 'default', subscribed: false };
  const permission = Notification.permission as PushStatus['permission'];
  let optedIn = false;
  try { optedIn = !!(OneSignal as any).User?.PushSubscription?.optedIn; } catch {}
  return { supported: true, permission, subscribed: permission === 'granted' && optedIn };
}

export type EnableResult = { ok: boolean; message?: string; detail?: string };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Suit en direct l'état d'abonnement aux notifications de ce navigateur (une fois OneSignal initialisé)
export function usePushStatus(ready: boolean, initError?: string) {
  const [status, setStatus] = useState<PushStatus>(read);
  const readyRef = useRef(ready); readyRef.current = ready;
  const errRef = useRef(initError); errRef.current = initError;
  const refresh = useCallback(() => setStatus(read()), []);

  useEffect(() => {
    if (!ready) return;
    refresh();
    try { (OneSignal as any).User?.PushSubscription?.addEventListener('change', refresh); } catch {}
    try { (OneSignal as any).Notifications?.addEventListener('permissionChange', refresh); } catch {}
    return () => {
      try { (OneSignal as any).User?.PushSubscription?.removeEventListener('change', refresh); } catch {}
      try { (OneSignal as any).Notifications?.removeEventListener('permissionChange', refresh); } catch {}
    };
  }, [ready, refresh]);

  const diagnose = useCallback(async (): Promise<string> => {
    const d: string[] = [];
    d.push(`permission=${typeof Notification !== 'undefined' ? Notification.permission : 'indisponible'}`);
    d.push(`onesignal=${readyRef.current ? 'prêt' : 'non initialisé'}`);
    if (errRef.current) d.push(`erreur=${errRef.current.slice(0, 120)}`);
    try { const s = (OneSignal as any).User?.PushSubscription; d.push(`abonné=${!!s?.optedIn}`, `id=${s?.id ? 'oui' : 'non'}`); } catch {}
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      d.push(`sw=${regs.map(r => (r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '?').replace(location.origin, '')).join(',') || 'aucun'}`);
    } catch { d.push('sw=indisponible'); }
    return d.join(' · ');
  }, []);

  // Doit être appelée directement depuis un clic (le navigateur exige un geste de l'utilisateur pour afficher la demande)
  const enable = useCallback(async (): Promise<EnableResult> => {
    try {
      if (window.self !== window.top) return { ok: false, message: 'Ouvrez Vendza dans un onglet du navigateur (pas dans un aperçu intégré) pour activer les notifications.' };
      if (typeof Notification === 'undefined') return { ok: false, message: 'Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d\'abord Vendza à l\'écran d\'accueil.' };
      if (Notification.permission === 'denied') { refresh(); return { ok: false, message: 'Les notifications sont bloquées pour ce site dans le navigateur.' }; }

      // 1) Demande native directe, indépendante d'OneSignal : c'est elle qui affiche la fenêtre « Autoriser »
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        refresh();
        if (perm !== 'granted') return { ok: false, message: perm === 'denied' ? 'Vous avez refusé les notifications.' : 'La demande a été fermée sans réponse. Réessayez.' };
      }

      // 2) Abonnement OneSignal : on attend que le SDK soit prêt (jusqu'à 10 s)
      for (let i = 0; i < 40 && !readyRef.current && !errRef.current; i++) await sleep(250);
      if (!readyRef.current) return { ok: false, message: 'Le service de notifications ne s\'est pas initialisé. Rechargez la page et réessayez.', detail: await diagnose() };

      try { await (OneSignal as any).User.PushSubscription.optIn(); } catch (e: any) { return { ok: false, message: `Abonnement impossible : ${String(e?.message || e).slice(0, 140)}`, detail: await diagnose() }; }

      // 3) On vérifie vraiment que l'abonnement existe (id attribué par OneSignal)
      for (let i = 0; i < 24; i++) {
        const s = (OneSignal as any).User?.PushSubscription;
        if (s?.optedIn && s?.id) { refresh(); return { ok: true }; }
        await sleep(250);
      }
      refresh();
      return { ok: false, message: 'Autorisation accordée, mais l\'abonnement n\'a pas pu être confirmé.', detail: await diagnose() };
    } catch (e: any) {
      return { ok: false, message: `Erreur : ${String(e?.message || e).slice(0, 140)}`, detail: await diagnose() };
    }
  }, [refresh, diagnose]);

  return { status, enable, refresh };
}
