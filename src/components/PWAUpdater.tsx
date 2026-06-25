import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function PWAUpdater() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // We register the Service Worker programmatically to hook into update events.
    // In autoUpdate mode, the new service worker activates and claims the clients immediately.
    // This triggers the 'controllerchange' event on navigator.serviceWorker.
    const handleControllerChange = () => {
      console.log('[PWA Updater] Le Service Worker a été mis à jour et a pris le contrôle.');
      setNeedRefresh(true);
      sessionStorage.setItem('vendza_sw_update_pending', 'true');
    };

    // If 'virtual:pwa-register' is loaded, we also listen to its update events
    let updateSW: (() => Promise<void>) | undefined;
    try {
      // @ts-ignore
      import('virtual:pwa-register').then(({ registerSW }) => {
        updateSW = registerSW({
          onNeedRefresh() {
            console.log('[PWA Updater] Nouvelle version disponible (onNeedRefresh).');
            setNeedRefresh(true);
            sessionStorage.setItem('vendza_sw_update_pending', 'true');
          },
          onOfflineReady() {
            console.log('[PWA Updater] L\'application est disponible hors-ligne.');
          }
        });
      }).catch((err) => {
        console.debug('[PWA Updater] Erreur lors du chargement de virtual:pwa-register:', err);
      });
    } catch (e) {
      console.debug('[PWA Updater] Erreur synchrone virtual:pwa-register:', e);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      
      // Check for updates on startup
      navigator.serviceWorker.ready.then((registration) => {
        // Manually check if there is an updated service worker waiting
        registration.update().catch((e) => console.debug('[PWA Updater] update failed:', e));
      });
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
    };
  }, []);

  // Effect to decide when to reload safely
  useEffect(() => {
    if (!needRefresh) return;

    // Show a beautiful, polite notification at the bottom
    setShowNotification(true);

    // Helper to check if the user is in the middle of a critical action
    const isUserEngagedInAction = () => {
      // 1. Is the user typing in any input?
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || activeEl.hasAttribute('contenteditable')) {
          return true;
        }
      }

      // 2. Are there active payment loaders or critical checkout elements visible?
      const bodyText = document.body.innerText || '';
      const criticalKeywords = [
        'Redirection',
        'Connexion Stripe',
        'Paiement en cours',
        'Traitement',
        'Patientez',
        'Validation physique',
        'Saisie',
        'MonCash'
      ];
      
      const hasCriticalKeywords = criticalKeywords.some(keyword => bodyText.includes(keyword));
      if (hasCriticalKeywords) {
        return true;
      }

      // 3. Are they currently on the checkout page or completing an order?
      const currentView = localStorage.getItem('vendza_current_view') || 'home';
      if (currentView === 'cart' || currentView === 'checkout' || currentView === 'scanner') {
        return true;
      }

      return false;
    };

    // Attempt to execute automatic safe reload
    const trySafeReload = () => {
      if (isUserEngagedInAction()) {
        console.log('[PWA Updater] Un rechargement automatique est nécessaire, mais reporté car l\'utilisateur est actif.');
        return false;
      }

      // Check if we already reloaded in the last 10 seconds to avoid infinite loops
      const lastReload = sessionStorage.getItem('vendza_pwa_last_reload_time');
      const now = Date.now();
      if (lastReload && now - parseInt(lastReload, 10) < 10000) {
        console.log('[PWA Updater] Rechargement automatique ignoré pour éviter une boucle de rafraîchissement.');
        return false;
      }

      console.log('[PWA Updater] Rechargement automatique sécurisé en cours...');
      sessionStorage.setItem('vendza_pwa_last_reload_time', now.toString());
      sessionStorage.removeItem('vendza_sw_update_pending');
      window.location.reload();
      return true;
    };

    // 1. Try reloading immediately if safe
    const reloaded = trySafeReload();
    if (reloaded) return;

    // 2. Listen for visibility changes (extremely silent and elegant way to update)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[PWA Updater] L\'onglet est visible. Tentative de rafraîchissement de la mise à jour...');
        trySafeReload();
      }
    };

    // 3. Listen for user interactions to check again when they are clicking but not typing
    const handleUserInteraction = () => {
      if (!isUserEngagedInAction()) {
        trySafeReload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleUserInteraction);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleUserInteraction);
    };
  }, [needRefresh]);

  if (!showNotification) return null;

  const handleForceUpdate = () => {
    console.log('[PWA Updater] Mise à jour forcée par l\'utilisateur.');
    sessionStorage.removeItem('vendza_sw_update_pending');
    window.location.reload();
  };

  return (
    <div 
      id="pwa-update-notification"
      className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-4 z-[101] animate-in slide-in-from-bottom duration-300 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
          <RefreshCw size={20} className="animate-spin" />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="font-sans font-bold text-white text-sm flex items-center justify-between">
            <span>Mise à jour disponible !</span>
            <button 
              onClick={() => setShowNotification(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Une nouvelle version de Vendza a été installée. Elle s'activera automatiquement au prochain démarrage ou au changement d'onglet.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end border-t border-slate-800/60 pt-3">
        <button
          onClick={() => setShowNotification(false)}
          className="px-3 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer"
        >
          Plus tard
        </button>
        <button
          onClick={handleForceUpdate}
          className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 font-bold text-slate-950 rounded-xl text-xs shadow-lg shadow-teal-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          Mettre à jour maintenant
        </button>
      </div>
    </div>
  );
}
