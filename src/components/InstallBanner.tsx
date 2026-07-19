import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Info, AppWindow } from 'lucide-react';
import { getSystemImageUrl } from '../lib/supabaseClient';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export function InstallBanner() {
  const pwaIcon192 = getSystemImageUrl('pwa-icon-192.png', '/pwa-icon-192.png');

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState<boolean>(false);
  const [showIOSBanner, setShowIOSBanner] = useState<boolean>(false);
  const [showManualBanner, setShowManualBanner] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');

  useEffect(() => {
    // 1. Core Standalone verification (Android / iOS / Desktop)
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as any).standalone === true;

    if (isStandaloneMode) {
      setIsInstalled(true);
      return;
    }

    // Checking if already marked as installed permanently
    if (localStorage.getItem('vendza_pwa_installed_persist') === 'true') {
      setIsInstalled(true);
      return;
    }

    // 2. Extra getInstalledRelatedApps check (Chrome / Android)
    const navAny = navigator as any;
    if (navAny.getInstalledRelatedApps && typeof navAny.getInstalledRelatedApps === 'function') {
      navAny.getInstalledRelatedApps()
        .then((relatedApps: any[]) => {
          if (relatedApps && relatedApps.length > 0) {
            setIsInstalled(true);
            localStorage.setItem('vendza_pwa_installed_persist', 'true');
          }
        })
        .catch((err: any) => {
          console.debug('[PWA Install] Related apps check failed:', err);
        });
    }

    // 3. Detect Platform
    const userAgent = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /Android/i.test(userAgent);

    if (isIOSDevice) {
      setActiveTab('ios');
    } else if (isAndroidDevice) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    // Check recent dismissions in localStorage
    const installDismissedTime = localStorage.getItem('vendza_install_dismissed');

    let dismissedAndroidRecently = false;
    if (installDismissedTime) {
      const parsedTime = parseInt(installDismissedTime, 10);
      const now = Date.now();
      // 1 day in milliseconds
      const cooldown = 24 * 60 * 60 * 1000;
      if (now - parsedTime < cooldown) {
        dismissedAndroidRecently = true;
      }
    }

    // 4. Setup beforeinstallprompt listener (Android / Chrome Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      // Show Android/Chrome native banner if not recently dismissed
      if (!isStandaloneMode && !dismissedAndroidRecently) {
        setShowAndroidBanner(true);
      }
    };

    // 5. Setup appinstalled listener
    const handleAppInstalled = () => {
      console.log('[PWA Install] Vendza application installed successfully!');
      setIsInstalled(true);
      setShowAndroidBanner(false);
      setShowIOSBanner(false);
      setShowManualBanner(false);
      localStorage.setItem('vendza_pwa_installed_persist', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 6. Handle Fallback/Manual Banner visibility:
    // If the browser does not fire the native prompt (Chrome iframe / general Safari),
    // we show our custom unintrusive manual banner so they still get the option!
    if (!isStandaloneMode && !dismissedAndroidRecently) {
      // Small timeout to let everything load
      const timer = setTimeout(() => {
        if (!deferredPrompt) {
          setShowManualBanner(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

  // Handle standard install prompt action
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger prompt
      await deferredPrompt.prompt();
      
      // Await user's answer
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA Install] User accepted the installation prompt.');
        setIsInstalled(true);
        setShowAndroidBanner(false);
        localStorage.setItem('vendza_pwa_installed_persist', 'true');
      } else {
        console.log('[PWA Install] User dismissed the installation prompt.');
        localStorage.setItem('vendza_install_dismissed', Date.now().toString());
        setShowAndroidBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback: Open beautiful guidelines modal
      setShowGuideModal(true);
    }
  };

  // Dismiss Android/Chrome banner (Ignore)
  const handleAndroidDismiss = () => {
    localStorage.setItem('vendza_install_dismissed', Date.now().toString());
    setShowAndroidBanner(false);
    setShowManualBanner(false);
  };

  if (isInstalled) return null;

  return (
    <>
      {/* 1. Base Floating Install Invitation Badge / Notification */}
      {(showAndroidBanner || showManualBanner) && (
        <div 
          id="pwa-install-banner-android"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-4.5 z-[100] animate-in slide-in-from-bottom duration-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl border border-slate-100 flex items-center justify-center p-1 bg-white shadow-sm shrink-0">
              <img 
                src={pwaIcon192} 
                alt="Vendza" 
                className="w-full h-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (img.src.includes('images_systeme')) {
                    img.src = '/pwa-icon-192.png';
                  } else {
                    img.style.display = 'none';
                  }
                }}
              />
            </div>
            <div className="space-y-0.5">
              <h4 className="font-sans font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <span>Installer l'app Vendza</span>
                <span className="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              </h4>
              <p className="text-[11px] text-slate-500 leading-normal font-sans">
                Accès direct depuis votre écran, notifications instantanées et chargement rapide.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 border-t border-slate-100 sm:border-0 pt-2.5 sm:pt-0">
            <button
              onClick={handleAndroidDismiss}
              className="flex-1 sm:flex-none px-3.5 py-2 hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer select-none"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstallClick}
              className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 font-bold text-white rounded-xl text-xs shadow-lg shadow-blue-600/10 flex items-center justify-center gap-1.5 transition cursor-pointer select-none"
            >
              <Download size={13} className="stroke-[2.5]" />
              Installer
            </button>
          </div>
        </div>
      )}

      {/* 2. Interactive PWA Installation Guidelines Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 overflow-hidden flex flex-col gap-5 max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-slate-100 p-1 bg-white shadow-sm flex items-center justify-center shrink-0">
                  <img 
                    src={pwaIcon192} 
                    alt="Vendza logo" 
                    className="w-10 h-10 object-contain rounded-lg" 
                    referrerPolicy="no-referrer" 
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      if (img.src.includes('images_systeme')) {
                        img.src = '/pwa-icon-192.png';
                      } else {
                        img.style.display = 'none';
                      }
                    }}
                  />
                </div>
                <div>
                  <h3 className="font-sans font-extrabold text-slate-900 text-base">Installer l'application Vendza</h3>
                  <p className="text-xs text-slate-500">Ajouter à l'écran d'accueil en quelques secondes</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Platform Tabs Header */}
            <div className="flex border-b border-slate-100 shrink-0">
              <button
                onClick={() => setActiveTab('android')}
                className={`flex-1 pb-2.5 font-sans font-bold text-xs border-b-2 transition-all cursor-pointer ${
                  activeTab === 'android' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                🤖 Android
              </button>
              <button
                onClick={() => setActiveTab('ios')}
                className={`flex-1 pb-2.5 font-sans font-bold text-xs border-b-2 transition-all cursor-pointer ${
                  activeTab === 'ios' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                🍎 iOS (iPhone/iPad)
              </button>
              <button
                onClick={() => setActiveTab('desktop')}
                className={`flex-1 pb-2.5 font-sans font-bold text-xs border-b-2 transition-all cursor-pointer ${
                  activeTab === 'desktop' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                💻 Ordinateur
              </button>
            </div>

            {/* Instruction Contents */}
            <div className="overflow-y-auto space-y-4 py-2 pr-1 text-sm font-sans text-slate-600">
              {activeTab === 'android' && (
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">1</span>
                    <p className="leading-relaxed">
                      Ouvrez votre navigateur <strong className="text-slate-800">Google Chrome</strong> ou <strong className="text-slate-800">Samsung Internet</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">2</span>
                    <p className="leading-relaxed">
                      Appuyez sur le bouton de menu <strong className="text-slate-800 font-bold">⋮ (trois points)</strong> situé dans le coin supérieur ou inférieur droit.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">3</span>
                    <p className="leading-relaxed">
                      Sélectionnez <strong className="text-teal-600 font-bold">« Installer l'application »</strong> ou <strong className="text-slate-800">« Ajouter à l'écran d'accueil »</strong> dans la liste.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'ios' && (
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">1</span>
                    <p className="leading-relaxed">
                      Assurez-vous d'utiliser le navigateur <strong className="text-[#2563eb]">Safari</strong> d'Apple.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">2</span>
                    <p className="leading-relaxed flex items-center gap-1.5 flex-wrap">
                      Appuyez sur l'icône de <strong className="text-slate-800">Partage</strong> <Share size={14} className="text-blue-500 inline stroke-[2.5]" /> (le carré bleu avec la flèche qui pointe vers le haut) au bas de l'écran.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">3</span>
                    <p className="leading-relaxed flex items-center gap-1.5 flex-wrap">
                      Faites glisser vers le haut et choisissez <strong className="text-teal-600 font-bold">« Sur l'écran d'accueil »</strong> <PlusSquare size={14} className="text-blue-500 inline stroke-[2.5]" />.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'desktop' && (
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">1</span>
                    <p className="leading-relaxed">
                      Dans la barre d'adresse en haut à droite, cliquez sur la petite icône <strong className="text-slate-800">Installer</strong> (qui ressemble à un écran d'ordinateur muni d'une flèche).
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">2</span>
                    <p className="leading-relaxed">
                      Si l'icône n'est pas présente, cliquez sur le menu <strong className="text-slate-800 font-bold">⋮ (trois points)</strong> de votre navigateur Chrome ou Edge.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-xs shrink-0 font-extrabold mt-0.5">3</span>
                    <p className="leading-relaxed">
                      Sélectionnez <strong className="text-teal-600 font-bold">« Enregistrer et partager »</strong> puis <strong className="text-teal-600 font-bold">« Installer la page comme une application »</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button 
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer select-none"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
