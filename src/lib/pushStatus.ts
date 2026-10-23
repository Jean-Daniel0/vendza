import { useCallback, useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import type { PushStatus } from './pushPrompt';

function read(): PushStatus {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return { supported: false, permission: 'default', subscribed: false };
  const permission = Notification.permission as PushStatus['permission'];
  let optedIn = false;
  try { optedIn = !!(OneSignal as any).User?.PushSubscription?.optedIn; } catch {}
  return { supported: true, permission, subscribed: permission === 'granted' && optedIn };
}

// Suit en direct l'état d'abonnement aux notifications de ce navigateur (une fois OneSignal initialisé)
export function usePushStatus(ready: boolean) {
  const [status, setStatus] = useState<PushStatus>(read);
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

  const enable = useCallback(async () => {
    try { await OneSignal.Notifications.requestPermission(); } catch {}
    try { await (OneSignal as any).User?.PushSubscription?.optIn(); } catch {}
    refresh();
  }, [refresh]);

  return { status, enable, refresh };
}
