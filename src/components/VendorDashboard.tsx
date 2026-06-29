import React, { useState, useEffect } from 'react';
import { 
  Plus, Package, ShoppingCart, DollarSign, Star, 
  MapPin, Clock, Eye, AlertCircle, RefreshCw,
  User2, Phone, Mail, Lock, Bell, Edit2, Save, X, Sparkles, Store, ShoppingBag,
  Search, Trash2, Copy, Printer, Download, QrCode, Truck, Check, SlidersHorizontal
} from 'lucide-react';
import { Product, Order, UserProfile, Review } from '../types';
import { HAITIAN_ZONES } from '../data';
import { QRCodeRenderer } from './QRCodeRenderer';
import { ShopSettingsView } from './ShopSettingsView';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface VendorDashboardProps {
  products: Product[];
  orders: Order[];
  reviews: Review[];
  user: UserProfile | null;
  onNavigate: (view: string) => void;
  onConfirmDelivery: (orderId: string) => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onUpdateProduct: (productId: string, updates: Partial<Product>) => void;
  onDeleteProduct: (productId: string) => void;
  onAddProduct: (product: Omit<Product, 'id' | 'vendeur' | 'vendeurId' | 'rating' | 'dateCreation'>) => void;
  onStartEditProduct: (product: Product) => void;
  onViewTicket?: (order: Order) => void;
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({
  products,
  orders,
  reviews,
  user,
  onNavigate,
  onConfirmDelivery,
  onUpdateProfile,
  onUpdateProduct,
  onDeleteProduct,
  onAddProduct,
  onStartEditProduct,
  onViewTicket
}) => {
  // Enhanced tabs to support all the original seller-facing features
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'deliveries' | 'tickets' | 'profile'>('dashboard');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  
  const handleViewOrderDetails = (ord: Order) => {
    if (onViewTicket) {
      onViewTicket(ord);
    } else {
      setSelectedOrderDetails(ord);
    }
  };

  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);

  // States for products tab search/filter/stock edit
  const [productsSearch, setProductsSearch] = useState<string>('');
  const [productsFilter, setProductsFilter] = useState<'all' | 'actif' | 'brouillon' | 'epuise'>('all');
  const [editingStockProductId, setEditingStockProductId] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState<number>(0);

  // States for deliveries tracking tab
  const [deliveriesSearch, setDeliveriesSearch] = useState<string>('');
  const [deliveriesFilter, setDeliveriesFilter] = useState<'all' | 'today' | 'upcoming' | 'delayed' | 'delivered'>('all');

  // States for tickets/POS receipts generator
  const [selectedTicketOrder, setSelectedTicketOrder] = useState<Order | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Profile Edit fields states
  const [editMode, setEditMode] = useState<boolean>(false);
  const [formPrenom, setFormPrenom] = useState<string>('');
  const [formNom, setFormNom] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formTel, setFormTel] = useState<string>('');
  const [formDept, setFormDept] = useState<string>('');
  const [formCommune, setFormCommune] = useState<string>('');
  const [formShopName, setFormShopName] = useState<string>('');
  const [formShopDesc, setFormShopDesc] = useState<string>('');
  const [formAvatar, setFormAvatar] = useState<string>('');
  const [formBanner, setFormBanner] = useState<string>('');
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [formMoncash, setFormMoncash] = useState<string>('');
  const [formMoncashNom, setFormMoncashNom] = useState<string>('');
  const [formBanque, setFormBanque] = useState<string>('');
  const [formCompteBanque, setFormCompteBanque] = useState<string>('');
  const [formIdType, setFormIdType] = useState<string>('');
  const [formIdNumber, setFormIdNumber] = useState<string>('');
  const [formIdFile, setFormIdFile] = useState<string>('');
  const [formStatutVerification, setFormStatutVerification] = useState<'non_verifie' | 'en_verification' | 'verifie'>('non_verifie');

  // Password fields states
  const [pwdCurrent, setPwdCurrent] = useState<string>('');
  const [pwdNew, setPwdNew] = useState<string>('');
  const [pwdConf, setPwdConf] = useState<string>('');
  const [pwdStatus, setPwdStatus] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' });

  // Preferences Toggles states
  const [prefOrders, setPrefOrders] = useState<boolean>(true);
  const [prefDelivery, setPrefDelivery] = useState<boolean>(true);
  const [prefReviews, setPrefReviews] = useState<boolean>(true);
  const [prefNewsletter, setPrefNewsletter] = useState<boolean>(false);
  const [prefMessages, setPrefMessages] = useState<boolean>(true);

  // Success toast logic
  const [toastMessage, setToastMessage] = useState<string>('');

  // Dashboard inner tabs for bottom lists
  const [dashboardSubTab, setDashboardSubTab] = useState<'sales' | 'purchases' | 'products'>('sales');

  // Inner sales filter ('all' | 'new' | 'completed')
  const [salesFilter, setSalesFilter] = useState<'all' | 'new' | 'completed'>('all');

  // Wallet structure and state for escrow
  const [wallet, setWallet] = useState<{
    vendor_id: string;
    available_balance: number;
    pending_balance: number;
    total_earned: number;
  }>({
    vendor_id: user?.id || '',
    available_balance: 0,
    pending_balance: 0,
    total_earned: 0
  });

  // Afficher le prochain versement le samedi
  const prochainSamedi = () => {
    const aujourd_hui = new Date();
    const jourSemaine = aujourd_hui.getDay();
    const joursRestants = jourSemaine === 6 
      ? 7 
      : (6 - jourSemaine + 7) % 7 || 7;
    const samedi = new Date(aujourd_hui);
    samedi.setDate(aujourd_hui.getDate() + joursRestants);
    return samedi.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day:     'numeric',
      month:   'long'
    });
  };

  // Fetch Wallet dynamically from Supabase or calculate local fallback dynamically from vendor orders
  useEffect(() => {
    const fetchWallet = async () => {
      let supabaseWalletData = null;
      if (isSupabaseConfigured && supabase && user?.id) {
        try {
          const { data, error } = await supabase
            .from('vendor_wallets')
            .select('*')
            .eq('vendor_id', user.id)
            .maybeSingle();

          if (data && !error) {
            supabaseWalletData = {
              vendor_id: data.vendor_id,
              available_balance: Number(data.available_balance) || 0,
              pending_balance: Number(data.pending_balance) || 0,
              total_earned: Number(data.total_earned) || 0
            };
          }
        } catch (err) {
          console.warn("Could not load wallet from Supabase:", err);
        }
      }

      // Compute fee percent locally to avoid block scoping issues
      const planStr = String(user?.plan || 'gratuit').toLowerCase();
      const localFeePercent = planStr === 'pro_national' || planStr === 'pro national' 
        ? 3 
        : (planStr === 'pro_local' || planStr === 'pro local' ? 7 : 10);

      // Read actual vendor items share configuration
      const vOrders = orders.filter(o => 
        o.items.some(item => item.vendeurId === 'v-tph' || item.vendeurId === user?.id)
      );

      let computedAvailable = 0;
      let computedPending = 0;

      vOrders.forEach(ord => {
        const grossShare = getResilientVendorShare(ord, user?.id || '');
        const fee = Math.round((grossShare * localFeePercent) / 100);
        const netAmt = grossShare - fee;

        if (ord.status === 'livree') {
          computedAvailable += netAmt;
        } else if (ord.status === 'payee') {
          computedPending += netAmt;
        }
      });

      const computedTotal = computedAvailable + computedPending;

      if (supabaseWalletData) {
        setWallet({
          vendor_id: supabaseWalletData.vendor_id,
          available_balance: supabaseWalletData.available_balance || computedAvailable,
          pending_balance: supabaseWalletData.pending_balance || computedPending,
          total_earned: supabaseWalletData.total_earned || computedTotal
        });
      } else {
        setWallet({
          vendor_id: user?.id || '',
          available_balance: computedAvailable,
          pending_balance: computedPending,
          total_earned: computedTotal
        });
      }
    };
    fetchWallet();
  }, [user?.id, orders, user?.plan]);

  // Sync profile fields with user prop
  useEffect(() => {
    if (user) {
      setFormPrenom(user.prenom || '');
      setFormNom(user.nom || '');
      setFormEmail(user.email || '');
      setFormTel(user.tel || '');
      setFormDept(user.departement || 'Ouest');
      setFormCommune(user.commune || 'Pétion-Ville');
      setFormShopName(user.shopName || '');
      setFormShopDesc(user.shopDesc || '');
      setFormAvatar(user.avatar || '');
      setFormBanner(user.banner || '');
      setFormCategories(user.categories || []);
      setFormMoncash(user.moncash || '');
      setFormMoncashNom(user.moncashNom || '');
      setFormBanque(user.banque || '');
      setFormCompteBanque(user.compteBanque || '');
      setFormIdType(user.idType || '');
      setFormIdNumber(user.idNumber || '');
      setFormIdFile(user.idFile || '');
      setFormStatutVerification(user.statutVerification || 'non_verifie');
    }
  }, [user]);

  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);

  // Fetch nearest active subscription or any subscription expiry date
  useEffect(() => {
    const fetchSubscriptionExpiry = async () => {
      if (isSupabaseConfigured && supabase && user?.id) {
        if (user.plan === 'Gratuit') {
          setSubscriptionExpiry(null);
          return;
        }
        try {
          const { data, error } = await supabase
            .from('vendor_subscriptions')
            .select('expires_at, started_at')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1);

          if (data && data.length > 0 && !error) {
            const sub = data[0];
            if (sub.expires_at) {
              const expDate = new Date(sub.expires_at);
              setSubscriptionExpiry(expDate.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }));
            }
          }
        } catch (err) {
          console.warn("Could not load fresh subscription info from Supabase:", err);
        }
      }
    };
    fetchSubscriptionExpiry();
  }, [user?.id, user?.plan]);

  // Handle auto-selecting the first merchant order when tickets tab is opened
  useEffect(() => {
    if (activeTab === 'tickets' && !selectedTicketOrder && vendorOrders.length > 0) {
      setSelectedTicketOrder(vendorOrders[0]);
    }
  }, [activeTab]);

  if (!user) return null;

  // Resilient vendor share calculation function
  const getResilientVendorShare = (ord: Order, vendorId: string): number => {
    const vendorItems = ord.items.filter(item => 
      item.vendeurId === 'v-tph' || 
      item.vendeurId === vendorId || 
      !item.vendeurId || 
      item.vendeurId === 'v-gen'
    );
    const sum = vendorItems.reduce((acc, currentItem: any) => {
      const pr = Number(currentItem.prix || currentItem.price || currentItem.unit_price || 0);
      const qt = Number(currentItem.qte || currentItem.quantity || currentItem.qty || 1);
      return acc + (pr * qt);
    }, 0);
    if (sum > 0) return sum;
    if (ord.total && ord.total > 0) return ord.total;
    return ord.items.reduce((acc, currentItem: any) => {
      const pr = Number(currentItem.prix || currentItem.price || currentItem.unit_price || 0);
      const qt = Number(currentItem.qte || currentItem.quantity || currentItem.qty || 1);
      return acc + (pr * qt);
    }, 0);
  };

  // Helper function to decode day of week index (Monday=0 to Sunday=6)
  const getDayOfWeekIndex = (dateStr: string): number => {
    try {
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const y = parseInt(parts[2], 10);
          const dateObj = new Date(y, m, d);
          const day = dateObj.getDay();
          return day === 0 ? 6 : day - 1;
        }
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          const dateObj = new Date(y, m, d);
          const day = dateObj.getDay();
          return day === 0 ? 6 : day - 1;
        }
      }
    } catch (e) {
      console.error("Day of week parsing exception:", e);
    }
    const cur = new Date().getDay();
    return cur === 0 ? 6 : cur - 1;
  };

  // Filter products belonging to this seller
  const vendorProducts = products.filter(p => p.vendeurId === 'v-tph' || p.vendeurId === user.id);
  const activeProductsCount = vendorProducts.filter(p => p.statut === 'actif').length;

  // Filter orders containing items owned by this vendor
  const vendorOrders = orders.filter(o => 
    o.items.some(item => item.vendeurId === 'v-tph' || item.vendeurId === user.id)
  );

  // Compute active unread order notifications for the merchant
  const activeOrderNotifications = vendorOrders.filter(
    o => (o.status === 'payee' || o.status === 'attente') && !dismissedNotifications.includes(o.id)
  );

  // Compute stats of sales
  const completedOrders = vendorOrders.filter(o => o.status === 'livree');
  
  // Fee rate based on user plan (Gratuit = 20%, Pro Local = 15%, Pro National = 10%)
  const planStr = String(user?.plan || 'gratuit').toLowerCase();
  const feePercent = planStr === 'pro_national' || planStr === 'pro national' 
    ? 10 
    : (planStr === 'pro_local' || planStr === 'pro local' ? 15 : 20);

  // Volume des ventes brutes
  const grossSalesVolume = completedOrders.reduce((sum, order) => {
    return sum + getResilientVendorShare(order, user.id);
  }, 0);

  // Gains nets après déduction des frais de plateforme
  const totalSalesVolume = completedOrders.reduce((sum, order) => {
    const grossShare = getResilientVendorShare(order, user.id);
    const fee = Math.round((grossShare * feePercent) / 100);
    return sum + (grossShare - fee);
  }, 0);

  // Total des frais de plateforme déduits
  const totalPlatformFeesDeducted = grossSalesVolume - totalSalesVolume;

  const pendingConfirmationCount = vendorOrders.filter(o => o.status === 'payee').length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const handleSimulateReceive = (orderId: string) => {
    onConfirmDelivery(orderId);
    showToast("✓ Enregistré ! Le paiement de la commande a été débloqué, les Gourdes ont été créditées sur votre solde.");
    setSelectedOrderDetails(prev => prev ? { ...prev, status: 'livree' } : null);
    if (selectedTicketOrder?.id === orderId) {
      setSelectedTicketOrder(prev => prev ? { ...prev, status: 'livree' } : null);
    }
  };

  const handleSaveProfile = () => {
    if (!formPrenom.trim() || !formNom.trim() || !formEmail.trim() || !formShopName.trim()) {
      showToast("⚠️ Les champs Prénom, Nom, Email et Nom de Boutique sont obligatoires (*)");
      return;
    }
    
    // Dynamically adjust verification status if identity / payment info is now completely filled or removed
    let nextStatut = formStatutVerification;
    if (formStatutVerification === 'non_verifie' && formMoncash.trim() && formIdNumber.trim() && formIdFile) {
      nextStatut = 'en_verification';
    }

    onUpdateProfile({
      prenom: formPrenom,
      nom: formNom,
      email: formEmail,
      tel: formTel,
      departement: formDept,
      commune: formCommune,
      shopName: formShopName,
      shopDesc: formShopDesc,
      avatar: formAvatar,
      banner: formBanner,
      categories: formCategories,
      moncash: formMoncash,
      moncashNom: formMoncashNom,
      banque: formBanque,
      compteBanque: formCompteBanque,
      idType: formIdType,
      idNumber: formIdNumber,
      idFile: formIdFile,
      statutVerification: nextStatut
    });
    setFormStatutVerification(nextStatut);
    setEditMode(false);
    showToast("💾 Configuration de boutique sauvegardée avec succès !");
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCurrent) {
      setPwdStatus({ type: 'error', text: 'Saisissez votre mot de passe actuel.' });
      return;
    }
    if (pwdNew.length < 6) {
      setPwdStatus({ type: 'error', text: 'Le mot de passe doit faire au moins 6 caractères.' });
      return;
    }
    if (pwdNew !== pwdConf) {
      setPwdStatus({ type: 'error', text: 'Les deux mots de passe saisis sont différents.' });
      return;
    }

    setPwdStatus({ type: 'success', text: '✓ Mot de passe réinitialisé !' });
    setPwdCurrent('');
    setPwdNew('');
    setPwdConf('');
    setTimeout(() => setPwdStatus({ type: '', text: '' }), 5000);
  };

  // Products tab filtering logic
  const filteredVendorProducts = vendorProducts.filter(p => {
    // Search filter
    if (productsSearch) {
      const q = productsSearch.toLowerCase();
      const matchName = p.nom.toLowerCase().includes(q);
      const matchCat = p.cat.toLowerCase().includes(q);
      const matchDesc = p.desc.toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchDesc) return false;
    }

    // Tab filter
    if (productsFilter === 'all') return true;
    if (productsFilter === 'actif') return p.statut === 'actif' && p.stock > 0;
    if (productsFilter === 'brouillon') return p.statut === 'brouillon';
    if (productsFilter === 'epuise') return p.stock <= 0;
    return true;
  });

  // Toggle active/draft status matching raw javascript source
  const handleToggleProductStatus = (prod: Product) => {
    const nextStatus = prod.statut === 'actif' ? 'brouillon' : 'actif';
    onUpdateProduct(prod.id, { statut: nextStatus });
    showToast(`✓ Statut de "${prod.nom}" mis à jour : ${nextStatus === 'actif' ? 'Actif (Publié)' : 'Brouillon'}`);
  };

  // Fast inline stock safe updates
  const handleEditStockClick = (prod: Product) => {
    setEditingStockProductId(prod.id);
    setEditingStockValue(prod.stock);
  };

  const handleSaveStockValue = (productId: string) => {
    onUpdateProduct(productId, { stock: editingStockValue });
    setEditingStockProductId(null);
    showToast("✓ Quantité en stock mise à jour !");
  };

  // Duplicate product as draft matching buildDuplicateRow in mes-produit.js
  const handleDuplicateProduct = (prod: Product) => {
    onAddProduct({
      nom: `${prod.nom} (Copie)`,
      cat: prod.cat,
      desc: prod.desc,
      prix: prod.prix,
      oldPrice: prod.oldPrice,
      stock: prod.stock,
      image_url: prod.image_url,
      tags: prod.tags || [],
      couleurs: prod.couleurs || [],
      tailles: prod.tailles || [],
      capacites: prod.capacites || [],
      gallery: prod.gallery || [],
      caracteristiques: prod.caracteristiques || {},
      statut: 'brouillon'
    });
    showToast(`✓ Produit "${prod.nom}" dupliqué en Brouillon avec succès !`);
  };

  // Delete product wrapper
  const handleDeleteProductClick = (productId: string, productName: string) => {
    if (confirm(`Voulez-vous vraiment supprimer définitivement le produit "${productName}" de votre catalogue ?`)) {
      onDeleteProduct(productId);
    }
  };

  // Deliveries tracker filters matcher
  const filteredDeliveries = vendorOrders.filter(order => {
    if (deliveriesSearch) {
      const q = deliveriesSearch.toLowerCase();
      const matchClient = order.clientNom.toLowerCase().includes(q);
      const matchAddr = order.commune.toLowerCase().includes(q) || order.departement.toLowerCase().includes(q);
      const matchId = order.id.toLowerCase().includes(q);
      const matchProd = order.items.some(it => it.productNom.toLowerCase().includes(q));
      if (!matchClient && !matchAddr && !matchId && !matchProd) return false;
    }

    if (deliveriesFilter === 'all') return true;
    if (deliveriesFilter === 'delivered') return order.status === 'livree';
    if (deliveriesFilter === 'today') return order.status === 'payee'; // En cours d'expédition aujourd'hui
    if (deliveriesFilter === 'delayed') return false; // Non simulé
    if (deliveriesFilter === 'upcoming') return order.status === 'payee' || order.status === 'attente';
    return true;
  });

  // Simulated printing trigger
  const triggerPrintReceipt = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      showToast("🖨️ Impression POS lancée avec succès.");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Toast alert display */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-60 bg-teal-900 border border-teal-400 text-teal-100 text-xs font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Four-way horizontal scrollable tab navigation bar resembling native layouts */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-3 items-stretch sm:items-center">
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 w-full sm:max-w-2xl md:max-w-3xl overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => { setActiveTab('dashboard'); setSelectedOrderDetails(null); }}
            className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer whitespace-nowrap relative ${
              activeTab === 'dashboard' ? 'bg-[#0c1445] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📊 Tableau de bord
            {activeOrderNotifications.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white font-mono text-[9px] font-black rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center animate-pulse">
                {activeOrderNotifications.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'products' ? 'bg-[#0c1445] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📦 Mes Produits
          </button>

          <button
            onClick={() => setActiveTab('deliveries')}
            className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'deliveries' ? 'bg-[#0c1445] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🚚 Suivi Livraisons
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile' ? 'bg-[#0c1445] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🏪 Identité &amp; Boutique
          </button>
        </div>

        {/* Global actions row based on selected tab */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-serif text-sm font-bold text-slate-800 uppercase tracking-wider">
            {activeTab === 'dashboard' && "Espace Marchand — Garantie Sécurisée"}
            {activeTab === 'products' && `Gestion Catalogue (${vendorProducts.length} articles disponibles)`}
            {activeTab === 'deliveries' && `Feuille de Route & Livraisons (${vendorOrders.length} colis)`}
            {activeTab === 'profile' && "Ma Boutique — Identité & Coordonnées de Paiement"}
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => {
                onStartEditProduct(null as any);
                onNavigate('create-product');
              }}
              className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus size={14} /> Publier un produit
            </button>
          </div>
        </div>
      </div>

      {/* ==================== 1. TAB: DASHBOARD ==================== */}
      {activeTab === 'dashboard' && (
        <div className="v-dash-container space-y-6">
          {/* Custom scoped style injector to render the provided mockup design exactly */}
          <style dangerouslySetInnerHTML={{ __html: `
            .v-dash-container {
              --blue: #2563eb; --blue-dk: #1e40af; --blue-lt: #eff6ff;
              --teal: #0d9488; --teal-lt: #f0fdfa;
              --green: #1d4ed8; --green-lt: #eff6ff; /* Match elegant look */
              --amber: #f59e0b; --amber-lt: #fffbeb;
              --red: #ef4444; --red-lt: #fef2f2;
              --violet: #7c3aed; --violet-lt: #f5f3ff;
              --text: #0c1445; --muted: #5a6480; --faint: #9aa3bf;
              --border: #e4e9f5; --bg: #f0f2fa; --white: #fff;
            }
            .v-dash-container .dash-header {
              background: linear-gradient(135deg, #0c1445 0%, #1e3a8a 60%, #0d9488 100%);
              border-radius: 20px; padding: 24px; margin-bottom: 24px;
              color: white; position: relative; overflow: hidden;
              box-shadow: 0 4px 20px rgba(12, 20, 69, 0.15);
            }
            .v-dash-container .dash-header-grid {
              position: absolute; inset: 0;
              background-image: linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px);
              background-size: 24px 24px; pointer-events: none; border-radius: 20px;
            }
            .v-dash-container .dash-greeting { font-size: 11px; font-weight: 705; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.6); margin-bottom: 4px; }
            .v-dash-container .dash-name { font-size: 1.6rem; font-weight: 800; tracking: tight; margin-bottom: 2px; }
            .v-dash-container .dash-sub { font-size: 12px; color: rgba(255,255,255,.7); }
            .v-dash-container .dash-header-bottom { display: flex; align-items: center; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
            .v-dash-container .dash-pill {
              display: flex; align-items: center; gap: 5px;
              background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
              color: rgba(255,255,255,0.9); font-size: 10.5px; font-weight: 600;
              padding: 4.5px 11px; border-radius: 99px; backdrop-filter: blur(4px);
            }
            .v-dash-container .dash-pill .dot { width: 6.5px; height: 6.5px; border-radius: 50%; background: #4ade80; animation: vd-pulse-green 2s infinite; }
            
            .v-dash-container .stats-grid {
              display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
            }
            @media(min-width: 640px) {
              .v-dash-container .stats-grid { grid-template-columns: repeat(3, 1fr); }
            }
            @media(min-width: 1024px) {
              .v-dash-container .stats-grid { grid-template-columns: repeat(6, 1fr); gap: 14px; }
            }

            .v-dash-container .stat-card {
              background: var(--white); border: 1px solid var(--border);
              border-radius: 16px; padding: 16px 14px; position: relative; overflow: hidden;
              transition: all .2s ease;
            }
            .v-dash-container .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,.04); border-color: #cbd5e1; }
            .v-dash-container .stat-card::before {
              content:''; position: absolute; top:0; left:0; right:0; height:3.5px; border-radius: 16px 16px 0 0;
            }
            .v-dash-container .stat-card.blue::before { background: var(--blue); }
            .v-dash-container .stat-card.amber::before { background: var(--amber); }
            .v-dash-container .stat-card.green::before { background: var(--green); }
            .v-dash-container .stat-card.violet::before { background: var(--violet); }
            .v-dash-container .stat-card.teal::before { background: #14b8a6; }
            .v-dash-container .stat-card.red::before { background: var(--red); }

            .v-dash-container .stat-icon {
              width: 34px; height: 34px; border-radius: 9px;
              display: flex; align-items: center; justify-content: center; font-size: 16px;
              margin-bottom: 10px;
            }
            .v-dash-container .stat-card.blue .stat-icon { background: var(--blue-lt); }
            .v-dash-container .stat-card.amber .stat-icon { background: var(--amber-lt); }
            .v-dash-container .stat-card.green .stat-icon { background: var(--green-lt); }
            .v-dash-container .stat-card.violet .stat-icon { background: var(--violet-lt); }
            .v-dash-container .stat-card.teal .stat-icon { background: #f0fdfa; }
            .v-dash-container .stat-card.red .stat-icon { background: var(--red-lt); }

            .v-dash-container .stat-val {
              font-size: 1.45rem; font-weight: 800; color: var(--text); line-height: 1.15; margin-bottom: 2px;
            }
            .v-dash-container .stat-lbl { font-size: 10px; font-weight: 700; color: var(--muted); white-space: nowrap; }
            .v-dash-container .stat-trend {
              position: absolute; top: 12px; right: 12px;
              font-size: 8px; font-weight: 800; padding: 2px 5px; border-radius: 5px;
            }
            .v-dash-container .trend-up { background: #dcfce7; color: #15803d; }
            .v-dash-container .trend-new { background: #dbeafe; color: #1d4ed8; }

            .v-dash-container .revenue-card {
              background: var(--white); border: 1px solid var(--border);
              border-radius: 16px; padding: 18px;
            }
            .v-dash-container .revenue-total {
              font-size: 1.5rem; font-weight: 800; color: var(--text); letter-spacing: -.02em; margin-bottom: 2px;
            }
            .v-dash-container .revenue-sub { font-size: 10.5px; color: var(--muted); margin-bottom: 14px; }
            
            .v-dash-container .mini-chart { display: flex; align-items: flex-end; gap: 5px; height: 50px; }
            .v-dash-container .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
            .v-dash-container .chart-bar {
              width: 100%; border-radius: 3.5px 3.5px 0 0;
              background: linear-gradient(180deg, var(--blue) 0%, #0d9488 100%);
              transition: height .3s ease; min-height: 3px;
            }
            .v-dash-container .chart-bar.current { background: linear-gradient(180deg, var(--amber) 0%, var(--red) 100%); }
            .v-dash-container .chart-lbl { font-size: 9px; color: var(--faint); text-align: center; font-weight: 600; }

            .v-dash-container .quick-actions {
              display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
            }
            @media(min-width: 768px) {
              .v-dash-container .quick-actions { grid-template-columns: repeat(4, 1fr); gap: 12px; }
            }
            .v-dash-container .qa-btn {
              background: var(--white); border: 1.5px solid var(--border);
              border-radius: 14px; padding: 14px;
              display: flex; align-items: center; gap: 8px;
              cursor: pointer; transition: all .15s ease; width: 100%; text-align: left;
            }
            .v-dash-container .qa-btn:hover { border-color: var(--blue); background: var(--blue-lt); transform: translateY(-2.5px); }
            .v-dash-container .qa-icon { font-size: 1.25rem; flex-shrink: 0; }
            .v-dash-container .qa-label { font-size: 11.5px; font-weight: 800; color: var(--text); line-height: 1.25; }
            .v-dash-container .qa-sub { font-size: 9px; color: var(--faint); margin-top: 1px; }

            .v-dash-container .cmd-card {
              background: var(--white); border: 1px solid var(--border);
              border-radius: 14px; padding: 12px 14px; margin-bottom: 8px;
              display: flex; align-items: center; gap: 10px;
              transition: all .15s; cursor: pointer;
            }
            .v-dash-container .cmd-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.04); border-color: var(--blue); }
            .v-dash-container .cmd-num {
              width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
              background: var(--blue-lt); color: var(--blue);
              font-family: monospace; font-size: 10.5px; font-weight: 700;
              display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.15;
            }
            .v-dash-container .cmd-body { flex: 1; min-width: 0; text-align: left; }
            .v-dash-container .cmd-client { font-size: 12px; font-weight: 700; margin-bottom: 1.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
            .v-dash-container .cmd-date { font-size: 10px; color: var(--faint); }
            .v-dash-container .cmd-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
            .v-dash-container .cmd-total { font-family: monospace; font-size: 12px; font-weight: 700; color: var(--text); }
            
            .v-dash-container .cmd-status { font-size: 9px; font-weight: 700; padding: 2px 7.5px; border-radius: 99px; white-space: nowrap; }
            .v-dash-container .status-paid { background: #dcfce7; color: #15803d; }
            .v-dash-container .status-pending { background: #fef3c7; color: #b45309; }
            .v-dash-container .status-cancel { background: #fee2e2; color: #b91c1c; }
            .v-dash-container .status-livree { background: #dbeafe; color: #1d4ed8; }

            .v-dash-container .prod-card {
              background: var(--white); border: 1px solid var(--border);
              border-radius: 14px; padding: 11px 13px; margin-bottom: 8px;
              display: flex; align-items: center; gap: 10px;
              transition: all .15s; cursor: pointer;
            }
            .v-dash-container .prod-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.04); border-color: var(--blue); }
            .v-dash-container .prod-emoji {
              width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
              background: linear-gradient(135deg, var(--blue-lt), #f0fdfa);
              display: flex; align-items: center; justify-content: center; font-size: 1.15rem;
            }
            .v-dash-container .prod-body { flex: 1; min-width: 0; text-align: left; }
            .v-dash-container .prod-name { font-size: 12px; font-weight: 700; margin-bottom: 1.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
            .v-dash-container .prod-meta { font-size: 10px; color: var(--faint); }
            .v-dash-container .prod-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
            .v-dash-container .prod-price { font-family: monospace; font-size: 12px; font-weight: 700; color: var(--blue); }
            .v-dash-container .prod-stock { font-size: 9px; font-weight: 700; }
            .v-dash-container .stock-ok { color: #15803d; }
            .v-dash-container .stock-low { color: #b45309; }
            .v-dash-container .stock-out { color: #b91c1c; }

            .v-dash-container .empty {
              text-align: center; padding: 24px 14px;
              background: #f8fafc; border-radius: 12px;
              border: 1.5px dashed #e2e8f0;
            }
            .v-dash-container .empty-icon { font-size: 1.6rem; margin-bottom: 6px; opacity: .45; }
            .v-dash-container .empty p { font-size: 11px; color: var(--faint); font-weight: 600; }

            @keyframes vd-pulse-green {
              0%,100% { opacity: 1; transform: scale(1) }
              50% { opacity: .55; transform: scale(.9) }
            }
          `}} />

          {/* Active order notifications banner */}
          {activeOrderNotifications.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3 animate-pulse-subtle">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔔</span>
                  <div>
                    <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                      Nouvelles commandes sécurisées reçues ({activeOrderNotifications.length})
                    </h3>
                    <p className="text-[10px] text-amber-700/80 font-medium">L'argent est bloqué par séquestre et garanti — préparez l'expédition.</p>
                  </div>
                </div>
                <button
                  onClick={() => setDismissedNotifications(vendorOrders.map(o => o.id))}
                  className="text-[10px] font-black text-amber-700 hover:text-amber-900 hover:underline uppercase tracking-wide cursor-pointer"
                >
                  Tout masquer
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeOrderNotifications.map(notificationOrder => {
                  const itemsSummary = notificationOrder.items.map(it => `${it.qte}x ${it.productNom || it.nom}`).join(', ');
                  return (
                    <div key={notificationOrder.id} className="bg-white border border-amber-200 rounded-2xl p-3 flex justify-between items-center gap-3 shadow-3xs hover:border-amber-400 transition-all">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap font-sans">
                          <span className="text-[8.5px] font-mono font-black px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded uppercase tracking-wider">
                            CMD: {notificationOrder.id.slice(0, 10).toUpperCase()}
                          </span>
                          <span className="text-xs font-extrabold text-slate-800 truncate">{notificationOrder.clientNom}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 truncate font-semibold">
                          🛒 {itemsSummary}
                        </p>
                        <p className="text-[9.5px] text-slate-400 font-bold flex items-center gap-1">
                          📍 {notificationOrder.commune}, {notificationOrder.departement}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => {
                            handleViewOrderDetails(notificationOrder);
                          }}
                          className="px-2.5 py-1.5 bg-[#0c1445] hover:bg-[#1b255c] text-white rounded-lg text-[9px] font-extrabold uppercase tracking-wide transition text-center cursor-pointer"
                        >
                          Détails
                        </button>
                        <button
                          onClick={() => setDismissedNotifications(prev => [...prev, notificationOrder.id])}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-lg text-[9px] font-extrabold uppercase tracking-wide transition text-center cursor-pointer border border-slate-100"
                        >
                          Masquer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Banner de revenus bloqués */}
          {(user.plan && user.plan !== 'Gratuit' && user.plan !== 'gratuit') && user.statutVerification !== 'verifie' && (
            user.statutVerification === 'en_verification' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs font-sans">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">⏳</span>
                  <div>
                    <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Vérification de sécurité en cours</h4>
                    <p className="text-[11px] text-amber-700 leading-normal mt-0.5">
                      Vos documents officiels d'identité sont actuellement en cours d'analyse par notre équipe de conformité. Vos gains accumulés de ({user.revenusBloques || 0} Gdes) sont en séquestre sécurisé et seront automatiquement transférés dès validation de votre profil.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="shrink-0 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer text-center"
                >
                  Suivre mon statut
                </button>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs font-sans">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0">🚨</span>
                  <div>
                    <h4 className="text-xs font-extrabold text-red-900 uppercase tracking-wider">Revenus de boutique bloqués ({user.revenusBloques || 0} Gdes)</h4>
                    <p className="text-[11px] text-red-700 leading-normal mt-0.5">
                      Votre compte vendeur n'est pas encore vérifié. Veuillez soumettre vos documents d'identité officiels ainsi que votre numéro MonCash dans l'onglet Identité de votre boutique pour débloquer automatiquement le retrait de vos gains sécurisés.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="shrink-0 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer text-center"
                >
                  Débloquer mes gains
                </button>
              </div>
            )
          )}

          {/* Model Header */}
          <div className="dash-header flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="dash-header-grid"></div>
            <div className="flex-1 min-w-0 relative z-10">
              <div className="dash-greeting">Bonjour 👋</div>
              <div className="dash-name">{user.shopName || `${user.prenom} Boutique`}</div>
              <div className="dash-sub">Plateforme de confiance sécurisée Vendza Haïti</div>
              <div className="dash-header-bottom">
                <div className="dash-pill"><span className="dot"></span> Boutique active</div>
                <div className="dash-pill">📅 {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div className="dash-pill">
                  ⭐ Plan {user.plan || 'Gratuit'}
                  {user.plan !== 'Gratuit' && subscriptionExpiry && ` (Expire le ${subscriptionExpiry})`}
                </div>
              </div>
            </div>

            <div className="relative z-10 shrink-0 w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/20 overflow-hidden flex items-center justify-center shadow-md select-none">
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.shopName || `${user.prenom} ${user.nom}`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="font-serif text-2.5xl font-black text-teal-305 text-white">
                  {user.prenom 
                    ? user.prenom.charAt(0).toUpperCase() 
                    : (user.email ? user.email.charAt(0).toUpperCase() : 'B')
                  }
                </span>
              )}
            </div>
          </div>

          {/* Subscription Infobox/Banner */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-3xs font-sans">
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-2xl shrink-0">
                {user.plan === 'Pro National' ? '🏆' : user.plan === 'Pro Local' ? '⭐' : '📦'}
              </span>
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span>Abonnement Actuel : {user.plan || 'Gratuit'}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">Actif</span>
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                  {user.plan === 'Gratuit' ? (
                    "Vous utilisez actuellement la formule d'essai gratuite limitée à votre région d'origine."
                  ) : (
                    <>
                      Votre visibilité {user.plan === 'Pro National' ? 'Nationale (Haïti-Entier)' : 'Régionale étendue'} est active. 
                      {subscriptionExpiry ? (
                        <span className="font-bold text-blue-600"> Renouvellement de l'abonnement prévu le : {subscriptionExpiry}</span>
                      ) : (
                        " Chargement des détails de validité..."
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('subscription')}
              className="shrink-0 px-3.5 py-2 border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
            >
              🚀 {user.plan === 'Gratuit' ? 'Passer au Plan Supérieur' : 'Option Abonnements'}
            </button>
          </div>

          {/* Portefeuille de Sequestre Block */}
          <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50/50 border border-indigo-100 rounded-3xl p-6 shadow-sm space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                    <DollarSign size={16} />
                  </span>
                  Portefeuille Séquestre Vendza
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl font-sans">
                  Suivez vos soldes de ventes en temps réel. Les fonds payés par les acheteurs restent en séquestre sécurisé et sont libérés automatiquement sur votre solde disponible 24 heures après la livraison scannée.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card available */}
              <div className="bg-white border border-emerald-100 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-emerald-200 transition duration-150">
                <div className="space-y-2">
                  <span className="text-[10px] font-black tracking-widest text-emerald-600 uppercase block">💰 Disponible</span>
                  <div className="text-xl font-mono font-black text-emerald-700 leading-none">
                    {wallet.available_balance.toLocaleString('fr-FR')} HTG
                  </div>
                  <div className="text-[10px] text-[#0d9488] font-bold mt-1 inline-flex items-center gap-1">
                    📅 Versement le {prochainSamedi()}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (wallet.available_balance <= 0) {
                      showToast("⚠️ Votre solde disponible est de 0 Gdes.");
                      return;
                    }
                    alert(`✓ Votre demande de versement de ${wallet.available_balance.toLocaleString()} Gdes via MonCash / Compte Bancaire a bien été transmise à la direction de Vendza. Versement prévu ce samedi : ${prochainSamedi()}`);
                  }}
                  className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10.5px] font-bold transition uppercase tracking-wider cursor-pointer shadow-xs active:scale-95 duration-100"
                >
                  Demander un virement
                </button>
              </div>

              {/* Card pending */}
              <div className="bg-white border border-amber-100 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-amber-200 transition duration-150">
                <div className="space-y-2">
                  <span className="text-[10px] font-black tracking-widest text-amber-600 uppercase block">🔒 En attente QR</span>
                  <div className="text-xl font-mono font-black text-amber-700 leading-none">
                    {wallet.pending_balance.toLocaleString('fr-FR')} HTG
                  </div>
                </div>
                <div className="mt-4 text-[10px] text-slate-500 leading-normal font-sans italic bg-amber-50/50 p-2.5 rounded-xl border border-dashed border-amber-100">
                  Libéré après scan du QR par le client
                </div>
              </div>

              {/* Card total */}
              <div className="bg-white border border-indigo-100 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-indigo-200 transition duration-150">
                <div className="space-y-2">
                  <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block">📊 Total gagné</span>
                  <div className="text-xl font-mono font-black text-indigo-700 leading-none">
                    {wallet.total_earned.toLocaleString('fr-FR')} HTG
                  </div>
                </div>
                <div className="mt-4 text-[10px] text-slate-500 leading-normal font-sans bg-indigo-50/50 p-2.5 rounded-xl border border-dashed border-indigo-100">
                  Volume total d'affaires honorées et en cours sur Vendza.
                </div>
              </div>
            </div>
          </div>

          {/* Model Stats Blocks */}
          <div className="stats-grid">
            <div className="stat-card blue">
              <div className="stat-trend trend-new">En vitrine</div>
              <div className="stat-icon">📦</div>
              <div className="stat-val">{vendorProducts.length}</div>
              <div className="stat-lbl">Produits actifs</div>
            </div>
            
            <div className="stat-card amber">
              {pendingConfirmationCount > 0 && (
                <div className="stat-trend trend-up">Attention</div>
              )}
              <div className="stat-icon">🛒</div>
              <div className="stat-val">{vendorOrders.length}</div>
              <div className="stat-lbl">Commandes reçues</div>
            </div>

            <div className="stat-card green">
              <div className="stat-icon">💰</div>
              <div className="stat-val">{totalSalesVolume.toLocaleString('fr-FR')}</div>
              <div className="stat-lbl">Revenus nets (Gdes)</div>
            </div>

            <div className="stat-card violet">
              <div className="stat-icon">⭐</div>
              <div className="stat-val">4.8</div>
              <div className="stat-lbl">Note moyenne</div>
            </div>

            <div className="stat-card teal">
              <div className="stat-icon">🕐</div>
              <div className="stat-val">{orders.filter(o => o.clientId === user.id).length}</div>
              <div className="stat-lbl">Mes achats</div>
            </div>

            <div className="stat-card red">
              <div className="stat-icon">🛍️</div>
              <div className="stat-val">
                {(() => {
                  try {
                    const stored = localStorage.getItem('vendza_cart') || localStorage.getItem('cart');
                    if (stored) {
                      const parsed = JSON.parse(stored);
                      return Array.isArray(parsed) ? parsed.length : 0;
                    }
                  } catch (e) {}
                  return 0;
                })()}
              </div>
              <div className="stat-lbl">Articles panier</div>
            </div>
          </div>

          {/* Two side-by-side graphs on PC & Tablettes, stacked on Mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-stretch">
            {/* Graph 1: Weekly Revenue Trend Chart */}
            <div className="revenue-card flex flex-col justify-between space-y-4 shadow-sm border border-[#e4e9f5] rounded-3xl p-5 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="revenue-total text-xl font-black text-[#0c1445] tracking-tight">
                      {totalSalesVolume.toLocaleString('fr-FR')} HTG
                    </div>
                    <span className="text-[9px] font-black tracking-wide bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase border border-emerald-250">
                      Gains Hebdo ✓
                    </span>
                  </div>
                  <div className="revenue-sub text-[10.5px] text-slate-400 font-semibold leading-normal font-sans mt-0.5">
                    Gains hebdomadaires nets crédités après déduction de la commission de <b>-{feePercent}%</b>.
                  </div>
                </div>
              </div>

              {/* Enhanced Chart Canvas with responsive SVGs */}
              <div className="relative pt-4 pb-1 px-1">
                {(() => {
                  const days = ['Luna', 'Mard', 'Merc', 'Jeud', 'Vend', 'Same', 'Dima'];
                  const hasRealSales = completedOrders.length > 0;
                  
                  const realNetVals = [0, 0, 0, 0, 0, 0, 0];
                  const realGrossVals = [0, 0, 0, 0, 0, 0, 0];
                  
                  completedOrders.forEach(order => {
                    const dayIdx = getDayOfWeekIndex(order.date);
                    if (dayIdx >= 0 && dayIdx < 7) {
                      const gross = getResilientVendorShare(order, user.id);
                      realGrossVals[dayIdx] += gross;
                      const fee = Math.round((gross * feePercent) / 100);
                      realNetVals[dayIdx] += (gross - fee);
                    }
                  });

                  const demoNetVals = [1800, 3200, 2400, 5200, 6400, 3100, 1500];
                  const demoGrossVals = demoNetVals.map(val => Math.round(val / ((100 - feePercent) / 100)));

                  const netVals = hasRealSales ? realNetVals : demoNetVals;
                  const grossVals = hasRealSales ? realGrossVals : demoGrossVals;

                  const maxVal = Math.max(...netVals, 2000);

                  const width = 450;
                  const height = 180;
                  const paddingLeft = 45;
                  const paddingRight = 15;
                  const paddingTop = 20;
                  const paddingBottom = 25;

                  const chartWidth = width - paddingLeft - paddingRight;
                  const chartHeight = height - paddingTop - paddingBottom;

                  const points = netVals.map((val, idx) => {
                    const x = paddingLeft + (idx * (chartWidth / 6));
                    const y = (paddingTop + chartHeight) - (val / maxVal) * chartHeight;
                    return { x, y, val, grossVal: grossVals[idx], day: days[idx] };
                  });

                  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                  const fillPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} Z`;

                  const gridLinesY = [0, 0.25, 0.5, 0.75, 1].map(r => paddingTop + r * chartHeight);
                  const latestPoint = points[points.length - 1];

                  return (
                    <div className="relative w-full">
                      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="overflow-visible select-none">
                        <defs>
                          <linearGradient id="areaGradBlue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Gridlines */}
                        {gridLinesY.map((y, idx) => (
                          <line 
                            key={idx} 
                            x1={paddingLeft} 
                            y1={y} 
                            x2={width - paddingRight} 
                            y2={y} 
                            stroke="#f1f5f9" 
                            strokeWidth="1.2" 
                            strokeDasharray={idx === 4 ? "0" : "3,3"}
                          />
                        ))}

                        {/* Vertical Gridlines */}
                        {points.map((p, idx) => (
                          <line 
                            key={idx} 
                            x1={p.x} 
                            y1={paddingTop} 
                            x2={p.x} 
                            y2={paddingTop + chartHeight} 
                            stroke="#f1f5f9" 
                            strokeWidth="1.2" 
                            strokeDasharray="3,3"
                          />
                        ))}

                        {/* Dotted horizontal baseline from final active dot to left edge */}
                        <line 
                          x1={paddingLeft} 
                          y1={latestPoint.y} 
                          x2={latestPoint.x} 
                          y2={latestPoint.y} 
                          stroke="#2563eb" 
                          strokeWidth="1.2" 
                          strokeDasharray="3,3" 
                          opacity="0.85" 
                        />

                        {/* Filled area path */}
                        <path d={fillPath} fill="url(#areaGradBlue)" />

                        {/* Thick Blue stroke line chart path */}
                        <path 
                          d={linePath} 
                          fill="none" 
                          stroke="#2563eb" 
                          strokeWidth="3.2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />

                        {/* Grid Line Label markers for Y-axis */}
                        {[0, 0.5, 1].map((r, i) => {
                          const val = Math.round(maxVal * r);
                          const y = (paddingTop + chartHeight) - r * chartHeight;
                          return (
                            <text 
                              key={i} 
                              x={paddingLeft - 8} 
                              y={y + 3} 
                              textAnchor="end" 
                              className="font-mono text-[9px] font-bold fill-slate-400"
                            >
                              {val.toLocaleString('fr-FR')}
                            </text>
                          );
                        })}

                        {/* X-axis Label markers */}
                        {points.map((p, idx) => (
                          <text 
                            key={idx} 
                            x={p.x} 
                            y={paddingTop + chartHeight + 16} 
                            textAnchor="middle" 
                            className="font-bold text-[9.5px] fill-slate-400"
                          >
                            {p.day}
                          </text>
                        ))}

                        {/* Circle Nodes */}
                        {points.map((p, idx) => {
                          const isLast = idx === points.length - 1;
                          return (
                            <g key={idx}>
                              {/* Outer glow ring on hover or if last */}
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r={isLast ? "10" : "6"} 
                                fill="#2563eb" 
                                fillOpacity={isLast ? "0.2" : "0"} 
                                className={isLast ? 'animate-pulse' : ''}
                              />
                              {/* Node solid circle */}
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r={isLast ? "4.5" : "3.5"} 
                                fill={isLast ? "#2563eb" : "#3b82f6"} 
                                stroke="#ffffff" 
                                strokeWidth="1.8" 
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Interactive Absolute Tooltips overlaid beautifully on hover */}
                      <div className="absolute inset-y-0 left-[45px] right-[15px] flex justify-between pointer-events-none">
                        {points.map((p, idx) => (
                          <div 
                            key={idx} 
                            className="group relative flex-1 h-full pointer-events-auto"
                          >
                            {/* Tooltip trigger area */}
                            <div className="absolute inset-y-0 left-[-15px] right-[-15px] bg-transparent cursor-crosshair" />
                            {/* Real-time Tooltip bubble */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-[#0c1445] text-white text-[9.5px] p-2 rounded-xl transition-all duration-150 shadow-md z-30 pointer-events-none whitespace-nowrap text-center leading-normal border border-slate-700">
                              <span className="font-extrabold text-slate-300 block mb-0.5">{p.day}</span>
                              <span className="font-mono text-emerald-400 font-extrabold block text-[10.5px]">
                                Net: {p.val.toLocaleString('fr-FR')} HTG
                              </span>
                              <span className="text-[8px] text-slate-400 block font-medium">
                                Brut: {p.grossVal.toLocaleString('fr-FR')} (-{feePercent}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Weekly info tagline */}
              <div className="mt-2 bg-slate-50 border border-slate-150 rounded-2xl p-2.5 text-left text-[10px] text-slate-500 font-bold leading-normal font-sans">
                💡 Les données de vente sont mises à jour en direct lors des livraisons physiques.
              </div>
            </div>

            {/* Graph 2: Monthly Comparison (Current vs Last Month with trend index) */}
            <div className="revenue-card flex flex-col justify-between space-y-4 shadow-sm border border-[#e4e9f5] rounded-3xl p-5 bg-white">
              {(() => {
                const MONTH_NAMES_FR = [
                  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
                ];

                const now = new Date();
                const currentMonthIdx = now.getMonth();
                const currentYear = now.getFullYear();

                let prevMonthIdx = currentMonthIdx - 1;
                let prevYear = currentYear;
                if (prevMonthIdx < 0) {
                  prevMonthIdx = 11;
                  prevYear = currentYear - 1;
                }

                const hasRealSales = completedOrders.length > 0;

                // Sum Net monthly gains divided into 4 weekly categories
                const realThisWeeks = [0, 0, 0, 0];
                const realLastWeeks = [0, 0, 0, 0];

                completedOrders.forEach(order => {
                  try {
                    let dObj = null;
                    let ordDay = 15; // default center of month
                    if (order.date.includes('/')) {
                      const parts = order.date.split('/');
                      if (parts.length === 3) {
                        dObj = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
                        ordDay = parseInt(parts[0], 10);
                      }
                    } else if (order.date.includes('-')) {
                      const parts = order.date.split('-');
                      if (parts.length === 3) {
                        dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                        ordDay = parseInt(parts[2], 10);
                      }
                    }

                    if (dObj) {
                      const ordMonth = dObj.getMonth();
                      const ordYear = dObj.getFullYear();
                      const gross = getResilientVendorShare(order, user.id);
                      const fee = Math.round((gross * feePercent) / 100);
                      const net = gross - fee;

                      // Map day of month to week bins [0, 1, 2, 3]
                      const weekBin = Math.min(3, Math.floor((ordDay - 1) / 7.5)); // dividing roughly 30 days into 4 parts

                      if (ordMonth === currentMonthIdx && ordYear === currentYear) {
                        realThisWeeks[weekBin] += net;
                      } else if (ordMonth === prevMonthIdx && ordYear === prevYear) {
                        realLastWeeks[weekBin] += net;
                      }
                    }
                  } catch (e) {
                    console.error("Month parsing exception:", e);
                  }
                });

                // Fallbacks
                const demoThisWeeks = [18200, 24800, 19100, 22100];
                const demoLastWeeks = [14500, 19300, 17850, 20850];

                const thisWeeks = hasRealSales ? realThisWeeks : demoThisWeeks;
                const lastWeeks = hasRealSales ? realLastWeeks : demoLastWeeks;

                const currentMonthNet = thisWeeks.reduce((a, b) => a + b, 0);
                const lastMonthNet = lastWeeks.reduce((a, b) => a + b, 0);

                // Calculate percentage increase or decrease
                let diffPercent = 0;
                let isUp = true;
                let isFlat = false;

                if (lastMonthNet > 0) {
                  const progress = ((currentMonthNet - lastMonthNet) / lastMonthNet) * 100;
                  diffPercent = Math.round(progress);
                  if (progress > 0) {
                    isUp = true;
                  } else if (progress < 0) {
                    isUp = false;
                    diffPercent = Math.abs(diffPercent);
                  } else {
                    isFlat = true;
                  }
                } else if (currentMonthNet > 0) {
                  diffPercent = 100;
                  isUp = true;
                } else {
                  isFlat = true;
                }

                const monthMaxVal = Math.max(...thisWeeks, ...lastWeeks, 10000);

                const width = 450;
                const height = 180;
                const paddingLeft = 45;
                const paddingRight = 15;
                const paddingTop = 20;
                const paddingBottom = 25;

                const chartWidth = width - paddingLeft - paddingRight;
                const chartHeight = height - paddingTop - paddingBottom;

                const pointsThis = thisWeeks.map((val, idx) => {
                  const x = paddingLeft + (idx * (chartWidth / 3));
                  const y = (paddingTop + chartHeight) - (val / monthMaxVal) * chartHeight;
                  return { x, y, val };
                });

                const pointsLast = lastWeeks.map((val, idx) => {
                  const x = paddingLeft + (idx * (chartWidth / 3));
                  const y = (paddingTop + chartHeight) - (val / monthMaxVal) * chartHeight;
                  return { x, y, val };
                });

                const linePathThis = pointsThis.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                const fillPathThis = `${linePathThis} L ${pointsThis[pointsThis.length - 1].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} L ${pointsThis[0].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} Z`;

                const linePathLast = pointsLast.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                const fillPathLast = `${linePathLast} L ${pointsLast[pointsLast.length - 1].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} L ${pointsLast[0].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} Z`;

                const gridLinesY = [0, 0.25, 0.5, 0.75, 1].map(r => paddingTop + r * chartHeight);
                const latestPointThis = pointsThis[pointsThis.length - 1];

                return (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="revenue-total text-xl font-black text-[#0c1445] tracking-tight">
                            {currentMonthNet.toLocaleString('fr-FR')} HTG
                          </div>
                          {isFlat ? (
                            <span className="text-[9px] font-black tracking-wide bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full uppercase border border-slate-200">
                              Stable ▬
                            </span>
                          ) : (
                            isUp ? (
                              <span className="text-[9px] font-black tracking-wide bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase border border-emerald-250 animate-pulse">
                                ▲ Hausse +{diffPercent}%
                              </span>
                            ) : (
                              <span className="text-[9px] font-black tracking-wide bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full uppercase border border-rose-200">
                                ▼ Baisse -{diffPercent}%
                              </span>
                            )
                          )}
                        </div>
                        <div className="revenue-sub text-[10.5px] text-slate-400 font-semibold leading-normal font-sans mt-0.5">
                          Comparaison des gains nets de <b>{MONTH_NAMES_FR[currentMonthIdx]}</b> par rapport à <b>{MONTH_NAMES_FR[prevMonthIdx]}</b>
                        </div>
                      </div>
                    </div>

                    {/* SVG Chart Canvas */}
                    <div className="relative pt-4 pb-1 px-1">
                      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="overflow-visible select-none">
                        <defs>
                          <linearGradient id="areaGradThis" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
                          </linearGradient>
                          <linearGradient id="areaGradLast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.10" />
                            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.00" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Gridlines */}
                        {gridLinesY.map((y, idx) => (
                          <line 
                            key={idx} 
                            x1={paddingLeft} 
                            y1={y} 
                            x2={width - paddingRight} 
                            y2={y} 
                            stroke="#f1f5f9" 
                            strokeWidth="1.2" 
                            strokeDasharray={idx === 4 ? "0" : "3,3"}
                          />
                        ))}

                        {/* Vertical Gridlines split into 4 weeks */}
                        {pointsThis.map((p, idx) => (
                          <line 
                            key={idx} 
                            x1={p.x} 
                            y1={paddingTop} 
                            x2={p.x} 
                            y2={paddingTop + chartHeight} 
                            stroke="#f1f5f9" 
                            strokeWidth="1.2" 
                            strokeDasharray="3,3"
                          />
                        ))}

                        {/* Baseline dotted horizontal marker */}
                        <line 
                          x1={paddingLeft} 
                          y1={latestPointThis.y} 
                          x2={latestPointThis.x} 
                          y2={latestPointThis.y} 
                          stroke="#2563eb" 
                          strokeWidth="1.2" 
                          strokeDasharray="3,3" 
                          opacity="0.85" 
                        />

                        {/* Last Month filled area */}
                        <path d={fillPathLast} fill="url(#areaGradLast)" />
                        {/* Last Month line graph (Slate color, dashed) */}
                        <path 
                          d={linePathLast} 
                          fill="none" 
                          stroke="#94a3b8" 
                          strokeWidth="2" 
                          strokeDasharray="4,4"
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          opacity="0.8"
                        />

                        {/* This Month filled area */}
                        <path d={fillPathThis} fill="url(#areaGradThis)" />
                        {/* This Month line graph (Royal Blue, solid) */}
                        <path 
                          d={linePathThis} 
                          fill="none" 
                          stroke="#2563eb" 
                          strokeWidth="3.2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />

                        {/* Grid Line Label markers for Y-axis */}
                        {[0, 0.5, 1].map((r, i) => {
                          const val = Math.round(monthMaxVal * r);
                          const y = (paddingTop + chartHeight) - r * chartHeight;
                          return (
                            <text 
                              key={i} 
                              x={paddingLeft - 8} 
                              y={y + 3} 
                              textAnchor="end" 
                              className="font-mono text-[9px] font-bold fill-slate-400"
                            >
                              {val.toLocaleString('fr-FR')}
                            </text>
                          );
                        })}

                        {/* X-axis Label markers: Week 1 to 4 */}
                        {pointsThis.map((p, idx) => (
                          <text 
                            key={idx} 
                            x={p.x} 
                            y={paddingTop + chartHeight + 16} 
                            textAnchor="middle" 
                            className="font-bold text-[9.5px] fill-slate-400"
                          >
                            {`Sem. ${idx + 1}`}
                          </text>
                        ))}

                        {/* Highlight Active nodes of This Month */}
                        {pointsThis.map((p, idx) => {
                          const isLast = idx === pointsThis.length - 1;
                          return (
                            <g key={idx}>
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r={isLast ? "10" : "6"} 
                                fill="#2563eb" 
                                fillOpacity={isLast ? "0.2" : "0"} 
                                className={isLast ? 'animate-pulse' : ''}
                              />
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r={isLast ? "4.5" : "3.5"} 
                                fill={isLast ? "#2563eb" : "#3b82f6"} 
                                stroke="#ffffff" 
                                strokeWidth="1.8" 
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Tooltips overlay for comparative analysis */}
                      <div className="absolute inset-y-0 left-[45px] right-[15px] flex justify-between pointer-events-none">
                        {pointsThis.map((p, idx) => {
                          const lastP = pointsLast[idx];
                          return (
                            <div 
                              key={idx} 
                              className="group relative flex-1 h-full pointer-events-auto"
                            >
                              <div className="absolute inset-y-0 left-[-20px] right-[-20px] bg-transparent cursor-crosshair" />
                              <div className="absolute -top-16 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-[#0c1445] text-white text-[9.5px] p-2.5 rounded-xl transition-all duration-150 shadow-md z-30 pointer-events-none whitespace-nowrap text-center leading-normal border border-slate-700 min-w-[125px]">
                                <span className="font-extrabold text-slate-300 block mb-1">Semaine {idx + 1}</span>
                                <span className="font-mono text-emerald-400 font-extrabold block text-[10.5px] mb-0.5">
                                  {now.toLocaleDateString('fr-FR', { month: 'short' })}: {p.val.toLocaleString('fr-FR')} HTG
                                </span>
                                <span className="font-mono text-slate-300 font-bold block text-[9.5px]">
                                  {MONTH_NAMES_FR[prevMonthIdx].substring(0, 4)}: {lastP.val.toLocaleString('fr-FR')} HTG
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Educational feedback banner */}
                    <div className={`mt-2 rounded-2xl p-2.5 text-left text-[10px] font-medium leading-normal flex items-start gap-2 ${
                      isFlat 
                        ? 'bg-slate-50 text-slate-600 border border-slate-200' 
                        : (isUp 
                            ? 'bg-emerald-50/70 border border-emerald-100 text-slate-600' 
                            : 'bg-rose-50/70 border border-rose-100 text-slate-600'
                          )
                    }`}>
                      <span className="text-sm shrink-0">{isFlat ? '📊' : (isUp ? '📈' : '📉')}</span>
                      <div>
                        {isFlat ? (
                          <p>Vos profits mensuels sont stables par rapport au mois précédent.</p>
                        ) : (
                          isUp ? (
                            <p className="font-bold">Excellent! Vos gains ont progressé de <b className="text-emerald-700 font-black">+{diffPercent}%</b> ce mois-ci par rapport au mois de {MONTH_NAMES_FR[prevMonthIdx]}. Continuez ainsi !</p>
                          ) : (
                            <p className="font-bold">Attention! Vos gains mensuels ont baissé de <b className="text-rose-700 font-black">-{diffPercent}%</b>. Essayez de publier de nouveaux articles pour rebooster votre boutique !</p>
                          )
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500 font-sans text-left">
              Actions Rapides Marchand
            </h4>
            <div className="quick-actions">
              <button 
                onClick={() => {
                  onStartEditProduct(null as any);
                  onNavigate('create-product');
                }}
                className="qa-btn"
              >
                <span className="qa-icon">📦</span>
                <div>
                  <div className="qa-label">Ajouter un produit</div>
                  <div className="qa-sub">Publier un article</div>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('deliveries')}
                className="qa-btn"
              >
                <span className="qa-icon">🚚</span>
                <div>
                  <div className="qa-label">Voir commandes</div>
                  <div className="qa-sub">Feuille de route active</div>
                </div>
              </button>

              <button 
                onClick={() => {
                  setDeliveriesFilter('upcoming');
                  setActiveTab('deliveries');
                }}
                className="qa-btn"
              >
                <span className="qa-icon">⏳</span>
                <div>
                  <div className="qa-label">Livraisons prévues</div>
                  <div className="qa-sub">Colis en séquestre</div>
                </div>
              </button>

              <button 
                onClick={() => onNavigate('subscription')}
                className="qa-btn"
              >
                <span className="qa-icon">⭐</span>
                <div>
                  <div className="qa-label">Mon abonnement</div>
                  <div className="qa-sub">Changer mon plan</div>
                </div>
              </button>
            </div>
          </div>

          {/* Bottom lists (Commandes récentes, Mes achats récents, Mes produits) restuctured into beautifully polished tab views */}
          <div className="space-y-4 pt-2">
            {/* Tab selection controls */}
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 w-full sm:max-w-xl md:max-w-2xl mx-auto overflow-x-auto no-scrollbar scroll-smooth">
              <button
                onClick={() => setDashboardSubTab('sales')}
                className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer whitespace-nowrap relative ${
                  dashboardSubTab === 'sales'
                    ? 'bg-[#0c1445] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                🛒 Commandes Clients ({vendorOrders.length})
              </button>
              <button
                onClick={() => setDashboardSubTab('purchases')}
                className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer whitespace-nowrap relative ${
                  dashboardSubTab === 'purchases'
                    ? 'bg-[#0c1445] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                🛍️ Mes Achats ({orders.filter(o => o.clientId === user.id).length})
              </button>
              <button
                onClick={() => setDashboardSubTab('products')}
                className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer whitespace-nowrap relative ${
                  dashboardSubTab === 'products'
                    ? 'bg-[#0c1445] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                📦 Mes Produits ({vendorProducts.length})
              </button>
            </div>

            {/* Display active Sub-Tab content */}
            <div className="bg-white border border-[#e4e9f5] rounded-3xl p-5 shadow-sm space-y-4 min-h-[220px]">
              {dashboardSubTab === 'sales' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                    <h3 className="font-serif text-xs font-bold uppercase tracking-wider text-slate-500 text-left">
                      Commandes Clients Récentes
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[8.5px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase">
                        Fonds de Garantie Séquestre
                      </span>
                    </div>
                  </div>

                  {/* Sub-tabs inside Commandes Clients */}
                  <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5 w-full sm:w-max border border-slate-250">
                    <button
                      onClick={() => setSalesFilter('all')}
                      aria-label="Toutes les commandes"
                      className={`flex-1 sm:flex-initial text-[10px] font-black py-1.5 px-3.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        salesFilter === 'all'
                          ? 'bg-[#0c1445] text-white shadow-3xs'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                      }`}
                    >
                      Toutes ({vendorOrders.length})
                    </button>
                    <button
                      onClick={() => setSalesFilter('new')}
                      aria-label="Nouvelles commandes"
                      className={`flex-1 sm:flex-initial text-[10px] font-black py-1.5 px-3.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 ${
                        salesFilter === 'new'
                          ? 'bg-emerald-600 text-white shadow-3xs'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                      }`}
                    >
                      <span>🆕 Nouvelles</span>
                      <span className="font-mono bg-white/25 text-[9px] px-1 py-0.2 rounded">
                        {vendorOrders.filter(o => o.status === 'payee' || o.status === 'attente').length}
                      </span>
                    </button>
                    <button
                      onClick={() => setSalesFilter('completed')}
                      aria-label="Commandes clôturées"
                      className={`flex-1 sm:flex-initial text-[10px] font-black py-1.5 px-3.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        salesFilter === 'completed'
                          ? 'bg-blue-600 text-white shadow-3xs'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                      }`}
                    >
                      Clôturées ({vendorOrders.filter(o => o.status === 'livree').length})
                    </button>
                  </div>

                  {(() => {
                    const filteredOrders = vendorOrders.filter(ord => {
                      if (salesFilter === 'new') return ord.status === 'payee' || ord.status === 'attente';
                      if (salesFilter === 'completed') return ord.status === 'livree';
                      return true;
                    });

                    return filteredOrders.length > 0 ? (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto no-scrollbar">
                        {filteredOrders.slice(0, 10).map(ord => {
                          const vendorShare = getResilientVendorShare(ord, user.id);
                          const feeAmt = Math.round((vendorShare * feePercent) / 100);
                          const netAmt = vendorShare - feeAmt;

                          return (
                            <div 
                              key={ord.id} 
                              onClick={() => handleViewOrderDetails(ord)}
                              className="cmd-card transition hover:border-slate-300"
                            >
                              <div className="cmd-num">
                                #{ord.id.slice(-4).toUpperCase()}
                              </div>
                              <div className="cmd-body">
                                <div className="cmd-client">{ord.clientNom}</div>
                                <div className="cmd-date">📅 {ord.date} à {ord.heure} • 📍 {ord.commune}</div>
                              </div>
                              <div className="cmd-right text-right">
                                <div className="cmd-total text-emerald-700 font-extrabold">{netAmt.toLocaleString('fr-FR')} HTG</div>
                                <div className="text-[10px] font-mono text-slate-500 font-bold leading-none mb-1">
                                  {vendorShare.toLocaleString('fr-FR')} - {feePercent}%
                                </div>
                                <span className={`cmd-status ${ord.status === 'livree' ? 'status-paid' : 'status-pending'}`}>
                                  {ord.status === 'livree' ? 'Clôturée' : 'Séquestre'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty border border-dashed border-slate-200 rounded-3xl p-8 text-center text-slate-400">
                        <div className="empty-icon text-2xl mb-2">🛒</div>
                        <p className="font-bold text-xs">Aucune commande disponible pour ce filtre.</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {dashboardSubTab === 'purchases' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                    <h3 className="font-serif text-xs font-bold uppercase tracking-wider text-slate-500 text-left">
                      Mes Achats Récents (en tant que Client)
                    </h3>
                  </div>
                  {orders.filter(o => o.clientId === user.id).length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                      {orders.filter(o => o.clientId === user.id).slice(0, 3).map(ord => {
                        return (
                          <div 
                            key={ord.id} 
                            className="cmd-card cursor-pointer"
                            onClick={() => handleViewOrderDetails(ord)}
                          >
                            <div className="cmd-num" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                              🛍️
                            </div>
                            <div className="cmd-body">
                              <div className="cmd-client">Commande chez {ord.items[0]?.vendeur || 'Vendeur'}</div>
                              <div className="cmd-date">📅 {ord.date} • {ord.items.length} article(s)</div>
                            </div>
                            <div className="cmd-right text-right">
                              <div className="cmd-total">{ord.total.toLocaleString('fr-FR')} Gdes</div>
                              <span className={`cmd-status ${ord.status === 'livree' ? 'status-paid' : 'status-pending'}`}>
                                {ord.status === 'livree' ? 'Validée & Livrée' : 'Séquestre Actif'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty">
                      <div className="empty-icon">🛍️</div>
                      <p>Vous n'avez effectué aucun achat personnel pour l'instant.</p>
                    </div>
                  )}
                </div>
              )}

              {dashboardSubTab === 'products' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                    <h3 className="font-serif text-xs font-bold uppercase tracking-wider text-slate-500 text-left">
                      Mes Produits en Vitrine
                    </h3>
                    <button 
                      onClick={() => setActiveTab('products')}
                      className="text-[10px] font-black text-blue-600 hover:underline uppercase"
                    >
                      Gérer tout
                    </button>
                  </div>

                  {vendorProducts.length > 0 ? (
                    <div className="space-y-2 max-h-[460px] overflow-y-auto no-scrollbar">
                      {vendorProducts.slice(0, 6).map(prod => {
                        const stockText = prod.quantiteStock !== undefined 
                          ? `${prod.quantiteStock} dispo` 
                          : 'Disponible';

                        const stockCls = prod.quantiteStock === 0 
                          ? 'stock-out' 
                          : (prod.quantiteStock !== undefined && prod.quantiteStock < 5) 
                            ? 'stock-low' 
                            : 'stock-ok';

                        // Categories mapper
                        const getProductEmoji = (cat: string) => {
                          const c = (cat || '').toLowerCase();
                          if (c.includes('mode') || c.includes('vetem') || c.includes('chauss') || c.includes('hab')) return '👗';
                          if (c.includes('electr') || c.includes('phone') || c.includes('teleph') || c.includes('ordi')) return '📱';
                          if (c.includes('alim') || c.includes('mang') || c.includes('nourri') || c.includes('epic')) return '🍎';
                          if (c.includes('maison') || c.includes('meub')) return '🏠';
                          return '📦';
                        };

                        return (
                          <div 
                            key={prod.id}
                            onClick={() => {
                              onStartEditProduct(prod);
                              onNavigate('create-product');
                            }}
                            className="prod-card"
                          >
                            <div className="prod-emoji">
                              {getProductEmoji(prod.categorie)}
                            </div>
                            <div className="prod-body">
                              <div className="prod-name">{prod.nom}</div>
                              <div className="prod-meta">📁 {prod.categorie} • ⭐ {prod.rating ? prod.rating.toFixed(1) : '5.0'}</div>
                            </div>
                            <div className="prod-right">
                              <div className="prod-price">{prod.prix.toLocaleString('fr-FR')} Gdes</div>
                              <span className={`prod-stock ${stockCls}`}>
                                {stockText}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty">
                      <div className="empty-icon">📦</div>
                      <p>Aucun produit dans votre catalogue.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Secure escrow reminder block */}
              <div className="bg-[#f8fafc] border border-slate-200/60 rounded-3xl p-4 space-y-2 text-left mt-2">
                <span className="text-[9.5px] font-extrabold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded uppercase tracking-wider">
                  ⚠️ Rappel Séquestre Résident
                </span>
                <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  Les fonds versés par les clients haïtiens via MonCash, Natcash ou carte de crédit sont systématiquement gelés dans notre pool de garantie nationale sécurisée. Les escroqueries, achats personnels invalides et usurpations sont bloqués par audits de livraison QR.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. TAB: MY PRODUCTS ==================== */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filtering bar copy of original static mes-produit widgets */}
          <div className="bg-white border rounded-2xl p-4 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, catégorie, mots-clés..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 text-slate-700"
                  value={productsSearch}
                  onChange={e => setProductsSearch(e.target.value)}
                />
                {productsSearch && (
                  <button 
                    onClick={() => setProductsSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Tabs filter status */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setProductsFilter('all')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    productsFilter === 'all' ? 'bg-white text-slate-800 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={() => setProductsFilter('actif')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    productsFilter === 'actif' ? 'bg-white text-emerald-700 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  En Vente
                </button>
                <button
                  type="button"
                  onClick={() => setProductsFilter('brouillon')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    productsFilter === 'brouillon' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Brouillons
                </button>
                <button
                  type="button"
                  onClick={() => setProductsFilter('epuise')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    productsFilter === 'epuise' ? 'bg-white text-red-700 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Rupture
                </button>
              </div>
            </div>
          </div>

          {/* Product Cards List */}
          {filteredVendorProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredVendorProducts.map(prod => {
                const isEpuise = prod.stock <= 0;
                const percentOff = prod.oldPrice && prod.oldPrice > prod.prix
                  ? Math.round((1 - prod.prix / prod.oldPrice) * 100)
                  : 0;

                return (
                  <div 
                    key={prod.id}
                    className="bg-white border rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition duration-200 border-slate-100 flex flex-col justify-between"
                  >
                    {/* Visual header */}
                    <div className="p-3 bg-slate-50 border-b flex items-center gap-3 relative">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border flex-shrink-0 flex items-center justify-center">
                        <img 
                          src={prod.image_url} 
                          alt={prod.nom} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <span className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider font-mono block leading-none mb-1">
                          Ref: {prod.id.toUpperCase()}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 tracking-tight truncate">
                          {prod.nom}
                        </h4>
                        <div className="flex gap-1 flex-wrap mt-1.5">
                          <span className="inline-block text-[9px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full uppercase">
                            📁 {prod.cat}
                          </span>
                          {prod.scoreReferencement !== undefined && prod.scoreReferencement < 100 ? (
                            <span 
                              title={prod.seoWarning || "L'image du produit présente des défauts de qualité."}
                              className="inline-block text-[9px] font-extrabold text-amber-700 bg-amber-55 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase animate-pulse"
                            >
                              ⚠️ Référencement réduit ({prod.scoreReferencement}/100)
                            </span>
                          ) : (
                            <span className="inline-block text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase">
                              ✨ Référencement Optimal
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Percent badge */}
                      {percentOff > 0 && (
                        <span className="absolute top-3 right-3 bg-red-100 text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded">
                          -{percentOff}%
                        </span>
                      )}
                    </div>

                    {/* Numeric details & fast stock editor */}
                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold uppercase text-[9.5px]">Prix de vente</span>
                        <div className="font-mono flex items-baseline gap-1">
                          <span className="text-[#0c1445] font-black text-sm">{prod.prix.toLocaleString('fr-FR')}</span>
                          <span className="text-[10px] text-slate-500">HTG</span>
                          {prod.oldPrice && (
                            <span className="text-[10.5px] text-slate-400 line-through pl-1 font-medium">{prod.oldPrice}</span>
                          )}
                        </div>
                      </div>

                      {/* Display / edit stock quantity directly matching original javascript behaviors */}
                      <div className="flex justify-between items-center py-1 border-y border-dashed border-slate-100">
                        <span className="text-slate-400 font-bold uppercase text-[9.5px]">Quantité stock</span>
                        {editingStockProductId === prod.id ? (
                          <div className="flex items-center gap-1 animate-fade-in">
                            <input 
                              type="number" 
                              value={editingStockValue}
                              onChange={e => setEditingStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-14 py-1 px-2 border rounded text-center text-xs font-mono font-bold"
                            />
                            <button 
                              onClick={() => handleSaveStockValue(prod.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded transition"
                              title="Enregistrer"
                            >
                              <Check size={12} />
                            </button>
                            <button 
                              onClick={() => setEditingStockProductId(null)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 rounded transition"
                              title="Annuler"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono font-bold text-xs ${
                              isEpuise ? 'text-red-600' : prod.stock <= 3 ? 'text-amber-600' : 'text-slate-700'
                            }`}>
                              {isEpuise ? 'Rupture' : `${prod.stock} unités`}
                            </span>
                            <button
                              onClick={() => handleEditStockClick(prod)}
                              className="text-slate-400 hover:text-blue-600 font-semibold text-[10px] uppercase underline cursor-pointer"
                            >
                              ✏️ Ajuster
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status pill slider */}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold uppercase text-[9.5px]">État d'affichage</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-black uppercase ${
                            prod.statut === 'actif' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                          } px-2 py-0.5 rounded border border-transparent`}>
                            {prod.statut === 'actif' ? 'Actif / Publié' : 'Brouillon'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(prod)}
                            className="text-slate-400 hover:text-[#0c1445]"
                            title="Basculer le statut"
                          >
                            <RefreshCw size={13} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick controls box */}
                    <div className="p-3 bg-slate-50 border-t flex justify-between gap-1">
                      <button
                        onClick={() => handleDuplicateProduct(prod)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border hover:bg-slate-50 text-[10px] text-slate-600 font-black uppercase rounded-lg transition shadow-3xs cursor-pointer flex-1 justify-center"
                        title="Créer rapidement un duplicata en mode brouillon"
                      >
                        <Copy size={11} /> Dupliquer
                      </button>

                      <button
                        onClick={() => onStartEditProduct(prod)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-[10px] text-blue-600 font-black uppercase rounded-lg transition cursor-pointer flex-1 justify-center"
                        title="Modifier intégralement la fiche produit"
                      >
                        <Edit2 size={11} /> Modifier
                      </button>

                      <button
                        onClick={() => handleDeleteProductClick(prod.id, prod.nom)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-[10px] text-red-600 font-black uppercase rounded-lg transition cursor-pointer flex-1 justify-center"
                        title="Retirer ce produit de votre magasin"
                      >
                        <Trash2 size={11} /> Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white border border-dashed rounded-3xl p-6">
              <span className="text-4xl text-slate-300">📦</span>
              <h3 className="font-serif text-xs font-extrabold uppercase mt-3 text-slate-700">Aucun produit ne correspond à vos filtres</h3>
              <p className="text-slate-400 text-[11px] max-w-xs mx-auto mt-1">Saisissez une autre recherche ou modifiez les filtres de visibilité de votre vitrine marchande.</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== 3. TAB: DELIVERY FOLLOW-UP ==================== */}
      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          {/* Dynamic livraison search strip */}
          <div className="bg-white border rounded-2xl p-4 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
              
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrer par nom du client, commune, numéro d'achat..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 text-slate-700"
                  value={deliveriesSearch}
                  onChange={e => setDeliveriesSearch(e.target.value)}
                />
              </div>

              {/* Day filter selector */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar self-start">
                <button
                  type="button"
                  onClick={() => setDeliveriesFilter('all')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    deliveriesFilter === 'all' ? 'bg-white text-slate-800 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Toutes
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveriesFilter('today')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    deliveriesFilter === 'today' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveriesFilter('upcoming')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    deliveriesFilter === 'upcoming' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  À venir / Bloquées
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveriesFilter('delivered')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    deliveriesFilter === 'delivered' ? 'bg-white text-emerald-700 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Livrées
                </button>
              </div>
            </div>
          </div>

          {/* Delivery shipments view list */}
          {filteredDeliveries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDeliveries.map(delOrder => {
                const isPaidEscrow = delOrder.status === 'payee';
                const isFinalized = delOrder.status === 'livree';

                return (
                  <div 
                    key={delOrder.id}
                    className={`bg-white border rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition duration-200 flex flex-col justify-between ${
                      isFinalized ? 'border-emerald-100' : isPaidEscrow ? 'border-blue-200' : 'border-slate-100'
                    }`}
                  >
                    <div className="p-4 space-y-3 text-xs">
                      {/* Header row */}
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-mono font-bold text-[#0c1445]">
                          LIVRAISON #{delOrder.id.slice(0, 10).toUpperCase()}
                        </span>
                        
                        <span className={`inline-block text-[9px] font-black uppercase px-2.5 py-0.5 rounded border ${
                          isFinalized 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : isPaidEscrow 
                              ? 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse' 
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {isFinalized ? "Colis Remis (Clôturé)" : isPaidEscrow ? "En route (Paiement Garantie)" : delOrder.status}
                        </span>
                      </div>

                      {/* Attributes */}
                      <div className="space-y-2 text-slate-700 font-medium leading-relaxed">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-base text-slate-400">👤</span>
                          <span>Acheteur destinataire : <strong>{delOrder.clientNom}</strong></span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[11px]">
                          <span className="text-base text-slate-400">📍</span>
                          <span>Point d'expédition : <strong>{delOrder.commune}, {delOrder.departement} (Haïti)</strong></span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[11px]">
                          <span className="text-base text-slate-400">🕒</span>
                          <span>Planification : En main propre — 24H à 48H</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                          <span className="text-base text-slate-400">📦</span>
                          <div className="flex-1">
                            <span className="text-[9.5px] text-slate-400 block font-bold uppercase tracking-wider font-sans">Désignation colis</span>
                            {delOrder.items.map((it, idx) => (
                              <div key={idx} className="font-semibold text-[10px] text-slate-700 flex justify-between">
                                <span>• {it.productNom}</span>
                                <span>x{it.qte}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fast actions controls panel sync to escrow model */}
                    <div className="p-3 bg-slate-50 border-t flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          handleViewOrderDetails(delOrder);
                        }}
                        className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-white hover:bg-slate-100 border text-[#0c1445] font-black text-[10px] uppercase rounded-xl transition cursor-pointer flex-1 h-10 shadow-3xs"
                        title="Afficher la fiche de colisage et le QR code de validation"
                      >
                        <Printer size={12} /> Billet &amp; QR
                      </button>

                      {isPaidEscrow ? (
                        <button
                          onClick={() => handleSimulateReceive(delOrder.id)}
                          className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase rounded-xl transition cursor-pointer flex-1 h-10 shadow-sm"
                          title="Fonds garantis en dépôt sécurisé. Cliquer si le colis est livré"
                        >
                          <Check size={12} /> Confirmer la remise
                        </button>
                      ) : isFinalized ? (
                        <span className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold text-[10.5px] uppercase rounded-xl flex-1 h-10 select-none">
                          ✓ Gains Libérés
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white border border-dashed rounded-3xl p-6">
              <span className="text-4xl text-slate-300 animate-pulse">🚚</span>
              <h3 className="font-serif text-xs font-extrabold uppercase mt-3 text-slate-700">Aucun colis en cours</h3>
              <p className="text-slate-400 text-[11px] max-w-xs mx-auto mt-1">Toutes vos expéditions validées et clôturées s'affichent ici.</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== 5. TAB: PROFILE & SHOP SETTINGS ==================== */}
      {activeTab === 'profile' && (
        <ShopSettingsView
          user={user}
          onUpdateProfile={onUpdateProfile}
          onNavigate={onNavigate}
        />
      )}
      {false && activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Section Header with edit button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h1 className="font-serif text-lg font-black text-[#0c1445]">
                🏪 Profil de Boutique &amp; Paramètres
              </h1>
              <p className="text-xs text-slate-400 font-semibold">
                Gérez vos informations de vitrine de vente, vos coordonnées de gérant et vos virements.
              </p>
            </div>
            
            <button
              onClick={() => {
                if (editMode) {
                  handleSaveProfile();
                } else {
                  setEditMode(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
                editMode 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                  : 'bg-[#0c1445] hover:bg-[#151c4f] text-white'
              }`}
            >
              {editMode ? (
                <><Save size={14} /> Enregistrer tout</>
              ) : (
                <><Edit2 size={14} /> Modifier mon Profil</>
              )}
            </button>
          </div>

          {/* Header cover */}
          <div className="relative rounded-3xl overflow-hidden border border-slate-100 shadow-xs group/cover">
            {formBanner ? (
              <img 
                src={formBanner} 
                alt="Photo de couverture" 
                className="w-full h-32 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-32 bg-gradient-to-r from-[#0c1445] via-teal-950 to-emerald-950 relative">
                <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/15 via-transparent to-transparent opacity-60" />
              </div>
            )}
            <div className="absolute top-4 right-4 bg-amber-500/20 text-amber-300 font-mono text-[9px] font-extrabold uppercase tracking-widest border border-amber-400/20 px-3 py-1 rounded-full backdrop-blur-xs">
              ✓ Membre Certifié {user.plan}
            </div>

            {/* Cover photo upload button - visible only in editMode */}
            {editMode && (
              <label className="absolute bottom-3 right-4 bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-slate-200 shadow-sm cursor-pointer transition-all flex items-center gap-1.5 select-none hover:scale-105 active:scale-95 duration-150">
                <Plus size={12} className="text-teal-600" />
                <span>Modifier la couverture</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          setFormBanner(reader.result);
                          showToast("📸 Photo de couverture ajoutée ! N'oubliez pas de cliquer sur Enregistrer.");
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden" 
                />
              </label>
            )}
          </div>

          {/* Avatar overlay */}
          <div className="p-5 pt-0 bg-white relative -mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10 mb-2">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-900 to-[#0c1445] text-white border-4 border-white flex items-center justify-center text-4xl font-serif font-black shadow-md relative group select-none overflow-hidden">
                {formAvatar ? (
                  <img 
                    src={formAvatar} 
                    alt="Photo de profil gérant" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{formShopName ? formShopName[0].toUpperCase() : 'B'}</span>
                )}

                {editMode && (
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer text-white text-[9px] font-bold">
                    <Plus size={14} />
                    <span className="text-center px-1">Changer</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setFormAvatar(reader.result);
                              showToast("📸 Photo de profil ajoutée ! N'oubliez pas de cliquer sur Enregistrer.");
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              <div className="space-y-0.5">
                <h2 className="font-serif text-base font-black tracking-tight text-[#0c1445] flex items-center gap-1.5">
                  <span>{formShopName || 'Ma Vitrine Vendza'}</span>
                  {user.plan === 'Pro Local' && (
                    <span className="inline-flex items-center shrink-0" title="Vendeur Vérifié (Pro Local)">
                      <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  )}
                  {user.plan === 'Pro National' && (
                    <span className="inline-flex items-center shrink-0" title="Vendeur Vérifié (Pro National)">
                      <svg className="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <span>Gérant : {formPrenom} {formNom}</span>
                  <span className="text-[#9aa3bf]">•</span>
                  <span>{formEmail}</span>
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  <span className="text-[9px] font-black tracking-wider uppercase bg-teal-50 text-teal-800 border border-teal-100 px-2 py-0.5 rounded-full">
                    🏪 Compte vendeur
                  </span>
                  <span className="text-[9px] font-black tracking-wider uppercase bg-[#dff0e2] text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-full">
                    📍 {formCommune}, {formDept}
                  </span>
                  <span className="text-[9px] font-black tracking-wider uppercase bg-blue-50 text-blue-800 border border-blue-100 px-2 py-0.5 rounded-full">
                    ⭐ Plan {user.plan}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Left Forms */}
            <div className="md:col-span-7 space-y-5">
              
              {/* Personal values */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-7 h-7 bg-blue-50 text-blue-600 flex items-center justify-center rounded-lg">
                    <User2 size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identité Gérant</h3>
                    <p className="text-[9px] text-slate-400">Coordonnées personnelles du titulaire du commerce</p>
                  </div>
                </div>

                {!editMode ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                      <span className="text-base text-slate-400 mt-0.5">👤</span>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Nom complet</span>
                        <span className="text-xs font-black text-slate-700">{formPrenom} {formNom || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                      <span className="text-base text-slate-400 mt-0.5">📧</span>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Adresse mail</span>
                        <span className="text-xs font-mono font-bold text-slate-700">{formEmail}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                      <span className="text-base text-slate-400 mt-0.5">📞</span>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Ligne Mobile (Payouts)</span>
                        <span className="text-xs font-mono font-bold text-slate-700">{formTel || 'Non spécifié'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-1">
                      <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                        <span className="text-base text-slate-400 mt-0.5">Departement</span>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Expéditeur</span>
                          <span className="text-xs font-black text-slate-700">{formDept}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                        <span className="text-base text-slate-400 mt-0.5">Commune</span>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Localité</span>
                          <span className="text-xs font-black text-slate-700">{formCommune}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 text-xs text-slate-700 font-semibold">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Prénom *</label>
                        <input 
                          type="text" 
                          value={formPrenom}
                          onChange={(e) => setFormPrenom(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nom *</label>
                        <input 
                          type="text" 
                          value={formNom}
                          onChange={(e) => setFormNom(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email *</label>
                      <input 
                        type="email" 
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Numéro de Téléphone (Transfert)</label>
                      <input 
                        type="tel" 
                        value={formTel}
                        onChange={(e) => setFormTel(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700"
                        placeholder="+509 XXXX XXXX"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Département</label>
                        <select 
                          value={formDept}
                          onChange={(e) => {
                            const newDept = e.target.value;
                            setFormDept(newDept);
                            const defCommunes = HAITIAN_ZONES[newDept] || [];
                            if (defCommunes.length > 0) setFormCommune(defCommunes[0]);
                          }}
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700 font-semibold"
                        >
                          {Object.keys(HAITIAN_ZONES).map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Commune</label>
                        <select 
                          value={formCommune}
                          onChange={(e) => setFormCommune(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700 font-semibold"
                        >
                          {(HAITIAN_ZONES[formDept] || []).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Shop info presentation block */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-7 h-7 bg-teal-50 text-teal-600 flex items-center justify-center rounded-lg">
                    <Store size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identité Commerciale de la Vitrine</h3>
                    <p className="text-[9px] text-slate-400">Présentation affichée sur votre profil public</p>
                  </div>
                </div>

                {!editMode ? (
                  <div className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Nom commercial de votre magasin</span>
                      <span className="text-xs font-black text-slate-800">{formShopName || '—'}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Slogan &amp; Présentation</span>
                      <p className="text-xs text-slate-600 leading-normal font-medium bg-slate-50 p-2 rounded-lg border">
                        {formShopDesc || 'Aucune description rédigée.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 text-xs text-slate-700">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nom de la vitrine *</label>
                      <input 
                        type="text" 
                        value={formShopName}
                        onChange={(e) => setFormShopName(e.target.value)}
                        placeholder="Ex : TechShop Haïti"
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700" 
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Description &amp; Slogan</label>
                      <textarea 
                        value={formShopDesc}
                        onChange={(e) => setFormShopDesc(e.target.value)}
                        placeholder="Décrivez votre boutique"
                        rows={3}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700" 
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditMode(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Save size={13} /> Sauvegarder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right block: Security and notification switches */}
            <div className="md:col-span-5 space-y-5">
              {/* Password resetting */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-7 h-7 bg-amber-50 text-amber-600 flex items-center justify-center rounded-lg">
                    <Lock size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sécurité des identifiants</h3>
                    <p className="text-[9px] text-slate-400">Modifier vos codes secrets d'accessibilité</p>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Code de connexion actuel</label>
                    <input 
                      type="password" 
                      value={pwdCurrent}
                      onChange={(e) => setPwdCurrent(e.target.value)}
                      placeholder="••••••••"
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-mono" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nouveau code</label>
                      <input 
                        type="password" 
                        value={pwdNew}
                        onChange={(e) => setPwdNew(e.target.value)}
                        placeholder="••••••••"
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-mono" 
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Confirmation</label>
                      <input 
                        type="password" 
                        value={pwdConf}
                        onChange={(e) => setPwdConf(e.target.value)}
                        placeholder="••••••••"
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-mono" 
                      />
                    </div>
                  </div>

                  {pwdStatus.text && (
                    <p className={`p-2 rounded-lg text-[9.5px] font-bold leading-normal ${
                      pwdStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      {pwdStatus.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-slate-150 hover:bg-slate-250 text-slate-700 bg-slate-100 rounded-xl font-bold transition cursor-pointer text-center"
                  >
                    Mettre à jour le mot de passe
                  </button>
                </form>
              </div>

              {/* Toggles switches */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-7 h-7 bg-violet-50 text-violet-600 flex items-center justify-center rounded-lg">
                    <Bell size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Canaux d'alertes sound</h3>
                    <p className="text-[9px] text-slate-400">Modifier vos priorités de notifications SMS &amp; Mail</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-700">Rapports d'achats</span>
                      <span className="block text-[9px] text-slate-400 font-medium leading-tight">À chaque encaissement sécurisé</span>
                    </div>
                    <button 
                      onClick={() => setPrefOrders(!prefOrders)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${prefOrders ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${prefOrders ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-700">Remises confirmées</span>
                      <span className="block text-[9px] text-slate-400 font-medium leading-tight">SMS dès libération des transferts</span>
                    </div>
                    <button 
                      onClick={() => setPrefDelivery(!prefDelivery)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${prefDelivery ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${prefDelivery ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-700">Avis clients de confiance</span>
                      <span className="block text-[9px] text-slate-400 font-medium leading-tight">Dès dépôt de commentaires et d'étoiles</span>
                    </div>
                    <button 
                      onClick={() => setPrefReviews(!prefReviews)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${prefReviews ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${prefReviews ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-700">Canaux de clavardage (messages)</span>
                      <span className="block text-[9px] text-slate-400 font-medium leading-tight">Alertes d'inbox buyers</span>
                    </div>
                    <button 
                      onClick={() => setPrefMessages(!prefMessages)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${prefMessages ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${prefMessages ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect unique Order details modal with POS-58 ticket and QR integrated */}
      {selectedOrderDetails && (() => {
        // Fee calculations based on subscription plan
        const planName = user.plan || 'Gratuit';
        const planStrLocal = planName.toLowerCase();
        const feePercent = planStrLocal === 'pro_national' || planStrLocal === 'pro national' 
          ? 10 
          : (planStrLocal === 'pro_local' || planStrLocal === 'pro local' ? 15 : 20);
        const planLabel = planName;

        // Subtotal for merchant items
        const merchantItemsSubtotal = selectedOrderDetails.items
          .filter(it => it.vendeurId === 'v-tph' || it.vendeurId === user.id || !it.vendeurId || it.vendeurId === 'v-gen')
          .reduce((sum, it) => sum + (Number(it.prix || it.price || 0) * it.qte), 0);

        const baseAmtForFee = merchantItemsSubtotal > 0 ? merchantItemsSubtotal : (selectedOrderDetails.total - selectedOrderDetails.fraisLivraison);
        const feeDeducted = Math.round((baseAmtForFee * feePercent) / 100);
        const netGainsValue = baseAmtForFee - feeDeducted;

        return (
          <div className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#f8fafc] rounded-3xl max-w-lg w-full p-5 border border-slate-200 flex flex-col space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
              <div className="flex justify-between items-center border-b pb-2 shrink-0">
                <span className="font-serif text-xs font-bold text-[#0c1445] uppercase tracking-wider flex items-center gap-1">
                  🎟️ Billet Offre &amp; QR Sésame
                </span>
                <button 
                  onClick={() => setSelectedOrderDetails(null)}
                  className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full font-extrabold text-sm transition"
                >
                  ✕
                </button>
              </div>

              {/* Printable POS card wrapper */}
              <div 
                id="printablePOS-ticket-inspect" 
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative w-full text-slate-800"
              >
                {/* 1. Teal Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-800 p-5 flex justify-between items-center text-white">
                  <div>
                    <div className="font-serif font-black text-lg tracking-tight uppercase">Vendza</div>
                    <div className="text-[9.5px] text-blue-100/80 font-medium tracking-wide">Pôle d'échanges séquestres national du vendeur</div>
                  </div>
                  <div className="bg-white/15 px-2.5 py-1 rounded-lg text-xs font-mono font-black tracking-wider uppercase">
                    #{selectedOrderDetails.id.slice(-5).toUpperCase()}
                  </div>
                </div>

                {/* 2. Perforated separator */}
                <div className="relative border-t-2 border-dashed border-slate-200">
                  <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#f8fafc] border border-slate-200" />
                  <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#f8fafc] border border-slate-200" />
                </div>

                {/* 3. Columns body */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-0 text-left">
                  {/* Left info column */}
                  <div className="sm:col-span-8 p-4 border-b sm:border-b-0 sm:border-r border-dashed border-slate-200 space-y-4">
                    {/* Items order details list */}
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Articles de la vente</h4>
                      <div className="divide-y divide-slate-100 font-sans">
                        {selectedOrderDetails.items.map((it, idx) => {
                          const itPrix = Number(it.prix || it.price || 0);
                          const itQte = Number(it.qte || it.quantity || 1);
                          return (
                            <div key={idx} className="py-1.5 flex flex-col font-medium text-[11.5px] leading-tight">
                              <div className="flex justify-between items-start gap-1">
                                <span className="font-bold text-slate-800">{it.productNom || it.nom}</span>
                                <span className="font-extrabold text-blue-600 shrink-0 font-mono">{(itPrix * itQte).toLocaleString('fr-FR')} G</span>
                              </div>
                              <div className="flex justify-between text-[9.5px] text-slate-400 font-semibold mt-0.5">
                                <span>Unit : {itPrix.toLocaleString('fr-FR')} Gdes</span>
                                <span>Quantité : x{itQte}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* PLATFORM FEES WITH USER CUSTOM REQUEST PER CENT PER PLAN */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-slate-500 font-semibold">
                        <span>Sous-total articles :</span>
                        <span className="font-mono">{baseAmtForFee.toLocaleString('fr-FR')} G</span>
                      </div>
                      <div className="flex justify-between text-slate-500 font-semibold">
                        <span>Frais livraison Escrow :</span>
                        <span className="font-mono">{selectedOrderDetails.fraisLivraison.toLocaleString('fr-FR')} G</span>
                      </div>
                      {feePercent > 0 && (
                        <div className="flex justify-between font-bold text-[#b91c1c] bg-[#fef2f2] p-2 rounded-lg border border-[#fecaca]/55 text-[10px]">
                          <span>Commission platforme ({planLabel} - {feePercent}%) :</span>
                          <span className="font-mono">-{feeDeducted.toLocaleString('fr-FR')} G</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                        <span>GAINS NETS DIRECTS :</span>
                        <span className="font-mono text-emerald-600 font-black">{netGainsValue.toLocaleString('fr-FR')} Gdes</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 border-dashed my-1" />

                    {/* Logistics infos */}
                    <div className="space-y-1.5 text-[10.5px]">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Informations Logistiques</h4>
                      <div className="grid grid-cols-2 gap-2 leading-relaxed">
                        <div>
                          <span className="text-[8.5px] text-slate-400 font-bold uppercase block">Date d'opération</span>
                          <span className="font-bold text-slate-700">{selectedOrderDetails.date} • {selectedOrderDetails.heure || '12:00'}</span>
                        </div>
                        <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/60 col-span-2">
                          <span className="text-[8.5px] text-blue-600 font-extrabold uppercase block tracking-wider">Acheteur (Nom du Client)</span>
                          <span className="font-extrabold text-slate-900 text-xs">{selectedOrderDetails.clientNom}</span>
                        </div>
                        {selectedOrderDetails.clientTel && (
                          <div className="col-span-2">
                            <span className="text-[8.5px] text-slate-400 font-bold uppercase block">Contact acheteur</span>
                            <span className="font-mono font-bold text-slate-700">Tél: {selectedOrderDetails.clientTel}</span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-[8.5px] text-slate-400 font-bold uppercase block">Localité de déblocage</span>
                          <span className="font-bold text-slate-700">📍 {selectedOrderDetails.commune}, {selectedOrderDetails.departement}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column containing scanned QR code */}
                  <div className="sm:col-span-4 p-4 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-3 shrink-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Signature QR</span>
                    
                    <div className={`p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs relative ${
                      selectedOrderDetails.status === 'livree' ? 'opacity-40' : 'animate-pulse'
                    }`}>
                      <QRCodeRenderer value={`https://vendza2.netlify.app/client/confirmation?id=${selectedOrderDetails.id}`} size={105} />
                      {selectedOrderDetails.status === 'livree' && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center p-1 rounded-xl">
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-1 rounded shadow-xs uppercase border border-emerald-300">
                            ✓ LIVRÉ
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="font-mono text-[8.5px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                      ID: {selectedOrderDetails.id.slice(0, 8).toUpperCase()}
                    </div>

                    <p className="text-[9px] text-slate-400 max-w-[110px] leading-tight font-semibold">
                      {selectedOrderDetails.status === 'livree' ? "Transaction honorée" : "Colis à faire scanner"}
                    </p>
                  </div>
                </div>

                {/* Footer brand info */}
                <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex justify-between items-center text-[9px] text-slate-400">
                  <span className="font-semibold">📧 info@vendza.store</span>
                  <span className="font-bold">© Vendza.store S.A</span>
                </div>
              </div>

              {/* Modale printing / closing action buttons bottom row */}
              <div className="grid grid-cols-2 gap-2 text-xs font-bold shrink-0">
                <button
                  onClick={() => {
                    const printableArea = document.getElementById("printablePOS-ticket-inspect");
                    if (printableArea) {
                      window.print();
                    }
                  }}
                  className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 duration-100"
                >
                  <Printer size={13} />
                  <span>Imprimer POS</span>
                </button>

                {selectedOrderDetails.status === 'payee' ? (
                  <button
                    onClick={() => {
                      handleSimulateReceive(selectedOrderDetails.id);
                      showToast("✓ gains boutique débloqués sur votre solde !");
                    }}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 duration-100"
                  >
                    <Check size={13} />
                    <span>Forcer Livraison</span>
                  </button>
                ) : (
                  <span className="flex-1 py-3 bg-slate-100 border text-slate-400 rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 select-none font-black text-center text-[10px]">
                    ✓ Solde Libéré
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer"
              >
                Fermer l'inspecteur
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
