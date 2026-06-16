import React from 'react';
import { 
  Home, ShoppingBag, Receipt, ShieldCheck, 
  LayoutDashboard, Package, FolderPlus, CreditCard, 
  MessageSquare, User2, LogIn, LogOut, X, MapPin, 
  TrendingUp, RefreshCw, Store, Database, HelpCircle
} from 'lucide-react';
import { UserProfile, CartItem } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  cart: CartItem[];
  unreadMsgsCount: number;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  onQuickClientLogin: () => void;
  onQuickVendorLogin: () => void;
  currentView: string;
  onUpdateProfile?: (updates: Partial<UserProfile>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  user,
  cart,
  unreadMsgsCount,
  onNavigate,
  onLogout,
  onQuickClientLogin,
  onQuickVendorLogin,
  currentView,
  onUpdateProfile
}) => {
  const currentPlan = user?.plan || 'Aucun';

  const menuClick = (view: string) => {
    onNavigate(view);
    onClose();
  };

  return (
    <>
      {/* Drawer Overlay */}
      <div 
        className={`fixed inset-0 z-50 bg-[#0c1445]/40 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-55 w-[290px] max-w-[85vw] bg-white transition-transform duration-350 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col h-full max-h-screen overflow-hidden shadow-2xl border-r border-[#e4e9f5] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header containing User Metadata */}
        <div className="relative bg-gradient-to-br from-[#0c1445] via-[#1e3a8a] to-[#0d9488] p-5 pt-8 text-white shrink-0 overflow-hidden">
          {/* Wave/Mesh background style */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-40 pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-teal-500/20 blur-xl rounded-full" />
          
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/25 text-white transition cursor-pointer"
            aria-label="Fermer le menu"
          >
            <X size={15} />
          </button>

          {user ? (
            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/15 border-2 border-white/20 overflow-hidden flex items-center justify-center shadow-inner">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="font-serif text-xl font-bold text-teal-300">
                      {user.prenom 
                        ? user.prenom.charAt(0).toUpperCase() 
                        : (user.email ? user.email.charAt(0).toUpperCase() : 'U')
                      }
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif text-base font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                    <span>{user.prenom} {user.nom}</span>
                    {user.userType === 'vendeur' && user.plan === 'Pro Local' && (
                      <span className="inline-flex items-center shrink-0" title="Vendeur Vérifié (Pro Local)">
                        <svg className="w-4 h-4 text-blue-400 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </span>
                    )}
                    {user.userType === 'vendeur' && user.plan === 'Pro National' && (
                      <span className="inline-flex items-center shrink-0" title="Vendeur Vérifié (Pro National)">
                        <svg className="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </span>
                    )}
                  </h3>
                  {user.userType === 'vendeur' && user.shopName && (
                    <p className="text-[11px] text-teal-300 font-bold truncate">🏪 {user.shopName}</p>
                  )}
                  <p className="text-[11px] text-slate-300 truncate">{user.email}</p>
                </div>
              </div>

              {/* Badges strip */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="text-[9px] font-bold tracking-wider uppercase bg-white/15 px-2 py-0.5 rounded-full border border-white/10 text-white/95">
                  {user.userType === 'vendeur' ? '🏪 Vendeur' : '🛍️ Client'}
                </span>
                
                {user.userType === 'vendeur' && (
                  <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border ${
                    user.plan === 'Pro National' 
                      ? 'bg-amber-400/90 text-amber-950 border-amber-300/80 font-black' 
                      : user.plan === 'Pro Local' 
                        ? 'bg-blue-400/90 text-blue-950 border-blue-300/80' 
                        : 'bg-white/10 text-slate-100 border-white/5'
                  }`}>
                    ★ {user.plan}
                  </span>
                )}

                <span className="text-[9px] font-bold tracking-wider uppercase bg-emerald-500/25 border border-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <MapPin size={8} /> {user.commune}
                </span>
              </div>

              {onUpdateProfile && (
                <div className="mt-2 pt-1 border-t border-white/10">
                  {user.shopName ? (
                    <button
                      onClick={() => {
                        const targetMode = user.userType === 'vendeur' ? 'client' : 'vendeur';
                        onUpdateProfile({ 
                          userType: targetMode
                        });
                        menuClick(targetMode === 'vendeur' ? 'vendor-dashboard' : 'home');
                      }}
                      className="w-full text-left text-[10px] font-bold tracking-wide bg-gradient-to-r from-teal-500/20 to-blue-500/20 hover:from-teal-500/35 hover:to-blue-500/35 border border-teal-300/30 text-teal-300 hover:text-white px-2.5 py-2 rounded-lg transition-all cursor-pointer backdrop-blur-xs flex items-center justify-center gap-1.5"
                    >
                      <span>🔄 {user.userType === 'vendeur' ? 'Mode Client 🛍️' : 'Mode Vendeur 🏪'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        menuClick('become-seller');
                      }}
                      className="w-full text-left text-[10px] font-bold tracking-wide bg-teal-400/20 hover:bg-teal-400/35 border border-teal-300/30 text-teal-300 hover:text-white px-2.5 py-2 rounded-lg transition-all cursor-pointer backdrop-blur-xs flex items-center justify-center gap-1"
                    >
                      <span>Devenir Vendeur 🏪</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="relative z-10 flex flex-col gap-2">
              <div className="text-sm font-semibold tracking-wider text-teal-300 uppercase">Bienvenue sur Vendza</div>
              <h3 className="font-serif text-base font-bold text-white tracking-tight">Accès visiteur anonyme</h3>
              <p className="text-[11px] text-slate-300 leading-normal">Inscrivez-vous pour commander ou mettre en vente vos articles.</p>
            </div>
          )}
        </div>

        {/* Section Navigation Items */}
        <div className="flex-grow flex-1 overflow-y-auto py-3 divide-y divide-slate-100 scrollbar-thin">
          {/* Main Navigation Section */}
          <div className="px-2 pb-3">
            <div className="text-[9px] font-bold tracking-widest text-[#9aa3bf] uppercase px-3 mb-1.5">Marché</div>
            <button
              onClick={() => menuClick('home')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                currentView === 'home' 
                  ? 'bg-blue-50 text-blue-600 font-bold' 
                  : 'text-[#5a6480] hover:bg-slate-50'
              }`}
            >
              <Home size={15} className={currentView === 'home' ? 'text-blue-600' : 'text-slate-400'} />
              <span>Marché principal</span>
            </button>

            <button
              onClick={() => menuClick('cart')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                currentView === 'cart' 
                  ? 'bg-blue-50 text-blue-600 font-bold' 
                  : 'text-[#5a6480] hover:bg-slate-50'
              }`}
            >
              <ShoppingBag size={15} className={currentView === 'cart' ? 'text-blue-600' : 'text-slate-400'} />
              <span>Mon panier</span>
              {cart.length > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              )}
            </button>

            {user && (
              <button
                onClick={() => menuClick('inbox')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                  currentView === 'inbox' 
                    ? 'bg-teal-50 text-teal-700 font-bold' 
                    : 'text-[#5a6480] hover:bg-slate-50'
                }`}
              >
                <MessageSquare size={15} className={currentView === 'inbox' ? 'text-teal-600' : 'text-slate-400'} />
                <span>Messagerie</span>
                {unreadMsgsCount > 0 && (
                  <span className="ml-auto bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadMsgsCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => menuClick('about')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                currentView === 'about' 
                  ? 'bg-emerald-50 text-emerald-700 font-bold' 
                  : 'text-[#5a6480] hover:bg-slate-50'
              }`}
            >
              <HelpCircle size={15} className={currentView === 'about' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>À propos de Vendza</span>
            </button>

            <button
              onClick={() => menuClick('terms')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                currentView === 'terms' 
                  ? 'bg-blue-50 text-blue-700 font-bold' 
                  : 'text-[#5a6480] hover:bg-slate-50'
              }`}
            >
              <ShieldCheck size={15} className={currentView === 'terms' ? 'text-blue-600' : 'text-slate-400'} />
              <span>Conditions d'utilisation</span>
            </button>

            <button
              onClick={() => menuClick('privacy')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                currentView === 'privacy' 
                  ? 'bg-[#e0f2fe] text-[#0369a1] font-bold' 
                  : 'text-[#5a6480] hover:bg-slate-50'
              }`}
            >
              <ShieldCheck size={15} className={currentView === 'privacy' ? 'text-[#0284c7]' : 'text-slate-400'} />
              <span>Confidentialité & Politiques</span>
            </button>
          </div>

          {/* Client Navigation Section */}
          {user && user.userType === 'client' && (
            <div className="px-2 py-3">
              <div className="text-[9px] font-bold tracking-widest text-[#9aa3bf] uppercase px-3 mb-1.5">Mon Espace Client</div>
              <button
                onClick={() => user ? menuClick('client-dashboard') : menuClick('auth')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                  currentView === 'client-dashboard' 
                    ? 'bg-blue-50 text-blue-600 font-bold' 
                    : 'text-[#5a6480] hover:bg-slate-50'
                }`}
              >
                <User2 size={15} className={currentView === 'client-dashboard' ? 'text-blue-600' : 'text-slate-400'} />
                <span>Mon profil client</span>
              </button>

              <button
                onClick={() => user ? menuClick('client-dashboard') : menuClick('auth')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide text-[#5a6480] hover:bg-slate-50 cursor-pointer"
              >
                <Receipt size={15} className="text-slate-400" />
                <span>Mes achats</span>
              </button>

              <button
                onClick={() => menuClick('scanner')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                  currentView === 'scanner' 
                    ? 'bg-emerald-50 text-emerald-700 font-bold' 
                    : 'text-[#5a6480] hover:bg-slate-50'
                }`}
              >
                <ShieldCheck size={15} className={currentView === 'scanner' ? 'text-emerald-600' : 'text-slate-400'} />
                <span>Valider livraison (Scan)</span>
              </button>
            </div>
          )}

          {/* Vendeur Navigation Section */}
          {user?.userType === 'vendeur' && (
            <div className="px-2 py-3">
              <div className="text-[9px] font-bold tracking-widest text-[#9aa3bf] uppercase px-3 mb-1.5">Ma Boutique</div>
              <button
                onClick={() => menuClick('vendor-dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                  currentView === 'vendor-dashboard' 
                    ? 'bg-teal-50 text-teal-700 font-bold' 
                    : 'text-[#5a6480] hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard size={15} className={currentView === 'vendor-dashboard' ? 'text-teal-600' : 'text-slate-400'} />
                <span>Tableau de bord</span>
              </button>

              <button
                onClick={() => menuClick('shop-settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                  currentView === 'shop-settings' 
                    ? 'bg-teal-50 text-teal-700 font-bold' 
                    : 'text-[#5a6480] hover:bg-slate-50'
                }`}
              >
                <Store size={15} className={currentView === 'shop-settings' ? 'text-teal-600' : 'text-slate-400'} />
                <span>Boutique &amp; Profil</span>
              </button>

              <button
                onClick={() => menuClick('create-product')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                  currentView === 'create-product' 
                    ? 'bg-teal-50 text-teal-700 font-bold' 
                    : 'text-[#5a6480] hover:bg-slate-50'
                }`}
              >
                <FolderPlus size={15} className={currentView === 'create-product' ? 'text-teal-600' : 'text-slate-400'} />
                <span>Créer un produit</span>
              </button>

              <button
                onClick={() => menuClick('subscription')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                  currentView === 'subscription' 
                    ? 'bg-teal-50 text-teal-700 font-bold' 
                    : 'text-[#5a6480] hover:bg-slate-50'
                }`}
              >
                <CreditCard size={15} className={currentView === 'subscription' ? 'text-teal-600' : 'text-slate-400'} />
                <span>Abonnement & plans</span>
              </button>

              <button
                onClick={() => menuClick('client-dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                  currentView === 'client-dashboard' 
                    ? 'bg-blue-50 text-blue-600 font-bold' 
                    : 'text-[#5a6480] hover:bg-slate-50'
                }`}
              >
                <User2 size={15} className={currentView === 'client-dashboard' ? 'text-blue-600' : 'text-slate-400'} />
                <span>Espace Client (Mes achats)</span>
              </button>
            </div>
          )}
        </div>

        {/* Global Footer inside Sidebar */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 shrink-0">
          {user ? (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition cursor-pointer"
            >
              <LogOut size={14} /> Déconnexion
            </button>
          ) : (
            <button
              onClick={() => menuClick('auth')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
            >
              <LogIn size={14} /> Espace Connexion / Inscription
            </button>
          )}

          <div className="text-[9px] text-[#9aa3bf] text-center mt-3 font-medium">
            © 2026 <strong>Vendza S.A.</strong> · Port-au-Prince, Haïti
          </div>
        </div>
      </aside>
    </>
  );
};
