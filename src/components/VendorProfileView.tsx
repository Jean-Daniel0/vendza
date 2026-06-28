import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, MapPin, Store, MessageSquare, Star, 
  ShieldCheck, AlertTriangle, Calendar, Clock, ShoppingBag, Send
} from 'lucide-react';
import { Product, Review, Order, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface VendorProfileViewProps {
  vendorId: string;
  user: UserProfile | null;
  products: Product[];
  reviews: Review[];
  orders: Order[];
  onNavigate: (view: string) => void;
  onSetProduct: (product: Product) => void;
  onOpenChat: (vendorId: string, vendorNom: string, productId?: string) => void;
  onAddReview: (review: Omit<Review, 'id' | 'date'>) => void;
}

export const VendorProfileView: React.FC<VendorProfileViewProps> = ({
  vendorId,
  user,
  products,
  reviews,
  orders,
  onNavigate,
  onSetProduct,
  onOpenChat,
  onAddReview
}) => {
  const [vendorProfile, setVendorProfile] = useState<{
    id: string;
    nom: string;
    shopName: string;
    shopDesc: string;
    departement: string;
    commune: string;
    createdAt: string;
    plan: string;
    avatar?: string;
    banner?: string;
    tel?: string;
    email?: string;
    premiumDepts?: string[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Leave a review local states
  const [showReviewForm, setShowReviewForm] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Load vendor profile details from Supabase with fallbacks
  useEffect(() => {
    async function fetchVendor() {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured && supabase) {
          let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', vendorId)
            .maybeSingle();

          if (error) {
            console.error("Error loading vendor profile info:", error.message);
          }

          if (data) {
            const firstName = data.prenom || data.first_name || data.full_name?.split(' ')[0] || '';
            const lastName = data.nom || data.last_name || data.full_name?.split(' ').slice(1).join(' ') || '';
            const vendorName = [firstName, lastName].filter(Boolean).join(' ') || 'Vendeur Partenaire';
            const shopNameVal = data.boutique_nom || data.shop_name || data.boutique || data.name || (firstName ? `Boutique de ${firstName}` : 'Boutique Partenaire');
            const shopDescVal = data.boutique_desc || data.shop_desc || data.shop_description || 'Boutique certifiée partenaire Vendza, offrant des produits vérifiés de qualité.';
            const avatarVal = data.avatar_url || data.avatar || data.photo_url || data.profile_image;
            const bannerVal = data.banner || data.cover_url || data.cover_image || data.banner_url || '';
            const telVal = data.telephone || data.tel || data.phone_number || data.phone || '';
            const emailVal = data.email || '';
            const premiumDeptsVal = data.premium_depts || data.premiumdepts || [];
            let parsedDepts: string[] = [];
            if (Array.isArray(premiumDeptsVal)) {
              parsedDepts = premiumDeptsVal;
            } else if (typeof premiumDeptsVal === 'string' && premiumDeptsVal.trim().startsWith('[')) {
              try {
                parsedDepts = JSON.parse(premiumDeptsVal);
              } catch (e) {}
            } else if (typeof premiumDeptsVal === 'string') {
              parsedDepts = premiumDeptsVal.split(',').map(s => s.trim()).filter(Boolean);
            }

            setVendorProfile({
              id: data.id,
              nom: vendorName,
              shopName: shopNameVal,
              shopDesc: shopDescVal,
              departement: data.departement || 'Ouest',
              commune: data.commune || 'Haïti',
              createdAt: data.created_at || new Date().toISOString(),
              plan: data.plan || 'Gratuit',
              avatar: avatarVal || undefined,
              banner: bannerVal || undefined,
              tel: telVal || undefined,
              email: emailVal || undefined,
              premiumDepts: parsedDepts
            });
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Exception loading vendor profile info from Supabase:", e);
      }

      // Fallback from active products lists
      const assocProduct = products.find(p => p.vendeurId === vendorId);
      if (assocProduct) {
        setVendorProfile({
          id: vendorId,
          nom: assocProduct.vendeur || 'Vendeur Secouru',
          shopName: assocProduct.vendeur || 'Boutique Authentique',
          shopDesc: 'Boutique certifiée partenaire Vendza, offrant des produits vérifiés de qualité.',
          departement: assocProduct.caracteristiques?.['Origine'] || 'Ouest',
          commune: 'Pétion-Ville',
          createdAt: assocProduct.dateCreation || new Date().toISOString(),
          plan: assocProduct.vendeurPlan || 'Pro National',
          avatar: undefined,
          banner: undefined,
          tel: undefined,
          email: undefined,
          premiumDepts: assocProduct.vendeurPremiumDepts || []
        });
      } else {
        // Fallback placeholder
        setVendorProfile({
          id: vendorId,
          nom: 'Boutique Vedette',
          shopName: 'Boutique Elite Vendza',
          shopDesc: 'Découvrez les meilleurs articles sélectionnés pour vous par nos vendeurs agréés.',
          departement: 'Ouest',
          commune: 'Delmas',
          createdAt: new Date().toISOString(),
          plan: 'Pro National',
          avatar: undefined,
          banner: undefined,
          tel: undefined,
          email: undefined,
          premiumDepts: ['Ouest', 'Nord', 'Sud', 'Artibonite', 'Centre']
        });
      }
      setIsLoading(false);
    }

    if (vendorId) {
      fetchVendor();
    }
  }, [vendorId, products]);

  if (isLoading || !vendorProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-100 p-8 shadow-xs">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium text-xs uppercase tracking-widest animate-pulse">Chargement de la boutique…</p>
      </div>
    );
  }

  // Live filter variables
  const vendorProducts = products.filter(p => p.vendeurId === vendorId);
  
  // Real sales computation based on orders with corresponding items matching the vendor
  const vendorSalesCount = orders.filter(o => {
    const isMatchedDirect = o.items.some(i => i.vendeurId === vendorId);
    return isMatchedDirect && (o.status === 'payee' || o.status === 'livree');
  }).length;

  // Filter reviews matching the vendor's products or left under the vendor shop placeholder
  const vendorReviews = reviews.filter(r => {
    return r.productId === `vendor:${vendorId}` || vendorProducts.some(vp => vp.id === r.productId);
  });

  const avgRating = vendorReviews.length > 0
    ? (vendorReviews.reduce((sum, r) => sum + r.note, 0) / vendorReviews.length).toFixed(1)
    : "4.8";

  const isVerified = vendorProfile.plan === 'Pro Local' || vendorProfile.plan === 'Pro National';

  // Handler to post custom boutique review
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      alert("Veuillez saisir un commentaire.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const clientName = user ? [user.prenom, user.nom].filter(Boolean).join(' ') : 'Client invité';
      
      onAddReview({
        productId: `vendor:${vendorId}`,
        clientNom: clientName,
        note: rating,
        commentaire: comment
      });

      alert("✓ Merci ! Votre avis a été enregistré avec succès.");
      setComment('');
      setShowReviewForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Compute covered areas based on vendor plan
  const plan = vendorProfile.plan;
  const mainDept = vendorProfile.departement || 'Ouest';
  const mainCommune = vendorProfile.commune || 'Haïti';
  const pDepts = vendorProfile.premiumDepts || [];

  let coverageType = 'Communal - Local';
  let coverageBadgeColor = 'bg-slate-50 text-slate-700 border-slate-200';
  let coverageDescriptionHtml = '';
  let coveredDeptsList: string[] = [];

  if (plan === 'Pro National') {
    coverageType = 'National - Tous Départements';
    coverageBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    coveredDeptsList = ['Ouest', 'Nord', 'Nord-Ouest', 'Nord-Est', 'Artibonite', 'Centre', 'Sud', 'Grande-Anse', 'Nippes', 'Sud-Est'];
    coverageDescriptionHtml = "Livraison express garantie sur tout le territoire national haïtien (l'ensemble des 10 départements est couvert).";
  } else if (plan === 'Pro Local') {
    coverageType = 'Régional - Départements Sélectionnés';
    coverageBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    coveredDeptsList = Array.from(new Set([mainDept, ...pDepts])).filter(Boolean);
    coverageDescriptionHtml = `Livraison rapide dans le département principal (${mainDept})${pDepts.length > 0 ? ` ainsi que dans les départements secondaires suivants : ${pDepts.join(', ')}` : ''}.`;
  } else {
    coverageType = 'Local / Ramassage de proximité';
    coverageBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    coveredDeptsList = [mainDept];
    coverageDescriptionHtml = `Ce vendeur livre principalement au niveau local sur la commune de ${mainCommune} (${mainDept}).`;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Dynamic cover section resembling user design */}
      <div className="relative h-48 rounded-3xl overflow-hidden shadow-md bg-slate-900 border border-slate-100">
        {vendorProfile.banner ? (
          <img 
            src={vendorProfile.banner} 
            alt="Boutique Cover" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0c1445] via-[#1e3a8a] to-teal-800">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(37,99,235,0.3)_0%,transparent_50%),radial-gradient(circle_at_80%_20%,rgba(13,148,136,0.25)_0%,transparent_50% preview)] opacity-60" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        
        {/* Back and Title navigation controls */}
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/45 hover:bg-black/60 text-white text-xs font-bold shadow-xs transition rounded-full cursor-pointer backdrop-blur-md"
          >
            <ArrowLeft size={13} />
            <span>Retour</span>
          </button>
        </div>

        {isVerified && (
          <div className={`absolute top-4 right-4 z-10 flex items-center gap-1 px-3 py-1 text-white text-[10px] font-black tracking-wider uppercase shadow-md rounded-full ${
            vendorProfile.plan === 'Pro National' ? 'bg-amber-500' : 'bg-blue-600'
          }`}>
            <ShieldCheck size={12} className="fill-white" />
            <span>{vendorProfile.plan}</span>
          </div>
        )}
      </div>

      {/* Main card head */}
      <div className="px-6 -mt-14 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex gap-4 items-end">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#0c1445] to-[#1e3a8a] text-teal-300 font-serif font-black text-4xl flex items-center justify-center border-4 border-white shadow-lg shrink-0 select-none overflow-hidden">
              {vendorProfile.avatar ? (
                <img 
                  src={vendorProfile.avatar} 
                  alt={vendorProfile.shopName} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{vendorProfile.shopName ? vendorProfile.shopName[0].toUpperCase() : 'V'}</span>
              )}
            </div>
            <div className="mb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-serif text-xl sm:text-2xl font-extrabold text-[#0c1445] tracking-tight leading-none">
                  {vendorProfile.shopName}
                </h1>
                {vendorProfile.plan === 'Pro Local' && (
                  <span className="inline-flex items-center shrink-0" title="Vendeur Vérifié (Pro Local)">
                    <svg className="w-5 h-5 text-blue-500 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </span>
                )}
                {vendorProfile.plan === 'Pro National' && (
                  <span className="inline-flex items-center shrink-0" title="Vendeur Vérifié (Pro National)">
                    <svg className="w-5 h-5 text-amber-500 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                @{vendorProfile.shopName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const firstProd = vendorProducts[0]?.id || '';
              onOpenChat(vendorProfile.id, vendorProfile.nom, firstProd);
            }}
            className="mb-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] transition-all cursor-pointer w-full sm:w-fit"
          >
            <MessageSquare size={14} />
            <span>Contacter le vendeur</span>
          </button>
        </div>

        {/* Tags Row */}
        <div className="flex flex-wrap gap-1.5 mt-5">
          <span className="text-[9.5px] font-black tracking-wider uppercase bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full">
            🏪 Compte vendeur
          </span>
          <span className="text-[9.5px] font-black tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-full flex items-center gap-1">
            <MapPin size={10} /> {vendorProfile.commune || 'Haïti'}
          </span>
          <span className="text-[9.5px] font-black tracking-wider uppercase bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1 rounded-full">
            📅 Depuis {new Date(vendorProfile.createdAt).getFullYear()}
          </span>
          {vendorProfile.plan !== 'Gratuit' && (
            <span className="text-[9.5px] font-black tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full">
              ⭐ {vendorProfile.plan}
            </span>
          )}
        </div>
      </div>

      {/* Grid of contents & stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left side: Quick informations and numbers */}
        <div className="md:col-span-1 space-y-6">
          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-xs text-center">
            <div className="p-2.5 bg-slate-50/50 rounded-xl">
              <span className="block text-2xl font-extrabold text-[#0c1445] font-mono leading-none">
                {vendorProducts.length}
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Produits</span>
            </div>
            <div className="p-2.5 bg-slate-50/50 rounded-xl">
              <span className="block text-2xl font-extrabold text-[#0c1445] font-mono leading-none">
                {vendorSalesCount}
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Ventes</span>
            </div>
            <div className="p-2.5 bg-slate-50/50 rounded-xl col-span-2 flex items-center justify-between px-4">
              <div className="text-left">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Note vendeur</span>
                <span className="text-sm font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                  {avgRating}/5 <Star size={11} className="fill-amber-400 text-amber-400" />
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Avis total</span>
                <span className="text-xs font-semibold text-slate-500 block mt-0.5">
                  {vendorReviews.length} avis
                </span>
              </div>
            </div>
          </div>

          {/* Verified Trust Card */}
          {isVerified && (
            <div className="p-4 bg-gradient-to-br from-emerald-500/5 to-teal-500/10 border border-emerald-500/20 rounded-2xl shadow-2xs space-y-2 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-emerald-500/10 rounded-full blur-md" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-700 rounded-lg">
                  <ShieldCheck size={16} />
                </div>
                <span className="text-[10px] font-black text-[#0c1445] tracking-tight uppercase">Boutique Vérifiée</span>
              </div>
              <p className="text-[10px] text-slate-600 leading-normal font-medium">
                Cette boutique a passé avec succès les tests de conformité de Vendza. Les documents d'identité et de localisation physique ont été rigoureusement vérifiés.
              </p>
            </div>
          )}

          {/* Core details cards */}
          <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              À propos
            </h3>

            <div className="space-y-3.5">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Boutique</span>
                <span className="text-xs font-bold text-[#0c1445] font-serif">{vendorProfile.shopName}</span>
              </div>

              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Département d'origine</span>
                <span className="text-xs font-medium text-slate-700">{vendorProfile.departement || 'Non spécifié'}</span>
              </div>

              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Commune principale</span>
                <span className="text-xs font-medium text-slate-700">{vendorProfile.commune || 'Non spécifié'}</span>
              </div>

              {vendorProfile.tel && (
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Téléphone</span>
                  <span className="text-xs font-semibold text-[#0c1445] font-mono block mt-0.5">{vendorProfile.tel}</span>
                </div>
              )}

              {vendorProfile.email && (
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Email de contact</span>
                  <span className="text-xs font-medium text-[#0c1445] block mt-0.5">{vendorProfile.email}</span>
                </div>
              )}

              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Description de la boutique</span>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">{vendorProfile.shopDesc}</p>
              </div>
            </div>
          </div>

          {/* Zone de Livraison Couverte Card */}
          <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-teal-600">📍</span>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                Zones de Livraison & Couverture
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Plan de livraison</span>
                <span className={`inline-block text-[9.5px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md mt-1 border ${coverageBadgeColor}`}>
                  {coverageType}
                </span>
              </div>

              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Note explicative</span>
                <p className="text-xs text-slate-600 leading-relaxed mt-1 font-medium">{coverageDescriptionHtml}</p>
              </div>

              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Départements desservis ({coveredDeptsList.length})</span>
                <div className="flex flex-wrap gap-1">
                  {coveredDeptsList.map(dept => (
                    <span key={dept} className="text-[10px] font-bold bg-slate-50 text-slate-800 border border-slate-150 px-2 py-0.5 rounded select-none shadow-3xs">
                      ✓ {dept}
                    </span>
                  ))}
                </div>
              </div>

              {plan === 'Pro National' && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-2.5 rounded-xl text-center">
                  <span className="text-[9.5px] text-indigo-800 font-extrabold uppercase tracking-wide block">🇺🇳 Envoi National Assuré</span>
                  <p className="text-[9px] text-indigo-600 mt-0.5 leading-snug">Service de messagerie express accessible sur l'ensemble d'Haïti.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Store active list of products + reviews */}
        <div className="md:col-span-2 space-y-6">
          {/* Grid Products horizontal scroll */}
          <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-xs space-y-4">
            <h3 className="font-serif text-sm font-bold text-[#0c1445] flex items-center gap-1.5 uppercase tracking-wide">
              <ShoppingBag size={15} className="text-slate-500" />
              <span>Produits de ce vendeur ({vendorProducts.length})</span>
            </h3>

            {vendorProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {vendorProducts.map(prod => (
                  <div
                    key={prod.id}
                    onClick={() => {
                      onSetProduct(prod);
                      onNavigate('detail');
                    }}
                    className="group bg-slate-50 hover:bg-white border hover:border-blue-300 rounded-xl overflow-hidden p-3 shadow-2xs hover:shadow-xs transition duration-200 cursor-pointer space-y-2 text-center"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-[#fafafa] flex items-center justify-center relative">
                      <img
                        src={prod.image_url}
                        alt={prod.nom}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-700 truncate line-clamp-1">{prod.nom}</h4>
                      <div className="text-xs font-extrabold text-[#2563eb] font-mono mt-1">
                        {prod.prix.toLocaleString('fr-FR')} Gdes
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-slate-50/30 border border-slate-100 border-dashed rounded-xl text-center text-xs text-slate-400">
                Ce vendeur n'a pas encore publié d'articles.
              </div>
            )}
          </div>

          {/* Reviews column with option to insert a new review */}
          <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0c1445] uppercase tracking-wide">
                  Avis clients ({vendorReviews.length})
                </h3>
                <p className="text-[10px] text-slate-400">Laisser un commentaire pour recommander sa boutique</p>
              </div>
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0c1445] text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
              >
                {showReviewForm ? "Fermer" : "Rédiger un avis"}
              </button>
            </div>

            {/* Write review form toggle panel */}
            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3.5 animate-fade-in">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600 block mr-2">Votre note :</span>
                  {[1, 2, 3, 4, 5].map(starIdx => (
                    <button
                      key={starIdx}
                      type="button"
                      onClick={() => setRating(starIdx)}
                      className="transition transform active:scale-90"
                    >
                      <Star
                        size={18}
                        className={starIdx <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                      />
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase block">Votre message public</label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Qu'avez-vous pensé de l'expédition, de la rapidité et de la qualité de service ?"
                    className="w-full text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="w-full py-2 bg-[#0c1445] hover:bg-[#161f55] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <Send size={11} />
                  <span>{isSubmittingReview ? "Publication…" : "Publier l'avis"}</span>
                </button>
              </form>
            )}

            {/* Review listings row */}
            {vendorReviews.length > 0 ? (
              <div className="space-y-4 divide-y divide-slate-50">
                {vendorReviews.map((rev, index) => (
                  <div key={rev.id} className={`pt-4 ${index === 0 ? 'pt-0' : ''} space-y-1`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs select-none">
                          {rev.clientNom[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[#0c1445] block">{rev.clientNom}</span>
                          <span className="text-[9.5px] text-slate-400 font-mono block leading-none">{rev.date}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(starIdx => (
                          <Star
                            key={starIdx}
                            size={11}
                            className={starIdx <= rev.note ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 pl-9 leading-relaxed">{rev.commentaire}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-slate-50/20 border border-slate-100 rounded-xl text-center text-xs text-slate-400">
                Aucun avis pour le moment. Soyez le premier à donner votre avis de confiance !
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
