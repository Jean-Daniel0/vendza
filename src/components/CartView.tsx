import React, { useState } from 'react';
import { ShoppingBag, MapPin, Tag, ArrowRight, Home, Trash2, ShieldCheck, Ticket, CreditCard, Smartphone } from 'lucide-react';
import { CartItem, UserProfile, Product, Order } from '../types';
import { HAITIAN_ZONES } from '../data';

interface CartViewProps {
  cart: CartItem[];
  user: UserProfile | null;
  onNavigate: (view: string) => void;
  onUpdateCartItemQty: (productId: string, qty: number) => void;
  onRemoveCartItem: (productId: string) => void;
  onClearCart: () => void;
  onPlaceOrder: (order: Omit<Order, 'id' | 'date' | 'heure' | 'status'>, paymentMethod: 'stripe' | 'moncash') => void;
  products: Product[];
  onSetProduct: (product: Product) => void;
  tauxUSD?: number;
}

export const CartView: React.FC<CartViewProps> = ({
  cart,
  user,
  onNavigate,
  onUpdateCartItemQty,
  onRemoveCartItem,
  onClearCart,
  onPlaceOrder,
  products,
  onSetProduct,
  tauxUSD = 130
}) => {
  const [selectedDept, setSelectedDept] = useState<string>(user?.departement || '');
  const [selectedCommune, setSelectedCommune] = useState<string>(user?.commune || '');
  const [promoCode, setPromoCode] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [promoError, setPromoError] = useState<string>('');
  const [promoSuccess, setPromoSuccess] = useState<string>('');

  const cartTotalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
  
  // Calculate raw subtotal
  const subtotal = cart.reduce((acc, item) => acc + item.product.prix * item.quantity, 0);

  // Delivery criteria
  const getShippingFee = () => {
    if (!selectedCommune) return 0;
    const freeCapitalCommunes = ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Carrefour'];
    return freeCapitalCommunes.includes(selectedCommune) ? 0 : 200;
  };
  const shippingFee = getShippingFee();

  // Promo validating list
  const applyPromo = () => {
    setPromoError('');
    setPromoSuccess('');
    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'VENDZA10') {
      setDiscountPercent(10);
      setPromoSuccess('🏷️ Code VENDZA10 (10% de réduction) appliqué !');
    } else if (code === 'BIENVENUE') {
      setDiscountPercent(15);
      setPromoSuccess('🎉 Code BIENVENUE (15% de réduction) appliqué !');
    } else if (code === 'HAITI20') {
      setDiscountPercent(20);
      setPromoSuccess('🇭🇹 Code HAITI20 (20% de réduction) appliqué !');
    } else {
      setPromoError('✕ Code invalide ou expiré.');
      setDiscountPercent(0);
    }
  };

  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const finalTotal = subtotal + shippingFee - discountAmount;

  // Handle order checkout
  const handleCheckout = (paymentMethod: 'stripe' | 'moncash') => {
    if (cart.length === 0) return;
    if (!selectedDept || !selectedCommune) {
      alert('Veuillez renseigner votre Département et Commune pour la livraison.');
      return;
    }
    if (!user) {
      alert('Veuillez vous connecter pour procéder au paiement de votre commande.');
      onNavigate('auth');
      return;
    }

    onPlaceOrder({
      clientId: user.id,
      clientNom: `${user.prenom} ${user.nom}`,
      clientTel: user.tel,
      items: cart.map(item => ({
        productId: item.product.id,
        productNom: item.product.nom,
        prix: item.product.prix,
        qte: item.quantity,
        couleur: item.selectedColor,
        taille: item.selectedSize,
        vendeurId: item.product.vendeurId
      })),
      fraisLivraison: shippingFee,
      discount: discountAmount,
      total: finalTotal,
      departement: selectedDept,
      commune: selectedCommune
    }, paymentMethod);
  };

  // Abstract similar item suggestions
  const suggestedProducts = products.filter(p => !cart.some(item => item.product.id === p.id)).slice(0, 3);

  const viewProduct = (p: Product) => {
    onSetProduct(p);
    onNavigate('detail');
  };

  return (
    <div className="space-y-6">
      {/* Back link heading */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h1 className="font-serif text-lg font-bold tracking-tight text-slate-800">
          Mon Panier d'Achats <span className="ml-2 bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">{cartTotalQty} articles</span>
        </h1>
        <button
          onClick={() => onNavigate('home')}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          ← Poursuivre mes achats
        </button>
      </div>

      {cart.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Left panel: List items */}
          <div className="md:col-span-8 space-y-3.5">
            <div className="space-y-3.5">
              {cart.map(item => (
                <div 
                  key={`${item.product.id}-${item.selectedColor}-${item.selectedSize}`}
                  className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-row items-stretch"
                >
                  <div 
                    className="w-24 sm:w-28 flex-shrink-0 flex items-center justify-center select-none overflow-hidden bg-slate-50 relative"
                  >
                    {item.product.image_url && !item.product.image_url.startsWith('#') ? (
                      <img 
                        src={item.product.image_url} 
                        alt={item.product.nom} 
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => viewProduct(item.product)}
                        referrerPolicy="no-referrer"
                      />
                    ) : item.selectedColor ? (
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${item.selectedColor}12, ${item.selectedColor}33)` }}
                      >
                        <div className="w-9 h-9 rounded-lg shadow-sm border border-white" style={{ backgroundColor: item.selectedColor }} />
                      </div>
                    ) : (
                      <span className="font-serif text-3xl">👜</span>
                    )}
                  </div>

                  <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                            {item.product.nom}
                          </h3>
                          <p className="text-[10px] text-teal-600 font-bold mt-0.5">Vendu par {item.product.vendeur}</p>
                        </div>
                        <button
                          onClick={() => onRemoveCartItem(item.product.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all flex-shrink-0 cursor-pointer"
                          title="Retirer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Display variants badges if selected */}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.selectedColor && (
                          <span className="text-[9px] font-black text-[#5a6480] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            🎨 Couleur select
                          </span>
                        )}
                        {item.selectedSize && (
                          <span className="text-[9px] font-black text-[#5a6400] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            📐 Taille {item.selectedSize}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 mt-3 pt-2.5 border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-semibold text-[#2563eb]">
                          {item.product.prix * item.quantity} <span className="text-[9px] font-sans font-medium text-slate-400">Gdes</span>
                        </span>
                        <span className="font-mono text-[10.5px] text-slate-500 font-medium leading-none mt-1">
                          {((item.product.prix * item.quantity) / tauxUSD).toFixed(2)} $ USD
                        </span>
                      </div>

                      {/* Mini Qty mod */}
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white scale-95-all">
                        <button
                          type="button"
                          onClick={() => onUpdateCartItemQty(item.product.id, -1)}
                          className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-mono text-xs font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateCartItemQty(item.product.id, 1)}
                          className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onClearCart}
              className="px-3.5 py-1.5 rounded-lg border border-red-200 hover:border-red-300 text-red-600 hover:bg-red-50 text-[10px] font-extrabold uppercase tracking-widest cursor-pointer"
            >
              🗑️ Vider le panier
            </button>
          </div>

          {/* Right panel: Recap calculations & Delivery Address */}
          <div className="md:col-span-4 space-y-4">
            {/* Delivery address setup */}
            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <MapPin size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Lieu de livraison</h3>
                  <p className="text-[10px] text-slate-400">Tarification locale de messagerie</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <select
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  value={selectedDept}
                  onChange={e => {
                    setSelectedDept(e.target.value);
                    setSelectedCommune('');
                  }}
                >
                  <option value="">Sélectionner le département…</option>
                  {Object.keys(HAITIAN_ZONES).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer disabled:opacity-55"
                  value={selectedCommune}
                  onChange={e => setSelectedCommune(e.target.value)}
                  disabled={!selectedDept}
                >
                  <option value="">Sélectionner la commune…</option>
                  {selectedDept && HAITIAN_ZONES[selectedDept].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {selectedCommune && (
                <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 flex items-center gap-1.5 text-[10px] font-bold text-teal-700">
                  <ShieldCheck size={13} />
                  <span>
                    {shippingFee === 0 
                      ? 'Livraison Port-au-Prince / Pétion-Ville gratuite !' 
                      : `Livraison régionale : +200 Gourdes`}
                  </span>
                </div>
              )}
            </div>

            {/* Promo card */}
            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs space-y-2.5">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                <Tag size={13} className="text-blue-500" /> Code Promotionnel
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: VENDZA10, HAITI20"
                  className="flex-1 py-2 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-600 uppercase"
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value)}
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  className="py-2 px-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Appliquer
                </button>
              </div>
              {promoError && <p className="text-[10px] text-red-600 font-bold">{promoError}</p>}
              {promoSuccess && <p className="text-[10px] text-emerald-600 font-bold">{promoSuccess}</p>}
            </div>

            {/* Price calculation sheet summary */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-4">
              <h3 className="font-serif text-sm font-bold text-slate-800">Recap total de commande</h3>
              
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Sous-total articles</span>
                  <div className="text-right">
                    <span className="font-mono block font-semibold">{subtotal} Gdes</span>
                    <span className="font-mono text-[10px] text-slate-400">{(subtotal / tauxUSD).toFixed(2)} $ USD</span>
                  </div>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Frais de livraison</span>
                  <div className="text-right">
                    <span className="font-mono block font-semibold">{shippingFee ? `${shippingFee} Gdes` : 'Gratuit'}</span>
                    {shippingFee > 0 && (
                      <span className="font-mono text-[10px] text-slate-400">{(shippingFee / tauxUSD).toFixed(2)} $ USD</span>
                    )}
                  </div>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Deduction coupon</span>
                    <div className="text-right">
                      <span className="font-mono block font-semibold">-{discountAmount} Gdes ({discountPercent}%)</span>
                      <span className="font-mono text-[10px] text-emerald-500">-{(discountAmount / tauxUSD).toFixed(2)} $ USD</span>
                    </div>
                  </div>
                )}
                
                <div className="h-px bg-slate-100" />

                <div className="flex justify-between items-start pt-1">
                  <span className="text-sm font-extrabold text-slate-800 self-center">Montant total</span>
                  <div className="text-right">
                    <span className="font-mono text-base font-extrabold text-blue-600 block">{finalTotal} HTG</span>
                    <span className="font-mono text-xs font-bold text-slate-500">{(finalTotal / tauxUSD).toFixed(2)} $ USD</span>
                  </div>
                </div>
              </div>

               {/* General security guarantees badge */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-[9px] font-black tracking-widest text-[#0d9488] uppercase">
                  <Ticket size={11} /> Paiement Sécurisé Garanti
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">Fonds gardés en sécurité par Vendza. Libération automatique uniquement après validation QR à la réception.</p>
              </div>

              {/* Checkout CTA */}
              <div className="payment-options pt-1 w-full space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleCheckout('moncash')}
                  className="w-full inline-flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-[#cc0612] hover:bg-[#b0050f] hover:opacity-95 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:scale-[1.01]"
                >
                  <Smartphone size={15} />
                  Payer avec MonCash
                </button>
                <div className="flex items-center justify-center gap-2 my-2 text-slate-300 select-none">
                  <div className="h-px bg-slate-100 flex-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ou</span>
                  <div className="h-px bg-slate-100 flex-1" />
                </div>
                <button
                  type="button"
                  onClick={() => handleCheckout('stripe')}
                  className="w-full inline-flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#635bff] hover:opacity-95 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:scale-[1.01]"
                >
                  <CreditCard size={15} />
                  Payer par carte
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 shadow-xs max-w-lg mx-auto">
          <span className="text-5xl block animate-bounce mb-3">🛒</span>
          <h2 className="font-serif text-sm font-bold text-slate-800">Votre panier est vide !</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mt-2 leading-relaxed">
            Consultez les différents départements, ajoutez des articles à votre panier, et commencez vos emplettes sécurisées en Haïti.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="mt-6 inline-flex items-center gap-2 py-2 px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Home size={14} /> Voir le catalogue
          </button>
        </div>
      )}

      {/* Suggested items carousel for shopping cart */}
      {suggestedProducts.length > 0 && (
        <div className="pt-6 border-t border-slate-100">
          <h3 className="font-serif text-xs font-bold text-slate-800 uppercase tracking-wider mb-3.5">
            Vous pourriez aussi aimer
          </h3>
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 pl-1 -ml-1">
            {suggestedProducts.map(p => (
              <a 
                onClick={() => viewProduct(p)} 
                key={p.id} 
                className="flex-none w-[130px] bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div 
                  className="w-full aspect-square flex items-center justify-center select-none bg-slate-50 relative overflow-hidden"
                >
                  {p.image_url && !p.image_url.startsWith('#') ? (
                    <img 
                      src={p.image_url} 
                      alt={p.nom} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : p.image_url ? (
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${p.image_url}12, ${p.image_url}22)` }}
                    >
                      <div className="w-7 h-7 rounded-lg shadow-sm border border-white" style={{ backgroundColor: p.image_url }} />
                    </div>
                  ) : (
                    <span className="font-serif text-2xl">🛍️</span>
                  )}
                </div>
                <div className="p-2">
                  <h4 className="text-[10px] font-bold text-slate-800 line-clamp-2 min-h-[30px]">{p.nom}</h4>
                  <span className="block font-mono text-[11px] font-extrabold text-blue-600 mt-1">{p.prix} Gdes</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
