import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Printer, ShieldCheck, Tag, Info, 
  MapPin, User, Calendar, Check, Send, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Order, UserProfile } from '../types';
import { QRCodeRenderer } from './QRCodeRenderer';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface TicketDetailViewProps {
  order: Order;
  user: UserProfile | null;
  onBack: () => void;
  onConfirmDelivery?: (orderId: string) => void;
  onNavigate?: (view: string) => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  order,
  user,
  onBack,
  onConfirmDelivery,
  onNavigate
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [clientProfil, setClientProfil] = useState<any>(null);
  const [vendeurProfil, setVendeurProfil] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isBuyer = user?.id === order.clientId;
  const isVendor = !isBuyer;

  useEffect(() => {
    async function loadProfiles() {
      if (!isSupabaseConfigured || !supabase) return;
      setLoading(true);
      try {
        const buyerId = order.clientId || (order as any).buyer_id;
        if (buyerId) {
          const { data: clientData, error: clientErr } = await supabase
            .from('profiles')
            .select('prenom, nom, telephone, avatar_url')
            .eq('id', buyerId)
            .single();
          if (!clientErr && clientData) {
            setClientProfil(clientData);
          }
        }

        const vendorId = (order as any).vendor_id || order.items[0]?.vendeurId;
        if (vendorId) {
          const { data: vendorData, error: vendorErr } = await supabase
            .from('profiles')
            .select('prenom, nom, telephone')
            .eq('id', vendorId)
            .single();
          if (!vendorErr && vendorData) {
            setVendeurProfil(vendorData);
          }
        }
      } catch (err) {
        console.error("Error loading profiles for ticket:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfiles();
  }, [order.id, order.clientId, order.items]);

  const nomClient = clientProfil?.prenom 
    ? `${clientProfil.prenom} ${clientProfil.nom || ''}`.trim()
    : (order.clientNom || 'Client');

  const telClient = clientProfil?.telephone 
    || order.clientTel
    || 'Non renseigné';

  const nomVendeur = vendeurProfil?.prenom
    ? `${vendeurProfil.prenom} ${vendeurProfil.nom || ''}`.trim()
    : 'Vendeur';

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    window.print();
  };

  const handleReleaseFunds = async () => {
    if (!onConfirmDelivery) return;
    setIsConfirming(true);
    try {
      await onConfirmDelivery(order.id);
      setActionMessage('✓ Succès! Les fonds ont été reversés sur le portefeuille du marchand.');
    } catch (e: any) {
      setActionMessage(`Erreur: ${e.message || 'Impossible de valider la livraison'}`);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-sans">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="fixed bottom-5 right-5 z-60 bg-blue-900 border border-teal-500 text-teal-300 font-bold text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <ShieldCheck size={14} className="text-teal-400" strokeWidth={3} />
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage('')} className="ml-2 hover:text-white shrink-0">✕</button>
        </div>
      )}

      {/* Primary Header/Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-150 pb-5 gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2 py-1.5 bg-[#f1f5f9] hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-black tracking-wide transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-3xs"
          >
            <ArrowLeft size={13} strokeWidth={2.5} />
            <span>RETOUR</span>
          </button>
          
          <div className="h-5 w-px bg-slate-200" />
          
          <div>
            <h1 className="font-serif text-lg sm:text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              🎫 Billet de Garde & Reçu Officiel
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">
              Plateforme Mandataire Séquestre Vendza
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200 shadow-3xs"
          >
            <Printer size={13} strokeWidth={2.5} />
            <span>Imprimer</span>
          </button>
          <button
            onClick={onBack}
            className="text-[10px] uppercase font-black px-4 py-3 text-white bg-[#0c1445] rounded-xl hover:bg-[#1a255c] transition text-center border border-slate-900 cursor-pointer shadow-sm"
          >
            Fermer l'onglet
          </button>
        </div>
      </div>

      {/* Main Page Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* LEFT COLUMN: The Physical Style Ticket Receipt */}
        <div className="lg:col-span-7 space-y-4 print:col-span-12">
          <div 
            id="printable-ticket" 
            className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden relative"
          >
            {/* Elegant Header and Stamp */}
            <div className="p-6 bg-gradient-to-br from-[#0c1445] to-[#122370] text-white flex justify-between items-start rounded-t-3xl relative">
              <div className="space-y-1">
                <div className="font-serif text-xl font-extrabold text-white flex items-center gap-1.5 tracking-tight">
                  <span>Vendza</span>
                  <span className="text-[9px] bg-teal-500/10 text-teal-400 font-sans tracking-widest uppercase px-2 py-0.5 rounded font-black border border-teal-500/20 shadow-3xs">
                    SÉQUESTRE SECURISÉ
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 font-medium">Billet dématérialisé de consignation</p>
              </div>
              
              <div className="text-right flex flex-col items-end">
                <span className="font-mono font-extrabold text-xs text-emerald-400 bg-white/10 border border-white/5 px-2.5 py-1 rounded-lg shadow-inner">
                  #{order.id.toUpperCase()}
                </span>
                <p className="text-[10px] text-slate-300 mt-2 font-bold font-mono">
                  {order.date} à {order.heure}
                </p>
              </div>
            </div>

            {/* Receipt Body content */}
            <div className="p-6 space-y-6 text-slate-700 text-xs">
              
              {/* Delivery Parameters Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs border-b border-dashed border-slate-200 pb-4">
                <div className="bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100 shadow-3xs">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block mb-1">
                    Destination Colis
                  </span>
                  <div className="flex items-start gap-1 font-semibold text-slate-800">
                    <MapPin size={12} className="text-blue-600 mt-0.5 shrink-0" />
                    <span>{order.departement}, {order.commune}</span>
                  </div>
                </div>
                
                <div className="bg-blue-50/50 p-2.5 rounded-2xl border border-blue-100/60 shadow-3xs">
                  <span className="text-[9px] uppercase tracking-widest text-blue-600 font-extrabold block mb-1">
                    Client (Acheteur)
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-black text-slate-900 text-xs sm:text-sm">
                      {clientProfil?.avatar_url ? (
                        <img src={clientProfil.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={13} className="text-blue-600 shrink-0" />
                      )}
                      <span>{nomClient}</span>
                    </div>
                    <span className="font-mono block text-slate-500 text-[11px] font-bold">
                      Tél: {telClient}
                    </span>
                  </div>
                </div>

                <div className="bg-teal-50/50 p-2.5 rounded-2xl border border-teal-100/60 shadow-3xs">
                  <span className="text-[9px] uppercase tracking-widest text-teal-600 font-extrabold block mb-1">
                    Boutique (Vendeur)
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-black text-slate-900 text-xs sm:text-sm">
                      <ShieldCheck size={13} className="text-teal-600 shrink-0" />
                      <span>{nomVendeur}</span>
                    </div>
                    <span className="font-mono block text-slate-500 text-[11px] font-bold">
                      Tél: {vendeurProfil?.telephone || 'Non renseigné'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Items Table */}
              <div className="space-y-2.5">
                <span className="text-[9px] font-black tracking-wider text-[#9aa3bf] uppercase block">
                  Détail de la Provision Consignée
                </span>
                <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl px-4 bg-slate-50/30 max-h-[220px] overflow-y-auto">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex flex-col gap-1 leading-normal text-xs text-slate-700">
                      <div className="flex justify-between items-start gap-1 font-semibold">
                        <span className="text-slate-800">{item.productNom}</span>
                        <span className="font-mono font-bold text-slate-900 shrink-0">
                          {((item.prix || 0) * item.qte).toLocaleString('fr-FR')} Gdes
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold pl-0.5">
                        <span>Prix unitaire : {(item.prix || 0).toLocaleString('fr-FR')} Gdes</span>
                        <span>Quantité consignée : x{item.qte}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fee Accounting Card */}
              <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl space-y-2">
                <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                  <span>Provision Marchandises</span>
                  <span className="font-mono text-slate-800">
                    {order.items.reduce((s, i) => s + (i.prix * i.qte), 0).toLocaleString('fr-FR')} Gdes
                  </span>
                </div>
                
                <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                  <span>Frais Logistiques (Livraison)</span>
                  <span className="font-mono text-slate-800">
                    {order.fraisLivraison ? `${order.fraisLivraison} Gdes` : 'Gratuit'}
                  </span>
                </div>

                {order.discount > 0 && (
                  <div className="flex justify-between text-[11px] text-emerald-600 font-extrabold">
                    <span>Code Promotionnel Appliqué</span>
                    <span className="font-mono">-{order.discount} Gdes</span>
                  </div>
                )}

                <div className="h-px bg-slate-200 my-2" />
                
                <div className="flex justify-between items-center font-black">
                  <span className="text-slate-800 font-black text-xs uppercase tracking-tight">
                    Fonds Totaux en Séquestre Garanti
                  </span>
                  <span className="font-mono text-blue-600 text-lg sm:text-xl font-black">
                    {order.total.toLocaleString('fr-FR')} Gdes
                  </span>
                </div>
              </div>

              {/* QR Code Validation Section inside Printable Ticket - Only for Vendor */}
              {isVendor && (
                <div className="bg-slate-50 border border-teal-150 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2.5 my-3">
                  <div className="bg-white p-2.5 border border-slate-200 rounded-xl shadow-3xs">
                    <QRCodeRenderer value={`https://vendza.netlify.app/client/confirmation?id=${order.id}`} size={110} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-black text-[#0d9488] tracking-widest font-sans block">
                      Code QR de Validation (Vendeur)
                    </span>
                    <p className="text-[9.5px] text-slate-450 font-bold max-w-[280px] mx-auto leading-relaxed italic">
                      À faire scanner par le client à la livraison pour libérer la provision fiduciaire.
                    </p>
                  </div>
                </div>
              )}

              {/* Disclaimer and Trust Seal */}
              <div className="text-center pt-2 border-t border-dashed border-slate-200">
                <div className="inline-flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-150 shadow-3xs mb-2">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  <span>TRANSACTION MULTI-SIGIL SECURISÉE VENDZA</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium max-w-md mx-auto leading-normal">
                  Ce document certifie le blocage de la provision fiduciaire correspondante. Elle sera liquidée au profit du vendeur dès que la réception physique sera notifiée par code de sécurité.
                </p>
              </div>
              
            </div>
            
            {/* Cute printable receipt bottom cut graphics */}
            <div className="bg-slate-100 h-2 flex justify-between overflow-hidden opacity-80" aria-hidden="true">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="w-2.5 h-2.5 bg-white transform rotate-45 shrink-0 -translate-y-1.5 shadow-3xs" />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Action and Security Dashboard */}
        <div className="lg:col-span-5 space-y-5 print:hidden">
          
          {/* Status Tracker */}
          <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-xs space-y-4">
            <h4 className="text-[10px] font-black tracking-widest text-[#0c1445] bg-[#eff6ff] border border-[#bfdbfe] px-3.5 py-1.5 rounded-full uppercase text-center w-full block">
              🛡️ FEUILLE DE ROUTE DE SECURITÉ
            </h4>

            {/* QR Code Presentation or Camera Scanner Button */}
            {isBuyer ? (
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50/70 border border-slate-150 rounded-2xl gap-4">
                <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                  <span className="text-3xl">📷</span>
                </div>
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">Scanner le code QR de livraison</h4>
                  <p className="text-xs text-slate-500 leading-normal">
                    Scannez le QR Code de confirmation présenté par le livreur ou le vendeur pour valider la réception du colis.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('scanner')}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
                >
                  <span>📷 OUVRIR LA CAMÉRA / SCANNER</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-5 bg-slate-50/50 border border-slate-150 rounded-2xl gap-3">
                <p className="text-[11px] text-slate-500 font-bold text-center leading-relaxed">
                  🔒 Colis Sécurisé Vendza.<br />Le QR Code officiel imprimable de déblocage est affiché directement dans le ticket de consignation ci-contre.
                </p>
                
                <p className="text-[10.5px] text-slate-450 font-semibold text-center italic">
                  Réf: {order.id.toUpperCase()}
                </p>
              </div>
            )}

            {/* Dynamic Status message depending on role */}
            <div className="space-y-4 pt-1">
              <div className="flex justify-center">
                <span className={`text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full border shadow-3xs ${
                  order.status === 'livree' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {order.status === 'livree' ? '✅ LIVRAISON VALIDÉE' : '⏳ FUNDS BLOCKED (SÉQUESTRE)'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl flex gap-3 text-slate-600">
                <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-bold text-xs text-slate-800">Fonctionnement du Séquestre</h5>
                  <p className="text-[11px] leading-relaxed">
                    {isBuyer ? (
                      "Vos Gourdes restent en sécurité chez Vendza. Une fois que vous aurez examiné et accepté les marchandises livrées en mains propres, montrez ce code QR au marchand ou cliquez sur le bouton de déblocage pour solder la transaction immédiatement."
                    ) : (
                      "Les fonds ont été déposés avec succès par l'acheteur et sont garantis. Pour les libérer sur votre portefeuille, demandez à l'acheteur de scanner votre badge ou présentez ce code QR afin de notifier la plateforme de la conformité du colis."
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Buyer Specific Interactive Actions */}
            {isBuyer && order.status !== 'livree' && onConfirmDelivery && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  disabled={isConfirming}
                  onClick={handleReleaseFunds}
                  className="w-full py-3 px-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
                >
                  {isConfirming ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} strokeWidth={3} />
                  )}
                  <span>Confirmer la réception (Débloquer fonds)</span>
                </button>
                <div className="flex items-center gap-1.5 text-[9px] text-red-500 font-bold bg-red-50 border border-red-150 p-2 rounded-xl">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>N'appuyez que si vous êtes en possession physique du colis vérifié.</span>
                </div>
              </div>
            )}
            
            {/* Vendor Specific Actions */}
            {isVendor && order.status !== 'livree' && (
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[10.5px] text-slate-400 font-bold justify-center bg-slate-50 p-2.5 rounded-xl border">
                  <span>Réf commande:</span>
                  <span className="font-mono text-slate-800 bg-white border px-2 py-0.5 rounded text-[11px]">
                    {order.id}
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-400 text-center font-bold uppercase tracking-wider">
                  Attente scanner de l'acheteur pour versement immédiat
                </p>
              </div>
            )}

            {/* Standard page foot controls */}
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                onClick={onBack}
                className="w-full py-2.5 px-3 rounded-xl bg-[#0c1445] hover:bg-[#1a255c] text-white text-xs font-bold tracking-wide transition cursor-pointer text-center"
              >
                Retour au Tableau de Bord
              </button>
            </div>

          </div>
          
        </div>
      </div>
    </div>
  );
};
