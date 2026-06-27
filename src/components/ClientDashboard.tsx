import React, { useState, useEffect } from 'react';
import { 
  Receipt, CheckCircle, ShoppingBag, Eye, 
  MapPin, ShieldAlert, Calendar, Loader, Printer,
  User2, ShieldCheck, CreditCard, ChevronRight, HelpCircle,
  Phone, Mail, Lock, Bell, Edit2, Save, X, Sparkles, Plus, ArrowLeft
} from 'lucide-react';
import { Order, UserProfile, CartItem, OrderStatus } from '../types';
import { HAITIAN_ZONES } from '../data';
import { QRCodeRenderer } from './QRCodeRenderer';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface ClientDashboardProps {
  orders: Order[];
  user: UserProfile | null;
  onNavigate: (view: string) => void;
  onCancelOrder: (orderId: string) => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  cart?: CartItem[];
  onViewTicket?: (order: Order) => void;
  onOpenDispute?: (orderId: string, reason: string) => Promise<{ success: boolean; message: string }>;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({
  orders,
  user,
  onNavigate,
  onCancelOrder,
  onUpdateProfile,
  cart = [],
  onViewTicket,
  onOpenDispute
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile'>('dashboard');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('');
  const [viewingTicketOrder, setViewingTicketOrder] = useState<Order | null>(null);

  // Dispute states
  const [disputingOrderId, setDisputingOrderId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputeSubmitting, setDisputeSubmitting] = useState<boolean>(false);

  // Profile Edit fields states
  const [editMode, setEditMode] = useState<boolean>(false);
  const [formPrenom, setFormPrenom] = useState<string>('');
  const [formNom, setFormNom] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formTel, setFormTel] = useState<string>('');
  const [formDept, setFormDept] = useState<string>('');
  const [formCommune, setFormCommune] = useState<string>('');
  const [formAvatar, setFormAvatar] = useState<string>('');
  const [formBanner, setFormBanner] = useState<string>('');

  // Password fields states
  const [pwdCurrent, setPwdCurrent] = useState<string>('');
  const [pwdNew, setPwdNew] = useState<string>('');
  const [pwdConf, setPwdConf] = useState<string>('');
  const [pwdStatus, setPwdStatus] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' });

  // Preferences Toggles states
  const [prefOrders, setPrefOrders] = useState<boolean>(true);
  const [prefPromo, setPrefPromo] = useState<boolean>(true);
  const [prefProducts, setPrefProducts] = useState<boolean>(false);
  const [prefMessages, setPrefMessages] = useState<boolean>(true);
  const [prefNewsletter, setPrefNewsletter] = useState<boolean>(false);

  // Success toast logic
  const [toastMessage, setToastMessage] = useState<string>('');

  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Sync profile fields with user prop
  useEffect(() => {
    if (user) {
      setFormPrenom(user.prenom || '');
      setFormNom(user.nom || '');
      setFormEmail(user.email || '');
      setFormTel(user.tel || '');
      setFormDept(user.departement || 'Ouest');
      setFormCommune(user.commune || 'Pétion-Ville');
      setFormAvatar(user.avatar || '');
      setFormBanner(user.banner || '');
    }
  }, [user]);

  // Step 4.1 — Récupérer le profil au chargement de la page et pré-remplir tous les champs
  useEffect(() => {
    const fetchProfileData = async () => {
      if (isSupabaseConfigured && supabase && user?.id) {
        try {
          const { data: profil, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profil && !error) {
            setFormPrenom(profil.prenom || '');
            setFormNom(profil.nom || '');
            setFormEmail(profil.email || '');
            setFormTel(profil.telephone || profil.tel || '');
            setFormDept(profil.departement || 'Ouest');
            setFormCommune(profil.commune || 'Pétion-Ville');
            setFormAvatar(profil.avatar_url || profil.avatar || '');
            setPrefOrders(profil.notif_commandes !== undefined ? profil.notif_commandes : true);
            setPrefPromo(profil.notif_livraisons !== undefined ? profil.notif_livraisons : true);
            setPrefMessages(profil.notif_avis !== undefined ? profil.notif_avis : true);
            setPrefNewsletter(profil.newsletter !== undefined ? profil.newsletter : false);
          }
        } catch (err) {
          console.warn("Could not load fresh profile from Supabase:", err);
        }
      }
    };
    fetchProfileData();
  }, [user?.id]);

  if (!user) return null;

  // Filter orders matching logged-in client
  const clientOrders = orders.filter(o => o.clientId === user.id);

  const statsTotal = clientOrders.length;
  const statsDelivered = clientOrders.filter(o => o.status === 'livree').length;
  const statsPending = clientOrders.filter(o => o.status === 'payee' || o.status === 'attente').length;

  const filteredOrders = clientOrders.filter(o => {
    if (!selectedStatusTab) return true;
    if (selectedStatusTab === 'livree') return o.status === 'livree';
    if (selectedStatusTab === 'en-cours') return o.status === 'payee' || o.status === 'attente';
    if (selectedStatusTab === 'annulee') return o.status === 'annulee';
    return true;
  });

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    window.print();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const uploadAvatar = async (file: File, userId: string) => {
    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image trop lourde — maximum 2MB');
      return null;
    }

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      alert('Fichier non valide — images uniquement');
      return null;
    }

    // Nom du fichier unique (userId/avatar.png/jpg/etc.)
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/avatar.${ext}`;

    if (!isSupabaseConfigured || !supabase) {
      showToast("⚠️ Supabase non configuré pour l'upload d'avatar.");
      return null;
    }

    // Upload dans Supabase Storage - avec auto-création du bucket si inexistant
    let { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { 
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.warn("Upload failed, trying to create 'avatars' bucket...", uploadError);
      try {
        await supabase.storage.createBucket('avatars', { public: true });
        const { error: retryError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file, { 
            upsert: true,
            contentType: file.type
          });
        uploadError = retryError;
      } catch (errBucket) {
        console.error("Could not create avatars bucket:", errBucket);
      }
    }

    if (uploadError) {
      console.error('Upload error:', uploadError);
      showToast(`❌ Erreur d'upload : ${uploadError.message}`);
      return null;
    }

    // Récupérer l'URL publique
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Mettre à jour profiles
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: data.publicUrl,
        updated_at: new Date()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      showToast(`❌ Erreur de mise à jour profil : ${updateError.message}`);
      return null;
    }

    // Mettre à jour l'état local et propager l'information
    setFormAvatar(data.publicUrl);
    onUpdateProfile({
      avatar: data.publicUrl
    });
    showToast("📸 Photo de profil mise à jour avec succès !");
    return data.publicUrl;
  };

  const handleSaveProfile = async () => {
    if (!formPrenom.trim() || !formNom.trim() || !formEmail.trim()) {
      showToast("⚠️ Veuillez remplir tous les champs obligatoires (*)");
      return;
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // Step 4.3 — À la sauvegarde, mettre à jour profiles
        const { error } = await supabase
          .from('profiles')
          .update({
            prenom: formPrenom,
            nom: formNom,
            telephone: formTel,
            departement: formDept,
            commune: formCommune,
            notif_commandes: prefOrders,
            notif_livraisons: prefPromo,
            notif_avis: prefMessages,
            newsletter: prefNewsletter,
            updated_at: new Date()
          })
          .eq('id', user.id);

        if (error) {
          showToast(`❌ Erreur lors de l'enregistrement : ${error.message}`);
          return;
        }

        // Action d'enregistrement de l'avatar déjà effectuée immédiatement

        // Step 4.5 — Afficher un message de succès après sauvegarde et notifier l'utilisateur
        onUpdateProfile({
          prenom: formPrenom,
          nom: formNom,
          email: formEmail,
          tel: formTel,
          departement: formDept,
          commune: formCommune,
          avatar: formAvatar,
          banner: formBanner,
          notifCommandes: prefOrders,
          notifLivraisons: prefPromo,
          notifAvis: prefMessages,
          newsletter: prefNewsletter
        });

        alert("✅ Vos modifications ont été enregistrées avec succès dans la base de données sécurisée !");
        setEditMode(false);
        showToast("💾 Modifications enregistrées avec succès !");
      } else {
        // Fallback local update
        onUpdateProfile({
          prenom: formPrenom,
          nom: formNom,
          email: formEmail,
          tel: formTel,
          departement: formDept,
          commune: formCommune,
          avatar: formAvatar,
          banner: formBanner
        });
        setEditMode(false);
        showToast("💾 Modifications enregistrées localement !");
      }
    } catch (err: any) {
      showToast(`❌ Erreur : ${err.message}`);
    }
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCurrent) {
      setPwdStatus({ type: 'error', text: 'Veuillez saisir votre mot de passe actuel.' });
      return;
    }
    if (pwdNew.length < 6) {
      setPwdStatus({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    if (pwdNew !== pwdConf) {
      setPwdStatus({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }

    setPwdStatus({ type: 'success', text: '✓ Mot de passe synchronisé avec succès !' });
    setPwdCurrent('');
    setPwdNew('');
    setPwdConf('');
    setTimeout(() => setPwdStatus({ type: '', text: '' }), 5000);
  };

  if (viewingTicketOrder) {
    return (
      <div className="space-y-6 animate-fade-in print:p-0">
        {/* Dedicated Back Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewingTicketOrder(null)}
              className="p-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-black tracking-wide transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 font-sans"
            >
              <ArrowLeft size={13} />
              <span>RETOUR AU DASHBOARD</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <h1 className="font-serif text-base sm:text-lg font-black text-slate-800 flex items-center gap-1.5 leading-tight">
                🎫 Reçu de Consignation
              </h1>
              <p className="text-[10px] text-slate-400 font-bold font-sans">
                Fonds garantis par séquestre Vendza
              </p>
            </div>
          </div>
          <button
            onClick={() => setViewingTicketOrder(null)}
            className="text-[10px] uppercase font-black px-4 py-2 text-[#0c1445] bg-slate-100 rounded-xl hover:bg-slate-200 transition text-center shrink-0 border border-slate-200 cursor-pointer font-sans"
          >
            Fermer le reçu
          </button>
        </div>

        {/* Immersive Dedicated Page Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Detailed Receipts Invoice Sheet */}
          <div className="md:col-span-7 bg-white rounded-3xl border border-slate-150 shadow-xs overflow-hidden print:border-none print:shadow-none" id="printable-ticket">
            {/* Elegant Header Banner */}
            <div className="p-5 bg-[#0c1445] text-white flex justify-between items-start rounded-t-3xl relative">
              <div>
                <div className="font-serif text-lg font-black text-white flex items-center gap-1">
                  <span>Vendza</span>
                  <span className="text-[9px] bg-blue-500/20 text-sky-400 font-sans tracking-wide uppercase px-1.5 py-0.2 rounded font-extrabold border border-sky-500/10">Séquestre</span>
                </div>
                <p className="text-[10px] text-slate-300">Commerce de confiance haïtien</p>
              </div>
              <div className="text-right font-sans">
                <span className="font-mono font-bold text-[9px] text-[#4fd1c5] bg-white/10 border border-white/5 px-2 py-0.5 rounded">
                  #{viewingTicketOrder.id.toUpperCase()}
                </span>
                <p className="text-[9px] text-slate-300 mt-1 font-semibold">Commande du {viewingTicketOrder.date} à {viewingTicketOrder.heure}</p>
              </div>
            </div>

            {/* Invoice Body Info */}
            <div className="p-5 space-y-5 font-sans text-xs text-slate-700">
              {/* Delivery Details */}
              <div className="grid grid-cols-2 gap-2 text-[10px] leading-normal text-slate-500 border-b border-slate-100 pb-3 font-sans">
                <div>
                  <strong className="text-slate-700 block text-[10px] uppercase tracking-wider mb-0.5">Région de livraison</strong>
                  <span className="font-semibold text-slate-600">{viewingTicketOrder.departement}, {viewingTicketOrder.commune}</span>
                </div>
                <div className="text-right font-sans bg-blue-50/50 p-2 border border-blue-100/50 rounded-xl">
                  <strong className="text-blue-600 block text-[9px] uppercase tracking-wider mb-0.5">NOM DU CLIENT (Acheteur)</strong>
                  <span className="font-extrabold text-slate-800 text-xs">{viewingTicketOrder.clientNom}</span><br/>
                  <span className="font-mono font-bold text-slate-500">Tél: {viewingTicketOrder.clientTel}</span>
                </div>
              </div>

              {/* Mapped Order Items List */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-black tracking-widest text-[#9aa3bf] uppercase block font-sans">Détails des articles consignés</span>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl px-3.5 bg-slate-50/20 max-h-[160px] overflow-y-auto">
                  {viewingTicketOrder.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex flex-col gap-0.5 leading-normal text-xs text-slate-700 font-sans">
                      <div className="flex justify-between items-start gap-1 font-semibold">
                        <span className="text-slate-800">{item.productNom || item.nom}</span>
                        <span className="font-mono font-bold text-slate-900 shrink-0">{((item.prix || item.price || 0) * item.qte).toLocaleString('fr-FR')} Gdes</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold pl-0.5">
                        <span>Prix unitaire : {(item.prix || item.price || 0).toLocaleString('fr-FR')} Gdes</span>
                        <span>Quantité consignée : x{item.qte}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Breakdowns */}
              <div className="bg-slate-50 p-4 rounded-2xl space-y-1.5 border border-slate-100 font-sans">
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Sous-total articles</span>
                  <span className="font-mono">{viewingTicketOrder.items.reduce((s, i) => s + i.prix * i.qte, 0)} Gdes</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Frais logistiques</span>
                  <span className="font-mono">{viewingTicketOrder.fraisLivraison ? `${viewingTicketOrder.fraisLivraison} Gdes` : 'Gratuit'}</span>
                </div>
                {viewingTicketOrder.discount > 0 && (
                  <div className="flex justify-between text-[11px] text-emerald-600 font-bold">
                    <span>Code Promo appliqué</span>
                    <span className="font-mono">-{viewingTicketOrder.discount} Gdes</span>
                  </div>
                )}
                <div className="h-px bg-slate-200 my-1.5" />
                <div className="flex justify-between items-center text-xs font-black pt-0.5">
                  <span className="text-slate-800 font-semibold">Montant total déposé</span>
                  <span className="font-mono text-blue-600 text-sm sm:text-base font-extrabold">{viewingTicketOrder.total} HTG</span>
                </div>
              </div>
            </div>
          </div>

          {/* Séquence QR & Escrow verification details panel */}
          <div className="md:col-span-5 bg-white rounded-3xl border border-slate-150 p-5 shadow-xs space-y-4 print:hidden">
            <h4 className="text-[10px] font-black tracking-widest text-[#0c1445] bg-[#eff6ff] border border-[#bfdbfe] px-3.5 py-1.5 rounded-full uppercase text-center w-full block font-sans">
              🛡️ FEUILLE DE ROUTE DE LIVRAISON
            </h4>
            
            {/* Direct QR scan helper for the Client */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 border border-slate-100 rounded-2xl shrink-0 gap-3 font-sans">
              <div className="bg-white border rounded-2xl p-4 flex flex-col items-center justify-center shadow-3xs w-full max-w-[200px]">
                <div className="w-12 h-12 bg-blue-50 text-[#0c1445] rounded-full flex items-center justify-center mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-scan-face"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg>
                </div>
                <span className="text-[9px] uppercase font-black text-[#0d9488] tracking-widest text-center">Scanner Personnel</span>
              </div>
              
              <button
                onClick={() => onNavigate('scanner')}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-camera"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                <span>Scanner le QR du Vendeur</span>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <span className="text-[9px] font-black text-[#0c1445] bg-slate-50 border px-3 py-1 rounded-full uppercase tracking-wider block w-fit mx-auto shadow-3xs font-sans">
                {viewingTicketOrder.status === 'livree' ? '✅ Livraison Validée' : '⏳ Commission de Confiance'}
              </span>
              <p className="text-[10.5px] text-slate-500 leading-normal font-sans text-center px-1 font-medium">
                {viewingTicketOrder.status === 'livree' 
                  ? 'La livraison a été officiellement signifiée. Les fonds ont été reversés sur le compte du marchand.'
                  : 'Vos Gourdes restent bloquées sous séquestre d\'État chez Vendza. À la livraison physique, utilisez le bouton ci-dessus pour scanner le code QR que vous présentera le vendeur afin de débloquer immédiatement son paiement.'}
              </p>
            </div>

            {/* Printing and Navigation Actions */}
            <div className="pt-2 border-t border-slate-50 flex gap-2 flex-col sm:flex-row">
              <button
                onClick={handlePrint}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200 font-sans"
              >
                <Printer size={12} /> Imprimer le reçu
              </button>
              <button
                onClick={() => setViewingTicketOrder(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#0c1445] hover:bg-[#1a255c] text-white text-xs font-bold tracking-wide transition cursor-pointer text-center font-sans"
              >
                Retourner aux achats
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-60 bg-[#0c1445] text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg border border-teal-500 flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Segmented Dual Tabs: Dashboard vs Profil */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 w-full sm:w-auto self-start">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📊 Tableau de bord
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            👤 Mon Profil Client
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <button
            onClick={() => onNavigate('scanner')}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-[#0d9488] hover:bg-[#0c8277] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            📱 Scanner un QR de livraison
          </button>
        ) : (
          <button
            onClick={() => {
              if (editMode) {
                handleSaveProfile();
              } else {
                setEditMode(true);
              }
            }}
            className={`inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
              editMode 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-[#0c1445] hover:bg-blue-950 text-white'
            }`}
          >
            {editMode ? (
              <><Save size={14} /> Enregistrer</>
            ) : (
              <><Edit2 size={14} /> Modifier mon profil</>
            )}
          </button>
        )}
      </div>

      {activeTab === 'dashboard' ? (
        /* ==================== ACTIVE DASHBOARD SCREEN ==================== */
        <div className="space-y-6">
          <section className="grid grid-cols-3 gap-3 print:hidden">
            <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-xs text-center">
              <div className="mx-auto w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                <Receipt size={16} />
              </div>
              <span className="block text-base font-extrabold text-blue-600 font-mono leading-none">{statsTotal}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">Commandes</span>
            </div>

            <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-xs text-center">
              <div className="mx-auto w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                <CheckCircle size={16} />
              </div>
              <span className="block text-base font-extrabold text-emerald-600 font-mono leading-none">{statsDelivered}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">Livrées</span>
            </div>

            <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-xs text-center">
              <div className="mx-auto w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1">
                <ShoppingBag size={16} />
              </div>
              <span className="block text-base font-extrabold text-amber-600 font-mono leading-none">{statsPending}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">En cours</span>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 print:hidden">
            <section className="md:col-span-8 space-y-4">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {['', 'livree', 'en-cours', 'annulee'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStatusTab(s)}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all border ${
                      selectedStatusTab === s
                        ? 'bg-[#0c1445] text-white border-[#0c1445] font-extrabold'
                        : 'bg-white text-slate-500 border-slate-200'
                    } cursor-pointer`}
                  >
                    {s === '' ? 'Tous' : s === 'livree' ? 'Livrées' : s === 'en-cours' ? 'En cours' : 'Annulées'}
                  </button>
                ))}
              </div>

              {(() => {
                const getGroupKey = (o: Order) => {
                  if (o.checkout_group_id) return o.checkout_group_id;
                  if (typeof o.id === 'string' && o.id.includes('_sub_')) {
                    return o.id.split('_sub_')[0];
                  }
                  return o.id;
                };

                const groupedMap: Record<string, Order[]> = {};
                for (const order of filteredOrders) {
                  const key = getGroupKey(order);
                  if (!groupedMap[key]) {
                    groupedMap[key] = [];
                  }
                  groupedMap[key].push(order);
                }

                const groupedOrdersList = Object.keys(groupedMap).map(key => {
                  const subOrders = groupedMap[key];
                  const firstOrder = subOrders[0];
                  const totalCombined = subOrders.reduce((sum, o) => sum + (o.total || 0), 0);
                  
                  let resolvedStatus: OrderStatus = 'livree';
                  if (subOrders.some(o => o.status === 'attente')) {
                    resolvedStatus = 'attente';
                  } else if (subOrders.some(o => o.status === 'payee')) {
                    resolvedStatus = 'payee';
                  } else if (subOrders.some(o => o.status === 'annulee') && subOrders.every(o => o.status === 'annulee')) {
                    resolvedStatus = 'annulee';
                  } else if (subOrders.some(o => o.status === 'annulee')) {
                    resolvedStatus = 'payee';
                  }

                  return {
                    groupKey: key,
                    orders: subOrders,
                    date: firstOrder.date,
                    heure: firstOrder.heure,
                    status: resolvedStatus,
                    total: totalCombined
                  };
                });

                return groupedOrdersList.length > 0 ? (
                  <div className="space-y-4">
                    {groupedOrdersList.map(group => (
                      <div 
                        key={group.groupKey} 
                        className={`bg-white border rounded-2xl overflow-hidden shadow-xs transition-all ${
                          group.status === 'livree' 
                            ? 'border-emerald-200 hover:border-emerald-300' 
                            : group.status === 'payee'
                              ? 'border-blue-200 hover:border-blue-300'
                              : group.status === 'annulee'
                                ? 'border-red-100 opacity-80'
                                : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <span className="font-mono text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                ID Commande: {group.groupKey.slice(0, 18)}...
                              </span>
                              <h3 className="font-serif text-xs font-black text-slate-800 tracking-tight mt-1.5">
                                Achat du {group.date} à {group.heure}
                              </h3>
                              {group.orders.length > 1 && (
                                <div className="mt-1">
                                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                    Multi-vendeurs ({group.orders.length})
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                              <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                                group.status === 'livree'
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                  : group.status === 'payee'
                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                    : group.status === 'annulee'
                                      ? 'bg-red-50 text-red-600 border-red-100'
                                      : 'bg-amber-50 text-amber-600 border-amber-100'
                              }`}>
                                ● {group.status === 'livree' && 'Livrée & Validée'}
                                {group.status === 'payee' && 'Payée (En séquestre)'}
                                {group.status === 'attente' && 'Attente Paiement'}
                                {group.status === 'annulee' && 'Annulée'}
                              </span>
                              
                              <span className="font-mono text-xs font-extrabold text-blue-600">
                                Total global : {group.total} Gdes
                              </span>
                            </div>
                          </div>

                          {/* List sub-orders per vendor */}
                          <div className="space-y-3 pt-1">
                            {group.orders.map((subOrder) => (
                              <div key={subOrder.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                                <div className="flex justify-between items-center pb-1 border-b border-slate-200/50">
                                  <span className="text-[11px] font-bold text-slate-700">
                                    Boutique : <span className="text-blue-600 font-black">{subOrder.vendor_name || 'Boutique'}</span>
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded border uppercase ${
                                      subOrder.status === 'livree'
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : subOrder.status === 'payee'
                                          ? 'bg-blue-50 text-blue-600 border-blue-100'
                                          : subOrder.status === 'annulee'
                                            ? 'bg-red-50 text-red-600 border-red-100'
                                            : 'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>
                                      {subOrder.status === 'livree' ? 'Livrée' : subOrder.status === 'payee' ? 'Payée' : subOrder.status === 'attente' ? 'Attente' : 'Annulée'}
                                    </span>
                                    <span className="font-mono text-[10.5px] font-extrabold text-slate-800">
                                      {subOrder.total} Gdes
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  {subOrder.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-slate-600 text-[11px] font-medium leading-relaxed">
                                      <span className="truncate max-w-[80%] pr-4">
                                        ({item.qte}x) {item.productNom}
                                      </span>
                                      <span className="font-mono flex-shrink-0 text-slate-500">
                                        {item.prix * item.qte} Gdes
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex flex-col gap-2 pt-1 border-t border-slate-200/40">
                                  <div className="flex gap-2 justify-between flex-wrap sm:flex-nowrap">
                                    <button
                                      onClick={() => {
                                        if (onViewTicket) {
                                          onViewTicket(subOrder);
                                        } else {
                                          setViewingTicketOrder(subOrder);
                                        }
                                      }}
                                      className="p-1 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye size={12} /> Voir ticket & QR
                                    </button>

                                    {subOrder.status !== 'livree' && subOrder.status !== 'annulee' && (
                                      <button
                                        onClick={() => onCancelOrder(subOrder.id)}
                                        className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                                      >
                                        Annuler l'achat
                                      </button>
                                    )}

                                    {subOrder.status === 'payee' && (
                                      <button
                                        onClick={() => {
                                          setDisputingOrderId(subOrder.id);
                                          setDisputeReason('');
                                        }}
                                        className="p-1 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer font-sans"
                                      >
                                        ⚠️ Ouvrir un Litige
                                      </button>
                                    )}
                                  </div>

                                  {disputingOrderId === subOrder.id && (
                                    <div className="mt-2 p-3 bg-rose-50 rounded-xl space-y-2.5 animate-fade-in border border-rose-100 text-left w-full">
                                      <label className="block text-[9.5px] font-black uppercase tracking-wider text-rose-700">
                                        Expliquer le problème (Ex: Article non reçu, cassé ou faux) *
                                      </label>
                                      <textarea
                                        value={disputeReason}
                                        onChange={e => setDisputeReason(e.target.value)}
                                        placeholder="Indiquez le motif précis de votre litige pour examen par l'administration Vendza..."
                                        className="w-full p-2 text-xs bg-white border border-rose-200 rounded-lg focus:outline-none focus:border-rose-600 font-sans"
                                        rows={2}
                                      />
                                      <div className="flex gap-2 justify-end">
                                        <button
                                          type="button"
                                          disabled={disputeSubmitting}
                                          onClick={() => {
                                            setDisputingOrderId(null);
                                            setDisputeReason('');
                                          }}
                                          className="px-2.5 py-1 text-[10px] border border-slate-200 hover:bg-white rounded-lg font-bold text-slate-500 cursor-pointer"
                                        >
                                          Annuler
                                        </button>
                                        <button
                                          type="button"
                                          disabled={disputeSubmitting || !disputeReason.trim()}
                                          onClick={async () => {
                                            if (!disputeReason.trim()) return;
                                            setDisputeSubmitting(true);
                                            try {
                                              if (onOpenDispute) {
                                                const res = await onOpenDispute(subOrder.id, disputeReason);
                                                alert(res.message);
                                                if (res.success) {
                                                  setDisputingOrderId(null);
                                                  setDisputeReason('');
                                                }
                                              } else {
                                                alert("Service de litige indisponible.");
                                              }
                                            } catch (e: any) {
                                              alert(`Erreur: ${e.message}`);
                                            } finally {
                                              setDisputeSubmitting(false);
                                            }
                                          }}
                                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-50"
                                        >
                                          {disputeSubmitting ? 'Envoi...' : 'Confirmer Litige'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                    <span className="text-3xl">🛍️</span>
                    <h3 className="font-serif text-xs font-bold text-slate-700 mt-2">Aucun achat historique</h3>
                    <p className="text-xs text-slate-400 mt-1">Vous n'avez pas encore passé de commande avec ces critères.</p>
                  </div>
                );
              })()}
            </section>

            <section className="md:col-span-4 space-y-4">
              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs space-y-3.5">
                <h3 className="font-serif text-xs font-bold text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                  Sécurisation de vos fonds
                </h3>
                
                <div className="space-y-3 text-xs leading-relaxed text-slate-500 font-medium">
                  <p>Vendza agit en tant que tiers de confiance pour sécuriser vos échanges :</p>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold mt-0.5">1</div>
                      <p className="text-[10px]"><strong>Commande payée</strong> : Les Gourdes de votre achat sont prélevées et bloquées dans le coffre Vendza.</p>
                    </div>

                    <div className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold mt-0.5">2</div>
                      <p className="text-[10px]"><strong>Livraison du colis</strong> : Le vendeur prépare le colis et s'occupe de l'envoi de votre marchandise.</p>
                    </div>

                    <div className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold mt-0.5">3</div>
                      <p className="text-[10px]"><strong>Validation QR</strong> : Une fois le colis vérifié physiquement, présentez ou scannez le QR code de conformité pour débloquer les fonds au vendeur.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        /* ==================== ACTIVE PROFILE SCREEN ==================== */
        <div className="space-y-6">
          <div className="relative rounded-3xl overflow-hidden border border-slate-100 shadow-xs group/cover">
            {formBanner ? (
              <img 
                src={formBanner} 
                alt="Photo de couverture" 
                className="w-full h-32 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-32 bg-gradient-to-r from-blue-900 via-indigo-950 to-teal-900 relative">
                <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60" />
              </div>
            )}
            <div className="absolute top-4 right-4 bg-teal-500/20 text-teal-300 font-mono text-[9px] font-extrabold uppercase tracking-widest border border-teal-400/20 px-3 py-1 rounded-full backdrop-blur-xs">
              ✓ Profil Actif
            </div>

            {/* Cover photo upload - visible only in editMode */}
            {editMode && (
              <label className="absolute bottom-3 right-4 bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-slate-200 shadow-sm cursor-pointer transition-all flex items-center gap-1.5 select-none hover:scale-105 active:scale-95 duration-150">
                <Plus size={12} className="text-[#2563eb]" />
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
                          showToast("📸 Photo de couverture ajoutée ! Enregistrez pour sauvegarder.");
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

          {/* Avatar block overlay */}
          <div className="p-5 pt-0 bg-white relative -mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10 mb-2">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-900 to-teal-700 text-white border-4 border-white flex items-center justify-center text-4xl font-serif font-black shadow-md relative group select-none overflow-hidden">
                {formAvatar ? (
                  <img 
                    src={formAvatar} 
                    alt="Photo de profil" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>
                    {formPrenom 
                      ? formPrenom.charAt(0).toUpperCase() 
                      : (formEmail ? formEmail.charAt(0).toUpperCase() : 'U')
                    }
                  </span>
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
                          setAvatarFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setFormAvatar(reader.result);
                              showToast("📸 Photo de profil ajoutée ! Traitement de l'envoi...");
                            }
                          };
                          reader.readAsDataURL(file);
                          
                          // Upload immediat dans Supabase
                          uploadAvatar(file, user.id);
                        }
                      }}
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              <div className="space-y-0.5">
                <h2 className="font-serif text-base font-black tracking-tight text-[#0c1445]">
                  {formPrenom} {formNom || 'Utilisateur'}
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">{formEmail}</p>

                {/* Badges strip */}
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  <span className="text-[9px] font-black tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                    👤 Compte client
                  </span>
                  <span className="text-[9px] font-black tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    📍 {formCommune}, {formDept}
                  </span>
                  <span className="text-[9px] font-black tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                    ✓ Membre actif
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Core numerical stats block mirroring html layout */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-3 text-center divide-x divide-slate-200 shadow-inner">
            <div className="space-y-0.5">
              <span className="block text-sm font-extrabold text-slate-800 font-mono leading-none">{statsTotal}</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Commandes</span>
            </div>
            <div className="space-y-0.5">
              <span className="block text-sm font-extrabold text-slate-800 font-mono leading-none">{statsDelivered}</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Livrées</span>
            </div>
            <div className="space-y-0.5">
              <span className="block text-sm font-extrabold text-slate-800 font-mono leading-none">{cart.length || 0}</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Dans le panier</span>
            </div>
          </div>

          {/* Quick shortcuts banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="p-3 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 hover:border-blue-300 transition-all cursor-pointer group shadow-2xs"
            >
              <span className="text-xl group-hover:scale-110 transition duration-150">🕐</span>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 leading-tight">Mes commandes</h4>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">Historique &amp; suivi</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('cart')}
              className="p-3 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 hover:border-amber-300 transition-all cursor-pointer group shadow-2xs"
            >
              <span className="text-xl group-hover:scale-110 transition duration-150">🛒</span>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 leading-tight">Mon panier</h4>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">{cart.length} articles</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('scanner')}
              className="p-3 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 hover:border-emerald-300 transition-all cursor-pointer group shadow-2xs"
            >
              <span className="text-xl group-hover:scale-110 transition duration-150">📱</span>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 leading-tight">Scanner QR</h4>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">Valider colis</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('home')}
              className="p-3 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 hover:border-teal-300 transition-all cursor-pointer group shadow-2xs"
            >
              <span className="text-xl group-hover:scale-110 transition duration-150">🛍️</span>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 leading-tight">Catalogue</h4>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">Acheter</p>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Left information card form representation */}
            <div className="md:col-span-7 bg-white border border-slate-100 rounded-3xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 flex items-center justify-center rounded-lg">
                  <User2 size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Informations personnelles</h3>
                  <p className="text-[9px] text-slate-400">Vos données de livraison par défaut</p>
                </div>
              </div>

              {!editMode ? (
                /* Read-Only structure match */
                <div className="space-y-3">
                  <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent">
                    <span className="text-base text-slate-400 mt-0.5">👤</span>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Nom complet</span>
                      <span className="text-xs font-black text-slate-700">{formPrenom} {formNom || '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent">
                    <span className="text-base text-slate-400 mt-0.5">📧</span>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Adresse Email</span>
                      <span className="text-xs font-mono font-bold text-slate-700">{formEmail}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent">
                    <span className="text-base text-slate-400 mt-0.5">📞</span>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Téléphone d'appel</span>
                      <span className="text-xs font-black text-slate-700">{formTel || 'Non renseigné'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent">
                      <span className="text-base text-slate-400 mt-0.5">🗺️</span>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Département</span>
                        <span className="text-xs font-black text-slate-700">{formDept || 'Non renseigné'}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent">
                      <span className="text-base text-slate-400 mt-0.5">📍</span>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Commune</span>
                        <span className="text-xs font-black text-slate-700">{formCommune || 'Non renseignée'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Editable form structure match */
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Prénom <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formPrenom}
                        onChange={(e) => setFormPrenom(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 focus:bg-white text-slate-700"
                        placeholder="Prénom" 
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nom <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formNom}
                        onChange={(e) => setFormNom(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 focus:bg-white text-slate-700"
                        placeholder="Nom" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email <span className="text-red-500">*</span></label>
                    <input 
                      type="email" 
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 focus:bg-white text-slate-700"
                      placeholder="votre@email.com" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans">Téléphone <span className="text-slate-400 font-semibold">(Optionnel)</span></label>
                    <input 
                      type="tel" 
                      value={formTel}
                      onChange={(e) => setFormTel(e.target.value)}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 focus:bg-white text-slate-700"
                      placeholder="+509 XXXX XXXX" 
                    />
                  </div>

                  {/* Dyn cascading department / commune selections */}
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
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 focus:bg-white text-slate-700 font-semibold"
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
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 focus:bg-white text-slate-700 font-semibold"
                      >
                        {(HAITIAN_ZONES[formDept] || []).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
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
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save size={13} /> Enregistrer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right column with Security & Preferences toggles combined */}
            <div className="md:col-span-5 space-y-4">
              {/* Security block */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-7 h-7 bg-amber-50 text-amber-600 flex items-center justify-center rounded-lg">
                    <Lock size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sécurité</h3>
                    <p className="text-[9px] text-slate-400">Mot de passe de compte</p>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Mot de passe actuel</label>
                    <input 
                      type="password" 
                      value={pwdCurrent}
                      onChange={(e) => setPwdCurrent(e.target.value)}
                      placeholder="••••••••"
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nouveau</label>
                      <input 
                        type="password" 
                        value={pwdNew}
                        onChange={(e) => setPwdNew(e.target.value)}
                        placeholder="••••••••"
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700" 
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Confirmer</label>
                      <input 
                        type="password" 
                        value={pwdConf}
                        onChange={(e) => setPwdConf(e.target.value)}
                        placeholder="••••••••"
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700" 
                      />
                    </div>
                  </div>

                  {pwdStatus.text && (
                    <div className={`p-2 rounded-lg text-[10px] font-bold leading-normal ${
                      pwdStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      {pwdStatus.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer text-center"
                  >
                    Mettre à jour l'accès
                  </button>
                </form>
              </div>

              {/* Preferences toggles block matching original styled Switch rows */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-7 h-7 bg-violet-50 text-violet-600 flex items-center justify-center rounded-lg">
                    <Bell size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</h3>
                    <p className="text-[9px] text-slate-400">Gérez vos préférences alertes</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-700">Mises à jour de commandes</span>
                      <span className="block text-[9.5px] text-slate-400 leading-tight">Statut, expédition, validation</span>
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
                      <span className="block text-xs font-bold text-slate-700">Promotions &amp; ventes flash</span>
                      <span className="block text-[9.5px] text-slate-400 leading-tight">Coupons et offres limitées</span>
                    </div>
                    <button 
                      onClick={() => setPrefPromo(!prefPromo)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${prefPromo ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${prefPromo ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-700">Nouveaux produits</span>
                      <span className="block text-[9.5px] text-slate-400 leading-tight">Selon vos boutiques préférées</span>
                    </div>
                    <button 
                      onClick={() => setPrefProducts(!prefProducts)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${prefProducts ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${prefProducts ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-700">Messages de vendeurs</span>
                      <span className="block text-[9.5px] text-slate-400 leading-tight">Alertes instantanées de clavardage</span>
                    </div>
                    <button 
                      onClick={() => setPrefMessages(!prefMessages)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${prefMessages ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${prefMessages ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="block text-xs font-bold text-slate-700">Newsletter Vendza</span>
                      <span className="block text-[9.5px] text-slate-400 leading-tight">Bons plans et nouvelles de commerce</span>
                    </div>
                    <button 
                      onClick={() => setPrefNewsletter(!prefNewsletter)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${prefNewsletter ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${prefNewsletter ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
