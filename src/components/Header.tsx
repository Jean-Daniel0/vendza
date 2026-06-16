import React from 'react';
import { ShoppingBag, User, Store, LogOut, Menu, UserCheck, MessageSquare } from 'lucide-react';
import { UserProfile, CartItem } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  cart: CartItem[];
  unreadMsgsCount: number;
  onNavigate: (view: string) => void;
  onToggleDrawer: () => void;
  currentView: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  cart,
  unreadMsgsCount,
  onNavigate,
  onToggleDrawer,
  currentView
}) => {
  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#e2e8f0] h-[66px] flex items-center transition-all duration-300">
      <nav className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Left section: Drawer trigger + Logo */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDrawer}
            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0c1445] transition-all cursor-pointer"
            aria-label="Ouvrir le menu"
          >
            <Menu size={18} />
          </button>
          
          <div 
            onClick={() => onNavigate('home')} 
            className="flex items-center cursor-pointer select-none ml-2"
          >
            <span className="text-xl font-extrabold text-[#2563eb] tracking-tight font-sans">
              Vend<span className="text-[#0d9488]">za</span>
            </span>
          </div>
        </div>

        {/* Center label of active space */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {currentView === 'home' && 'Marché public'}
            {currentView === 'detail' && 'Fiche produit'}
            {currentView === 'cart' && 'Mon Panier'}
            {currentView === 'client-dashboard' && 'Espace Client'}
            {currentView === 'vendor-dashboard' && 'Espace Boutique'}
            {currentView === 'shop-settings' && 'Boutique & Profil'}
            {currentView === 'inbox' && 'Messagerie instantanée'}
            {currentView === 'subscription' && 'Plan Vendeur'}
            {currentView === 'create-product' && 'Ajout Catalogue'}
            {currentView === 'scanner' && 'Scanner Validation'}
            {currentView === 'auth' && 'Zone d\'accès'}
          </span>
        </div>

        {/* Right section: Instant view links + Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Messages instant review trigger */}
          {user && (
            <button
              onClick={() => onNavigate('inbox')}
              className={`relative p-2 rounded-xl transition-all border cursor-pointer ${
                currentView === 'inbox' 
                  ? 'bg-teal-50 border-teal-200 text-teal-600 font-bold' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <MessageSquare size={17} />
              {unreadMsgsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full flex items-center justify-content shadow-sm scale-95 border border-white">
                  {unreadMsgsCount}
                </span>
              )}
            </button>
          )}

          {/* Cart item trigger */}
          <button
            onClick={() => onNavigate('cart')}
            className={`relative p-2 rounded-xl transition-all border cursor-pointer ${
              currentView === 'cart'
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-blue-50/50 hover:bg-blue-50 border-blue-100 text-blue-600'
            }`}
          >
            <ShoppingBag size={17} />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#2563eb] text-white text-[9px] font-bold rounded-full flex items-center justify-content shadow-sm scale-95 border border-white">
                {cartItemsCount}
              </span>
            )}
          </button>

          {/* User authentication trigger */}
          {user ? (
            <button
              onClick={() => onNavigate(user.userType === 'vendeur' ? 'vendor-dashboard' : 'client-dashboard')}
              className={`flex items-center gap-1.5 p-1 px-2.5 rounded-xl border transition-all cursor-pointer ${
                user.userType === 'vendeur'
                  ? 'bg-teal-50/50 hover:bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt="Avatar" 
                  className="w-6 h-6 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-teal-500 text-white font-black text-[10px] flex items-center justify-center uppercase shadow-sm border border-white">
                  {user.prenom 
                    ? user.prenom.charAt(0).toUpperCase() 
                    : (user.email ? user.email.charAt(0).toUpperCase() : 'U')
                  }
                </div>
              )}
              <span className="hidden sm:inline text-xs font-bold font-sans">
                {user.userType === 'vendeur' && user.shopName ? user.shopName : `${user.prenom} ${user.nom[0]}.`}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('auth')}
              className="flex items-center gap-1.5 p-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              <User size={14} />
              <span>Connexion</span>
            </button>
          )}
        </div>
      </nav>
    </header>
  );
};
