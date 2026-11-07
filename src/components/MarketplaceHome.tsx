import React, { useState, useEffect } from 'react';
import { Search, MapPin, Sparkles, Flame, Clock, Plus, Star, Store, X } from 'lucide-react';
import { Product, UserProfile, Review } from '../types';
import { HAITIAN_ZONES } from '../data';

import { EIcon, RichText } from './EIcon';
import { ratingInfo, isPopularVerified, byPopularity } from '../lib/popularity';
interface MarketplaceHomeProps {
  products: Product[];
  reviews?: Review[];
  onNavigate: (view: string) => void;
  onSetProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  user: UserProfile | null;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  tauxUSD?: number;
}

export const MarketplaceHome: React.FC<MarketplaceHomeProps> = ({
  products,
  reviews = [],
  onNavigate,
  onSetProduct,
  onAddToCart,
  user,
  loading = false,
  onLoadMore,
  hasMore = false,
  tauxUSD = 130
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [homeTab, setHomeTab] = useState<'tous' | 'populaires'>('tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedCommune, setSelectedCommune] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  
  // Timer Countdown state for live Flash Sales
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentSeconds = now.getSeconds();

      // Flash sales starts at 8h00 (8 AM) and ends at 20h00 (8 PM - 12 hours countdown max)
      // Disappears when countdown reaches 0 (after 20:00), reappears the next morning at 8:00 AM!
      if (currentHour >= 8 && currentHour < 20) {
        setIsFlashActive(true);
        setTimeLeft({
          hours: 19 - currentHour,
          minutes: 59 - currentMinutes,
          seconds: 59 - currentSeconds
        });
      } else {
        setIsFlashActive(false);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const categories = [
    { value: 'Tout', label: '[[ShoppingBag]] Tout' },
    { value: 'Mode', label: '[[Shirt]] Mode' },
    { value: 'Électronique', label: '[[Smartphone]] Électronique' },
    { value: 'Audio', label: '[[Headphones]] Audio' },
    { value: 'Wearable', label: '[[Watch]] Wearable' },
    { value: 'Maison', label: '[[Home]] Maison' },
    { value: 'Photo', label: '[[Camera]] Photo' },
    { value: 'Gaming', label: '[[Gamepad2]] Gaming' },
    { value: 'Beauté', label: '[[Droplets]] Beauté' },
    { value: 'Accessoires', label: '[[Backpack]] Accessoires' },
    { value: 'Alimentaire', label: '[[ShoppingCart]] Alimentaire' },
    { value: 'Sport', label: '[[Dumbbell]] Sport' },
    { value: 'Autre', label: '[[Package]] Autre' }
  ];

  // Handle department changes - reset commune
  const handleDeptChange = (dept: string) => {
    setSelectedDept(dept);
    setSelectedCommune('');
  };

  // Filter logic
  const filteredProducts = products.filter(p => {
    // Normalize seller plan for robust comparison
    const pPlan = String(p.vendeurPlan || '').toLowerCase().replace(/_/g, ' ').trim();
    const isProNational = pPlan === 'pro_national' || pPlan === 'pro national';

    // 1. Category Filter
    if (selectedCat && selectedCat !== 'Tout' && p.cat !== selectedCat) {
      return false;
    }
    // 2. Search Text
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = p.nom.toLowerCase().includes(q);
      const matchDesc = p.desc.toLowerCase().includes(q);
      const matchCat = p.cat.toLowerCase().includes(q);
      const matchTags = p.tags.some(tag => tag.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchCat && !matchTags) return false;
    }
    // 3. Location selection (simulate regional routing)
    if (selectedDept) {
      const pDept = (p.departement || '').toLowerCase().trim();
      const pOrig = (p.caracteristiques?.['Origine'] || '').toLowerCase().trim();
      const targetDept = selectedDept.toLowerCase().trim();
      
      const deptMatches = pDept === targetDept || pOrig.includes(targetDept);
      const isNationalOrPremiumDept = isProNational || (p.vendeurPremiumDepts && p.vendeurPremiumDepts.some(d => d.toLowerCase().trim() === targetDept));
      
      if (!deptMatches && !isNationalOrPremiumDept) {
        return false;
      }
    }

    if (selectedCommune) {
      const pCommune = (p.commune || '').toLowerCase().trim();
      const pOrig = (p.caracteristiques?.['Origine'] || '').toLowerCase().trim();
      const targetCommune = selectedCommune.toLowerCase().trim();
      
      const communeMatches = pCommune === targetCommune || pOrig.includes(targetCommune);
      
      // Find department of the selected commune
      let targetCommuneDept = '';
      const targetCommuneLower = targetCommune.toLowerCase().trim();
      for (const [deptName, communes] of Object.entries(HAITIAN_ZONES)) {
        if (communes.some(c => c.toLowerCase().trim() === targetCommuneLower)) {
          targetCommuneDept = deptName;
          break;
        }
      }
      const targetCommuneDeptLower = targetCommuneDept.toLowerCase().trim();

      const isNationalOrPremiumCommune = isProNational || 
        (targetCommuneDeptLower && p.vendeurPremiumDepts && p.vendeurPremiumDepts.some(d => d.toLowerCase().trim() === targetCommuneDeptLower));
      
      if (!communeMatches && !isNationalOrPremiumCommune) {
        return false;
      }
    }
    return p.statut === 'actif';
  });

  const hasNoProductsForSelectedLocation = (selectedDept || selectedCommune) && filteredProducts.length === 0;

  // Sort products dynamically by referencing/SEO tiers (Pro National > Pro Local > Gratuit) and image verification status
  filteredProducts.sort((a, b) => {
    const getProductTier = (p: Product) => {
      const rawPlan = String(p.vendeurPlan || '').toLowerCase().replace(/_/g, ' ').trim();
      
      // If the product is marked by the image verification (has an active quality/illustration warning)
      const isMarkedByImageVerification = !!p.seoWarning;
      
      if (isMarkedByImageVerification) {
        return 1; // Demote to basic tier matching the free plan
      }
      
      if (rawPlan === 'pro national' || rawPlan === 'pro_national') {
        return 3; // Best referencing (National Pro first)
      }
      if (rawPlan === 'pro local' || rawPlan === 'pro_local') {
        return 2; // Medium referencing (Local Pro next)
      }
      return 1; // Basic referencing (Gratuit / base last)
    };

    const tierA = getProductTier(a);
    const tierB = getProductTier(b);

    if (tierB !== tierA) {
      return tierB - tierA; // Higher tier first
    }

    // Within the same tier, sort by secondary SEO/referencing score descending
    const scoreA = a.scoreReferencement ?? 100;
    const scoreB = b.scoreReferencement ?? 100;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // Fallback: newest products first
    const dateA = new Date(a.dateCreation || 0).getTime();
    const dateB = new Date(b.dateCreation || 0).getTime();
    return dateB - dateA;
  });

  // Note moyenne issue des vrais avis ; null = pas encore noté
  const getProductRating = (p: Product): number | null => ratingInfo(reviews, p.id).avg;

  // Populaires & Vérifiés : vendeur vérifié, au moins 10 avis, note moyenne d'au moins 4,5 (classés par nombre d'avis puis note)
  const popularProducts = filteredProducts
    .filter(p => isPopularVerified(ratingInfo(reviews, p.id), p))
    .sort((a, b) => byPopularity(ratingInfo(reviews, a.id), ratingInfo(reviews, b.id)));
  const trendsProducts = filteredProducts.filter(p => p.tags.includes('tech') || p.tags.includes('mode'));
  const discountProducts = filteredProducts.filter(p => p.oldPrice && p.oldPrice > p.prix);
  // Onglet « Populaires & Vérifiés » : retombe sur « Tous » s'il n'y a plus de produit populaire (filtres changés)
  const activeTab: 'tous' | 'populaires' = homeTab === 'populaires' && popularProducts.length > 0 ? 'populaires' : 'tous';
  const gridProducts = activeTab === 'populaires' ? popularProducts : filteredProducts;
  const newProducts = filteredProducts.slice().reverse().slice(0, 3);

  const viewProduct = (p: Product) => {
    onSetProduct(p);
    onNavigate('detail');
  };

  return (
    <div className="space-y-6">
      {/* Category selector row */}
      <section className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none border-b border-[#e2e8f0] -mx-4 px-4 bg-white sticky top-[66px] z-20">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setSelectedCat(cat.value === 'Tout' ? '' : cat.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
              (cat.value === 'Tout' && !selectedCat) || selectedCat === cat.value
                ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-500 border-[#e2e8f0]'
            }`}
          >
            <RichText text={cat.label} />
          </button>
        ))}
      </section>

      {/* Modern Search & Location Block */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-[#e4e9f5] shadow-xs">
        {/* Search input */}
        <div className="relative md:col-span-6 flex flex-col justify-center">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher un produit, une marque, un tag..."
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-xs text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-3 focus:ring-blue-100 transition-all font-sans"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-all cursor-pointer"
                title="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          {/* Quick Search Tag Helpers */}
          {isSearchFocused && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1 animate-fade-in">
              <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider select-none">Populaire :</span>
              {['Téléphone', 'Robe', 'Chaussures', 'Casque', 'Audio', 'Gaming'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="text-[10px] font-extrabold text-[#2563eb] bg-blue-50/60 hover:bg-blue-100 hover:text-[#1d4ed8] px-2.5 py-0.5 rounded-full transition-all cursor-pointer border border-blue-100/40"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Location selector */}
        <div className="md:col-span-6 flex flex-row items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 select-none">
            <MapPin size={14} className="text-blue-500 animate-bounce" />
            <span className="hidden sm:inline">Zone :</span>
          </div>

          <div className="grid grid-cols-2 gap-2 flex-1">
            <select
              className="py-2.5 px-3 border border-slate-200 rounded-xl bg-white text-[12px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
              value={selectedDept}
              onChange={e => handleDeptChange(e.target.value)}
            >
              <option value="">Département</option>
              {Object.keys(HAITIAN_ZONES).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              className="py-2.5 px-3 border border-slate-200 rounded-xl bg-white text-[12px] font-semibold text-slate-700 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              value={selectedCommune}
              onChange={e => setSelectedCommune(e.target.value)}
              disabled={!selectedDept}
            >
              <option value="">Commune</option>
              {selectedDept && HAITIAN_ZONES[selectedDept].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {!hasNoProductsForSelectedLocation ? (
        <>
          {/* Ventes Flash banner with countdown */}
          {isFlashActive && (
            <section 
              onClick={() => onNavigate('flash-sales')}
              className="cursor-pointer bg-gradient-to-r from-red-600 to-amber-500 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm hover:from-red-700 hover:to-amber-600 transition-all duration-300 transform active:scale-[0.995]"
            >
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="inline-flex items-center gap-1 text-sm font-black tracking-tight uppercase">
                  <Flame size={16} className="text-yellow-300 animate-pulse animate-bounce" /> Ventes Flash — Jusqu'à -50%
                </h3>
                <p className="text-xs text-white/90">Offres limitées sur des dizaines de produits phares (Cliquez pour voir tout à -50%).</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 border border-white/10 rounded-lg p-2 text-center min-w-[50px] shadow-inner">
                    <span className="block font-mono text-base font-extrabold leading-none">{timeLeft.hours.toString().padStart(2, '0')}</span>
                    <small className="text-[9px] text-white/70 font-bold uppercase tracking-wider">H</small>
                  </div>
                  <div className="bg-white/20 border border-white/10 rounded-lg p-2 text-center min-w-[50px] shadow-inner">
                    <span className="block font-mono text-base font-extrabold leading-none">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                    <small className="text-[9px] text-white/70 font-bold uppercase tracking-wider">Min</small>
                  </div>
                  <div className="bg-white/20 border border-white/10 rounded-lg p-2 text-center min-w-[50px] shadow-inner">
                    <span className="block font-mono text-base font-extrabold leading-none">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                    <small className="text-[9px] text-white/70 font-bold uppercase tracking-wider">Sec</small>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section Scrolls */}
          {loading ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-sm font-bold tracking-tight text-slate-800">Tendances & Mode</h2>
                <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Mode</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-3 pl-1 -ml-1 scrollbar-none">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="min-w-[145px] w-[145px] skeleton-card animate-pulse">
                    <div className="skeleton-image h-[100px] rounded-t-lg"></div>
                    <div className="skeleton-body gap-1.5 p-2.5">
                      <div className="skeleton-category h-[8px] w-1/2"></div>
                      <div className="skeleton-title h-[12px] w-[85%]"></div>
                      <div className="skeleton-price h-[10px] w-2/3 pb-1"></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            trendsProducts.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-sm font-bold tracking-tight text-slate-800">Tendances & Mode</h2>
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Mode</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-3 pl-1 -ml-1 scrollbar-none">
                  {trendsProducts.map(p => (
                    <ProductScrollCard key={p.id} product={p} rating={getProductRating(p)} onView={() => viewProduct(p)} onAdd={() => onAddToCart(p)} tauxUSD={tauxUSD} />
                  ))}
                </div>
              </section>
            )
          )}

          {/* Main Grid Catalogue Products */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h2 className="font-serif text-sm font-bold tracking-tight text-slate-800">
                {selectedCat ? `${selectedCat} - Catalogue` : 'Tous les produits disponibles'}
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                {loading ? 'Chargement...' : `${gridProducts.length} articles`}
              </span>
            </div>

            {!loading && popularProducts.length > 0 && (
              <div role="tablist" aria-label="Affichage du catalogue" className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {([['tous', 'Tous les produits'], ['populaires', 'Populaires & Vérifiés']] as const).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={activeTab === id} onClick={() => setHomeTab(id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer border transition-all ${activeTab === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-[#e2e8f0] hover:bg-slate-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                  <div key={i} className="skeleton-card bg-white rounded-xl overflow-hidden border border-slate-100">
                    <div className="skeleton-image h-[160px] sm:h-[180px]"></div>
                    <div className="skeleton-body p-3 flex flex-col gap-2">
                      <div className="skeleton-category h-[10px] w-[40%] rounded"></div>
                      <div className="skeleton-title h-[14px] w-[85%] rounded"></div>
                      <div className="skeleton-shop h-[10px] w-[55%] rounded"></div>
                      <div className="skeleton-price h-[16px] w-[45%] rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : gridProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {gridProducts.map((p, i) => (
                  <React.Fragment key={p.id}>
                    <ProductGridCard product={p} rating={getProductRating(p)} onView={() => viewProduct(p)} onAdd={() => onAddToCart(p)} tauxUSD={tauxUSD} />
                    {/* Mini carrousel « Super aubaines » glissé parmi les produits, après le 3e */}
                    {i === 2 && activeTab === 'tous' && discountProducts.length > 0 && (
                      <PromoCarouselCard products={discountProducts.slice(0, 6)} onView={viewProduct} tauxUSD={tauxUSD} />
                    )}
                  </React.Fragment>
                ))}
                {activeTab === 'tous' && gridProducts.length < 3 && discountProducts.length > 0 && (
                  <PromoCarouselCard products={discountProducts.slice(0, 6)} onView={viewProduct} tauxUSD={tauxUSD} />
                )}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                <span className="text-3xl"><EIcon name="Package" /></span>
                <h3 className="font-serif text-sm font-bold text-slate-700 mt-2">Aucun produit trouvé</h3>
                <p className="text-xs text-slate-400 mt-1">Essayez de retirer vos filtres de recherche ou de localisation.</p>
              </div>
            )}

            {hasMore && !loading && activeTab === 'tous' && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={onLoadMore}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-250 text-slate-700 hover:text-slate-900 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 border border-slate-200 hover:border-slate-300 active:scale-95 duration-200 cursor-pointer"
                >
                  <span>Voir plus de produits</span>
                  <Plus size={14} className="text-slate-500" />
                </button>
              </div>
            )}
          </section>

          {/* Hero Banner style with Premium Look - Re-positioned just above the footer */}
          <section className="relative bg-gradient-to-br from-[#0c1445] via-[#1e3a8a] to-[#0d9488] rounded-3xl p-6 sm:p-8 text-white overflow-hidden shadow-md mt-6">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-35" />
            <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial bg-cover hidden md:block opacity-10 pointer-events-none" />
            
            <div className="relative z-10 max-w-lg space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 border border-white/15 text-[10px] font-extrabold uppercase tracking-widest text-[#4fd1c5]">
                <Sparkles size={11} /> Marketplace active en Haïti
              </span>
              <h1 className="font-serif text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Achetez et vendez en toute <span className="text-teal-300">confiance</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans font-medium">
                Paiement sécurisé par séquestre et vérification de livraison par code QR unique. Vendre ou acheter localement n'a jamais été aussi sûr.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

/* Mini Scroll Card Inner Component */
const ProductScrollCard: React.FC<{ product: Product; rating: number | null; onView: () => void; onAdd: () => void; tauxUSD?: number }> = ({ product, rating, onView, onAdd, tauxUSD = 130 }) => {
  const isColor = product.image_url && product.image_url.startsWith('#') && product.image_url.length <= 7;
  return (
    <div className="flex-none w-[140px] bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs hover:border-blue-400 transition-all group flex flex-col justify-between">
      <div onClick={onView} className="cursor-pointer">
        {/* Colorful dynamic top image indicator */}
        <div 
          className="w-full aspect-square relative flex items-center justify-center select-none overflow-hidden bg-slate-50"
          style={{ background: isColor ? `linear-gradient(135deg, ${product.image_url}15, ${product.image_url}30)` : undefined }}
        >
          {isColor ? (
            <div className="w-8 h-8 rounded-full shadow-md border-2 border-white" style={{ backgroundColor: product.image_url }} />
          ) : product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.nom} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <span className="font-serif text-3xl"><EIcon name="Shirt" /></span>
          )}
          {product.oldPrice && (
            <span className="absolute top-2 left-2 bg-red-600 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
              Aubaine
            </span>
          )}
          {product.stock <= 0 && (
            <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
              Épuisé
            </div>
          )}
        </div>

        <div className="p-2.5">
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">{product.cat}</span>
          <h4 className="text-[11px] font-bold text-slate-800 leading-snug group-hover:text-blue-600 line-clamp-2 min-h-[30px]">
            {product.nom}
          </h4>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <div className="flex items-center gap-0.5 bg-amber-50 px-1 py-0.5 rounded text-[9px] text-amber-500 font-extrabold leading-none">
              <Star size={9} fill={rating === null ? 'none' : 'currentColor'} aria-label={rating === null ? 'Pas encore noté' : undefined} />
              {rating !== null && <span>{rating}</span>}
            </div>
            <div className="flex items-center gap-0.5 text-[9.5px] text-[#0d9488] font-bold truncate max-w-[85px]" title={product.vendeur}>
              <Store size={9} className="text-teal-600 shrink-0" />
              <span className="font-black text-teal-700 truncate">{product.vendeur}</span>
            </div>
            {(product.vendeurPlan === 'Pro Local' || product.vendeurPlan === 'Pro National' || String(product.vendeurPlan || '').toLowerCase().includes('pro')) && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[8px] font-extrabold border border-emerald-200 shrink-0">
                <EIcon name="Check" /> Vérifié
              </span>
            )}
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
          </div>
        </div>
      </div>

      <div className="p-2 pt-0 flex items-center justify-between gap-1 mt-auto">
        <div>
          <span className="font-mono text-xs font-extrabold text-[#2563eb]">
            {product.prix.toLocaleString('fr-FR')} <span className="text-[8px] font-sans font-medium text-slate-400">Gdes</span>
          </span>
          {product.oldPrice && product.oldPrice > product.prix && (
            <span className="block font-mono text-[9px] text-slate-400 line-through leading-none mt-0.5">
              {product.oldPrice.toLocaleString('fr-FR')} Gdes
            </span>
          )}
          <span className="block font-mono text-[9.5px] text-emerald-600 font-bold leading-none mt-0.5">
            ${(product.prix / tauxUSD).toFixed(2)} <span className="text-[7.5px] font-sans font-medium text-slate-400">USD</span>
          </span>
          {product.oldPrice && product.oldPrice > product.prix && (
            <span className="block font-mono text-[8px] text-slate-400 line-through leading-none mt-0.5">
              ${(product.oldPrice / tauxUSD).toFixed(2)}
            </span>
          )}
        </div>
        {product.stock > 0 && (
          <button
            onClick={onAdd}
            className="w-7 h-7 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center font-bold text-xs transition cursor-pointer"
            title="Ajouter au Panier"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// Mini carrousel de promotions, présenté comme une carte du catalogue (défilement automatique, points, glisser du doigt)
const PromoCarouselCard: React.FC<{ products: Product[]; onView: (p: Product) => void; tauxUSD: number }> = ({ products, onView, tauxUSD }) => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = React.useRef<number | null>(null);
  const n = products.length;
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (n < 2 || paused || reduce) return;
    const t = window.setInterval(() => setIdx(i => (i + 1) % n), 4000);
    return () => window.clearInterval(t);
  }, [n, paused, reduce]);
  useEffect(() => { if (idx >= n) setIdx(0); }, [n, idx]);

  const go = (d: number) => setIdx(i => (i + d + n) % n);
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border border-red-100 bg-gradient-to-b from-red-50 to-white shadow-xs"
      role="region" aria-roledescription="carrousel" aria-label="Super aubaines"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={e => { const x = touchX.current; touchX.current = null; setPaused(false); if (x !== null && n > 1) { const dx = e.changedTouches[0].clientX - x; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } }}
    >
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-red-600">Super aubaines</span>
        <span className="text-[9px] font-bold text-slate-400">{idx + 1}/{n}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {products.map((p, i) => {
            const isColor = !!p.image_url && p.image_url.startsWith('#');
            const pct = p.oldPrice && p.oldPrice > p.prix ? Math.round((1 - p.prix / p.oldPrice) * 100) : 0;
            return (
              <button key={p.id} type="button" onClick={() => onView(p)} aria-hidden={i !== idx} tabIndex={i === idx ? 0 : -1}
                className="flex w-full shrink-0 cursor-pointer flex-col text-left" aria-label={`${p.nom}, ${p.prix.toLocaleString('fr-FR')} HTG`}>
                <div className="relative mx-2 mt-1.5 aspect-square overflow-hidden rounded-lg bg-slate-100">
                  {isColor ? <div className="h-full w-full" style={{ backgroundColor: p.image_url }} />
                    : p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                    : <span className="flex h-full w-full items-center justify-center text-3xl"><EIcon name="Shirt" /></span>}
                  {pct > 0 && <span className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">-{pct}%</span>}
                </div>
                <div className="px-3 pb-2 pt-1.5">
                  <h4 className="line-clamp-1 text-xs font-bold text-slate-800">{p.nom}</h4>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="font-mono text-sm font-black text-[#2563eb]">{p.prix.toLocaleString('fr-FR')} <span className="font-sans text-[9px] font-medium text-slate-400">HTG</span></span>
                    {pct > 0 && <span className="font-mono text-[10px] text-slate-400 line-through">{(p.oldPrice as number).toLocaleString('fr-FR')}</span>}
                  </div>
                  <span className="font-mono text-[10px] font-extrabold text-emerald-600">${(p.prix / tauxUSD).toFixed(2)} <span className="font-sans font-medium text-slate-400">USD</span></span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {n > 1 && (
        <div className="flex justify-center gap-1.5 pb-2.5" role="tablist" aria-label="Choisir une aubaine">
          {products.map((p, i) => (
            <button key={p.id} role="tab" aria-selected={i === idx} aria-label={`Aubaine ${i + 1}`} onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-red-600' : 'w-1.5 bg-slate-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
};


/* Grid Card Inner Component */
export const ProductGridCard: React.FC<{ product: Product; rating: number | null; onView: () => void; onAdd: () => void; tauxUSD?: number }> = ({ product, rating, onView, onAdd, tauxUSD = 130 }) => {
  const isColor = product.image_url && product.image_url.startsWith('#') && product.image_url.length <= 7;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-blue-400 transition-all duration-300 group flex flex-col justify-between">
      <div onClick={onView} className="cursor-pointer">
        {/* Dynamic header representation */}
        <div 
          className="w-full aspect-square relative flex items-center justify-center select-none overflow-hidden bg-slate-50"
          style={{ background: isColor ? `linear-gradient(135deg, ${product.image_url}15, ${product.image_url}35)` : undefined }}
        >
          {isColor ? (
            <div className="w-12 h-12 rounded-xl shadow-lg border-4 border-white transform group-hover:scale-105 transition-all" style={{ backgroundColor: product.image_url }} />
          ) : product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.nom} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <span className="font-serif text-4xl"><EIcon name="Shirt" /></span>
          )}
          {product.oldPrice && (
            <span className="absolute top-2 left-2 bg-red-600 text-white font-extrabold text-[8px] px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
              Flash -{Math.round((1 - product.prix / product.oldPrice) * 100)}%
            </span>
          )}
          {product.stock <= 0 && (
            <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white text-[11px] font-bold uppercase tracking-wider backdrop-blur-xs">
              Épuisé
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{product.cat}</span>
            <span className="text-slate-200 text-[8px]">•</span>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">{product.caracteristiques['Origine'] || 'Haïti'}</span>
          </div>

          <h4 className="text-xs font-bold text-slate-800 leading-snug group-hover:text-blue-500 line-clamp-2 min-h-[32px]">
            {product.nom}
          </h4>

          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-500 font-bold">
            <div className="flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded">
              <Star size={10} fill={rating === null ? 'none' : 'currentColor'} aria-label={rating === null ? 'Pas encore noté' : undefined} />
              {rating !== null && <span>{rating}</span>}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">|</span>
              <div className="flex items-center gap-0.5 text-teal-700 font-black text-[10px] truncate max-w-[120px]" title={product.vendeur}>
                <Store size={10} className="text-teal-600 shrink-0" />
                <span className="truncate">{product.vendeur}</span>
              </div>
              {(product.vendeurPlan === 'Pro Local' || product.vendeurPlan === 'Pro National' || String(product.vendeurPlan || '').toLowerCase().includes('pro')) && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[8px] font-extrabold border border-emerald-200 shrink-0">
                  <EIcon name="Check" /> Vérifié
                </span>
              )}
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
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 pt-0 flex items-center justify-between gap-2 mt-auto border-t border-slate-50">
        <div>
          <span className="font-mono text-sm font-black text-[#2563eb]">
            {product.prix.toLocaleString('fr-FR')} <span className="text-[9px] font-sans font-medium text-slate-400">HTG</span>
          </span>
          {product.oldPrice && product.oldPrice > product.prix && (
            <span className="block font-mono text-[10px] text-slate-400 line-through leading-none mt-1">
              {product.oldPrice.toLocaleString('fr-FR')} HTG
            </span>
          )}
          <span className="block font-mono text-xs text-emerald-600 font-extrabold leading-none mt-1">
            ${(product.prix / tauxUSD).toFixed(2)} <span className="text-[9px] font-sans font-medium text-slate-400">USD</span>
          </span>
          {product.oldPrice && product.oldPrice > product.prix && (
            <span className="block font-mono text-[9px] text-slate-400 line-through leading-none mt-1">
              ${(product.oldPrice / tauxUSD).toFixed(2)} USD
            </span>
          )}
        </div>
        
        {product.stock > 0 && (
          <button
            onClick={onAdd}
            className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center font-bold text-xs transition cursor-pointer shadow-xs"
            title="Ajouter au Panier"
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
