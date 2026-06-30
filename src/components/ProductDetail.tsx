import React, { useState } from 'react';
import { 
  ArrowLeft, ThumbsUp, ShoppingCart, Bolt, Heart, 
  MessageSquare, Star, Check, ShieldCheck, Share2,
  Store, MapPin
} from 'lucide-react';
import { Product, Review, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface ProductDetailProps {
  product: Product;
  products?: Product[];
  reviews: Review[];
  user: UserProfile | null;
  onNavigate: (view: string) => void;
  onAddToCart: (product: Product, quantity: number, color?: string, size?: string) => void;
  onCheckoutNow: (product: Product, quantity: number, color?: string, size?: string) => void;
  onOpenChat: (vendorId: string, vendorNom: string, productId?: string) => void;
  onAddReview: (review: Omit<Review, 'id' | 'date'>) => void;
  onShareLink: (product: Product) => void;
  onSetProduct?: (product: Product) => void;
  onViewVendorProfile?: (vendorId: string) => void;
  tauxUSD?: number;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  products = [],
  reviews,
  user,
  onNavigate,
  onAddToCart,
  onCheckoutNow,
  onOpenChat,
  onAddReview,
  onShareLink,
  onSetProduct,
  onViewVendorProfile,
  tauxUSD = 130
}) => {
  // Vendor Stats Panel trigger
  const [showVendorStats, setShowVendorStats] = useState<boolean>(false);
  if (!product) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 p-8 shadow-xs">
        <span className="text-4xl text-slate-300">📦</span>
        <h3 className="font-serif text-sm font-bold text-slate-700 mt-3">Produit introuvable</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Ce produit n'est plus disponible ou a été retiré de la boutique.</p>
        <button
          onClick={() => onNavigate('home')}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
        >
          Retourner à l'accueil
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'reviews' | 'livraison'>('desc');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedColor, setSelectedColor] = useState<string>(product.couleurs && product.couleurs[0] ? product.couleurs[0] : '');
  const [selectedSize, setSelectedSize] = useState<string>(product.tailles ? product.tailles[0] : '');
  const [selectedCapacity, setSelectedCapacity] = useState<string>(product.capacites && product.capacites[0] ? product.capacites[0] : '');
  
  // Reset selected indices / capacities if product changes
  const [prevProductId, setPrevProductId] = useState<string>(product.id);
  const [activeImgIndex, setActiveImgIndex] = useState<number>(0);

  if (product.id !== prevProductId) {
    setPrevProductId(product.id);
    setActiveImgIndex(0);
    setSelectedColor(product.couleurs[0] || '');
    setSelectedSize(product.tailles ? product.tailles[0] : '');
    setSelectedCapacity(product.capacites && product.capacites[0] ? product.capacites[0] : '');
  }
  
  // Review inputs
  const [newNote, setNewNote] = useState<number>(5);
  const [newComment, setNewComment] = useState<string>('');
  
  // Saved status
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Follow boutique states & preferences
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followPreferences, setFollowPreferences] = useState<{ notifyNewProducts: boolean; notifyPromotions: boolean }>({
    notifyNewProducts: true,
    notifyPromotions: true,
  });
  const [showPreferencesModal, setShowPreferencesModal] = useState<boolean>(false);
  const [isFollowActionLoading, setIsFollowActionLoading] = useState<boolean>(false);

  const isValidUuid = (uuid: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  };

  // Check follow status in database on mount or user/vendor change
  React.useEffect(() => {
    const checkFollowStatus = async () => {
      const vendorId = product.vendeurId;
      if (isSupabaseConfigured && supabase && user?.id && vendorId && isValidUuid(user.id) && isValidUuid(vendorId)) {
        try {
          const { data, error } = await supabase
            .from('vendor_follows')
            .select('*')
            .eq('follower_id', user.id)
            .eq('vendor_id', vendorId)
            .maybeSingle();
          if (data && !error) {
            setIsFollowing(true);
            setFollowPreferences({
              notifyNewProducts: data.notify_new_products,
              notifyPromotions: data.notify_promotions,
            });
          } else {
            setIsFollowing(false);
          }
        } catch (err) {
          console.warn("Error checking follow status:", err);
        }
      }
    };
    checkFollowStatus();
  }, [user?.id, product.vendeurId]);

  // Handle follow/unfollow toggle
  const handleFollowToggle = async () => {
    const vendorId = product.vendeurId;
    if (!user) {
      alert("Veuillez vous connecter pour suivre cette boutique.");
      return;
    }
    if (!vendorId || vendorId === user.id) return;
    if (!isValidUuid(user.id) || !isValidUuid(vendorId)) {
      console.warn("Invalid follower_id or vendor_id UUID");
      return;
    }

    setIsFollowActionLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('vendor_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('vendor_id', vendorId);
        if (error) throw error;
        setIsFollowing(false);
      } else {
        // Follow
        const { error } = await supabase
          .from('vendor_follows')
          .insert({
            follower_id: user.id,
            vendor_id: vendorId,
            notify_new_products: true,
            notify_promotions: true,
          });
        if (error) throw error;
        setIsFollowing(true);
        setFollowPreferences({ notifyNewProducts: true, notifyPromotions: true });
        setShowPreferencesModal(true); // Show preference preferences modal on initial follow
      }
    } catch (err: any) {
      console.error("Follow toggle error:", err.message);
      alert("Une erreur s'est produite lors de l'action de suivi.");
    } finally {
      setIsFollowActionLoading(false);
    }
  };

  const productReviews = reviews.filter(r => r.productId === product.id);
  const avgRating = productReviews.length > 0 
    ? (productReviews.reduce((sum, r) => sum + r.note, 0) / productReviews.length).toFixed(1)
    : product.rating;

  // Real vendor computations
  const vendorProducts = products.filter(p => p.vendeurId === product.vendeurId || (p.vendeur === product.vendeur && p.vendeurId === 'v-gen'));
  const vendorReviews = reviews.filter(r => vendorProducts.some(vp => vp.id === r.productId));
  const avgVendorRating = vendorReviews.length > 0 
    ? (vendorReviews.reduce((sum, r) => sum + r.note, 0) / vendorReviews.length).toFixed(1)
    : "4.8";

  const handleQtyChange = (d: number) => {
    setQuantity(prev => Math.max(1, Math.min(product.stock, prev + d)));
  };

  const submitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    onAddReview({
      productId: product.id,
      clientNom: user ? `${user.prenom} ${user.nom}` : 'Client Anonyme',
      note: newNote,
      commentaire: newComment
    });

    setNewComment('');
    setNewNote(5);
  };

  return (
    <div className="space-y-6">
      {/* Back to Home row */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Retour au Marché
        </button>

        <span className="text-[10px] text-slate-400 font-mono">
          ID: {product.id}
        </span>
      </div>

      {/* Main product representation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        {/* Left column: Big beautiful color box */}
        <div className="space-y-4">
          {(() => {
            const galleryImageUrls = product.gallery && product.gallery.length > 0 
              ? product.gallery 
              : [product.image_url].filter(Boolean);
            const currentImageSrc = galleryImageUrls[activeImgIndex] || product.image_url || '';
            const isColorPlaceholder = currentImageSrc && currentImageSrc.startsWith('#') && currentImageSrc.length <= 7;

            return (
              <>
                <div 
                  className="w-full aspect-square rounded-2xl relative flex items-center justify-center shadow-inner border border-slate-100 select-none overflow-hidden bg-slate-50"
                >
                  {currentImageSrc && !isColorPlaceholder ? (
                    <img 
                      src={currentImageSrc} 
                      alt={product.nom} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center relative"
                      style={{ background: `linear-gradient(135deg, ${selectedColor || '#2563eb'}22, ${selectedColor || '#2563eb'}44)` }}
                    >
                      <div 
                        className="w-28 h-28 rounded-2xl shadow-xl border-8 border-white animate-pulse"
                        style={{ backgroundColor: selectedColor || '#2563eb' }}
                      />
                    </div>
                  )}

                  {/* Float tags */}
                  <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                    {product.oldPrice && (
                      <span className="bg-red-600 text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                        Super Promo
                      </span>
                    )}
                    {product.stock <= 3 && product.stock > 0 && (
                      <span className="bg-amber-600 text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                        Stock Limité
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onShareLink(product)}
                    className="absolute top-4 right-4 p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition shadow-xs cursor-pointer"
                    title="Partager le lien"
                  >
                    <Share2 size={15} />
                  </button>
                </div>

                {/* Thumbnails row */}
                {galleryImageUrls.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
                    {galleryImageUrls.map((src, idx) => {
                      const isColorThumb = src && src.startsWith('#') && src.length <= 7;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImgIndex(idx)}
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                            activeImgIndex === idx ? 'border-blue-600 shadow-sm scale-95' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {isColorThumb ? (
                            <div className="w-full h-full" style={{ backgroundColor: src }} />
                          ) : (
                            <img 
                              src={src} 
                              alt={`${product.nom} ${idx + 1}`} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}

          {/* Color select row under large box */}
          {product.couleurs.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Images & Variantes</span>
              <div className="flex gap-2">
                {product.couleurs.map(clr => (
                  <div
                    key={clr}
                    onClick={() => setSelectedColor(clr)}
                    className={`w-9 h-9 rounded-lg border-2 cursor-pointer transition flex items-center justify-center ${
                      selectedColor === clr ? 'border-blue-600 shadow-xs' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: clr }}
                  >
                    {selectedColor === clr && <span className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Product metadata sheet */}
        <div className="flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded uppercase tracking-wider">{product.cat}</span>
              <span className="text-slate-300">•</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">Note: {avgRating}/5</span>
            </div>

            <h1 className="font-serif text-xl sm:text-2xl font-extrabold text-[#0c1445] tracking-tight leading-snug mt-2">
              {product.nom}
            </h1>

            {/* Vendeur block */}
            <div className="flex items-center gap-3 mt-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 w-fit flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#0c1445] text-teal-300 font-bold text-[9px] flex items-center justify-center">
                  {product.vendeur[0]}
                </div>
                <span className="text-[11px] font-bold text-[#0c1445]">Vendu par {product.vendeur}</span>
                {(product.vendeurPlan === 'Pro Local' || String(product.vendeurPlan || '').toLowerCase().replace(/_/g, ' ') === 'pro local') && (
                  <span className="inline-flex items-center shrink-0" title={`${product.vendeur} est un Vendeur vérifié (Pro Local)`}>
                    <svg className="w-3.5 h-3.5 text-blue-500 fill-current ml-0.5" viewBox="0 0 24 24">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </span>
                )}
                {(product.vendeurPlan === 'Pro National' || String(product.vendeurPlan || '').toLowerCase().replace(/_/g, ' ') === 'pro national') && (
                  <span className="inline-flex items-center shrink-0" title={`${product.vendeur} est un Vendeur vérifié (Pro National)`}>
                    <svg className="w-3.5 h-3.5 text-amber-500 fill-current ml-0.5" viewBox="0 0 24 24">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </span>
                )}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <button
                onClick={() => {
                  if (onViewVendorProfile) {
                    onViewVendorProfile(product.vendeurId || 'v-tph');
                  } else {
                    setShowVendorStats(true);
                  }
                }}
                className="text-[10px] font-black tracking-wider text-blue-600 hover:text-blue-800 underline uppercase cursor-pointer pl-1 border-l border-slate-200"
              >
                Voir le profil →
              </button>

              {/* Follow Button near vendor info */}
              <div className="pl-1.5 border-l border-slate-200 flex items-center">
                {!user ? (
                  <button
                    disabled
                    className="text-[10px] font-black tracking-wider text-slate-400 uppercase cursor-not-allowed"
                    title="Connecte-toi pour suivre"
                  >
                    Suivre (Se connecter)
                  </button>
                ) : user.id !== product.vendeurId ? (
                  <button
                    onClick={handleFollowToggle}
                    disabled={isFollowActionLoading}
                    className={`text-[10px] font-black tracking-wider uppercase transition cursor-pointer flex items-center gap-1 ${
                      isFollowing 
                        ? 'text-emerald-600 hover:text-emerald-800 font-bold' 
                        : 'text-indigo-600 hover:text-indigo-800'
                    }`}
                  >
                    <span>{isFollowing ? '✓ Abonné' : '🔔 Suivre'}</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Price display block */}
            <div className="mt-4 flex flex-col md:flex-row md:items-baseline gap-1.5 md:gap-3">
              <div className="flex items-baseline gap-2.5">
                <span className="font-serif text-2xl sm:text-3xl font-black text-[#2563eb]">
                  {product.prix.toLocaleString('fr-FR')} <span className="text-xs font-sans font-medium text-slate-500">HTG / Gdes</span>
                </span>
                {product.oldPrice && (
                  <span className="text-xs text-slate-400 line-through font-mono">
                    {product.oldPrice.toLocaleString('fr-FR')} Gdes
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-lg border border-emerald-100 self-start">
                <span className="font-mono text-base font-extrabold">
                  ${(product.prix / tauxUSD).toFixed(2)}
                </span>
                <span className="text-[10px] font-sans font-medium uppercase tracking-widest text-emerald-600">USD</span>
                {product.oldPrice && (
                  <span className="text-[10px] text-emerald-500 font-mono line-through ml-1 leading-none">
                    (${(product.oldPrice / tauxUSD).toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            {/* Sizes selector if present */}
            {product.tailles && product.tailles.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Choisir la taille</span>
                <div className="flex gap-2">
                  {product.tailles.map(sz => (
                    <button
                      key={sz}
                      onClick={() => setSelectedSize(sz)}
                      className={`min-w-[36px] h-9 rounded-lg border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                        selectedSize === sz 
                          ? 'bg-blue-600 text-white border-blue-600 font-extrabold shadow-sm' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Capacities selector if present */}
            {product.capacites && product.capacites.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Choisir la capacité</span>
                <div className="flex gap-2">
                  {product.capacites.map(cap => (
                    <button
                      key={cap}
                      onClick={() => setSelectedCapacity(cap)}
                      className={`min-w-[48px] h-9 px-2.5 rounded-lg border text-[11px] font-bold transition flex items-center justify-center cursor-pointer ${
                        selectedCapacity === cap 
                          ? 'bg-blue-600 text-white border-blue-600 font-extrabold shadow-sm' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-[#5a6480] leading-relaxed mt-4">
              {product.desc}
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            {/* Quantity selector */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Quantité</span>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => handleQtyChange(-1)}
                  className="w-9 h-9 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="w-10 text-center font-mono text-xs font-bold text-slate-800">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => handleQtyChange(1)}
                  className="w-9 h-9 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  disabled={quantity >= product.stock}
                >
                  +
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                ({product.stock > 0 ? `${product.stock} unités disponibles` : 'Rupture'})
              </span>
            </div>

            {/* Primary checkout buttons */}
            {user && (product.vendeurId === user.id || (product.vendeurId === 'v-tph' && user.id === 'v-tph')) ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-3.5 rounded-xl leading-relaxed">
                <span className="font-extrabold text-amber-900 flex items-center gap-1.5 mb-1">
                  🏪 Votre propre article en ligne
                </span>
                Vous ne pouvez pas acheter vos propres produits. En tant que vendeur propriétaire, vous pouvez gérer le stock et les prix depuis votre table de bord commerçant.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => onCheckoutNow(product, quantity, selectedColor, selectedSize)}
                  disabled={product.stock <= 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 text-white font-extrabold text-xs tracking-wider uppercase transition shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Bolt size={14} /> Acheter l'instant
                </button>

                <button
                  onClick={() => onAddToCart(product, quantity, selectedColor, selectedSize)}
                  disabled={product.stock <= 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600 font-extrabold text-xs tracking-wider uppercase transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ShoppingCart size={14} /> Mettre au panier
                </button>
              </div>
            )}

            {/* Secondary micro actions */}
            <div className="flex gap-2 justify-between">
              <button
                onClick={() => setIsSaved(!isSaved)}
                className={`py-2 px-3 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isSaved 
                    ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-[#5a6480]'
                }`}
              >
                <Heart size={12} fill={isSaved ? "currentColor" : "none"} /> 
                {isSaved ? 'Enregistré !' : 'Sauvegarder'}
              </button>

              <button
                onClick={() => onOpenChat(product.vendeurId, product.vendeur, product.id)}
                className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-[#5a6480] flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare size={12} /> Écrire au vendeur
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs list section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('desc')}
            className={`px-5 py-3 text-xs font-bold tracking-wide uppercase transition border-b-2 cursor-pointer ${
              activeTab === 'desc' 
                ? 'border-blue-600 text-blue-600 font-extrabold' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Description
          </button>
          
          <button
            onClick={() => setActiveTab('specs')}
            className={`px-5 py-3 text-xs font-bold tracking-wide uppercase transition border-b-2 cursor-pointer ${
              activeTab === 'specs' 
                ? 'border-blue-600 text-blue-600 font-extrabold' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Caractéristiques
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-5 py-3 text-xs font-bold tracking-wide uppercase transition border-b-2 cursor-pointer ${
              activeTab === 'reviews' 
                ? 'border-blue-600 text-blue-600 font-extrabold' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Avis clients ({productReviews.length})
          </button>

          <button
            onClick={() => setActiveTab('livraison')}
            className={`px-5 py-3 text-xs font-bold tracking-wide uppercase transition border-b-2 cursor-pointer ${
              activeTab === 'livraison' 
                ? 'border-blue-600 text-blue-600 font-extrabold' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Livraison sécurisée
          </button>
        </div>

        <div className="p-5 text-xs text-slate-600 leading-relaxed">
          {activeTab === 'desc' && (
            <div className="space-y-2">
              <p className="font-medium text-slate-700">{product.nom}</p>
              <p>{product.desc}</p>
              <p>Mise en vente sur Vendza, la première marketplace de confiance à Haïti bénéficiant d'un modèle d'achat solidaire garanti. Votre capital est entièrement protégé : le vendeur perçoit ses Gourdes uniquement après validation du QR Code.</p>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="divide-y divide-slate-100">
              {Object.entries(product.caracteristiques).map(([key, val]) => (
                <div key={key} className="grid grid-cols-3 py-2">
                  <span className="font-extrabold text-slate-700 uppercase tracking-widest text-[10px]">{key}</span>
                  <span className="col-span-2 text-slate-600 text-xs font-semibold">{val}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 py-2">
                <span className="font-extrabold text-slate-700 uppercase tracking-widest text-[10px]">Origine</span>
                <span className="col-span-2 text-slate-600 text-xs font-semibold">Haïti (Vendeur localisé)</span>
              </div>
            </div>
          )}

          {activeTab === 'livraison' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <h4 className="font-bold text-[#0c1445] text-xs">Informations d'acheminement &amp; Origine</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Origine d'expédition</span>
                    <span className="text-xs font-bold text-[#0c1445]">
                      {product.commune && product.departement 
                        ? `${product.commune}, ${product.departement}` 
                        : (product.caracteristiques['Origine'] || 'Haïti')}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Délai estimé</span>
                    <span className="text-xs font-bold text-emerald-700 capitalize">
                      {product.delaiLivraison 
                        ? (product.delaiLivraison === '24h' ? 'Sous 24h chrono'
                           : product.delaiLivraison === '48h' ? 'Sous 48 heures'
                           : product.delaiLivraison === '3j' ? '2-3 jours ouvrés'
                           : product.delaiLivraison === 'semaine' ? '1 semaine'
                           : product.delaiLivraison === 'remise' ? 'Remise en main propre'
                           : product.delaiLivraison)
                        : 'Standard (3-5 jours)'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Région</span>
                    <span className="text-xs font-bold text-slate-600">
                      {product.departement || 'Haïti (Vendeur localisé)'}
                    </span>
                  </div>
                </div>
              </div>

              {(() => {
                const rawP = product as any;
                const blocks: [string, string][] = [];
                if (rawP.shipping_info) blocks.push(['Livraison', String(rawP.shipping_info)]);
                if (rawP.delivery_info) blocks.push(['Détails', String(rawP.delivery_info)]);
                if (rawP.shipping_time) blocks.push(['Délai', String(rawP.shipping_time)]);
                if (rawP.delivery_zone) blocks.push(['Zone', String(rawP.delivery_zone)]);
                if (rawP.shipping_price != null && rawP.shipping_price !== '') {
                  blocks.push(['Frais', typeof rawP.shipping_price === 'number' ? `${rawP.shipping_price} Gdes` : String(rawP.shipping_price)]);
                }

                if (blocks.length > 0) {
                  return (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                      <h4 className="font-bold text-slate-800 text-xs text-[#0c1445]">Détails géographiques d'expédition</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {blocks.map(([label, val]) => (
                          <div key={label} className="p-2 bg-white rounded-lg border border-slate-200">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">{label}</span>
                            <span className="text-xs font-semibold text-[#0c1445]">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <h3 className="font-bold text-slate-700 leading-snug">Règles de livraison sécurisée Vendza</h3>
              <p>Chaque commande effectuée sur la plateforme génère un <strong>ticket de garde unique</strong> encodé dans un QR code client.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <h4 className="font-bold text-slate-700">1. Expédition & Colis</h4>
                  <p className="text-[11px] text-slate-500">Le vendeur s\'occupe d\'expédier l\'article et de coller le bon de commande ou d\'avoir le QR code vendeur imprimé.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <h4 className="font-bold text-slate-700">2. Scan & Validation</h4>
                  <p className="text-[11px] text-slate-500">Dès réception de l\'article par le client, ce dernier scanne le QR code pour débloquer les fonds de garantie.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {/* Product Review Form */}
              <form onSubmit={submitReview} className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl space-y-3">
                <h4 className="font-serif font-bold text-xs text-slate-800">Partagez votre avis sur ce produit</h4>
                
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Votre Note</span>
                  <div className="flex gap-1 bg-white border border-slate-200 px-2 py-1 rounded-full text-amber-500">
                    {[1, 2, 3, 4, 5].map(starNum => (
                      <button
                        key={starNum}
                        type="button"
                        onClick={() => setNewNote(starNum)}
                        className="p-0.5 hover:scale-115 transition text-amber-400 active:text-amber-500"
                        title={`${starNum} étoiles`}
                      >
                        <Star size={14} fill={newNote >= starNum ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <textarea
                    placeholder="Contenu de votre commentaire..."
                    required
                    className="w-full text-xs font-sans text-slate-700 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 bg-white"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    rows={2}
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0c1445] text-white hover:bg-[#1a2355] text-xs font-bold rounded-lg cursor-pointer"
                >
                  Publier l'avis
                </button>
              </form>

              {/* Product reviews list view */}
              <div className="space-y-3 pt-2">
                <h4 className="font-serif font-bold text-xs text-slate-800">Commentaires récents ({productReviews.length})</h4>
                {productReviews.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {productReviews.map(rev => (
                      <div key={rev.id} className="py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold font-sans text-[10px] text-slate-500">
                              {rev.clientNom[0]}
                            </div>
                            <span className="text-xs font-bold text-slate-800">{rev.clientNom}</span>
                          </div>
                          
                          <div className="flex items-center gap-0.5 text-amber-500 bg-amber-50/50 px-2 py-0.5 rounded-full text-[10px]">
                            <Star size={10} fill="currentColor" />
                            <span className="font-bold">{rev.note}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 bg-slate-50/20 p-2 rounded-lg italic">
                          "{rev.commentaire}"
                        </p>
                        <span className="text-[9px] text-[#9aa3bf] tracking-wide block text-right">{rev.date}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-center py-4">Soyez le premier à donner votre avis !</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== BOUTIQUE PARTENAIRE MODAL OVERLAY ==================== */}
      {showVendorStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c1445]/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-scale-up">
            {/* Modal Header banner */}
            <div className="relative bg-gradient-to-br from-[#0c1445] to-[#1e3a8a] text-white p-6 shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-45 pointer-events-none" />
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setShowVendorStats(false)}
                  className="rounded-full bg-white/10 hover:bg-white/25 text-white p-2 transition cursor-pointer"
                  aria-label="Fermer le profil du vendeur"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/15 border-2 border-white/20 flex items-center justify-center text-3xl font-serif font-black text-teal-300 shadow-inner select-none shrink-0">
                  {product.vendeur[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-serif text-lg font-bold tracking-tight">{product.vendeur}</h3>
                    {(product.vendeurPlan === 'Pro Local' || String(product.vendeurPlan || '').toLowerCase().replace(/_/g, ' ') === 'pro local') && (
                      <span className="inline-flex items-center shrink-0" title={`Boutique Officielle Vérifiée (Pro Local)`}>
                        <svg className="w-5 h-5 text-blue-400 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </span>
                    )}
                    {(product.vendeurPlan === 'Pro National' || String(product.vendeurPlan || '').toLowerCase().replace(/_/g, ' ') === 'pro national') && (
                      <span className="inline-flex items-center shrink-0" title={`Boutique Officielle Vérifiée (Pro National)`}>
                        <svg className="w-5 h-5 text-amber-500 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-teal-400" />
                    <span>Région : {product.caracteristiques?.['Origine'] || 'Haïti'}</span>
                  </p>
                </div>
              </div>

              {/* Verified Sub Badges */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                <span className="text-[9px] font-black tracking-wider uppercase bg-white/15 px-2.5 py-0.5 rounded-full border border-white/10 text-white flex items-center gap-1 shadow-sm">
                  🏪 Boutique Partenaire
                </span>
                
                <span className="text-[9px] font-black tracking-wider uppercase bg-teal-500 text-[#0c1445] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm font-extrabold">
                  ★ {product.vendeurPlan}
                </span>

                <span className="text-[9px] font-black tracking-wider uppercase bg-emerald-500/25 border border-emerald-400/20 text-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  ✓ Tiers de confiance
                </span>
              </div>
            </div>

            {/* Modal Scrollable core */}
            <div className="p-6 overflow-y-auto space-y-5 scrollbar-thin flex-1 bg-slate-50/50">
              {/* Numeric stats section */}
              <div className="grid grid-cols-3 gap-3 text-center bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs">
                <div>
                  <span className="block text-lg font-extrabold text-[#0c1445] font-mono leading-none">{vendorProducts.length}</span>
                  <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Articles</span>
                </div>
                <div>
                  <span className="block text-lg font-extrabold text-[#0c1445] font-mono leading-none flex items-center justify-center gap-0.5">
                    {avgVendorRating} <Star size={12} className="fill-amber-400 text-amber-400" />
                  </span>
                  <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Avis ({vendorReviews.length})</span>
                </div>
                <div>
                  <span className="block text-lg font-extrabold text-emerald-600 font-mono leading-none">99%</span>
                  <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Expédition</span>
                </div>
              </div>

              {/* Security guarantee banner informational */}
              <div className="bg-blue-50/40 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                <span className="text-xl shrink-0">🛡️</span>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-black text-[#0c1445] uppercase tracking-wide">Paiement Garanti de Confiance</h4>
                  <p className="text-[10.5px] text-slate-500 leading-normal">
                    L'argent de vos commandes est détenu de manière sécurisée par Vendza et n'est libéré au vendeur que lorsque vous scannez le QR code de livraison. Aucun risque de perte de gourdes !
                  </p>
                </div>
              </div>

              {/* Vendor's other listings */}
              <div className="space-y-2">
                <h4 className="font-serif text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <Store size={12} className="text-slate-500" />
                  <span>Autres articles de cette boutique ({vendorProducts.length})</span>
                </h4>

                {vendorProducts.length > 1 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
                    {vendorProducts.filter(p => p.id !== product.id).map(otherProd => (
                      <div 
                        key={otherProd.id}
                        onClick={() => {
                          if (onSetProduct) {
                            onSetProduct(otherProd);
                            setShowVendorStats(false);
                          }
                        }}
                        className="bg-white border border-slate-100 rounded-xl p-2.5 w-32 snap-start shrink-0 hover:border-blue-400 hover:shadow-xs transition duration-150 cursor-pointer text-center space-y-1.5"
                      >
                        <div className="w-full h-16 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                          <img 
                            src={otherProd.image_url} 
                            alt={otherProd.nom} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <h5 className="text-[10px] font-black text-slate-700 truncate leading-none">{otherProd.nom}</h5>
                        <div className="text-[10px] font-semibold text-blue-600 font-mono">
                          {otherProd.prix.toLocaleString('fr-FR')} Gdes
                          <span className="block text-[9px] text-emerald-600 font-bold leading-none mt-0.5">
                            ${(otherProd.prix / tauxUSD).toFixed(2)} USD
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-white border border-[#e4e9f5] border-dashed rounded-2xl text-center text-[11px] text-slate-400">
                    Aucun autre produit listé actuellement par ce vendeur.
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer controls */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0 grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowVendorStats(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-500 text-xs font-bold text-center cursor-pointer transition"
              >
                Retourner aux détails
              </button>
              <button
                onClick={() => {
                  setShowVendorStats(false);
                  onOpenChat(product.vendeurId, product.vendeur, product.id);
                }}
                className="w-full py-2.5 bg-[#0c1445] hover:bg-[#1a2355] text-white text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <MessageSquare size={13} />
                <span>Contacter le vendeur</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreferencesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-scale-up">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2 text-xl shadow-xs">
                🔔
              </div>
              <h4 className="font-serif text-base font-extrabold text-[#0c1445] tracking-tight">Préférences d'abonnements</h4>
              <p className="text-xs text-slate-500">Personnalisez vos notifications pour la boutique <b>{product.vendeur}</b>.</p>
            </div>

            <div className="space-y-3.5 pt-2">
              <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-150/60 cursor-pointer transition">
                <div className="space-y-0.5 pr-2 text-left">
                  <span className="text-xs font-bold text-slate-800 block">Nouveaux produits</span>
                  <span className="text-[10px] text-slate-500 block leading-tight">Recevoir une alerte lors de l'ajout de nouveaux articles</span>
                </div>
                <input
                  type="checkbox"
                  checked={followPreferences.notifyNewProducts}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setFollowPreferences(prev => ({ ...prev, notifyNewProducts: val }));
                    const vendorId = product.vendeurId;
                    if (isSupabaseConfigured && supabase && user?.id && vendorId && isValidUuid(user.id) && isValidUuid(vendorId)) {
                      await supabase
                        .from('vendor_follows')
                        .update({ notify_new_products: val })
                        .eq('follower_id', user.id)
                        .eq('vendor_id', vendorId);
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-150/60 cursor-pointer transition">
                <div className="space-y-0.5 pr-2 text-left">
                  <span className="text-xs font-bold text-slate-800 block">Promotions uniquement</span>
                  <span className="text-[10px] text-slate-500 block leading-tight">Recevoir une alerte uniquement pour les réductions de prix</span>
                </div>
                <input
                  type="checkbox"
                  checked={followPreferences.notifyPromotions}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setFollowPreferences(prev => ({ ...prev, notifyPromotions: val }));
                    const vendorId = product.vendeurId;
                    if (isSupabaseConfigured && supabase && user?.id && vendorId && isValidUuid(user.id) && isValidUuid(vendorId)) {
                      await supabase
                        .from('vendor_follows')
                        .update({ notify_promotions: val })
                        .eq('follower_id', user.id)
                        .eq('vendor_id', vendorId);
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
            </div>

            <button
              onClick={() => setShowPreferencesModal(false)}
              className="w-full py-2.5 bg-[#0c1445] hover:bg-[#1a2355] text-white text-xs font-extrabold rounded-xl text-center shadow-md transition cursor-pointer"
            >
              Enregistrer mes préférences
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
