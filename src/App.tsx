import React, { useState, useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MarketplaceHome, ProductGridCard } from './components/MarketplaceHome';
import { ProductDetail } from './components/ProductDetail';
import { CartView } from './components/CartView';
import { ClientDashboard } from './components/ClientDashboard';
import { VendorDashboard } from './components/VendorDashboard';
import { CreateProduct } from './components/CreateProduct';
import { Subscription } from './components/Subscription';
import { SubscriptionSuccess } from './components/SubscriptionSuccess';
import { ScannerView } from './components/ScannerView';
import { InboxView } from './components/InboxView';
import { AuthView } from './components/AuthView';
import { TermsPage } from './components/TermsPage';
import { PrivacyPage } from './components/PrivacyPage';
import { AboutPage } from './components/AboutPage';
import { VendorProfileView } from './components/VendorProfileView';
import { ShopSettingsView } from './components/ShopSettingsView';
import { BecomeSellerView } from './components/BecomeSellerView';
import { TicketDetailView } from './components/TicketDetailView';
import { CheckoutReturn } from './components/CheckoutReturn';
import { InstallBanner } from './components/InstallBanner';
import { PWAUpdater } from './components/PWAUpdater';

import { Product, CartItem, Order, Review, Message, UserProfile } from './types';
import { INITIAL_PRODUCTS, INITIAL_REVIEWS } from './data';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

// Predefined live states empty to welcome live database content only
const INITIAL_MESSAGES: Message[] = [];
const INITIAL_ORDERS: Order[] = [];

// Cache local 5 minutes
let productsCache: any[] | null = null;
let cacheTime: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

const FRONTEND_FALLBACK_PRODUCTS: Product[] = [];

export default function App() {
  const [currentView, setCurrentView] = useState<string>(() => {
    return localStorage.getItem('vendza_current_view') || 'home';
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('vendza_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Persist currentView and currentUser to localStorage
  useEffect(() => {
    localStorage.setItem('vendza_current_view', currentView);
  }, [currentView]);

  // --- Back Button Navigation & PWA History Management ---
  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    // 1. Initial state baseline setup
    if (!window.history.state || window.history.state.view === undefined) {
      if (currentView === 'home') {
        window.history.replaceState({ view: 'home' }, '');
      } else {
        // If we land on another page (e.g. redirected success page),
        // we replace history with home first, then push currentView
        // so that there's always a 'home' state behind us!
        window.history.replaceState({ view: 'home' }, '');
        window.history.pushState({ view: currentView }, '');
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      const activeView = currentViewRef.current;
      
      if (activeView !== 'home') {
        // If they click back when on any other page, go to 'home'!
        setCurrentView('home');
        
        // Push state of 'home' on the stack to prevent going back further (e.g. to payment gateways)
        window.history.pushState({ view: 'home' }, '');
      } else {
        // We are on home page, and they clicked back -> trigger close/exit
        try {
          window.close();
        } catch (e) {
          console.warn("Auto-close is not supported by this browser container:", e);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const lastPushedViewRef = useRef(currentView);

  useEffect(() => {
    if (currentView === lastPushedViewRef.current) return;
    
    // Push the state so back button navigation can detect the popup/view change
    window.history.pushState({ view: currentView }, '');
    lastPushedViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('vendza_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('vendza_current_user');
    }
  }, [currentUser]);
  
  // Custom MonCash States
  const [isRedirectingToMonCash, setIsRedirectingToMonCash] = useState<boolean>(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [redirectPaymentMethod, setRedirectPaymentMethod] = useState<'moncash' | 'stripe' | null>(null);
  const [moncashSuccessOrder, setMoncashSuccessOrder] = useState<string | null>(null);
  const [moncashErrorOrder, setMoncashErrorOrder] = useState<string | null>(null);
  
  // Instant checkout (Acheter maintenant) payment choice state
  const [instantCheckoutModalItem, setInstantCheckoutModalItem] = useState<{
    product: Product;
    quantity: number;
    color?: string;
    size?: string;
  } | null>(null);
  
  // Custom ticket view states
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [previousView, setPreviousView] = useState<string>('home');

  // Active inbox vendor chat focus routing
  const [activeChatRecipientId, setActiveChatRecipientId] = useState<string | null>(null);
  const [activeChatRecipientNom, setActiveChatRecipientNom] = useState<string | null>(null);

  // Selected vendor profile view state
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  // Core dynamic datasets states
  const [products, setProducts] = useState<Product[]>(FRONTEND_FALLBACK_PRODUCTS);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsPage, setProductsPage] = useState<number>(0);
  const [hasMoreProducts, setHasMoreProducts] = useState<boolean>(true);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('vendza_messages');
      return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(FRONTEND_FALLBACK_PRODUCTS[0] || null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  // Real-time exchange rate Gdes/USD
  const [tauxUSD, setTauxUSD] = useState<number>(130);
  const [oneSignalInitDone, setOneSignalInitDone] = useState<boolean>(false);

  // Canceled order process states
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [refundConfirmationMsg, setRefundConfirmationMsg] = useState<string | null>(null);

  // Initialize OneSignal Push Notifications Web SDK
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        console.log('[OneSignal] Initializing Web SDK...');
        await OneSignal.init({
          appId: '75a4d965-5500-4694-abfa-69b8a88c9d1d',
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: true,
          } as any,
        });
        console.log('[OneSignal] Initialized successfully with App ID : 75a4d965-5500-4694-abfa-69b8a88c9d1d');
        setOneSignalInitDone(true);
      } catch (err) {
        console.warn('[OneSignal] Initialization error:', err);
      }
    };
    initOneSignal();
  }, []);

  // Synchronize OneSignal logged-in user alias
  useEffect(() => {
    if (!oneSignalInitDone) return;

    if (currentUser?.id) {
      try {
        console.log('[OneSignal] Logging in external user ID:', currentUser.id);
        OneSignal.login(currentUser.id)
          .then(() => {
            console.log('[OneSignal] External user ID synchronized successfully:', currentUser.id);
          })
          .catch(err => {
            console.warn('[OneSignal] Login call failed:', err);
          });
      } catch (err) {
        console.warn('[OneSignal] Error logging user in OneSignal:', err);
      }
    } else {
      try {
        console.log('[OneSignal] Logging out external user ID...');
        OneSignal.logout()
          .catch(err => {
            console.warn('[OneSignal] Logout call failed:', err);
          });
      } catch (err) {
        console.warn('[OneSignal] Error logging out in OneSignal:', err);
      }
    }
  }, [currentUser?.id, oneSignalInitDone]);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase
        .from('exchange_rates')
        .select('usd_to_htg')
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.warn('[Exchange Rates DB] Error loading from exchange_rates table:', error.message);
          } else if (data && data.usd_to_htg) {
            setTauxUSD(Number(data.usd_to_htg));
            console.log('[Exchange Rates DB] Rate loaded successfully:', data.usd_to_htg);
          }
        });
    }
  }, []);

  // State for tracking Supabase Storage Row-Level Security permission failures
  const [storageRlsError, setStorageRlsError] = useState<boolean>(false);
  const [messagesRlsError, setMessagesRlsError] = useState<boolean>(false);

  // Helper utility to compress base64 images to keep database payloads extremely small and avoid failures
  const compressBase64Image = (base64Str: string, maxDimension: number = 400): Promise<string> => {
    return new Promise((resolve) => {
      if (!base64Str || !base64Str.startsWith('data:image')) {
        resolve(base64Str);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = base64Str;
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64Str);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG format with 0.5 utility quality
          const compressed = canvas.toDataURL('image/jpeg', 0.5);
          resolve(compressed);
        } catch (err) {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  // Adaptive database operations
  const adaptiveInsert = async (table: string, payload: any) => {
    if (!supabase) return { ok: false };
    const targetTable = table;
    const body = { ...payload };
    let lastError: any = null;
    for (let k = 0; k < 15; k += 1) {
      try {
        const { error } = await supabase.from(targetTable).insert([body]);
        if (!error) return { ok: true };
        lastError = error;
        const msg = String(error.message || '');
        if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
          console.warn("Supabase connection issue detected during adaptive insert:", msg);
          break;
        }
        if (error.code === '42P01' || (msg.includes('relation') && msg.includes('does not exist'))) {
          break;
        }
        const miss = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
        if (miss && miss[1] && Object.prototype.hasOwnProperty.call(body, miss[1])) {
          delete body[miss[1]];
          continue;
        }
        break;
      } catch (err: any) {
        const errMsg = String(err?.message || '');
        if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
          console.warn("Supabase exception network issue detected during insert:", errMsg);
        }
        return { ok: false, error: err };
      }
    }
    return { ok: false, error: lastError };
  };

  const adaptiveUpdate = async (table: string, payload: any, matchId: string) => {
    if (!supabase) return { ok: false };
    const targetTable = table;
    const body = { ...payload };
    let lastError: any = null;
    for (let k = 0; k < 15; k += 1) {
      try {
        const idKey = 'id';
        const { data, error } = await supabase.from(targetTable).update(body).eq(idKey, matchId).select();
        
        if (error) {
          lastError = error;
          const msg = String(error.message || '');
          if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
            console.warn("Supabase connection issue detected during adaptive update:", msg);
            break;
          }
          if (error.code === '42P01' || (msg.includes('relation') && msg.includes('does not exist'))) {
            break;
          }

          // If a Postgres array syntax / type conversion issue is detected (e.g., column is TEXT but we passed a JS array)
          if (msg.includes('array') || msg.includes('syntax') || msg.includes('type') || error.code === '22P02') {
            if (Array.isArray(body.premium_depts)) {
              body.premium_depts = JSON.stringify(body.premium_depts);
            }
            if (Array.isArray(body.premiumdepts)) {
              body.premiumdepts = JSON.stringify(body.premiumdepts);
            }
            continue;
          }

          const miss = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
          if (miss && miss[1] && Object.prototype.hasOwnProperty.call(body, miss[1])) {
            delete body[miss[1]];
            continue;
          }
          break;
        }
        
        return { ok: true };
      } catch (err: any) {
        const errMsg = String(err?.message || '');
        if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
          console.warn("Supabase exception network issue detected during update:", errMsg);
        }
        return { ok: false, error: err };
      }
    }
    return { ok: false, error: lastError };
  };

  // Load profile callback
  const loadUserProfile = async (uid: string) => {
    if (!supabase || !isSupabaseConfigured) return;
    try {
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      
      if (error) {
        console.error("Erreur de profil Supabase (profiles):", error.message);
        return;
      }
      
      if (profile) {
        const firstName = profile.prenom || profile.first_name || profile.name || profile.full_name?.split(' ')[0] || '';
        const lastName = profile.nom || profile.last_name || profile.full_name?.split(' ').slice(1).join(' ') || '';
        const shopNameVal = profile.boutique_nom || profile.shop_name || profile.boutique || profile.name;
        const shopDescVal = profile.boutique_desc || profile.shop_desc || profile.shop_description;
        const avatarVal = profile.avatar_url || profile.avatar || profile.photo_url || profile.profile_image;
        const bannerVal = profile.banner || profile.cover_url || profile.cover_image || profile.banner_url;

         const rawPlan = profile.plan || 'Gratuit';
         let normalizedPlan: 'Gratuit' | 'Pro Local' | 'Pro National' = 'Gratuit';
         const cleanPlan = String(rawPlan).toLowerCase().replace(/_/g, ' ');
         if (cleanPlan === 'pro local') {
           normalizedPlan = 'Pro Local';
         } else if (cleanPlan === 'pro national') {
           normalizedPlan = 'Pro National';
         }

         const rawStatut = profile.statut_verification || 'non_verifie';
         let normalizedStatut: 'non_verifie' | 'en_verification' | 'verifie' = 'non_verifie';
         const cleanStatut = String(rawStatut).toLowerCase();
         if (cleanStatut === 'en_verification') {
           normalizedStatut = 'en_verification';
         } else if (cleanStatut === 'verifie') {
           normalizedStatut = 'verifie';
         }

         setCurrentUser({
          id: profile.id || uid,
          prenom: firstName,
          nom: lastName,
          email: profile.email || '',
          tel: profile.telephone || profile.tel || profile.phone_number || profile.phone || '',
          departement: profile.departement || 'Ouest',
          commune: profile.commune || '',
          shopName: shopNameVal || undefined,
          shopDesc: shopDescVal || undefined,
          avatar: avatarVal || undefined,
          banner: bannerVal || undefined,
          userType: (profile.type || profile.user_type || 'client') as 'client' | 'vendeur',
          plan: normalizedPlan,
          statutVerification: normalizedStatut,
          revenusBloques: Number(profile.revenus_bloques || 0),
          premiumDepts: (() => {
            const raw = profile.premium_depts || profile.premiumdepts || [];
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string' && raw.trim().startsWith('[')) {
              try {
                return JSON.parse(raw);
              } catch (e) {}
            }
            if (typeof raw === 'string') {
              return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
            return [];
          })(),
          categories: (() => {
            const rawCat = profile.categories || [];
            if (Array.isArray(rawCat)) return rawCat;
            if (typeof rawCat === 'string' && rawCat.trim().startsWith('[')) {
              try { return JSON.parse(rawCat); } catch (e){}
            }
            if (typeof rawCat === 'string' && rawCat.length > 0) {
              return rawCat.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
            return [];
          })(),
          moncash: profile.numero_moncash || profile.moncash || profile.moncash_num || '',
          moncashNom: profile.moncash_nom || profile.moncashnom || '',
          banque: profile.banque || profile.bank_name || '',
          compteBanque: profile.compte_banque || profile.comptebanque || profile.bank_account || '',
          idType: profile.id_type || profile.idtype || '',
          idNumber: profile.id_number || profile.idnumber || '',
          idFile: profile.id_file || profile.idfile || profile.id_document_url || ''
        });
      } else {
        // Auto-recreate missing profile rows safely
        console.warn("Profil introuvable, création automatique de profil pour l'id:", uid);
        try {
          const { data: { user }, error: userErr } = await supabase.auth.getUser();
          if (userErr) throw userErr;
          if (user && user.id === uid) {
            const email = user.email || '';
            const parts = email.split('@')[0].split('.');
            const prenom = parts[0] ? (parts[0].charAt(0).toUpperCase() + parts[0].slice(1)) : 'Acheteur';
            const nom = parts[1] ? (parts[1].charAt(0).toUpperCase() + parts[1].slice(1)) : 'Vendza';
            
            const autoProfile: any = {
              id: user.id,
              prenom,
              first_name: prenom,
              nom,
              last_name: nom,
              full_name: `${prenom} ${nom}`.trim(),
              email,
              user_type: 'vendeur', // Default to vendor so they can explore dashboards out-of-the-box
              plan: 'Pro National', // Give them Pro National access in preview
              departement: 'Ouest',
              commune: 'Pétion-Ville',
              shop_name: `Boutique de ${prenom}`,
              boutique: `Boutique de ${prenom}`
            };

            await adaptiveInsert('profiles', autoProfile);

            setCurrentUser({
              id: user.id,
              prenom,
              nom,
              email,
              tel: '',
              departement: 'Ouest',
              commune: 'Pétion-Ville',
              shopName: `Boutique de ${prenom}`,
              userType: 'vendeur',
              plan: 'Pro National',
              premiumDepts: []
            });
          }
        } catch (authErr) {
          console.error("Error fetching user in loadUserProfile fallback:", authErr);
        }
      }
    } catch (e) {
      console.error("Erreur de récupération du profil:", e);
    }
  };

  // Auth synchronization effect
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const handleAuthError = async (err: any) => {
      console.error("[Supabase Auth Error Detected]:", err);
      const strErr = String(err?.message || err || '');
      if (
        strErr.includes('Refresh Token') || 
        strErr.includes('refresh_token') || 
        strErr.includes('invalid_grant') || 
        strErr.includes('not found') || 
        strErr.includes('Invalid Refresh Token')
      ) {
        console.warn("Broken session detected. Purging local auth state and resetting...");
        try {
          // Clear all local storage auth keys
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith('sb-') || key.includes('auth-token')) {
              localStorage.removeItem(key);
            }
          }
          for (const key of Object.keys(sessionStorage)) {
            if (key.startsWith('sb-') || key.includes('auth-token')) {
              sessionStorage.removeItem(key);
            }
          }
          await supabase.auth.signOut({ scope: 'local' });
        } catch (e) {
          console.error("Error during manual auth purge:", e);
        } finally {
          setCurrentUser(null);
        }
      }
    };

    // Check pre-existing session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          handleAuthError(error);
          return;
        }
        if (session?.user) {
          loadUserProfile(session.user.id);
        }
      })
      .catch((err) => {
        handleAuthError(err);
      });

    // Handle authentication updates reactive stream
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          loadUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      } catch (err) {
        handleAuthError(err);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Products dynamic synchronization with registered vendors resolving and image resolutions from storage
  async function fetchProducts(pageNum = 0, isAppend = false) {
    if (!isSupabaseConfigured || !supabase) {
      if (!isAppend) {
        setProducts(FRONTEND_FALLBACK_PRODUCTS);
        const searchParams = new URLSearchParams(window.location.search);
        const prodId = searchParams.get('product') || searchParams.get('p') || window.location.hash.match(/#product=(.+)/)?.[1] || window.location.hash.match(/#p=(.+)/)?.[1];
        const linked = prodId ? FRONTEND_FALLBACK_PRODUCTS.find(p => p.id === prodId) : null;
        if (linked) {
          setSelectedProduct(linked);
          setCurrentView('detail');
        } else {
          setSelectedProduct(FRONTEND_FALLBACK_PRODUCTS[0]);
        }
      }
      setProductsLoading(false);
      setHasMoreProducts(false);
      return;
    }

    if (pageNum === 0) {
      setProductsLoading(true);
    }

    try {
      // Local pickImage resolver matching production website logic
      function pickImage(p: any) {
        const raw = p.image_url || p.image || p.image_path || p.storage_path || p.product_image_path || '';
        if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) {
          return raw;
        }
        if (typeof raw === 'string' && raw.trim() && supabase) {
          const path = raw.trim().replace(/^images\//i, '').replace(/^\/+/, '');
          try {
            const pub = supabase.storage.from('images').getPublicUrl(path);
            if (pub && pub.data && pub.data.publicUrl) {
              return pub.data.publicUrl;
            }
          } catch (e) {
            console.error("Storage pick image error wrapper", e);
          }
        }
        return 'https://images.unsplash.com/photo-1546868871-7041f2a55e12';
      }

      // Resolve comprehensive gallery paths
      function resolveGallery(p: any): string[] {
        const candidates = [
          p.image_url,
          p.image,
          p.image_path,
          p.storage_path,
          p.product_image_path
        ];
        const urls: string[] = [];

        function addUnique(val: string) {
          if (!val || typeof val !== 'string') return;
          const clean = val.trim();
          if (!clean) return;
          if (!urls.includes(clean)) {
            urls.push(clean);
          }
        }

        function cleanPath(raw: string): string {
          return raw.trim()
            .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/images\//i, '')
            .replace(/^images\//i, '')
            .replace(/^\/+/, '');
        }

        for (const cand of candidates) {
          if (!cand || typeof cand !== 'string') continue;
          const raw = cand.trim();
          if (!raw) continue;
          if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
            addUnique(raw);
          } else if (supabase) {
            const cP = cleanPath(raw);
            try {
              const pub = supabase.storage.from('images').getPublicUrl(cP);
              if (pub?.data?.publicUrl) addUnique(pub.data.publicUrl);
            } catch (e) {
              // silent catch
            }
          }
        }

        const rawGallery = p.gallery || p.galerie || [];
        const galleryArray = Array.isArray(rawGallery) 
          ? rawGallery 
          : (typeof rawGallery === 'string' 
              ? (rawGallery.startsWith('[') ? JSON.parse(rawGallery) : rawGallery.split(',')) 
              : []);

        for (const item of galleryArray) {
          if (!item || typeof item !== 'string') continue;
          const raw = item.trim();
          if (!raw) continue;
          if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
            addUnique(raw);
          } else if (supabase) {
            const cP = cleanPath(raw);
            try {
              const pub = supabase.storage.from('images').getPublicUrl(cP);
              if (pub?.data?.publicUrl) addUnique(pub.data.publicUrl);
            } catch (e) {
              // silent
            }
          }
        }

        // Fallback
        if (urls.length === 0 && p.vendor_id && p.id && supabase) {
          const fallback = `${p.vendor_id}/${p.id}/cover.jpg`;
          try {
            const pub = supabase.storage.from('images').getPublicUrl(fallback);
            if (pub?.data?.publicUrl) addUnique(pub.data.publicUrl);
          } catch (e) {
            // silent
          }
        }

        if (urls.length === 0) {
          urls.push('https://images.unsplash.com/photo-1546868871-7041f2a55e12');
        }

        return urls;
      }

      // Local resolveVendorMap matcher
      async function resolveVendorMap(rawProducts: any[]) {
        const ids = Array.from(new Set(rawProducts.map(p => p.vendor_id || p.vendeur_id || p.user_id).filter(Boolean)));
        
        // Seed with default demo vendors so they always resolve premium plans even if DB is still clean!
        const map: Record<string, { shopName: string; name: string; departement: string; commune: string; plan?: string; premiumDepts?: string[] }> = {
          'v-tph': {
            shopName: 'TechPlus Haïti',
            name: 'Alexandre TechPlus',
            departement: 'Ouest',
            commune: 'Delmas',
            plan: 'Pro National',
            premiumDepts: ['Ouest', 'Nord', 'Nord-Ouest', 'Nord-Est', 'Artibonite', 'Centre', 'Sud', 'Grande-Anse', 'Nippes', 'Sud-Est']
          },
          'v-bch': {
            shopName: 'Boutique Confiance',
            name: 'Boutique Confiance Haïti',
            departement: 'Nord',
            commune: 'Cap-Haïtien',
            plan: 'Pro Local',
            premiumDepts: ['Nord', 'Nord-Est', 'Nord-Ouest', 'Artibonite', 'Centre']
          }
        };
        if (!ids.length) return map;

        const sources = [
          { table: 'profiles', key: 'id' }
        ];

        for (const s of sources) {
          try {
            const { data, error } = await supabase
              .from(s.table)
              .select('*')
              .in(s.key, ids);
            
            if (error || !Array.isArray(data)) continue;

            data.forEach(row => {
              const id = row[s.key];
              if (!id || map[id]) return;
              const shop = row.boutique_nom || row.shop_name || row.store_name || row.boutique || row.shopName || '';
              const person = row.vendor_name || row.full_name || row.display_name || row.name || [row.first_name, row.last_name].filter(Boolean).join(' ');
              const shopName = String(shop || person || 'Vendeur').trim() || 'Vendeur';
              
              const rawPlan = row.plan || row.plan_code || row.subscription_plan || 'Gratuit';
              let planVal: 'Gratuit' | 'Pro Local' | 'Pro National' = 'Gratuit';
              const cleanPlan = String(rawPlan).toLowerCase().replace(/_/g, ' ');
              if (cleanPlan === 'pro local') {
                planVal = 'Pro Local';
              } else if (cleanPlan === 'pro national') {
                planVal = 'Pro National';
              }
              
              const rawDepts = row.premium_depts || row.premiumdepts || [];
              let parsedDepts: string[] = [];
              if (Array.isArray(rawDepts)) {
                parsedDepts = rawDepts;
              } else if (typeof rawDepts === 'string' && rawDepts.trim().startsWith('[')) {
                try {
                  parsedDepts = JSON.parse(rawDepts);
                } catch (e) {}
              } else if (typeof rawDepts === 'string') {
                parsedDepts = rawDepts.split(',').map((s: string) => s.trim()).filter(Boolean);
              }

              map[id] = {
                shopName: shopName,
                name: String(person || shop || 'Vendeur').trim() || 'Vendeur',
                departement: row.departement || row.region || '',
                commune: row.commune || row.location || '',
                plan: planVal,
                premiumDepts: parsedDepts
              };
            });
          } catch (e) {
            // Silent catch
          }
        }

        return map;
      }

      const tableCandidates = ['products', 'Products', 'produits', 'Produits'];
      let rawData: any[] | null = null;
      let queryError: any = null;

      const now = Date.now();
      // Only read from cache if it's the first page (pageNum == 0) and cache is fresh
      if (pageNum === 0 && productsCache && cacheTime && (now - cacheTime) < CACHE_DURATION) {
        rawData = productsCache;
      } else {
        // Optimized Column Selection (Sélectionner seulement les colonnes nécessaires)
        const selectCols = '*';
        
        for (const tableName of tableCandidates) {
          try {
            // Try active and published products filters first (highly optimized)
            let query = supabase
              .from(tableName)
              .select(selectCols)
              .eq('is_active', true)
              .eq('status', 'published')
              .order('created_at', { ascending: false });

            const { data, error } = await query.range(pageNum * 20, (pageNum + 1) * 20 - 1);
            if (!error && data) {
              rawData = data;
              break;
            } else {
              // Try fallback structure without active or published filters in case schema is simple
              let fallbackQuery = supabase
                .from(tableName)
                .select(selectCols)
                .order('created_at', { ascending: false })
                .range(pageNum * 20, (pageNum + 1) * 20 - 1);
              
              const { data: fbData, error: fbErr } = await fallbackQuery;
              if (!fbErr && fbData) {
                rawData = fbData;
                break;
              }
              queryError = fbErr || error;
            }
          } catch (err) {
            queryError = err;
          }
        }

        if (pageNum === 0 && rawData) {
          productsCache = rawData;
          cacheTime = now;
        }
      }

      if (rawData === null) {
        console.error("Erreur Supabase produits (candidats):", queryError);
        if (!isAppend) {
          setProducts(FRONTEND_FALLBACK_PRODUCTS);
          const searchParams = new URLSearchParams(window.location.search);
          const prodId = searchParams.get('product') || searchParams.get('p') || window.location.hash.match(/#product=(.+)/)?.[1] || window.location.hash.match(/#p=(.+)/)?.[1];
          const linked = prodId ? FRONTEND_FALLBACK_PRODUCTS.find(p => p.id === prodId) : null;
          if (linked) {
            setSelectedProduct(linked);
            setCurrentView('detail');
          } else {
            setSelectedProduct(FRONTEND_FALLBACK_PRODUCTS[0]);
          }
        }
        setHasMoreProducts(false);
        return;
      }

      // Check if we loaded a full page of 20 elements
      if (rawData.length < 20) {
        setHasMoreProducts(false);
      } else {
        setHasMoreProducts(true);
      }

      const helperParseArray = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String);
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed.map(String);
            } catch (e) {}
          }
          return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [];
      };

      if (rawData.length > 0) {
        // Resolve vendor names and other attributes safely
        const vendorMap = await resolveVendorMap(rawData);

        const mapped: Product[] = rawData.map((p: any, idx: number) => {
          const vId = p.vendor_id || p.vendeur_id || p.user_id || 'v-gen';
          const vInfo = (vendorMap[vId] || {}) as any;
          const shopName = vInfo.shopName || p.vendeur || p.vendeur_nom || p.vendor || p.shop_name || 'Boutique Vendza';

          const rawStatus = String(p.statut || p.status || 'actif').toLowerCase().trim();
          const finalStatus: 'actif' | 'brouillon' = (rawStatus === 'published' || rawStatus === 'actif' || rawStatus === 'active') ? 'actif' : 'brouillon';

          const originCity = p.commune || '';
          const originDept = p.departement || '';
          const originString = (originCity && originDept) 
            ? `${originCity}, ${originDept}` 
            : (originDept || originCity || 'Haïti');

          const originFeatures = { ...(p.caracteristiques || p.features || {}) };
          if (!originFeatures['Origine']) {
            originFeatures['Origine'] = originString;
          }

          const galleryUrls = resolveGallery(p);
          return {
            id: p.id || p.product_id || p.PID || `live-prod-${pageNum * 20 + idx}`,
            nom: p.nom || p.name || p.title || p.label || 'Produit sans nom',
            desc: p.desc || p.description || p.info || '',
            prix: Number(p.prix !== undefined ? p.prix : (p.price !== undefined ? p.price : 0)),
            oldPrice: p.old_price ? Number(p.old_price) : (p.oldPrice ? Number(p.oldPrice) : (p.compare_at_price ? Number(p.compare_at_price) : undefined)),
            stock: Number(p.stock !== undefined ? p.stock : (p.quantity !== undefined ? p.quantity : 10)),
            image_url: galleryUrls[0] || pickImage(p),
            vendeur: shopName,
            vendeurId: vId,
            rating: p.rating ? Number(p.rating) : 5,
            tags: helperParseArray(p.tags || p.keywords),
            couleurs: helperParseArray(p.couleurs || p.colors || ['#000000']),
            tailles: helperParseArray(p.tailles || p.sizes || []),
            capacites: helperParseArray(p.capacites || p.capacities || []),
            gallery: galleryUrls,
            caracteristiques: originFeatures,
            statut: finalStatus,
            dateCreation: p.date_creation || p.created_at || new Date().toISOString().split('T')[0],
            cat: p.cat || p.category || p.categorie || 'Électronique',
            vendeurPlan: vInfo.plan || 'Gratuit',
            vendeurPremiumDepts: vInfo.premiumDepts || [],
            departement: String(originDept || vInfo.departement || '').trim(),
            commune: String(originCity || vInfo.commune || '').trim()
          };
        });

        if (isAppend) {
          setProducts(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const uniqueNew = mapped.filter(item => !existingIds.has(item.id));
            return [...prev, ...uniqueNew];
          });
        } else {
          setProducts(mapped);
        }

        const searchParams = new URLSearchParams(window.location.search);
        const prodId = searchParams.get('product') || searchParams.get('p') || window.location.hash.match(/#product=(.+)/)?.[1] || window.location.hash.match(/#p=(.+)/)?.[1];
        if (mapped.length > 0 && !isAppend) {
          const linked = prodId ? mapped.find(p => p.id === prodId) : null;
          if (linked) {
            setSelectedProduct(linked);
            setCurrentView('detail');
          } else {
            setSelectedProduct(mapped[0]);
          }
        }
      } else if (!isAppend) {
        setProducts(FRONTEND_FALLBACK_PRODUCTS);
        const searchParams = new URLSearchParams(window.location.search);
        const prodId = searchParams.get('product') || searchParams.get('p') || window.location.hash.match(/#product=(.+)/)?.[1] || window.location.hash.match(/#p=(.+)/)?.[1];
        const linked = prodId ? FRONTEND_FALLBACK_PRODUCTS.find(p => p.id === prodId) : null;
        if (linked) {
          setSelectedProduct(linked);
          setCurrentView('detail');
        } else {
          setSelectedProduct(FRONTEND_FALLBACK_PRODUCTS[0]);
        }
      }
    } catch (err) {
      console.error("Products fallback load error", err);
      if (!isAppend) {
        setProducts(FRONTEND_FALLBACK_PRODUCTS);
        const searchParams = new URLSearchParams(window.location.search);
        const prodId = searchParams.get('product') || searchParams.get('p') || window.location.hash.match(/#product=(.+)/)?.[1] || window.location.hash.match(/#p=(.+)/)?.[1];
        const linked = prodId ? FRONTEND_FALLBACK_PRODUCTS.find(p => p.id === prodId) : null;
        if (linked) {
          setSelectedProduct(linked);
          setCurrentView('detail');
        } else {
          setSelectedProduct(FRONTEND_FALLBACK_PRODUCTS[0]);
        }
      }
    } finally {
      if (pageNum === 0) {
        setTimeout(() => {
          setProductsLoading(false);
        }, 800);
      }
    }
  }

  const handleLoadMoreProducts = async () => {
    const nextPage = productsPage + 1;
    setProductsPage(nextPage);
    await fetchProducts(nextPage, true);
  };

  useEffect(() => {
    fetchProducts(0, false);
    if (isSupabaseConfigured && supabase) {
      // Notification/Vérification admin chaque samedi à 8h / toutes les heures
      const verifierVersementsSamedi = async () => {
        try {
          const aujourd_hui = new Date();
          if (aujourd_hui.getDay() !== 6) return; // 6 = Samedi

          const { count, error } = await supabase
            .from('vendor_wallets')
            .select('*', { count: 'exact', head: true })
            .gt('available_balance', 0);

          if (error) {
            console.error("[Saturday Check Error]", error.message);
            return;
          }

          if (count && count > 0) {
            console.log(`📢 SAMEDI — ${count} vendeurs à payer !`);
          }
        } catch (err: any) {
          console.error("Error inside verifierVersementsSamedi:", err.message);
        }
      };

      verifierVersementsSamedi();
      const saturdayInterval = setInterval(verifierVersementsSamedi, 60 * 60 * 1000);
      return () => clearInterval(saturdayInterval);
    }
  }, [isSupabaseConfigured]);

  // Listen to payment verification status from redirect parameters (MonCash)
  useEffect(() => {
    const handleMoncashCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get('paymentStatus');
      const orderId = urlParams.get('orderId');

      if (paymentStatus === 'success') {
        setIsVerifyingPayment(true);
        const pendingOrderStr = sessionStorage.getItem('pendingOrder');
        if (pendingOrderStr) {
          try {
            const rawOrder = JSON.parse(pendingOrderStr) as Order;
            rawOrder.status = 'payee'; // Mark as "payee" (paid escrow)
            
            // Crucial: Only insert when payment is confirmed successful
            if (isSupabaseConfigured && supabase) {
              await insertOrderAdaptive(rawOrder);
            }
            
            setOrders(prev => {
              if (prev.some(o => o.id === rawOrder.id)) return prev;
              return [rawOrder, ...prev];
            });

            setMoncashSuccessOrder(rawOrder.id);
            sendAutomatedOrderNotification(rawOrder);
            
            setCart([]);
            localStorage.removeItem('cart');
            sessionStorage.removeItem('pendingOrder');
          } catch (err) {
            console.error("Error creating MonCash order on success return:", err);
            setMoncashSuccessOrder(orderId || 'unknown');
          } finally {
            setIsVerifyingPayment(false);
          }
        } else if (orderId) {
          setMoncashSuccessOrder(orderId);
          setIsVerifyingPayment(false);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === 'error') {
        setMoncashErrorOrder(orderId || 'unknown');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleMoncashCallback();
  }, [isSupabaseConfigured, products]);

  // Listen to Stripe & MonCash payment callbacks after redirection
  useEffect(() => {
    const handlePaymentCallback = async () => {
      const path = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      
      if (path.includes('/checkout/return')) {
        console.log(`[MCC Payment Verification] Routing to checkout-return view.`);
        setCurrentView('checkout-return');
        return;
      }

      if (path.includes('/paiement/abonnement/succes')) {
        console.log(`[Subscription Success Redirect] Routing to subscription-success view.`);
        setCurrentView('subscription-success');
        return;
      }

      const sessionId = urlParams.get('session_id') || urlParams.get('sessionId');
      // Retrieve orderId from query parameter (for both Stripe & MonCash redirects)
      let orderId = urlParams.get('orderId') || urlParams.get('order_id');

      const isStripeSuccess = path.includes('/paiement/succes');
      const isMonCashSuccess = path.includes('/paiement/moncash/succes');

      if (isStripeSuccess || isMonCashSuccess) {
        console.log(`[Payment Success Redirect] Processing callback for path: ${path}`);
        setIsVerifyingPayment(true); // show loading overlay during verification/polling

        try {
          // If sessionId is present (Stripe), verify on backend first
          if (isStripeSuccess && sessionId) {
            const verification = await fetch('/api/stripe/verify-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
            });
            
            if (verification.ok) {
              const { paid } = await verification.json();
              if (!paid) {
                alert("Le paiement Stripe n'a pas pu être vérifié ou est incomplet.");
                setCurrentView('cart');
                window.history.replaceState({}, document.title, '/');
                setIsVerifyingPayment(false);
                return;
              }
            } else {
              console.warn("Stripe verification call failed, falling back to database check.");
            }
          }

          // Retrieve pendingOrder from sessionStorage to extract its ID if orderId is not in the URL
          const pendingOrderStr = sessionStorage.getItem('pendingOrder');
          let rawOrder: Order | null = null;
          if (pendingOrderStr) {
            rawOrder = JSON.parse(pendingOrderStr) as Order;
            if (!orderId && rawOrder) {
              orderId = rawOrder.id;
            }
          }

          console.log(`[Payment Verification] Verifying order ${orderId} created by webhook...`);

          // Poll up to 10 attempts (10 seconds) for the webhook to create the order in Supabase
          let foundOrder: Order | null = null;
          if (isSupabaseConfigured && supabase && orderId) {
            const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            const queryCol = isUuid(orderId) ? 'id' : 'qr_token';
            for (let attempt = 1; attempt <= 10; attempt++) {
              const { data: ord } = await supabase
                .from('orders')
                .select('*')
                .eq(queryCol, orderId)
                .maybeSingle();

              if (ord) {
                foundOrder = ord as unknown as Order;
                console.log('[Payment Verification] Webhook order found in database:', ord);
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          if (foundOrder) {
            setOrders(prev => {
              if (prev.some(o => o.id === foundOrder!.id)) return prev;
              return [foundOrder!, ...prev];
            });
            setSelectedOrder(foundOrder);
            sendAutomatedOrderNotification(foundOrder);
          } else if (rawOrder) {
            // Fallback: If webhook didn't complete / database couldn't be indexed, create order from client side
            console.warn("[Payment Verification] Webhook did not create order in 10s, falling back to local fallback.");
            rawOrder.status = 'payee';
            if (isSupabaseConfigured && supabase) {
              await insertOrderAdaptive(rawOrder);
            }
            setOrders(prev => {
              if (prev.some(o => o.id === rawOrder!.id)) return prev;
              return [rawOrder!, ...prev];
            });
            setSelectedOrder(rawOrder);
            sendAutomatedOrderNotification(rawOrder);
          } else {
            // Ultimate fallback
            console.warn("[Payment Verification] No pending order context available, displaying fallback ticket");
            setSelectedOrder({ id: orderId || 'mc-fallback', status: 'payee' } as any);
          }

          // Clear cart & session
          setCart([]);
          localStorage.removeItem('cart');
          sessionStorage.removeItem('pendingOrder');

          setPreviousView('client-dashboard');
          setCurrentView('ticket');
        } catch (err: any) {
          console.error("Error confirming payment callback:", err);
          alert("Erreur lors de la confirmation de votre commande: " + err.message);
          setCurrentView('cart');
        } finally {
          setIsVerifyingPayment(false);
        }
        window.history.replaceState({}, document.title, '/');
      } else if (path.includes('/paiement/annule')) {
        console.log("[Payment Cancel Redirect] User went back.");
        alert("Paiement Stripe / MonCash annulé. Votre panier est toujours actif.");
        setCurrentView('cart');
        window.history.replaceState({}, document.title, '/');
      }
    };

    handlePaymentCallback();
  }, [isSupabaseConfigured]);

  // Sync and listen to URL/hash navigations reactively
  useEffect(() => {
    const handleUrlNavigation = () => {
      if (products.length > 0) {
        const searchParams = new URLSearchParams(window.location.search);
        const prodId = searchParams.get('product') || searchParams.get('p') || window.location.hash.match(/#product=(.+)/)?.[1] || window.location.hash.match(/#p=(.+)/)?.[1];
        if (prodId) {
          const found = products.find(p => p.id === prodId);
          if (found) {
            setSelectedProduct(found);
            setCurrentView('detail');
          }
        } else if (window.location.hash === '#about') {
          setCurrentView('about');
        } else if (window.location.hash === '#terms') {
          setCurrentView('terms');
        }
      }
    };
    handleUrlNavigation();
    window.addEventListener('hashchange', handleUrlNavigation);
    return () => window.removeEventListener('hashchange', handleUrlNavigation);
  }, [products]);

  // Reviews dynamic synchronization from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    async function fetchReviews() {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*');

        if (error) {
          console.warn("Supabase local offline fallback for reviews active. Using local reviews.", error);
          return;
        }

        if (data && data.length > 0) {
          const mappedReviews: Review[] = data.map((r: any) => ({
            id: r.id,
            productId: r.product_id || r.productId || '',
            clientNom: r.client_nom || r.clientNom || 'Client anonyme',
            note: Number(r.note !== undefined ? r.note : (r.rating !== undefined ? r.rating : 5)),
            commentaire: r.commentaire || r.comment || r.content || '',
            date: r.date || r.created_at || new Date().toISOString().split('T')[0]
          }));
          setReviews(mappedReviews);
        } else {
          setReviews([]);
        }
      } catch (err) {
        console.error("Reviews load error", err);
      }
    }

    fetchReviews();
  }, []);

  // Save messages locally to keep chat history resilient
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem('vendza_messages', JSON.stringify(messages));
      }
    } catch (e) {
      console.error("Local storage sync error", e);
    }
  }, [messages]);

  // Messages dynamic synchronization and real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !currentUser) return;

    let isSubscribed = true;

    async function fetchMessages() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*');

        if (error) {
          console.warn("Messages direct query warn (table might not exist yet):", error.message);
          return;
        }

        if (data && isSubscribed) {
          const mapped: Message[] = data.map((m: any) => ({
            id: String(m.id),
            senderId: m.sender_id || m.senderId || '',
            senderNom: m.sender_nom || m.sender_name || m.senderNom || 'Utilisateur',
            recipientId: m.recipient_id || m.recipientId || '',
            text: m.text || '',
            image: m.image || '',
            time: m.time || m.created_at || "Aujourd'hui",
            productId: m.product_id || m.productId,
            orderId: m.order_id || m.orderId,
            createdAt: m.created_at,
            isRead: m.is_read !== undefined ? m.is_read : (m.isRead !== undefined ? m.isRead : false)
          })).filter((m: Message) => m.senderId === currentUser.id || m.recipientId === currentUser.id || (m.senderId === 'system-vendza' && m.recipientId === currentUser.id));
          
          setMessages(prev => {
            const prevFiltered = prev.filter(p => !mapped.some(m => m.id === p.id));
            return [...prevFiltered, ...mapped];
          });
        }
      } catch (err) {
        console.error("Messages load exception:", err);
      }
    }

    fetchMessages();

    // Listen to real-time message changes (INSERT, UPDATE, DELETE) for instant chat responsiveness
    const channel = supabase
      .channel('messages-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (!isSubscribed) return;

          if (payload.eventType === 'DELETE') {
            const oldId = payload.old ? String(payload.old.id) : '';
            if (oldId) {
              setMessages(prev => prev.filter(p => p.id !== oldId));
            }
          } else if (payload.new) {
            const m = payload.new as any;
            const mappedMsg: Message = {
              id: String(m.id),
              senderId: m.sender_id || m.senderId || '',
              senderNom: m.sender_nom || m.sender_name || m.senderNom || 'Utilisateur',
              recipientId: m.recipient_id || m.recipientId || '',
              text: m.text || '',
              image: m.image || '',
              time: m.time || m.created_at || "Aujourd'hui",
              productId: m.product_id || m.productId,
              orderId: m.order_id || m.orderId,
              createdAt: m.created_at,
              isRead: m.is_read !== undefined ? m.is_read : (m.isRead !== undefined ? m.isRead : false)
            };

            const isRelevant = mappedMsg.senderId === currentUser.id || 
                               mappedMsg.recipientId === currentUser.id || 
                               (mappedMsg.senderId === 'system-vendza' && mappedMsg.recipientId === currentUser.id);

            if (isRelevant) {
              setMessages(prev => {
                const filtered = prev.filter(p => p.id !== mappedMsg.id);
                return [...filtered, mappedMsg];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Orders dynamic synchronization
  const fetchOrders = async () => {
    if (!isSupabaseConfigured || !supabase || !currentUser) return;
      try {
        let query = supabase.from('orders').select('*');
        const { data, error } = await query;
        if (error) {
          console.error("Erreur Supabase commandes:", error);
          return;
        }
        if (data) {
          const mapped: Order[] = data.map((o: any) => {
            const rawItems = o.items;
            let itemsArray: any[] = [];
            const estimatedOrderTotal = Number(o.total_price || o.total || o.total_amount || o.amount || o.price || 0);
            
            if (Array.isArray(rawItems) && rawItems.length > 0) {
              itemsArray = rawItems.map((item: any) => {
                const pNom = item.productNom || item.product_name || item.nom || item.name || o.product_name || 'Produit';
                const pId = item.productId || item.product_id || item.id || o.product_id || 'p-gen';
                let pPrix = Number(item.prix || item.price || item.unit_price || o.price || o.unit_price || 0);
                const pQte = Number(item.qte || item.quantity || item.qty || 1);
                
                // If price resolves to 0 but we have a valid order total, fallback to dividing it
                if (pPrix === 0 && estimatedOrderTotal > 0) {
                  const shippingVal = Number(o.frais_livraison || o.shipping_fee || 0);
                  pPrix = Math.max(0, (estimatedOrderTotal - shippingVal) / Math.max(1, pQte * rawItems.length));
                }
                
                return {
                  id: pId,
                   productId: pId,
                  product_id: pId,
                  nom: pNom,
                  name: pNom,
                  productNom: pNom,
                  product_name: pNom,
                  prix: pPrix,
                  price: pPrix,
                  unit_price: pPrix,
                  qte: pQte,
                  quantity: pQte,
                  vendeurId: item.vendeurId || item.vendor_id || o.vendor_id || 'v-gen',
                  vendeur: item.vendeur || item.vendor_name || o.vendor_name || 'Vendeur'
                };
              });
            } else if (rawItems && typeof rawItems === 'object') {
              const pNom = rawItems.productNom || rawItems.product_name || rawItems.nom || rawItems.name || o.product_name || 'Produit';
              const pId = rawItems.productId || rawItems.product_id || rawItems.id || o.product_id || 'p-gen';
              let pPrix = Number(rawItems.prix || rawItems.price || rawItems.unit_price || o.price || o.unit_price || o.total_price || 0);
              const pQte = Number(rawItems.qte || rawItems.quantity || rawItems.qty || o.quantity || 1);
              
              if (pPrix === 0 && estimatedOrderTotal > 0) {
                const shippingVal = Number(o.frais_livraison || o.shipping_fee || 0);
                pPrix = Math.max(0, estimatedOrderTotal - shippingVal);
              }
              
              itemsArray = [{
                id: pId,
                productId: pId,
                product_id: pId,
                nom: pNom,
                name: pNom,
                productNom: pNom,
                product_name: pNom,
                prix: pPrix,
                price: pPrix,
                unit_price: pPrix,
                qte: pQte,
                quantity: pQte,
                vendeurId: rawItems.vendeurId || rawItems.vendor_id || o.vendor_id || 'v-gen',
                vendeur: rawItems.vendeur || rawItems.vendor_name || o.vendor_name || 'Vendeur'
              }];
            } else {
              // Construct a realistic list item array from columns
              const pNom = o.product_name || 'Produit';
              const pId = o.product_id || 'p-gen';
              let pPrix = Number(o.price || o.unit_price || 0);
              const pQte = Number(o.quantity || 1);
              
              if (pPrix === 0) {
                pPrix = Number(o.total_price || o.total || o.total_amount || o.amount || 0) / Math.max(1, pQte);
              }
              
              if (pPrix === 0 && estimatedOrderTotal > 0) {
                const shippingVal = Number(o.frais_livraison || o.shipping_fee || 0);
                pPrix = Math.max(0, estimatedOrderTotal - shippingVal);
              }
              
              itemsArray = [{
                id: pId,
                productId: pId,
                product_id: pId,
                nom: pNom,
                name: pNom,
                productNom: pNom,
                product_name: pNom,
                prix: pPrix,
                price: pPrix,
                unit_price: pPrix,
                qte: pQte,
                quantity: pQte,
                vendeurId: o.vendor_id || 'v-gen',
                vendeur: o.vendor_name || 'Vendeur'
              }];
            }

            // Map order status to French equivalents used in frontend logic
            let mappedStatus = o.status || 'payee';
            if (mappedStatus === 'paid' || mappedStatus === 'success' || mappedStatus === 'completed_escrow' || mappedStatus === 'payee') {
              mappedStatus = 'payee'; // Security Escrow active
            } else if (mappedStatus === 'completed' || mappedStatus === 'delivered' || mappedStatus === 'livree' || mappedStatus === 'validated') {
              mappedStatus = 'livree'; // Delivered & Escrow unlocked to vendor
            } else if (mappedStatus === 'canceled' || mappedStatus === 'annulee') {
              mappedStatus = 'annulee';
            } else if (mappedStatus === 'pending' || mappedStatus === 'attente') {
              mappedStatus = 'payee';
            }

            const createdAtStr = o.created_at || o.ceated_at;
            let finalDate = o.date;
            let finalHeure = o.heure;

            if (createdAtStr) {
              try {
                const dateObj = new Date(createdAtStr);
                if (!isNaN(dateObj.getTime())) {
                  const day = String(dateObj.getDate()).padStart(2, '0');
                  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                  const year = dateObj.getFullYear();
                  finalDate = `${day}/${month}/${year}`;
                  
                  const hours = String(dateObj.getHours()).padStart(2, '0');
                  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                  finalHeure = `${hours}:${minutes}`;
                }
              } catch (e) {
                // fallback
              }
            }

            if (!finalDate) {
              const now = new Date();
              const day = String(now.getDate()).padStart(2, '0');
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const year = now.getFullYear();
              finalDate = `${day}/${month}/${year}`;
            }

            if (!finalHeure || finalHeure === '12:00') {
              const now = new Date();
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              finalHeure = `${hours}:${minutes}`;
            }

            return {
              id: o.id,
              clientId: o.buyer_id || o.user_id || o.qr_payload,
              clientNom: o.client_name || o.client_nom || 'Client',
              clientTel: o.client_tel || '',
              items: itemsArray,
              fraisLivraison: Number(o.shipping_fee || o.frais_livraison || 0),
              discount: Number(o.discount || 0),
              total: estimatedOrderTotal || itemsArray.reduce((acc, it) => acc + (it.prix * it.qte), 0),
              status: mappedStatus,
              date: finalDate,
              heure: finalHeure,
              departement: o.departement || 'Ouest',
              commune: o.delivery_commune || o.commune || 'Pétion-Ville'
            };
          });

          // Resilient client-side filtering matching the user's role exactly
          const filtered = mapped.filter((o: Order) => {
            if (currentUser.userType === 'client') {
              return o.clientId === currentUser.id;
            } else {
              // Vendor can see orders they purchased OR orders containing items they sell
              return o.clientId === currentUser.id || o.items.some(it => it.vendeurId === currentUser.id || (currentUser.id === 'v-tph' && it.vendeurId === 'v-tph'));
            }
          });

          setOrders(filtered);
        }
      } catch (err) {
        console.error("fetchOrders error handler", err);
      }
  };

  useEffect(() => {
    fetchOrders();
  }, [currentUser]);

  // Handle active navigation
  const navigateTo = (view: string) => {
    const protectedViews = ['client-dashboard', 'vendor-dashboard', 'create-product', 'subscription', 'scanner', 'inbox'];
    
    // Automatically log in or adapt user role to prevent any restriction alerts
    if (protectedViews.includes(view)) {
      const isVendorView = ['vendor-dashboard', 'create-product', 'subscription', 'scanner'].includes(view);
      
      if (!currentUser) {
        // Rediriger proprement vers l'authentification au lieu de se connecter automatiquement avec un compte démo
        setCurrentView('auth');
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      } else if (isVendorView && currentUser.userType !== 'vendeur') {
        alert("Accès réservé aux vendeurs. Veuillez créer un compte vendeur.");
        setCurrentView('become-seller');
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
    }

    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Auth simulators
  const handleLogin = (user: UserProfile) => {
    // Determine appropriate dashboard based on user profile type
    const targetView = user.userType === 'vendeur' ? 'vendor-dashboard' : 'client-dashboard';
    
    // Synchronize to localStorage to make reload persistent
    localStorage.setItem('vendza_current_user', JSON.stringify(user));
    localStorage.setItem('vendza_current_view', targetView);
    
    setCurrentUser(user);
    setCurrentView(targetView);
    
    // Automatically refresh modern site after login
    setTimeout(() => {
      window.location.reload();
    }, 150);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setCart([]);
    navigateTo('home');
  };

  const handleQuickClientLogin = () => {
    navigateTo('auth');
  };

  const handleQuickVendorLogin = () => {
    navigateTo('auth');
  };

  // Cart operations
  const handleAddToCart = (product: Product, quantity = 1, color?: string, size?: string) => {
    if (product.stock <= 0) return;
    if (currentUser && (product.vendeurId === currentUser.id || (product.vendeurId === 'v-tph' && currentUser.id === 'v-tph'))) {
      alert("⚠️ Vous êtes le vendeur de ce produit. Vous ne pouvez pas ajouter vos propres articles à votre panier.");
      return;
    }
    setCart(prev => {
      const existsIdx = prev.findIndex(item => 
        item.product.id === product.id && 
        item.selectedColor === color && 
        item.selectedSize === size
      );

      if (existsIdx > -1) {
        const copy = [...prev];
        copy[existsIdx].quantity = Math.min(product.stock, copy[existsIdx].quantity + quantity);
        return copy;
      } else {
        return [...prev, { product, quantity, selectedColor: color, selectedSize: size }];
      }
    });
    alert(`🛒 "${product.nom}" ajouté au panier !`);
  };

  const handleUpdateCartItemQty = (productId: string, qty: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const targetQty = Math.max(1, Math.min(item.product.stock, item.quantity + qty));
        return { ...item, quantity: targetQty };
      }
      return item;
    }));
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Instantly process payment and set to pending validation (payment guaranteed)
  const handleCheckoutNow = async (product: Product, quantity: number, color?: string, size?: string) => {
    if (!currentUser) {
      alert("Veuillez vous connectez d'abord pour confirmer cet achat.");
      navigateTo('auth');
      return;
    }

    if (product.vendeurId === currentUser.id || (product.vendeurId === 'v-tph' && currentUser.id === 'v-tph')) {
      alert("⚠️ Vous êtes le vendeur de ce produit. Vous ne pouvez pas acheter votre propre marchandise.");
      return;
    }

    // Instead of directly processing, let user choose between payment options first via the custom choice popup
    setInstantCheckoutModalItem({ product, quantity, color, size });
  };

  // Perform the actual instant payment booking after user has selected their method
  const executeInstantCheckout = async (paymentMethod: 'stripe' | 'moncash') => {
    if (!currentUser || !instantCheckoutModalItem) return;
    const { product, quantity, color, size } = instantCheckoutModalItem;

    const freeCapitalCommunes = ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Carrefour'];
    const shippingFee = freeCapitalCommunes.includes(currentUser.commune) ? 0 : 200;
    const finalTotal = product.prix * quantity + shippingFee;

    const newOrder: Order = {
      id: `order-${Date.now().toString().slice(-4)}-vendza-haiti`,
      clientId: currentUser.id,
      clientNom: `${currentUser.prenom} ${currentUser.nom}`,
      clientTel: currentUser.tel,
      items: [{
        productId: product.id,
        productNom: product.nom,
        prix: product.prix,
        qte: quantity,
        couleur: color,
        taille: size,
        vendeurId: product.vendeurId
      }],
      fraisLivraison: shippingFee,
      discount: 0,
      total: finalTotal,
      status: 'attente', // "attente" represents the initial pending status
      date: new Date().toLocaleDateString('fr-FR'),
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      departement: currentUser.departement || 'Ouest',
      commune: currentUser.commune || 'Pétion-Ville',
      paymentMethod: paymentMethod
    };

    // Save to pending order session storage
    sessionStorage.setItem('pendingOrder', JSON.stringify(newOrder));

    // Save to database pending orders
    if (isSupabaseConfigured) {
      try {
        const response = await fetch('/api/orders/pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference_id: newOrder.id,
            buyer_id: newOrder.clientId,
            vendor_id: product.vendeurId,
            items: newOrder.items,
            total_price: newOrder.total,
            shipping_fee: newOrder.fraisLivraison || 0,
            delivery_commune: newOrder.commune,
            delivery_address: newOrder.departement || ''
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          console.error("Error creating pending order record in Supabase:", errData.error || response.statusText);
        } else {
          console.log("Pending order successfully registered on server.");
        }
      } catch (e: any) {
        console.error("Exception creating pending order inside database:", e.message);
      }
    }

    if (paymentMethod === 'stripe') {
      setIsRedirectingToMonCash(true);
      setRedirectPaymentMethod('stripe');
      try {
        const items = [{
          name: product.nom,
          price: product.prix,
          quantity: quantity,
          image_url: product.image_url && product.image_url.startsWith('https://') 
            ? product.image_url 
            : null,
        }];

        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: newOrder.id,
            items: items,
            customerEmail: currentUser.email || '',
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Erreur de communication avec le serveur Stripe.");
        }

        const { url } = await response.json();
        setInstantCheckoutModalItem(null); // Clear modal select state
        window.location.href = url;
      } catch (err: any) {
        setIsRedirectingToMonCash(false);
        console.error("[Stripe Checkout Error]", err.message);
        alert(`✕ Impossible de se connecter à Stripe: ${err.message}.\n\nVotre achat est enregistré en local.`);
      }
    } else if (paymentMethod === 'moncash') {
      setIsRedirectingToMonCash(true);
      setRedirectPaymentMethod('moncash');
      try {
        const response = await fetch('/api/paiement/creer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: newOrder.id,
            total: newOrder.total,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Impossible d'initier le paiement instantané.");
        }

        const data = await response.json();

        if (data && data.payment_url) {
          setInstantCheckoutModalItem(null); // Clear modal select state
          window.location.href = data.payment_url;
        } else {
          throw new Error(data.error || "Aucune URL de redirection configurée.");
        }
      } catch (err: any) {
        setIsRedirectingToMonCash(false);
        console.error("[MonCash Instant Checkout Error]", err.message);
        alert(`✕ Impossible de se connecter à MonCash: ${err.message}.\n\nVotre commande instantanée a été sauvegardée en local.`);
      }
    }
  };

  // Adaptive database orders insertion handler
  const insertOrderAdaptive = async (rawOrder: Order) => {
    if (!supabase || !isSupabaseConfigured) return;
    
    const firstItem = rawOrder.items[0];
    const firstVendorId = firstItem ? (firstItem.vendeurId || '') : '';
    const matchedProd = firstItem ? products.find(p => p.id === firstItem.productId) : null;
    const firstVendorName = matchedProd ? matchedProd.vendeur : 'Vendeur';
    const firstProductId = firstItem ? (firstItem.productId || '') : '';
    const firstProductName = firstItem ? (firstItem.productNom || '') : '';
    
    const payload: any = {
      id: rawOrder.id,
      qr_token: rawOrder.id, // Save friendly payment reference ID in the text column
      qr_payload: rawOrder.clientId, // Store original client ID here as fallback text in case user ID is not a UUID
      
      // Client / Buyer mapping with multiple redundant aliases (preserve original ID, letting database decide type compatibility)
      buyer_id: rawOrder.clientId,
      client_id: rawOrder.clientId,
      customer_id: rawOrder.clientId,
      user_id: rawOrder.clientId,
      client_name: rawOrder.clientNom,
      client_tel: rawOrder.clientTel,
      
      // Vendor / Seller mapping with multiple redundant aliases (preserve original ID, letting database decide type compatibility)
      vendor_id: firstVendorId,
      vendeur_id: firstVendorId,
      seller_id: firstVendorId,
      owner_id: firstVendorId,
      vendor_name: firstVendorName,
      product_id: firstProductId,
      product_name: firstProductName,
      
      // Core numeric pricing
      shipping_fee: rawOrder.fraisLivraison,
      discount: rawOrder.discount,
      total_price: rawOrder.total,
      unit_price: firstItem ? (firstItem.prix || 0) : rawOrder.total,
      quantity: firstItem ? (firstItem.qte || 1) : 1,
      
      // Other metadata
      status: rawOrder.status,
      date: rawOrder.date,
      heure: rawOrder.heure,
      departement: rawOrder.departement,
      delivery_commune: rawOrder.commune,
      payment_method: rawOrder.paymentMethod || 'moncash',
      
      // Trust logic checklist
      is_validated: false,
      client_confirmed: false,
      buyer_confirmed: false,
      reception_confirmed: false,
      vendor_credited: false,
      
      // Generation QR code for validation scanning checks
      qr_code: `qr-${rawOrder.id.split('-')[1] || Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      items: rawOrder.items.map(item => {
        const itemProd = products.find(p => p.id === item.productId);
        const itemVendorName = itemProd ? itemProd.vendeur : firstVendorName;
        return {
          id: item.productId,
          productId: item.productId,
          product_id: item.productId,
          nom: item.productNom,
          name: item.productNom,
          product_name: item.productNom,
          prix: item.prix,
          price: item.prix,
          unit_price: item.prix,
          qte: item.qte,
          quantity: item.qte,
          vendeurId: item.vendeurId,
          vendeur: itemVendorName
        };
      })
    };

    // Retry loop with column omission for adaptive resilience
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        const { data, error } = await supabase.from('orders').insert([payload]).select();
        if (!error) {
          console.log("Adaptive order successfully synchronized to Supabase!");
          if (data && data[0]) {
            const dbOrder = data[0];
            // Update local state with real DB UUID
            setOrders(prev => prev.map(o => o.id === rawOrder.id ? { ...o, id: dbOrder.id } : o));
            // Trigger the escrow initialization
            afterPaymentConfirmed(dbOrder.id);
          }
          return;
        }
        
        const errMsg = error.message || '';
        if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
          console.warn("Connection issue during order creation:", errMsg);
          alert(`⚠️ Connexion réseau indisponible (Failed to fetch).\n\nVotre commande a été correctement enregistrée sur votre appareil en mode local Vendza. Le paiement par séquestre mobile est sauvegardé en local !`);
          return;
        }

        // If UUID mapping issue
        if (errMsg.toLowerCase().includes('uuid') || errMsg.toLowerCase().includes('invalid input syntax for uuid')) {
          let foundOffendingKey = false;
          for (const key of Object.keys(payload)) {
            const valStr = String(payload[key]);
            if (valStr && errMsg.includes(valStr)) {
              if (key === 'id') {
                console.warn(`[Resilience] Detected invalid UUID value '${valStr}' for primary key 'id', replacing with a new random UUID...`);
                payload.id = generateUUID();
              } else {
                console.warn(`[Resilience] Detected invalid UUID value '${valStr}' for column '${key}', removing...`);
                delete payload[key];
              }
              foundOffendingKey = true;
            }
          }
          if (!foundOffendingKey) {
            if (errMsg.toLowerCase().includes('buyer_id') || errMsg.toLowerCase().includes('client_id') || errMsg.toLowerCase().includes('customer_id') || errMsg.toLowerCase().includes('user_id')) {
              console.warn("UUID mapping issue on buyer_id inside adaptive insertion, omitting...");
              delete payload.buyer_id;
              delete payload.client_id;
              delete payload.customer_id;
              delete payload.user_id;
            } else if (errMsg.toLowerCase().includes('vendor_id') || errMsg.toLowerCase().includes('vendeur_id') || errMsg.toLowerCase().includes('seller_id') || errMsg.toLowerCase().includes('owner_id')) {
              console.warn("UUID mapping issue on vendor_id inside adaptive insertion, omitting...");
              delete payload.vendor_id;
              delete payload.vendeur_id;
              delete payload.seller_id;
              delete payload.owner_id;
            } else {
              console.log("Detected UUID primary key on orders table, converting ID to UUID...");
              payload.id = generateUUID();
            }
          }
          continue;
        }

        const matchCol = errMsg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i) || 
                         errMsg.match(/Could not find the '([^']+)' column/i) || 
                         errMsg.match(/column "([^"]+)" does not exist/i);
        
        if (matchCol && matchCol[1]) {
          const offendingCol = matchCol[1];
          console.warn(`Database schema mismatch helper (Orders): removing unconfigured parameter '${offendingCol}' from payload.`);
          delete payload[offendingCol];
        } else {
          console.error("Non-recoverable Supabase insert error on orders:", error);
          break;
        }
      } catch (err: any) {
        const errMsg = String(err?.message || '');
        if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
          console.warn("Connection exception during order creation:", errMsg);
          alert(`⚠️ Connexion réseau indisponible (Failed to fetch).\n\nVotre commande a été correctement enregistrée sur votre appareil en mode local Vendza. Le paiement par séquestre mobile est sauvegardé en local !`);
        } else {
          console.error("Outer exception during adaptive order database write:", err);
        }
        break;
      }
    }
  };

  // Shopping cart checkout order confirmation
  const handlePlaceOrder = async (orderInfo: Omit<Order, 'id' | 'date' | 'heure' | 'status'>, paymentMethod: 'stripe' | 'moncash') => {
    const rawOrder: Order = {
      ...orderInfo,
      id: `order-${Date.now().toString().slice(-4)}-vendza-haiti`,
      status: 'attente', // "attente" represents the initial pending status
      date: new Date().toLocaleDateString('fr-FR'),
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      paymentMethod: paymentMethod,
    };

    // Store order temporarily in sessionStorage before payment completes
    sessionStorage.setItem('pendingOrder', JSON.stringify(rawOrder));

    // Save to pending_orders in Supabase (via backend secure proxy to bypass RLS policies) BEFORE redirecting!
    if (isSupabaseConfigured) {
      try {
        const uniqueVendors = Array.from(new Set(rawOrder.items.map(item => item.vendeurId || '')));
        
        if (uniqueVendors.length > 1) {
          console.log(`[Order Splitter] Multi-vendor cart detected (${uniqueVendors.length} vendors). Splitting order...`);
          
          const baseShippingFee = Math.floor((rawOrder.fraisLivraison || 0) / uniqueVendors.length);
          const remainderShippingFee = (rawOrder.fraisLivraison || 0) % uniqueVendors.length;
          
          for (let idx = 0; idx < uniqueVendors.length; idx++) {
            const vId = uniqueVendors[idx];
            const subItems = rawOrder.items.filter(item => (item.vendeurId || '') === vId);
            const subItemsTotal = subItems.reduce((sum, item) => sum + (item.prix * item.qte), 0);
            const subShippingFee = baseShippingFee + (idx === 0 ? remainderShippingFee : 0);
            const subTotal = subItemsTotal + subShippingFee;
            const subOrderId = `${rawOrder.id}_sub_${vId}`;

            const response = await fetch('/api/orders/pending', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference_id: subOrderId,
                checkout_group_id: rawOrder.id,
                buyer_id: rawOrder.clientId,
                vendor_id: vId,
                items: subItems,
                total_price: subTotal,
                shipping_fee: subShippingFee,
                delivery_commune: rawOrder.commune,
                delivery_address: rawOrder.departement || ''
              })
            });

            if (!response.ok) {
              const errData = await response.json();
              console.error(`Error creating split pending order for vendor ${vId}:`, errData.error || response.statusText);
            } else {
              console.log(`Pending split order for vendor ${vId} successfully registered on server.`);
            }
          }
        } else {
          // Single vendor order
          const firstItem = rawOrder.items[0];
          const response = await fetch('/api/orders/pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference_id: rawOrder.id,
              checkout_group_id: rawOrder.id,
              buyer_id: rawOrder.clientId,
              vendor_id: firstItem?.vendeurId || '',
              items: rawOrder.items,
              total_price: rawOrder.total,
              shipping_fee: rawOrder.fraisLivraison || 0,
              delivery_commune: rawOrder.commune,
              delivery_address: rawOrder.departement || ''
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            console.error("Error creating pending order record in Supabase:", errData.error || response.statusText);
          } else {
            console.log("Pending order successfully registered on server.");
          }
        }
      } catch (e: any) {
        console.error("Exception creating pending order inside database:", e.message);
      }
    }

    if (paymentMethod === 'stripe') {
      setIsRedirectingToMonCash(true);
      setRedirectPaymentMethod('stripe');
      try {
        const items = cart.map(item => ({
          name: item.product.nom,
          price: item.product.prix,
          quantity: item.quantity,
          image_url: item.product.image_url && item.product.image_url.startsWith('https://') 
            ? item.product.image_url 
            : null,
        }));

        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: rawOrder.id,
            items: items,
            customerEmail: currentUser?.email || '',
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Erreur de communication avec le serveur Stripe.");
        }

        const { url } = await response.json();

        // Redirect to Stripe Checkout Page
        window.location.href = url;
      } catch (err: any) {
        setIsRedirectingToMonCash(false);
        console.error("[Stripe Checkout Error]", err.message);
        alert(`✕ Impossible de se connecter à Stripe: ${err.message}.\n\nVotre achat est enregistré en local.`);
      }
    } else if (paymentMethod === 'moncash') {
      setIsRedirectingToMonCash(true);
      setRedirectPaymentMethod('moncash');
      try {
        const response = await fetch('/api/mcc/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: rawOrder.id,
            amount: rawOrder.total,
            customerEmail: currentUser?.email || '',
            customerName: `${currentUser?.prenom || ''} ${currentUser?.nom || ''}`.trim()
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Erreur de communication avec le serveur MonCashConnect.");
        }

        const { paymentUrl } = await response.json();

        if (!paymentUrl) {
          throw new Error("L'URL de paiement n'a pas été retournée par le serveur.");
        }

        // Redirect to MonCash Connect gateway sandbox
        window.location.href = paymentUrl;
      } catch (err: any) {
        setIsRedirectingToMonCash(false);
        console.error("[MonCash Connect Error]", err.message);
        alert(`✕ Impossible de se connecter à MonCashConnect: ${err.message}.\n\nVotre achat est enregistré en local.`);
      }
    }
  };

  const handleCancelOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setOrderToCancel(order);
    } else {
      console.warn("[App] Order not found for cancellation:", orderId);
    }
  };

  const executeConfirmCancelOrder = async () => {
    if (!orderToCancel) return;

    const orderId = orderToCancel.id;
    const total = orderToCancel.total || 0;
    const frais_annulation = total * 0.075;
    const montant_rembourse = total - frais_annulation;

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'annulee' as const,
          montant_rembourse,
          frais_annulation
        };
      }
      return o;
    }));

    if (isSupabaseConfigured && supabase) {
      const payload: any = {
        status: 'annulee',
        montant_rembourse,
        frais_annulation
      };
      
      try {
        const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
        if (error) {
          const errMsg = error.message || '';
          if (errMsg.includes('column') && (errMsg.includes('montant_rembourse') || errMsg.includes('frais_annulation'))) {
            console.warn("[App Cancel Order] Column does not exist on orders table, falling back to simple status cancellation");
            await supabase.from('orders').update({ status: 'annulee' }).eq('id', orderId);
          } else {
            console.error("[App Cancel Order Error] Failed to update custom columns in Supabase:", error.message);
          }
        }
      } catch (err: any) {
        console.error("[App Cancel Order Exception]", err.message);
      }
    }

    // Send OneSignal notification to the vendor
    const vendorId = orderToCancel.vendor_id || (orderToCancel as any).vendeur_id || orderToCancel.items[0]?.vendeurId || '';
    if (vendorId) {
      sendPushNotification(
        vendorId,
        "Commande annulée",
        `Le client a annulé sa commande (${orderId}). Reste remboursé : ${montant_rembourse.toFixed(2)} HTG (frais retenus : ${frais_annulation.toFixed(2)} HTG).`
      );
    }

    // Dismiss the cancellation prompt and display confirmation message
    setOrderToCancel(null);
    setRefundConfirmationMsg(
      `Ta commande a été annulée avec succès.\n\n` +
      `Frais de transaction conservés: ${frais_annulation.toFixed(2)} HTG (7.50%)\n` +
      `Montant qui te sera remboursé: ${montant_rembourse.toFixed(2)} HTG\n\n` +
      `Le remboursement sera crédité selon le mode de paiement utilisé.`
    );
  };

  // Rule 1: Aprés confirmation du paiement, on appelle afterPaymentConfirmed
  const afterPaymentConfirmed = async (orderId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      console.log("[Escrow] Processing afterPaymentConfirmed for ID:", orderId);
      const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const queryCol = isUuid(orderId) ? 'id' : 'qr_token';
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq(queryCol, orderId)
        .maybeSingle();

      if (!order || orderErr) {
        console.warn("[Escrow] Could not find order to process escrow for ID:", orderId);
        return;
      }

      const vendorId = order.vendor_id || '';
      let planStr = 'gratuit';
      if (vendorId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', vendorId)
          .maybeSingle();
        if (profile?.plan) {
          planStr = String(profile.plan).toLowerCase();
        }
      }

      const commissions: Record<string, number> = {
        'gratuit':      0.10,
        'pro_local':    0.07,
        'pro_national': 0.03
      };
      
      const rate = commissions[planStr] !== undefined ? commissions[planStr] : 0.10;
      const amountToPay = Number(order.total_price) || 0;
      const commission = amountToPay * rate;
      const montantVendeur = amountToPay - commission;

      console.log(`[Escrow] Calculating vendor revenue: Total=${amountToPay}, Plan=${planStr}, Rate=${rate}, VendorShare=${montantVendeur}`);

      // 1. Mettre à jour l'état de la commande à 'payee'
      await supabase
        .from('orders')
        .update({ 
          status: 'payee',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      // 2. Créditer les fonds en séquestre (pending_balance) & total_earned
      const { data: wallet } = await supabase
        .from('vendor_wallets')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (wallet) {
        await supabase
          .from('vendor_wallets')
          .update({
            pending_balance: (Number(wallet.pending_balance) || 0) + montantVendeur,
            total_earned: (Number(wallet.total_earned) || 0) + montantVendeur,
            updated_at: new Date().toISOString()
          })
          .eq('vendor_id', vendorId);
      } else {
        await supabase
          .from('vendor_wallets')
          .insert({
            vendor_id: vendorId,
            pending_balance: montantVendeur,
            available_balance: 0,
            total_earned: montantVendeur,
            updated_at: new Date().toISOString()
          });
      }

      // 3. Enregistrer la transaction de séquestre
      await supabase
        .from('vendor_wallet_transactions')
        .insert({
          vendor_id: vendorId,
          order_id: orderId,
          amount: montantVendeur,
          type: 'pending_escrow',
          description: `Fonds sécurisés en séquestre (frais plateforme ${rate * 100}% déduits)`
        });

      console.log("[Escrow] Successfully credited vendor pending escrow balance for order:", orderId);
    } catch (e) {
      console.error("[Escrow] Error inside afterPaymentConfirmed:", e);
    }
  };

  // Release payment guarantee & finish cycle
  const handleConfirmDelivery = async (orderId: string) => {
    console.log("[Escrow] Confirming delivery (QR Scan or Force Click) for ID:", orderId);
    const targetOrder = orders.find(o => o.id === orderId);

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'livree' as const };
      }
      return o;
    }));

    if (targetOrder) {
      // Recalculer le compteur/stock de chaque produit dans la commande
      setProducts(prev => {
        const updatedProducts = prev.map(p => {
          const itemInOrder = targetOrder.items.find(item => item.productId === p.id);
          if (itemInOrder) {
            const nextStock = Math.max(0, p.stock - itemInOrder.qte);
            return { ...p, stock: nextStock };
          }
          return p;
        });

        // Mettre à jour en base de données Supabase si configuré
        if (isSupabaseConfigured && supabase) {
          targetOrder.items.forEach(async (item) => {
            try {
              // Obtenir la quantité réelle en temps réel dans Supabase pour éviter les désynchronisations de stock
              const { data: realTimeProduct, error: fetchError } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.productId)
                .maybeSingle();

              if (!fetchError && realTimeProduct) {
                const currentDbStock = Number(realTimeProduct.stock) || 0;
                const nextStock = Math.max(0, currentDbStock - (Number(item.qte) || 1));
                
                const { error: updateError } = await supabase
                  .from('products')
                  .update({ stock: nextStock })
                  .eq('id', item.productId);

                if (updateError) {
                  console.error(`Erreur de mise à jour du stock pour le produit ${item.productId}:`, updateError.message);
                } else {
                  console.log(`[Supabase Stock Sync] Produit ${item.productId} mis à jour avec succès. Ancien stock: ${currentDbStock}, nouveau stock: ${nextStock}`);
                }
              } else {
                // Fallback avec l'état local si le fetch en temps réel échoue
                const currentProd = prev.find(p => p.id === item.productId);
                if (currentProd) {
                  const nextStock = Math.max(0, currentProd.stock - item.qte);
                  await supabase
                    .from('products')
                    .update({ stock: nextStock })
                    .eq('id', item.productId);
                }
              }
            } catch (err: any) {
              console.error(`Exception de mise à jour du stock pour le produit ${item.productId}:`, err.message);
            }
          });
        }

        return updatedProducts;
      });
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('*, profiles:vendor_id(plan)')
          .eq('id', orderId)
          .maybeSingle();

        const plan = order?.profiles?.plan || 'gratuit';
        const commissions: Record<string, number> = {
          'gratuit':      0.10,
          'pro_local':    0.07,
          'pro_national': 0.03
        };
        const rate = commissions[plan] !== undefined ? commissions[plan] : 0.10;
        const totalPrice = order ? (Number(order.total_price) || 0) : (targetOrder ? targetOrder.totalPrice : 0);
        const commission = totalPrice * rate;
        const montantVendeur = totalPrice - commission;
        const vendorId = order?.vendor_id || targetOrder?.vendorId || '';

        if (vendorId) {
          // Transférer pending → available IMMÉDIATEMENT
          const { data: wallet } = await supabase
            .from('vendor_wallets')
            .select('*')
            .eq('vendor_id', vendorId)
            .maybeSingle();

          if (wallet) {
            await supabase
              .from('vendor_wallets')
              .update({
                pending_balance: Math.max(0, (Number(wallet.pending_balance) || 0) - montantVendeur),
                available_balance: (Number(wallet.available_balance) || 0) + montantVendeur,
                updated_at: new Date().toISOString()
              })
              .eq('vendor_id', vendorId);
          } else {
            await supabase
              .from('vendor_wallets')
              .insert({
                vendor_id: vendorId,
                pending_balance: 0,
                available_balance: montantVendeur,
                total_earned: montantVendeur,
                updated_at: new Date().toISOString()
              });
          }

          // Enregistrer transaction
          await supabase
            .from('vendor_wallet_transactions')
            .insert({
              vendor_id: vendorId,
              order_id: orderId,
              amount: montantVendeur,
              type: 'credit',
              description: `Livraison confirmée — ${montantVendeur} HTG disponible pour le versement du samedi (commission ${rate * 100}% déduite)`
            });

          // Notifier le vendeur
          await supabase
            .from('platform_messages')
            .insert({
              title: '✅ Livraison confirmée !',
              message: `${montantVendeur.toLocaleString('fr-FR')} HTG ajoutés à votre solde disponible. Versement prévu ce samedi.`,
              audience: vendorId,
              is_active: true
            });
        }

        // Mettre à jour la commande
        await supabase
          .from('orders')
          .update({
            reception_confirmed: true,
            buyer_confirmed: true,
            buyer_confirmed_at: new Date().toISOString(),
            vendor_credited: true,
            vendor_credited_at: new Date().toISOString(),
            status: 'completed',
            is_validated: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        console.log("[Escrow] Immediate balance transition completed successfully for order:", orderId);
        fetchOrders();
        // Rafraîchir les produits pour voir la baisse de quantité disponible en temps réel dans l'interface
        fetchProducts(0, false);
      } catch (err: any) {
        console.error("Error in handleConfirmDelivery immediate transfer:", err.message);
      }
    }
  };

  // Rule 5: Litige (geler les fonds)
  const ouvrirLitige = async (orderId: string, reason: string): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, message: "Base de données non disponible." };
    }
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (!order || orderErr) {
        return { success: false, message: "Commande inexistante." };
      }

      if (order.vendor_credited) {
        return { success: false, message: "Les fonds ont déjà été libérés au vendeur, impossible d'ouvrir un litige." };
      }

      const buyerId = order.buyer_id || order.clientId || currentUser?.id || '';

      await supabase
        .from('disputes')
        .insert({
          order_id: orderId,
          buyer_id: buyerId,
          vendor_id: order.vendor_id,
          reason: reason,
          status: 'open'
        });

      await supabase
        .from('orders')
        .update({
          status: 'disputed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      // Refresh local list
      fetchOrders();

      return {
        success: true,
        message: "Litige ouvert avec succès ! Notre équipe administrative examine le dossier sous 48h. Les fonds restent gelés en séquestre."
      };
    } catch (e: any) {
      console.error("[Escrow] Error in ouvrirLitige:", e);
      return { success: false, message: `Erreur: ${e.message}` };
    }
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Helper helper to upload base64 images to Supabase storage to avoid huge database payload limits
  const uploadBase64ToStorage = async (base64Str: string, bucketName: string = 'images'): Promise<string> => {
    if (!supabase || !isSupabaseConfigured) return base64Str;
    if (!base64Str || !base64Str.startsWith('data:')) {
      return base64Str;
    }

    try {
      const parts = base64Str.split(';base64,');
      if (parts.length !== 2) return base64Str;
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      const blob = new Blob([uInt8Array], { type: contentType });
      const extension = contentType.split('/')[1] || 'png';
      const fileName = `product-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;

      let uploadResult = await supabase.storage
        .from(bucketName)
        .upload(fileName, blob, {
          contentType,
          cacheControl: '3600',
          upsert: true
        });

      if (uploadResult.error && (
        uploadResult.error.message?.toLowerCase().includes('not found') || 
        uploadResult.error.message?.toLowerCase().includes('bucket')
      )) {
        console.log(`Bucket '${bucketName}' not found. Attempting auto-creation...`);
        try {
          await supabase.storage.createBucket(bucketName, { public: true });
          uploadResult = await supabase.storage
            .from(bucketName)
            .upload(fileName, blob, {
              contentType,
              cacheControl: '3600',
              upsert: true
            });
        } catch (errBucket) {
          console.warn("Failed to auto-create bucket:", errBucket);
        }
      }

      if (uploadResult.error) {
        console.error("Supabase Storage upload error:", uploadResult.error.message);
        
        // Identify if it's a Row Level Security policy block error
        const isRls = uploadResult.error.message?.toLowerCase().includes('violates row-level security') ||
                      uploadResult.error.message?.toLowerCase().includes('row-level security') ||
                      uploadResult.error.message?.toLowerCase().includes('security policy');
        if (isRls) {
          setStorageRlsError(true);
        }

        // Smart Adaptive Fallback: compress this base64 image down to under 30KB so it successfully writes inline to database
        console.log("Compacting image before falling back to inline database storage...");
        const compressedBase64 = await compressBase64Image(base64Str, 350);
        return compressedBase64;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      return publicUrl || base64Str;
    } catch (err) {
      console.error("Failed parsing/uploading base64 image:", err);
      return base64Str;
    }
  };

  // Add Product logic
  const handleAddProduct = async (newProd: Omit<Product, 'id' | 'vendeur' | 'vendeurId' | 'rating' | 'dateCreation'>) => {
    const finalDept = newProd.departement || currentUser?.departement || 'Ouest';
    const finalCommune = newProd.commune || currentUser?.commune || 'Pétion-Ville';

    // Upload base64 images to Supabase Storage first to keep database updates clean and small
    let uploadedImageUrl = newProd.image_url;
    let uploadedGallery: string[] = [];

    if (isSupabaseConfigured && supabase) {
      if (newProd.image_url && newProd.image_url.startsWith('data:')) {
        uploadedImageUrl = await uploadBase64ToStorage(newProd.image_url);
      }
      if (Array.isArray(newProd.gallery)) {
        uploadedGallery = await Promise.all(
          newProd.gallery.map(async (img) => {
            if (img && img.startsWith('data:')) {
              return await uploadBase64ToStorage(img);
            }
            return img;
          })
        );
      } else {
        uploadedGallery = [uploadedImageUrl];
      }
    } else {
      if (Array.isArray(newProd.gallery)) {
        uploadedGallery = newProd.gallery;
      } else {
        uploadedGallery = [newProd.image_url];
      }
    }

    const fullProd: Product = {
      ...newProd,
      image_url: uploadedImageUrl,
      gallery: uploadedGallery,
      id: `prod-${Date.now().toString().slice(-3)}`,
      vendeur: currentUser?.shopName || `${currentUser?.prenom} Store`,
      vendeurId: currentUser?.id || 'v-gen',
      rating: 5.0,
      dateCreation: new Date().toISOString().split('T')[0],
      departement: finalDept,
      commune: finalCommune,
      vendeurPlan: currentUser?.plan || 'Gratuit',
      vendeurPremiumDepts: currentUser?.premiumDepts || [],
      caracteristiques: {
        'Origine': `${finalCommune}, ${finalDept}`,
        ...(newProd.caracteristiques || {})
      }
    };

    setProducts(prev => [...prev, fullProd]);

    if (isSupabaseConfigured && supabase) {
      let payload: any = {
        id: fullProd.id,
        nom: fullProd.nom,
        name: fullProd.nom,
        desc: fullProd.desc,
        description: fullProd.desc,
        prix: fullProd.prix,
        price: fullProd.prix,
        old_price: fullProd.oldPrice,
        stock: fullProd.stock,
        image_url: fullProd.image_url,
        vendeur: fullProd.vendeur,
        vendeur_id: fullProd.vendeurId,
        vendor_id: fullProd.vendeurId,
        rating: fullProd.rating,
        tags: fullProd.tags,
        keywords: fullProd.tags,
        couleurs: fullProd.couleurs,
        colors: fullProd.couleurs,
        tailles: fullProd.tailles,
        sizes: fullProd.tailles,
        capacites: fullProd.capacites,
        capacities: fullProd.capacites ? fullProd.capacites.join(', ') : '', // Schema capacities is text
        gallery: fullProd.gallery,
        delai_livraison: fullProd.delaiLivraison,
        delivery_time: fullProd.delaiLivraison,
        statut: fullProd.statut === 'actif' ? 'published' : 'draft',
        status: fullProd.statut === 'actif' ? 'published' : 'draft',
        cat: fullProd.cat,
        category: fullProd.cat,
        caracteristiques: fullProd.caracteristiques,
        features: fullProd.caracteristiques
      };

      for (let attempt = 0; attempt < 25; attempt++) {
        try {
          const { data, error } = await supabase.from('products').insert([payload]).select();
          if (!error) {
            console.log("Successfully created product in Supabase database!");
            if (data && data[0]) {
              const dbProd = data[0];
              // Map DB true uuid back to our local lists
              setProducts(prev => prev.map(p => p.id === fullProd.id ? { ...p, id: dbProd.id } : p));
            }
            break;
          }
          const errMsg = String(error.message || '');
          if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
            console.warn("Network issue caught during product insert:", errMsg);
            alert(`⚠️ Problème de connexion internet (Échec du réseau).\n\nVotre produit "${fullProd.nom}" a été enregistré correctement localement sur votre appareil.\n\nIl s'affiche dans votre mode Boutique et sera synchronisé dès le rétablissement de la liaison en ligne.`);
            break;
          }

          // If UUID primary key error
          if (errMsg.toLowerCase().includes('uuid') || errMsg.toLowerCase().includes('invalid input syntax for uuid')) {
            console.log("Detected UUID primary key on products table, converting ID to UUID...");
            payload.id = generateUUID();
            continue;
          }

          const matchCol = errMsg.match(/Could not find the '([^']+)' column/i)
            || errMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i)
            || errMsg.match(/column "([^"]+)" of relation "products" does not exist/i);

          if (matchCol && matchCol[1] && Object.prototype.hasOwnProperty.call(payload, matchCol[1])) {
            console.warn(`Adaptive prune: removing missing column '${matchCol[1]}' from insert.`);
            delete payload[matchCol[1]];
            continue;
          } else {
            console.error("Unrecoverable error creating product in Supabase:", error.message);
            break;
          }
        } catch (err: any) {
          const errMsg = String(err?.message || '');
          if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
            console.warn("Network exception caught during product insert:", errMsg);
            alert(`⚠️ Problème de connexion internet (Échec du réseau).\n\nVotre produit "${fullProd.nom}" a été enregistré correctement localement sur votre appareil.\n\nIl s'affiche dans votre mode Boutique et sera synchronisé dès le rétablissement de la liaison en ligne.`);
          } else {
            console.error("Exception in adaptive insert:", err.message);
          }
          break;
        }
      }
    }
  };

  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    let uploadedImage = updates.image_url;
    let uploadedGallery = updates.gallery;

    if (isSupabaseConfigured && supabase) {
      if (updates.image_url && updates.image_url.startsWith('data:')) {
        uploadedImage = await uploadBase64ToStorage(updates.image_url);
      }
      if (Array.isArray(updates.gallery)) {
        uploadedGallery = await Promise.all(
          updates.gallery.map(async (img) => {
            if (img && img.startsWith('data:')) {
              return await uploadBase64ToStorage(img);
            }
            return img;
          })
        );
      }
    }

    const mergedUpdates = {
      ...updates,
      ...(uploadedImage !== undefined ? { image_url: uploadedImage } : {}),
      ...(uploadedGallery !== undefined ? { gallery: uploadedGallery } : {})
    };

    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...mergedUpdates } : p));

    if (isSupabaseConfigured && supabase) {
      const dbUpdates: any = {};
      if (mergedUpdates.nom !== undefined) { dbUpdates.nom = mergedUpdates.nom; dbUpdates.name = mergedUpdates.nom; }
      if (mergedUpdates.desc !== undefined) { dbUpdates.desc = mergedUpdates.desc; dbUpdates.description = mergedUpdates.desc; }
      if (mergedUpdates.prix !== undefined) { dbUpdates.prix = mergedUpdates.prix; dbUpdates.price = mergedUpdates.prix; }
      if (mergedUpdates.oldPrice !== undefined) dbUpdates.old_price = mergedUpdates.oldPrice;
      if (mergedUpdates.stock !== undefined) dbUpdates.stock = mergedUpdates.stock;
      if (mergedUpdates.statut !== undefined) {
        dbUpdates.statut = mergedUpdates.statut === 'actif' ? 'published' : 'draft';
        dbUpdates.status = mergedUpdates.statut === 'actif' ? 'published' : 'draft';
      }
      if (uploadedImage !== undefined) { dbUpdates.image_url = uploadedImage; }
      if (mergedUpdates.cat !== undefined) { dbUpdates.cat = mergedUpdates.cat; dbUpdates.category = mergedUpdates.cat; }
      
      // Additional multi-select and logic fields
      if (mergedUpdates.couleurs !== undefined) { dbUpdates.couleurs = mergedUpdates.couleurs; dbUpdates.colors = mergedUpdates.couleurs; }
      if (mergedUpdates.tailles !== undefined) { dbUpdates.tailles = mergedUpdates.tailles; dbUpdates.sizes = mergedUpdates.tailles; }
      if (mergedUpdates.capacites !== undefined) { dbUpdates.capacites = mergedUpdates.capacites; dbUpdates.capacities = mergedUpdates.capacites; }
      if (mergedUpdates.tags !== undefined) { dbUpdates.tags = mergedUpdates.tags; dbUpdates.keywords = mergedUpdates.tags; }
      if (uploadedGallery !== undefined) dbUpdates.gallery = uploadedGallery;
      if (mergedUpdates.delaiLivraison !== undefined) { dbUpdates.delai_livraison = mergedUpdates.delaiLivraison; dbUpdates.delivery_time = mergedUpdates.delaiLivraison; }
      if (mergedUpdates.caracteristiques !== undefined) { dbUpdates.caracteristiques = mergedUpdates.caracteristiques; dbUpdates.features = mergedUpdates.caracteristiques; }

      for (let attempt = 0; attempt < 25; attempt++) {
        try {
          const { error } = await supabase.from('products').update(dbUpdates).eq('id', productId);
          if (!error) {
            console.log("Successfully updated product in Supabase!");
            break;
          }
          const errMsg = String(error.message || '');
          if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
            console.warn("Network issue caught during product update:", errMsg);
            alert(`⚠️ Problème de connexion internet (Échec du réseau).\n\nLes modifications apportées au produit ont été enregistrées localement sur votre appareil.\n\nElles seront reportées en ligne dès le retour de connexion.`);
            break;
          }
          const matchCol = errMsg.match(/Could not find the '([^']+)' column/i)
            || errMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i)
            || errMsg.match(/column "([^"]+)" of relation "products" does not exist/i);

          if (matchCol && matchCol[1] && Object.prototype.hasOwnProperty.call(dbUpdates, matchCol[1])) {
            console.warn(`Adaptive prune: removing missing column '${matchCol[1]}' from update.`);
            delete dbUpdates[matchCol[1]];
            continue;
          } else {
            console.error("Unrecoverable error updating product in Supabase:", error.message);
            break;
          }
        } catch (err: any) {
          const errMsg = String(err?.message || '');
          if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
            console.warn("Network exception caught during product update:", errMsg);
            alert(`⚠️ Problème de connexion internet (Échec du réseau).\n\nLes modifications apportées au produit ont été enregistrées localement sur votre appareil.\n\nElles seront reportées en ligne dès le retour de connexion.`);
          } else {
            console.error("Exception in adaptive update:", err.message);
          }
          break;
        }
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    let imagesCached: string[] = [];
    if (isSupabaseConfigured && supabase && currentUser) {
      try {
        const { data: produit, error: fetchErr } = await supabase
          .from('products')
          .select('vendor_id, image_url, gallery')
          .eq('id', productId)
          .single();

        if (fetchErr || !produit) {
          console.error("Erreur de récupération ou produit inexistant:", fetchErr);
          alert('Impossible de trouver le produit pour vérification');
          return;
        }

        if (produit.vendor_id !== currentUser.id) {
          alert('Vous ne pouvez pas supprimer ce produit');
          return;
        }

        // Collecter les images pour suppression
        if (produit.image_url) {
          imagesCached.push(produit.image_url);
        }
        if (produit.gallery) {
          if (Array.isArray(produit.gallery)) {
            imagesCached.push(...produit.gallery);
          } else if (typeof produit.gallery === 'string') {
            try {
              const parsed = JSON.parse(produit.gallery);
              if (Array.isArray(parsed)) {
                imagesCached.push(...parsed);
              }
            } catch (je) {
              imagesCached.push(produit.gallery);
            }
          }
        }

        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId)
          .eq('vendor_id', currentUser.id); // Double sécurité

        if (error) {
          console.error('Erreur suppression:', error);
          alert('Erreur lors de la suppression');
          return;
        }

        // Supprimer les images d'images de stockage s'il y a lieu
        if (imagesCached.length > 0) {
          const filesToDelete = imagesCached
            .map(url => {
              if (typeof url !== 'string') return null;
              if (url.startsWith('http')) {
                const parts = url.split('/');
                return parts[parts.length - 1];
              }
              return null;
            })
            .filter((name): name is string => !!name && (name.startsWith('product-') || name.includes('product-')));

          if (filesToDelete.length > 0) {
            try {
              await supabase.storage.from('images').remove(filesToDelete);
            } catch (storageErr) {
              console.warn("Erreur lors de la suppression des images physiques:", storageErr);
            }
          }
        }
      } catch (e: any) {
        console.error('Exception lors de la suppression:', e);
        alert('Erreur lors de la suppression');
        return;
      }
    }

    // Après suppression réussie :
    // - Retirer le produit de la liste sans recharger la page
    // - Mettre à jour le compteur de produits (automatique via le state mis à jour)
    setProducts(prev => prev.filter(p => p.id !== productId));

    // - Afficher un message "Produit supprimé avec succès"
    alert("Produit supprimé avec succès");
  };

  // Upgrade Plan logic
  const handleUpgradePlan = async (
    plan: 'Gratuit' | 'Pro Local' | 'Pro National',
    depts?: string[],
    billing: 'mensuel' | 'annuel' = 'mensuel',
    amount: number = 0
  ) => {
    if (!currentUser) return;
    setCurrentUser({
      ...currentUser,
      plan,
      premiumDepts: depts
    });

    // Mirror updated subscription info instantly onto any listed products of this user
    setProducts(prev => prev.map(p => {
      if (p.vendeurId === currentUser.id) {
        return { 
          ...p, 
          vendeurPlan: plan, 
          vendeurPremiumDepts: depts || [] 
        };
      }
      return p;
    }));

    if (isSupabaseConfigured && supabase) {
      const nouveauPlan = plan === 'Pro National' ? 'pro_national' : plan === 'Pro Local' ? 'pro_local' : 'gratuit';
      try {
        // 1. Mettre à jour profiles
        const { error: profileErr } = await supabase.from('profiles')
          .update({ 
            plan: nouveauPlan,  // 'gratuit', 'pro_local', 'pro_national'
            premium_depts: depts || [],
            updated_at: new Date()
          })
          .eq('id', currentUser.id);

        if (profileErr) {
          console.error("Error updating profile plan:", profileErr.message);
        }

        // 2. Enregistrer dans vendor_subscriptions
        const startedAt = new Date();
        const expiresAt = new Date();
        if (billing === 'annuel') {
          expiresAt.setDate(startedAt.getDate() + 365);
        } else {
          expiresAt.setDate(startedAt.getDate() + 30);
        }

        const { error: subErr } = await supabase.from('vendor_subscriptions').insert({
          user_id: currentUser.id,
          plan_code: nouveauPlan,
          status: 'active',
          started_at: startedAt,
          expires_at: expiresAt,
          billing: billing,
          total_paid: amount
        });

        if (subErr) {
          console.error("Error inserting into vendor_subscriptions:", subErr.message);
        }

        // 3. Mettre à jour boost_score dans shops
        const boostScore = {
          'gratuit': 0,
          'pro_local': 50,
          'pro_national': 100
        };

        const { error: shopErr } = await supabase.from('shops')
          .update({ 
            plan: nouveauPlan,
            boost_score: boostScore[nouveauPlan],
            is_featured: nouveauPlan === 'pro_national'
          })
          .eq('vendor_id', currentUser.id);

        if (shopErr) {
          console.error("Error updating shop plan/boost:", shopErr.message);
        }
      } catch (err: any) {
        console.error("Exception in upgrade plan:", err.message);
      }
    }
  };

  // Update Profile logic
  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    
    let planToUse = currentUser.plan;
    let premiumDeptsToUse = currentUser.premiumDepts;

    if (updates.userType === 'vendeur' && isSupabaseConfigured && supabase) {
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('plan, premium_depts, premiumdepts')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileData) {
          if (profileData.plan) {
            planToUse = profileData.plan as any;
          }
          const rawDepts = profileData.premium_depts || profileData.premiumdepts || [];
          if (Array.isArray(rawDepts)) {
            premiumDeptsToUse = rawDepts;
          } else if (typeof rawDepts === 'string' && rawDepts.trim().startsWith('[')) {
            try {
              premiumDeptsToUse = JSON.parse(rawDepts);
            } catch (e) {}
          } else if (typeof rawDepts === 'string') {
            premiumDeptsToUse = rawDepts.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
      } catch (e) {
        console.warn("Could not reload plan on userType toggle:", e);
      }
    }

    let finalAvatar = updates.avatar;
    let finalBanner = updates.banner;
    let finalIdFile = updates.idFile;

    if (isSupabaseConfigured && supabase) {
      if (updates.avatar && updates.avatar.startsWith('data:')) {
        finalAvatar = await uploadBase64ToStorage(updates.avatar);
      }
      if (updates.banner && updates.banner.startsWith('data:')) {
        finalBanner = await uploadBase64ToStorage(updates.banner);
      }
      if (updates.idFile && updates.idFile.startsWith('data:')) {
        finalIdFile = await uploadBase64ToStorage(updates.idFile);
      }
    }

    const cleanedUpdates = {
      ...updates,
      ...(finalAvatar !== undefined ? { avatar: finalAvatar } : {}),
      ...(finalBanner !== undefined ? { banner: finalBanner } : {}),
      ...(finalIdFile !== undefined ? { idFile: finalIdFile } : {})
    };

    const nextUser = { 
      ...currentUser, 
      ...cleanedUpdates,
      plan: planToUse,
      premiumDepts: premiumDeptsToUse
    };

    if (isSupabaseConfigured && supabase) {
      const dbUpdates: any = {};
      if (cleanedUpdates.prenom !== undefined) {
        dbUpdates.prenom = cleanedUpdates.prenom;
        dbUpdates.first_name = cleanedUpdates.prenom;
      }
      if (cleanedUpdates.nom !== undefined) {
        dbUpdates.nom = cleanedUpdates.nom;
        dbUpdates.last_name = cleanedUpdates.nom;
      }
      if (cleanedUpdates.email !== undefined) dbUpdates.email = cleanedUpdates.email;
      if (cleanedUpdates.tel !== undefined) {
        dbUpdates.tel = cleanedUpdates.tel;
        dbUpdates.phone_number = cleanedUpdates.tel;
        dbUpdates.phone = cleanedUpdates.tel;
        dbUpdates.telephone = cleanedUpdates.tel; // Schema matches public.profiles.telephone
      }
      if (cleanedUpdates.departement !== undefined) dbUpdates.departement = cleanedUpdates.departement;
      if (cleanedUpdates.commune !== undefined) dbUpdates.commune = cleanedUpdates.commune;
      if (cleanedUpdates.shopName !== undefined) {
        dbUpdates.shop_name = cleanedUpdates.shopName;
        dbUpdates.boutique = cleanedUpdates.shopName;
        dbUpdates.boutique_nom = cleanedUpdates.shopName; // Schema matches public.profiles.boutique_nom
      }
      if (cleanedUpdates.shopDesc !== undefined) {
        dbUpdates.shop_desc = cleanedUpdates.shopDesc;
        dbUpdates.shop_description = cleanedUpdates.shopDesc;
        dbUpdates.boutique_desc = cleanedUpdates.shopDesc; // Schema matches public.profiles.boutique_desc
      }
      if (cleanedUpdates.avatar !== undefined) {
        dbUpdates.avatar = cleanedUpdates.avatar;
        dbUpdates.avatar_url = cleanedUpdates.avatar; // Schema matches public.profiles.avatar_url
        dbUpdates.photo_url = cleanedUpdates.avatar;
        dbUpdates.profile_image = cleanedUpdates.avatar;
      }
      if (cleanedUpdates.banner !== undefined) {
        dbUpdates.banner = cleanedUpdates.banner;
        dbUpdates.cover_url = cleanedUpdates.banner;
        dbUpdates.cover_image = cleanedUpdates.banner;
        dbUpdates.banner_url = cleanedUpdates.banner;
      }
      if (cleanedUpdates.userType !== undefined) {
        dbUpdates.user_type = cleanedUpdates.userType;
        dbUpdates.type = cleanedUpdates.userType; // Schema matches public.profiles.type
      }
      if (cleanedUpdates.categories !== undefined) {
        dbUpdates.categories = cleanedUpdates.categories;
      }
      if (cleanedUpdates.moncash !== undefined) {
        dbUpdates.moncash = cleanedUpdates.moncash;
        dbUpdates.moncash_num = cleanedUpdates.moncash;
        dbUpdates.numero_moncash = cleanedUpdates.moncash; // Schema matches public.profiles.numero_moncash
      }
      if (cleanedUpdates.moncashNom !== undefined) {
        dbUpdates.moncash_nom = cleanedUpdates.moncashNom;
        dbUpdates.moncashnom = cleanedUpdates.moncashNom;
      }
      if (cleanedUpdates.banque !== undefined) {
        dbUpdates.banque = cleanedUpdates.banque;
        dbUpdates.bank_name = cleanedUpdates.banque;
      }
      if (cleanedUpdates.compteBanque !== undefined) {
        dbUpdates.compte_bug = cleanedUpdates.compteBanque;
        dbUpdates.compte_banque = cleanedUpdates.compteBanque;
        dbUpdates.comptebanque = cleanedUpdates.compteBanque;
        dbUpdates.bank_account = cleanedUpdates.compteBanque;
      }
      if (cleanedUpdates.idType !== undefined) {
        dbUpdates.id_type = cleanedUpdates.idType;
        dbUpdates.idtype = cleanedUpdates.idType;
      }
      if (cleanedUpdates.idNumber !== undefined) {
        dbUpdates.id_number = cleanedUpdates.idNumber;
        dbUpdates.idnumber = cleanedUpdates.idNumber;
      }
      if (cleanedUpdates.idFile !== undefined) {
        dbUpdates.id_file = cleanedUpdates.idFile;
        dbUpdates.idfile = cleanedUpdates.idFile;
        dbUpdates.id_document_url = cleanedUpdates.idFile; // Schema matches public.shops.id_document_url
      }
      if (cleanedUpdates.statutVerification !== undefined) {
        dbUpdates.statut_verification = cleanedUpdates.statutVerification;
        dbUpdates.statutverification = cleanedUpdates.statutVerification;
        dbUpdates.statut = cleanedUpdates.statutVerification;
      }
      if (cleanedUpdates.revenusBloques !== undefined) {
        dbUpdates.revenus_bloques = cleanedUpdates.revenusBloques;
        dbUpdates.revenusbloques = cleanedUpdates.revenusBloques;
      }

      const result = await adaptiveUpdate('profiles', dbUpdates, currentUser.id);

      if (!result.ok) {
        console.error("Erreur de sauvegarde profiles:", result.error);
        alert("❌ Impossible d'enregistrer vos modifications en ligne. Veuillez vérifier votre connexion internet.");
        return;
      }

      // Write-through synchronization for public.shops table (keyed by vendor_id)
      if (
        cleanedUpdates.shopName !== undefined || 
        cleanedUpdates.shopDesc !== undefined || 
        cleanedUpdates.categories !== undefined || 
        cleanedUpdates.moncash !== undefined || 
        cleanedUpdates.banque !== undefined ||
        cleanedUpdates.idNumber !== undefined
      ) {
        const shopPayload = {
          shop_name: cleanedUpdates.shopName || currentUser.shopName || '',
          description: cleanedUpdates.shopDesc || currentUser.shopDesc || '',
          categories: cleanedUpdates.categories || currentUser.categories || [],
          logo_url: cleanedUpdates.avatar || currentUser.avatar || '',
          moncash: cleanedUpdates.moncash || currentUser.moncash || '',
          moncash_nom: cleanedUpdates.moncashNom || currentUser.moncashNom || '',
          bank_name: cleanedUpdates.banque || currentUser.banque || '',
          bank_account: cleanedUpdates.compteBanque || currentUser.compteBanque || '',
          id_type: cleanedUpdates.idType || currentUser.idType || '',
          id_number: cleanedUpdates.idNumber || currentUser.idNumber || '',
          id_document_url: cleanedUpdates.idFile || currentUser.idFile || '',
          plan: cleanedUpdates.plan || currentUser.plan || 'gratuit',
          statut_verification: cleanedUpdates.statutVerification || currentUser.statutVerification || 'non_verifie',
          delai_livraison: currentUser.delaiLivraison || '3j'
        };

        try {
          const { data: existingShop } = await supabase
            .from('shops')
            .select('id')
            .eq('vendor_id', currentUser.id)
            .maybeSingle();

          if (existingShop) {
            await supabase.from('shops').update(shopPayload).eq('vendor_id', currentUser.id);
          } else {
            await supabase.from('shops').insert([{
              vendor_id: currentUser.id,
              ...shopPayload
            }]);
          }
        } catch (e) {
          console.warn("Bypassed sync to 'shops' table:", e);
        }
      }

      // Successfully saved and verified via database! Now we display the updates and notify the user
      setCurrentUser(nextUser);
      alert("✅ Vos modifications ont été enregistrées avec succès dans la base de données sécurisée !");
    } else {
      // Offline / Fallback
      setCurrentUser(nextUser);
      alert("✓ Modifications enregistrées localement.");
    }
  };

  // Adaptive message insertion to database
  const insertMessageAdaptive = async (rawMsg: Message) => {
    if (!supabase || !isSupabaseConfigured) return;

    // Helper to check UUID format
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let buyerId = rawMsg.senderId;
    let vendorId = rawMsg.recipientId;

    // Fallbacks to user UUID to prevent foreign key errors (sender_id references auth.users/profiles)
    const currentUserId = currentUser?.id || '00000000-0000-0000-0000-000000000000';
    if (!isUUID(buyerId)) {
      buyerId = isUUID(vendorId) ? vendorId : currentUserId;
    }
    if (!isUUID(vendorId)) {
      vendorId = isUUID(buyerId) ? buyerId : currentUserId;
    }

    let conversation_id = null;

    // Try finding existing conversation
    try {
      const { data: match } = await supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${buyerId},buyer_id.eq.${vendorId}`)
        .limit(1);
      if (match && match.length > 0) {
        conversation_id = match[0].id;
      }
    } catch (e) {
      console.warn("Convo search error, proceeding with creation", e);
    }

    // Try creating a conversation if none found
    if (!conversation_id) {
      try {
        const convoPayload: any = {
          buyer_id: buyerId,
          buyerId: buyerId,
          vendor_id: vendorId,
          vendorId: vendorId,
          last_message_at: new Date().toISOString(),
          lastMessageAt: new Date().toISOString()
        };
        const { data: created, error: createErr } = await supabase
          .from('conversations')
          .insert([convoPayload])
          .select();
        if (!createErr && created && created[0]) {
          conversation_id = created[0].id;
        } else {
          // Retry with absolute bare columns
          const { data: createdFallback, error: fallbackErr } = await supabase
            .from('conversations')
            .insert([{ buyer_id: buyerId, vendor_id: vendorId, last_message_at: new Date().toISOString() }])
            .select();
          if (!fallbackErr && createdFallback && createdFallback[0]) {
            conversation_id = createdFallback[0].id;
          }
        }
      } catch (e) {
        console.warn("Exception during fallback convo creation", e);
      }
    }

    // If still no conversation_id, pull ANY existing or use a dummy UUID
    if (!conversation_id) {
      try {
        const { data: anyConvo } = await supabase.from('conversations').select('id').limit(1);
        if (anyConvo && anyConvo[0]) {
          conversation_id = anyConvo[0].id;
        } else {
          conversation_id = '00000000-0000-0000-0000-000000000000'; // fallback
        }
      } catch (_) {
        conversation_id = '00000000-0000-0000-0000-000000000000';
      }
    }

    const payload: any = {
      id: rawMsg.id,
      conversation_id: conversation_id,
      sender_id: buyerId,
      senderId: rawMsg.senderId,
      sender_nom: rawMsg.senderNom,
      senderNom: rawMsg.senderNom,
      recipient_id: vendorId,
      recipientId: rawMsg.recipientId,
      text: rawMsg.text,
      content: rawMsg.text || '', // fallback content column
      image: rawMsg.image || null,
      attachment_path: rawMsg.image || null, // fallback attachment column
      time: rawMsg.time,
      product_id: rawMsg.productId,
      productId: rawMsg.productId,
      order_id: rawMsg.orderId,
      orderId: rawMsg.orderId,
      created_at: new Date(),
      is_read: false,
      isRead: false
    };

    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const { error } = await supabase.from('messages').insert([payload]);
        if (!error) {
          console.log("Message successfully saved on Supabase!");
          break;
        }

        const errMsg = error.message || '';
        if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('failed to fetch')) {
          break; // network issue
        }

        // Check Row-Level Security policy error on table "messages"
        if (errMsg.toLowerCase().includes('violates row-level security') || errMsg.toLowerCase().includes('row-level security') || errMsg.toLowerCase().includes('security policy')) {
          console.warn("Detected Row-Level Security (RLS) violation on public.messages:", errMsg);
          setMessagesRlsError(true);
          break;
        }

        // UUID fallback
        if (errMsg.toLowerCase().includes('uuid') || errMsg.toLowerCase().includes('invalid input syntax for uuid')) {
          payload.id = generateUUID();
          continue;
        }

        // Null value constraint fallback (like conversation_id)
        if (errMsg.toLowerCase().includes('null value in column') && errMsg.toLowerCase().includes('violates not-null constraint')) {
          const matchNullCol = errMsg.match(/column "([^"]+)"/i);
          if (matchNullCol && matchNullCol[1]) {
            const nullCol = matchNullCol[1];
            if (nullCol === 'conversation_id') {
              // Try to generate a fresh random UUID for it as fallback
              payload.conversation_id = generateUUID();
              continue;
            }
          }
        }

        const matchCol = errMsg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i) || 
                         errMsg.match(/Could not find the '([^']+)' column/i) || 
                         errMsg.match(/column "([^"]+)" does not exist/i);

        if (matchCol && matchCol[1]) {
          const offendingCol = matchCol[1];
          console.warn(`Pruning message payload parameters: removing '${offendingCol}'.`);
          delete payload[offendingCol];
        } else {
          console.error("Non-recoverable error sending message in Supabase:", error.message);
          break;
        }
      } catch (err) {
        break;
      }
    }
  };

  // Send multi-user push notifications via secure Express proxy
  const sendPushNotification = async (recipientId: string, title: string, message: string) => {
    try {
      console.log(`[Push Notification] Sending to '${recipientId}': ${title} - ${message}`);
      const res = await fetch('/api/onesignal/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipientId, title, message })
      });
      const data = await res.json();
      console.log('[Push Notification] Server response:', data);
    } catch (e) {
      console.warn('[Push Notification] Request failed:', e);
    }
  };

  // Automated new order notification sender from Vendza
  const sendAutomatedOrderNotification = async (order: Order) => {
    const vendorsWithItems: Record<string, any[]> = {};
    for (const item of order.items) {
      const vId = item.vendeurId || 'v-gen';
      if (!vendorsWithItems[vId]) {
        vendorsWithItems[vId] = [];
      }
      vendorsWithItems[vId].push(item);
    }

    for (const [vId, items] of Object.entries(vendorsWithItems)) {
      const itemsSummary = items.map(it => `${it.qte}x ${it.productNom || it.nom}`).join(', ');
      const messageText = `📢 NOUVELLE COMMANDE DISPONIBLE !
 
ID de commande : ${order.id}
Client : ${order.clientNom} (${order.clientTel || 'Aucun numéro'})
Lieu : ${order.commune}, ${order.departement}
Articles : ${itemsSummary}
 
Veuillez préparer la commande. À la livraison, demandez le code QR de l'acheteur pour le scanner depuis votre tableau de bord marchand. Cela débloquera instantanément les fonds en séquestre vers votre solde Vendza !`;

      const notificationMsg: Message = {
        id: `msg-notif-${Date.now()}-${vId}-${Math.random().toString(36).substring(2, 6)}`,
        senderId: 'system-vendza',
        senderNom: 'Vendza',
        recipientId: vId,
        text: messageText,
        time: "Aujourd'hui, " + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        orderId: order.id
      };

      setMessages(prev => [...prev, notificationMsg]);
      if (isSupabaseConfigured && supabase) {
        await insertMessageAdaptive(notificationMsg);
      }
      
      // Notify the vendor of the new order
      sendPushNotification(vId, "🛍️ Nouvelle commande !", `Vous avez reçu une commande d'un montant de ${order.total} HTG !`);
    }

    // Also notify the BUYER/CLIENT who made the purchase
    if (order.clientId) {
      const clientMessageText = `🎉 FÉLICITATIONS ! VOTRE COMMANDE A BIEN ÉTÉ ENREGISTRÉE EN SÉQUESTRE !
 
ID de commande : ${order.id}
Montant total : ${order.total} HTG
Articles : ${order.items.map(it => `${it.qte}x ${it.productNom || 'Article'}`).join(', ')}
 
Vendza conserve vos fonds en toute sécurité sous séquestre. Le vendeur ne sera payé qu'une fois que vous aurez vérifié l'article en personne et fait scanner votre code QR de livraison unique. 
 
Vous retrouverez votre code QR unique sur votre "Reçu de Commande" depuis votre Tableau de bord Acheteur ! Contactez le vendeur pour planifier la livraison.`;

      const clientNotifMsg: Message = {
        id: `msg-notif-buyer-${Date.now()}-${order.clientId}`,
        senderId: 'system-vendza',
        senderNom: 'Vendza',
        recipientId: order.clientId,
        text: clientMessageText,
        time: "Aujourd'hui, " + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        orderId: order.id
      };

      setMessages(prev => [...prev, clientNotifMsg]);
      if (isSupabaseConfigured && supabase) {
        await insertMessageAdaptive(clientNotifMsg);
      }

      // Notify the buyer of order status
      sendPushNotification(order.clientId, "🎉 Commande enregistrée !", "Votre paiement a été placé en séquestre de sécurité.");
    }
  };

  // Instant messaging sender helper
  const handleSendMessage = (text: string, recipientId: string, image?: string, orderId?: string) => {
    if (!currentUser) return;
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      senderNom: `${currentUser.prenom} ${currentUser.nom}`,
      recipientId,
      text,
      image,
      orderId,
      time: "Aujourd'hui, " + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      isRead: false
    };

    setMessages(prev => [...prev, newMsg]);

    if (isSupabaseConfigured && supabase) {
      insertMessageAdaptive(newMsg);
    }

    // Trigger push notification to other participant in the private chat
    sendPushNotification(recipientId, `💬 Message de ${currentUser.prenom}`, text);


  };

  // Mark all messages from a specific sender to the current user as read
  const handleMarkMessagesAsRead = async (senderId: string) => {
    if (!currentUser) return;
    
    // 1. Update instantly in local state for instantaneous UI feedback
    setMessages(prev => prev.map(m => {
      if (m.senderId === senderId && m.recipientId === currentUser.id) {
        return { ...m, isRead: true };
      }
      return m;
    }));

    // 2. Update status asynchronously in Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('messages')
          .update({ is_read: true, isRead: true })
          .eq('sender_id', senderId)
          .eq('recipient_id', currentUser.id);

        if (error) {
          await supabase
            .from('messages')
            .update({ isRead: true })
            .eq('senderId', senderId)
            .eq('recipientId', currentUser.id);
        }
      } catch (err) {
        console.warn("Could not sync message read status to Supabase:", err);
      }
    }
  };

  const handleAddReview = (newRev: Omit<Review, 'id' | 'date'>) => {
    const fullRev: Review = {
      ...newRev,
      id: `rev-${Date.now()}`,
      date: new Date().toISOString().split('T')[0]
    };

    setReviews(prev => [fullRev, ...prev]);
    
    // Dynamically update product average stars
    setProducts(prods => prods.map(p => {
      if (p.id === newRev.productId) {
        const subset = [fullRev, ...reviews.filter(r => r.productId === p.id)];
        const avg = parseFloat((subset.reduce((acc, r) => acc + r.note, 0) / subset.length).toFixed(1));
        return { ...p, rating: avg };
      }
      return p;
    }));

    if (isSupabaseConfigured && supabase) {
      supabase.from('reviews').insert([{
        id: fullRev.id,
        product_id: fullRev.productId,
        client_nom: fullRev.clientNom,
        note: fullRev.note,
        commentaire: fullRev.commentaire,
        date: fullRev.date
      }]).then(({ error }) => {
        if (error) {
          console.error("Error creating review in Supabase:", error.message);
        }
      });
    }
  };

  const handleShareLink = (product: Product) => {
    const origin = window.location.origin;
    const shareUrl = `${origin}/?product=${product.id}`;
    
    const shareText = `🔍 Découvrez "${product.nom}" - ${product.prix.toLocaleString()} HTG sur Vendza.store!\n\n📋 Description : ${product.desc}`;
    
    if (navigator.share) {
      navigator.share({
        title: product.nom,
        text: shareText,
        url: shareUrl
      })
      .then(() => console.log('Successfully shared'))
      .catch((err) => {
        // Fallback if browser cancels or blocks native sharing
        navigator.clipboard.writeText(shareUrl);
        alert(`✓ Lien professionnel généré : ${shareUrl}\n(copié dans votre presse-papier)`);
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("✓ Lien public copié dans votre presse-papier !\n\nVous pouvez le coller sur WhatsApp, Facebook ou Instagram pour partager cet article avec sa photo, son prix et sa description.");
    }
  };

  // Count exact number of unread messages received by the user
  const unreadCount = currentUser 
    ? messages.filter(m => m.recipientId === currentUser.id && m.isRead !== true).length 
    : 0;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800 antialiased overflow-x-hidden selection:bg-blue-100 selection:text-blue-800 pb-12">
      
      {/* Dynamic PWA Custom Install Banner */}
      <InstallBanner />
      <PWAUpdater />

      {/* App Header layout block */}
      <Header
        user={currentUser}
        cart={cart}
        unreadMsgsCount={unreadCount}
        onNavigate={navigateTo}
        onToggleDrawer={() => setSidebarOpen(!sidebarOpen)}
        currentView={currentView}
      />

      {/* Main Drawer control panel menu */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={currentUser}
        cart={cart}
        unreadMsgsCount={unreadCount}
        onNavigate={navigateTo}
        onLogout={handleLogout}
        onQuickClientLogin={handleQuickClientLogin}
        onQuickVendorLogin={handleQuickVendorLogin}
        currentView={currentView}
        onUpdateProfile={handleUpdateProfile}
      />

      {/* Primary viewport content */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 pt-[86px] pb-10">
        <div className="animate-fade-in duration-300">
          
          {currentView === 'home' && (
            <MarketplaceHome
              products={products}
              reviews={reviews}
              onNavigate={navigateTo}
              onSetProduct={setSelectedProduct}
              onAddToCart={(p) => handleAddToCart(p, 1)}
              user={currentUser}
              loading={productsLoading}
              onLoadMore={handleLoadMoreProducts}
              hasMore={hasMoreProducts}
              tauxUSD={tauxUSD}
            />
          )}

          {currentView === 'flash-sales' && (
            <div className="space-y-6">
              {/* Header section with back button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <button 
                    onClick={() => navigateTo('home')}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer mb-2"
                  >
                    <span>← Retour au marché</span>
                  </button>
                  <h2 className="font-serif text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded-lg bg-red-600 text-white font-serif font-black animate-pulse text-base">50%</span> 
                    Ventes Flash Vendza
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xl font-sans">
                    Articles d’exception bénéficiant d’une réduction de prix de 50%. Profitez de ces opportunités d’achat exclusif en séquestre sécurisé.
                  </p>
                </div>
              </div>

              {/* Grid content */}
              {products.filter(p => {
                if (!p.oldPrice) return false;
                const discountPercent = Math.round((1 - p.prix / p.oldPrice) * 100);
                return discountPercent >= 45 && discountPercent <= 55;
              }).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                  {products.filter(p => {
                    if (!p.oldPrice) return false;
                    const discountPercent = Math.round((1 - p.prix / p.oldPrice) * 100);
                    return discountPercent >= 45 && discountPercent <= 55;
                  }).map(p => {
                    // Local rating calculation
                    const subset = reviews.filter(r => r.productId === p.id);
                    const computedRating = subset.length > 0 
                      ? Number((subset.reduce((acc, r) => acc + r.note, 0) / subset.length).toFixed(1))
                      : (p.rating || 5.0);

                    return (
                      <ProductGridCard 
                        key={p.id} 
                        product={p} 
                        rating={computedRating} 
                        onView={() => {
                          setSelectedProduct(p);
                          navigateTo('detail');
                        }} 
                        onAdd={() => handleAddToCart(p, 1)} 
                        tauxUSD={tauxUSD} 
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                  <span className="text-4xl">🏷️</span>
                  <p className="text-xs font-semibold text-slate-500 mt-3 font-sans">Aucun produit à -50% n'est disponible en ce moment.</p>
                  <button 
                    onClick={() => navigateTo('home')} 
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition hover:bg-blue-700 cursor-pointer"
                  >
                    Voir tous les produits
                  </button>
                </div>
              )}
            </div>
          )}

          {currentView === 'detail' && (
            <ProductDetail
              product={selectedProduct}
              products={products}
              reviews={reviews}
              user={currentUser}
              onNavigate={navigateTo}
              onAddToCart={handleAddToCart}
              onCheckoutNow={handleCheckoutNow}
              onOpenChat={(id, name) => {
                setActiveChatRecipientId(id);
                setActiveChatRecipientNom(name);
                navigateTo('inbox');
              }}
              onAddReview={handleAddReview}
              onShareLink={handleShareLink}
              onSetProduct={setSelectedProduct}
              onViewVendorProfile={(vendorId) => {
                setSelectedVendorId(vendorId);
                navigateTo('vendeur-profil');
              }}
              tauxUSD={tauxUSD}
            />
          )}

          {currentView === 'vendeur-profil' && selectedVendorId && (
            <VendorProfileView
              vendorId={selectedVendorId}
              user={currentUser}
              products={products}
              reviews={reviews}
              orders={orders}
              onNavigate={navigateTo}
              onSetProduct={setSelectedProduct}
              onOpenChat={(id, name) => {
                setActiveChatRecipientId(id);
                setActiveChatRecipientNom(name);
                navigateTo('inbox');
              }}
              onAddReview={handleAddReview}
            />
          )}

          {currentView === 'cart' && (
            <CartView
              cart={cart}
              user={currentUser}
              onNavigate={navigateTo}
              onUpdateCartItemQty={handleUpdateCartItemQty}
              onRemoveCartItem={handleRemoveCartItem}
              onClearCart={handleClearCart}
              onPlaceOrder={handlePlaceOrder}
              products={products}
              onSetProduct={setSelectedProduct}
              tauxUSD={tauxUSD}
            />
          )}

          {currentView === 'client-dashboard' && (
            <ClientDashboard
              orders={orders}
              user={currentUser}
              onNavigate={navigateTo}
              onCancelOrder={handleCancelOrder}
              onUpdateProfile={handleUpdateProfile}
              cart={cart}
              onViewTicket={(ord) => {
                setSelectedOrder(ord);
                setPreviousView('client-dashboard');
                setCurrentView('ticket');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onOpenDispute={ouvrirLitige}
            />
          )}

          {currentView === 'vendor-dashboard' && (
            <VendorDashboard
              products={products}
              orders={orders}
              reviews={reviews}
              user={currentUser}
              onNavigate={navigateTo}
              onConfirmDelivery={handleConfirmDelivery}
              onUpdateProfile={handleUpdateProfile}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onAddProduct={handleAddProduct}
              onStartEditProduct={(prod) => {
                setProductToEdit(prod);
                navigateTo('create-product');
              }}
              onViewTicket={(ord) => {
                setSelectedOrder(ord);
                setPreviousView('vendor-dashboard');
                setCurrentView('ticket');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
            />
          )}

          {currentView === 'ticket' && (
            (() => {
              const orderInState = orders.find(o => o.id === selectedOrder?.id) || selectedOrder;
              return orderInState ? (
                <TicketDetailView
                  order={orderInState}
                  user={currentUser}
                  onBack={() => {
                    setCurrentView(previousView || 'home');
                    window.scrollTo({ top: 0, behavior: 'instant' });
                  }}
                  onConfirmDelivery={handleConfirmDelivery}
                  onNavigate={navigateTo}
                />
              ) : null;
            })()
          )}

          {currentView === 'shop-settings' && currentUser && (
            <ShopSettingsView
              user={currentUser}
              onUpdateProfile={handleUpdateProfile}
              onNavigate={navigateTo}
            />
          )}

          {currentView === 'become-seller' && currentUser && (
            <BecomeSellerView
              user={currentUser}
              onUpdateProfile={handleUpdateProfile}
              onNavigate={navigateTo}
            />
          )}

          {currentView === 'create-product' && (
            <CreateProduct
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              productToEdit={productToEdit}
              clearProductToEdit={() => setProductToEdit(null)}
              onNavigate={navigateTo}
            />
          )}

          {currentView === 'subscription' && (
            <Subscription
              user={currentUser}
              onUpgradePlan={handleUpgradePlan}
            />
          )}

          {currentView === 'subscription-success' && (
            <SubscriptionSuccess
              user={currentUser}
              onBackToDashboard={() => navigateTo('vendor-dashboard')}
              onRefreshUser={async () => {
                if (currentUser?.id) {
                  await loadUserProfile(currentUser.id);
                }
              }}
            />
          )}

          {currentView === 'scanner' && (
            <ScannerView
              orders={orders}
              onConfirmDelivery={handleConfirmDelivery}
              onNavigate={navigateTo}
            />
          )}

          {currentView === 'inbox' && (
            <InboxView
              messages={messages}
              user={currentUser}
              onSendMessage={handleSendMessage}
              onMarkMessagesAsRead={handleMarkMessagesAsRead}
              products={products}
              orders={orders}
              initialRecipientId={activeChatRecipientId}
              initialRecipientNom={activeChatRecipientNom}
            />
          )}

          {currentView === 'checkout-return' && (
            <CheckoutReturn
              onGoHome={() => navigateTo('home')}
              onGoToOrders={() => navigateTo('client-dashboard')}
              isSupabaseConfigured={isSupabaseConfigured}
              supabase={supabase}
              clearCart={() => {
                setCart([]);
                localStorage.removeItem('cart');
              }}
              onViewTicket={async (orderId) => {
                if (orderId) {
                  let finalOrder: any = null;
                  if (isSupabaseConfigured && supabase) {
                    try {
                      const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
                      const queryCol = isUuid(orderId) ? 'id' : 'qr_token';
                      const { data: ord } = await supabase
                        .from('orders')
                        .select('*')
                        .eq(queryCol, orderId)
                        .maybeSingle();
                      if (ord) {
                        finalOrder = ord;
                      }
                    } catch (err) {
                      console.error("Error retrieving finished order from Supabase:", err);
                    }
                  }

                  if (!finalOrder) {
                    finalOrder = orders.find(o => o.id === orderId);
                  }

                  if (!finalOrder) {
                    const pendingOrderStr = sessionStorage.getItem('pendingOrder');
                    if (pendingOrderStr) {
                      try {
                        const raw = JSON.parse(pendingOrderStr);
                        if (raw.id === orderId) {
                          raw.status = 'payee'; // Mark as paid for user display
                          finalOrder = raw;
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }
                  }

                  if (!finalOrder) {
                    finalOrder = { id: orderId, status: 'payee' };
                  }

                  setOrders(prev => {
                    if (prev.some(o => o.id === finalOrder.id)) return prev;
                    return [finalOrder, ...prev];
                  });

                  setSelectedOrder(finalOrder);
                  sessionStorage.removeItem('pendingOrder');
                  setPreviousView('client-dashboard');
                  setCurrentView('ticket');
                }
              }}
            />
          )}

          {currentView === 'auth' && (
            <AuthView
              onLogin={handleLogin}
              onNavigate={navigateTo}
            />
          )}

          {currentView === 'terms' && (
            <TermsPage />
          )}

          {currentView === 'privacy' && (
            <PrivacyPage />
          )}

          {currentView === 'about' && (
            <AboutPage />
          )}

        </div>
      </main>

      {/* Universal Footer styled with Haitian flag reference */}
      <footer className="mt-auto border-t border-slate-200 py-6 bg-white shrink-0 print:hidden">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider select-none">
            <span className="w-4 h-2.5 bg-blue-600 block rounded-xs" />
            <span className="w-4 h-2.5 bg-red-600 block rounded-xs" />
            <span>Vendza.store · Garantie mobile Modèle Haïtien</span>
          </div>

          <div className="flex gap-4 text-[11px] text-slate-400 font-bold">
            <a onClick={() => navigateTo('home')} className="hover:text-blue-600 cursor-pointer">Marché</a>
            {currentUser && (
              <>
                <a onClick={() => navigateTo('subscription')} className="hover:text-blue-600 cursor-pointer">Abonnements</a>
                <a onClick={() => navigateTo('scanner')} className="hover:text-blue-600 cursor-pointer">QR Validation</a>
              </>
            )}
            <a onClick={() => navigateTo('terms')} className="hover:text-blue-600 cursor-pointer text-blue-600 underline">Conditions d'Utilisation</a>
            <a onClick={() => navigateTo('privacy')} className="hover:text-[#0d9488] text-[#0d9488] underline">Confidentialité</a>
          </div>
        </div>
      </footer>

      {/* Storage RLS Error guidance overlay */}
      {storageRlsError && (
        <div className="fixed bottom-4 right-4 max-w-sm sm:max-w-md bg-white border border-rose-200 rounded-2xl shadow-xl z-50 p-5 space-y-3 animate-slide-up mr-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-alert"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                Configuration de serveur requise !
              </h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                Les politiques de sécurité (RLS) de votre bucket bloquent l'envoi d'images. Copiez l'instruction SQL ci-dessous dans l'<strong>éditeur SQL</strong> de votre console de base de données pour débloquer les uploads publics :
              </p>
            </div>
            <button 
              onClick={() => setStorageRlsError(false)} 
              className="text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
              title="Masquer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="bg-slate-900 rounded-lg p-3 text-slate-200 text-[10px] font-mono overflow-x-auto relative">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`-- Activer l'accès public au bucket images
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

create policy "Allow Public Image Reading"
  on storage.objects for select
  using ( bucket_id = 'images' );

create policy "Allow Public Image Uploading"
  on storage.objects for insert
  with check ( bucket_id = 'images' );

create policy "Allow Public Image Updating"
  on storage.objects for update
  with check ( bucket_id = 'images' );`);
                alert("✓ Script SQL copié ! Collez-le dans l'éditeur SQL de votre serveur de base de données.");
              }}
              className="absolute right-2 top-2 bg-slate-800 hover:bg-slate-700 text-[9px] text-teal-400 px-2 py-1 rounded border border-slate-700 font-sans cursor-pointer transition select-none"
            >
              Copier SQL
            </button>
            <pre className="select-all opacity-95">
{`-- Activer l'accès public au bucket
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

create policy "Allow Public Read"
  on storage.objects for select
  using ( bucket_id = 'images' );

create policy "Allow Public Insert"
  on storage.objects for insert
  with check ( bucket_id = 'images' );`}
            </pre>
          </div>

          <p className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 flex items-center gap-1.5 shadow-3xs leading-relaxed">
            <span>💡</span>
            <span><strong>Mode de secours actif :</strong> Votre produit a été sauvegardé correctement grâce à notre compresseur d'image résilient intégré !</span>
          </p>
        </div>
      )}

      {/* Messages Table RLS Error guidance overlay */}
      {messagesRlsError && (
        <div className="fixed bottom-4 right-4 max-w-sm sm:max-w-md bg-white border border-rose-200 rounded-2xl shadow-xl z-50 p-5 space-y-3 animate-slide-up mr-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-alert"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                Règle RLS requise pour les messages !
              </h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                Les politiques de sécurité (RLS) de la table <strong>messages</strong> bloquent l'envoi de messages de chat. Exécutez le script ci-dessous dans l'<strong>éditeur SQL</strong> de votre console de base de données :
              </p>
            </div>
            <button 
              onClick={() => setMessagesRlsError(false)} 
              className="text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
              title="Masquer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="bg-slate-900 rounded-lg p-3 text-slate-200 text-[10px] font-mono overflow-x-auto relative">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`-- Débloquer les droits en lecture/écriture de la table messages (Row Level Security)
alter table public.messages enable row level security;

create policy "Lecture publique des messages"
  on public.messages for select
  using (true);

create policy "Insertion publique des messages"
  on public.messages for insert
  with check (true);`);
                alert("✓ Script SQL copié ! Collez-le dans l'éditeur SQL de votre serveur de base de données.");
              }}
              className="absolute right-2 top-2 bg-slate-800 hover:bg-slate-700 text-[9px] text-teal-400 px-2 py-1 rounded border border-slate-700 font-sans cursor-pointer transition select-none"
            >
              Copier SQL
            </button>
            <pre className="select-all opacity-95">
{`-- Débloquer l'accès public à la table messages
alter table public.messages enable row level security;

create policy "Lecture publique des messages"
  on public.messages for select
  using (true);

create policy "Insertion publique des messages"
  on public.messages for insert
  with check (true);`}
            </pre>
          </div>

          <p className="text-[10px] text-blue-850 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 flex items-center gap-1.5 shadow-3xs leading-relaxed">
            <span>💡</span>
            <span><strong>Mode de secours actif :</strong> Votre message a bien été affiché localement en temps réel ! Vos discussions restent fluides et interactives.</span>
          </p>
        </div>
      )}

      {/* ========================================================
          MONCASH SECURE PAYMENT OVERLAYS AND MODALS
          ======================================================== */}

      {/* Instant Checkout (Acheter Maintenant) Payment Method Selection Modal */}
      {instantCheckoutModalItem && (() => {
        const item = instantCheckoutModalItem;
        const freeCapitalCommunes = ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Carrefour'];
        const isCapitalCity = currentUser ? freeCapitalCommunes.includes(currentUser.commune) : true;
        const shippingFee = isCapitalCity ? 0 : 200;
        const finalTotal = item.product.prix * item.quantity + shippingFee;

        return (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[998] flex flex-col items-center justify-center p-4 pr-5">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  <h3 className="font-sans font-extrabold text-slate-900 text-sm tracking-tight">
                    Choisir votre méthode de paiement
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInstantCheckoutModalItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded-lg transition-all cursor-pointer font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] text-left">
                {/* Product Preview */}
                <div className="flex gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-100 shrink-0 flex items-center justify-center p-1">
                    {item.product.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.nom}
                        className="w-full h-full object-contain rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-400">
                        P
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <h4 className="font-sans font-extrabold text-slate-905 text-xs truncate">
                      {item.product.nom}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Quantité : <strong className="text-slate-800 font-bold">{item.quantity}</strong>
                      {item.color && <> • Couleur : <strong className="text-slate-800 font-bold">{item.color}</strong></>}
                      {item.size && <> • Taille : <strong className="text-slate-800 font-bold">{item.size}</strong></>}
                    </p>
                    <p className="font-mono text-xs font-black text-blue-600">
                      {item.product.prix} HTG
                    </p>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-2.5 font-sans">
                  <div className="flex justify-between items-center text-xs text-slate-650">
                    <span>Sous-total</span>
                    <span className="font-mono font-bold text-slate-800">{item.product.prix * item.quantity} HTG</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-650">
                    <span>Frais de livraison ({currentUser?.commune || 'Pétion-Ville'})</span>
                    <span className="font-mono font-bold text-slate-800">
                      {shippingFee > 0 ? `${shippingFee} HTG` : <span className="text-teal-650 font-extrabold">Gratuit</span>}
                    </span>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-extrabold text-slate-800">Montant Total</span>
                    <div className="text-right font-sans">
                      <span className="font-mono text-sm font-black text-blue-600 block">{finalTotal} HTG</span>
                      <span className="font-mono text-[10px] font-bold text-slate-400">{(finalTotal / tauxUSD).toFixed(2)} $ USD</span>
                    </div>
                  </div>
                </div>

                {/* Info alert about secure process */}
                <div className="p-3 bg-teal-50/50 border border-teal-100 rounded-xl space-y-1 flex items-start gap-2">
                  <span className="text-sm mt-0.5">🔒</span>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[9.5px] font-black uppercase tracking-wider text-teal-700">Fonds protégés en Séquestre</p>
                    <p className="text-[9.5px] text-slate-500 leading-normal font-sans">
                      Les fonds ne sont versés au vendeur qu'après confirmation par code QR de la livraison par vos soins !
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons for payment choice and close */}
              <div className="p-5 bg-slate-50/10 border-t border-slate-100 flex flex-col gap-2.5">
                {/* 1. Digicel MonCash Button */}
                <button
                  type="button"
                  onClick={() => executeInstantCheckout('moncash')}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#cc0612] hover:bg-[#b0050f] text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:scale-[1.01]"
                >
                  Payer avec MonCash
                </button>

                {/* Divider */}
                <div className="flex items-center justify-center gap-2 text-slate-300 select-none my-0.5">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#94a3b8]">OU</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                {/* 2. Stripe Button */}
                <button
                  type="button"
                  onClick={() => executeInstantCheckout('stripe')}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#635bff] text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:scale-[1.01]"
                >
                  Payer par Carte
                </button>

                {/* 3. Cancel */}
                <button
                  type="button"
                  onClick={() => setInstantCheckoutModalItem(null)}
                  className="mt-1.5 w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl hover:bg-slate-100 text-slate-500 font-extrabold text-xs transition cursor-pointer"
                >
                  Retour
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 1. Redirection Spinner Overlays */}
      {isRedirectingToMonCash && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-100/90 shadow-2xl max-w-sm w-full text-center space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold tracking-tight text-slate-800">
                {redirectPaymentMethod === 'stripe' ? "Redirection vers Stripe" : "Redirection vers MonCash"}
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {redirectPaymentMethod === 'stripe'
                  ? "Nous préparons votre paiement par carte bancaire. Vous allez être redirigé vers l'interface officielle et sécurisée de Stripe pour valider votre transaction."
                  : "Nous préparons votre paiement sécurisé. Vous allez être redirigé vers l'interface officielle Digicel MonCash pour valider l'opération en toute sécurité."}
              </p>
            </div>
            <div className="bg-blue-50 text-blue-800 rounded-2xl p-3 text-[10.5px] font-mono text-center flex items-center justify-center gap-1.5 border border-blue-100/80 animate-pulse">
              <span className="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
              {redirectPaymentMethod === 'stripe' ? "Sécurisé par Stripe • Visa / Mastercard / Amex" : "Paiement Séquestre Garanti • HTG (Gourdes)"}
            </div>
          </div>
        </div>
      )}

      {/* 1b. Verification Spinner Overlay */}
      {isVerifyingPayment && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-100/90 shadow-2xl max-w-sm w-full text-center space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-teal-600 border-t-transparent animate-spin"></div>
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold tracking-tight text-slate-800">
                Vérification du paiement...
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Veuillez patienter pendant que nous sécurisons votre transaction et finalisons l'enregistrement de votre commande sous séquestre Vendza.
              </p>
            </div>
            <div className="bg-teal-50 text-teal-850 rounded-2xl p-3 text-[10.5px] font-mono text-center flex items-center justify-center gap-1.5 border border-teal-100/80 animate-pulse">
              <span className="inline-block w-1.5 h-1.5 bg-teal-600 rounded-full"></span>
              Paiement Sécurisé • Séquestre Actif
            </div>
          </div>
        </div>
      )}

      {/* 2. Payment Success Modal */}
      {moncashSuccessOrder && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[998] flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl border border-emerald-100 shadow-2xl max-w-md w-full text-center space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-200">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-xl font-black text-slate-850 tracking-tight">Achat Porté avec Succès !</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Félicitations ! Votre paiement a été traité et validé avec succès. Les fonds de votre commande sont maintenant préservés en séquestre chez Vendza pour le vendeur (Escrow de sécurité actif).
              </p>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Numéro de Commande :</span>
                <span className="font-mono text-slate-850 font-black bg-slate-200/60 px-2 py-0.5 rounded text-[10px]">{moncashSuccessOrder}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Protection Acheteur :</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">Active <span className="text-xs">🛡️</span></span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Statut Fonds :</span>
                <span className="text-[9px] font-mono font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Préservé en séquestre</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setMoncashSuccessOrder(null);
                  navigateTo('client-dashboard');
                }}
                className="flex-1 bg-emerald-600 cursor-pointer hover:bg-emerald-700 font-sans text-xs font-bold text-white py-3 rounded-2xl hover:shadow-md transition-all duration-200"
              >
                Espace Client
              </button>
              <button
                onClick={() => setMoncashSuccessOrder(null)}
                className="flex-1 bg-slate-100 cursor-pointer hover:bg-slate-200 font-sans text-xs font-bold text-slate-700 py-3 rounded-2xl transition-all duration-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Payment Error / Canceled Modal */}
      {moncashErrorOrder && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[998] flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl border border-rose-100 shadow-2xl max-w-md w-full text-center space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-200">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-slate-800 tracking-tight">Paiement Non Finalisé</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Le paiement pour votre commande n'a pas pu être validé. Il est possible que la transaction ait été interrompue ou refusée sur la passerelle MonCash.
              </p>
            </div>
            
            <div className="bg-rose-50 border border-rose-100/70 rounded-2xl p-3 text-[10.5px] text-rose-800 font-mono text-center">
              MONCASH_PAYMENT_CANCELED_OR_FAILED
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMoncashErrorOrder(null);
                  navigateTo('cart');
                }}
                className="flex-1 bg-slate-900 cursor-pointer hover:bg-slate-800 font-sans text-xs font-bold text-white py-3 rounded-2xl transition-all duration-200 shadow-sm"
              >
                Panier d'achats
              </button>
              <button
                onClick={() => setMoncashErrorOrder(null)}
                className="flex-1 bg-slate-100 cursor-pointer hover:bg-slate-200 font-sans text-xs font-bold text-slate-700 py-3 rounded-2xl transition-all duration-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {orderToCancel && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-4">
          <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center border border-red-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-serif text-lg font-black text-slate-850 tracking-tight">Annuler la commande ?</h3>
              <p className="text-xs text-slate-500 leading-relaxed text-left whitespace-pre-wrap">
                En annulant cette commande, des frais de transaction de 7,50% seront déduits de ton remboursement. Le reste du montant te sera remboursé.{"\n\n"}Cette action est irréversible.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Montant total:</span>
                <span className="font-bold text-slate-800">{(orderToCancel.total || 0).toFixed(2)} HTG</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span className="font-medium">Frais déduits (7.50%):</span>
                <span>-{((orderToCancel.total || 0) * 0.075).toFixed(2)} HTG</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between font-extrabold text-emerald-600 text-sm">
                <span>Remboursement estimé:</span>
                <span>{((orderToCancel.total || 0) * 0.925).toFixed(2)} HTG</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setOrderToCancel(null)}
                className="flex-1 bg-slate-100 cursor-pointer hover:bg-slate-200 font-sans text-xs font-bold text-slate-700 py-3 rounded-2xl transition-all duration-200"
              >
                Garder ma commande
              </button>
              <button
                onClick={executeConfirmCancelOrder}
                className="flex-1 bg-red-600 cursor-pointer hover:bg-red-700 font-sans text-xs font-bold text-white py-3 rounded-2xl transition-all duration-200 shadow-md"
              >
                Accepter et annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Success message */}
      {refundConfirmationMsg && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-4">
          <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full text-center space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-lg font-black text-slate-850 tracking-tight">Commande Annulée</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed text-left whitespace-pre-wrap">
                {refundConfirmationMsg}
              </p>
            </div>

            <button
              onClick={() => setRefundConfirmationMsg(null)}
              className="w-full bg-emerald-600 cursor-pointer hover:bg-emerald-700 font-sans text-xs font-bold text-white py-3 rounded-2xl transition-all duration-200"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
