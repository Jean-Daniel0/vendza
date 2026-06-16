import React from 'react';
import { ShieldCheck, FileText, Lock, ArrowLeft, RefreshCw, Smartphone } from 'lucide-react';

interface TermsPageProps {
  onBack?: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 max-w-3xl mx-auto shadow-xs text-slate-700 animate-fade-in">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Retour à l'écran précédent
        </button>
      )}

      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
          <FileText size={24} />
        </div>
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Conditions Générales d'Utilisation
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Dernière mise à jour : 22 Mai 2026</p>
        </div>
      </div>

      <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
        Bienvenue sur <strong className="text-slate-800">Vendza.ht</strong>. En accédant ou en utilisant notre plateforme de commerce 
        avec séquestre sécurisé en Haïti, vous acceptez de vous conformer aux présentes Conditions Générales d'Utilisation (CGU). 
        Veuillez les lire attentivement.
      </p>

      {/* Grid of Key principles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
          <div className="text-emerald-600 shrink-0 mt-0.5">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Séquestre Sécurisé</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Les fonds de chaque commande sont conservés en tiers de confiance (séquestre) jusqu'à confirmation finale de la livraison.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
          <div className="text-blue-600 shrink-0 mt-0.5">
            <Smartphone size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Paiement Mobile</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Tous les paiements et retraits s'appuient sur des réseaux sécurisés de paiement mobile local pour garantir l'immédiateté.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
          <div className="text-teal-600 shrink-0 mt-0.5">
            <RefreshCw size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Remboursements Garantis</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Si le vendeur ne livre pas ou si le produit ne correspond pas, l'acheteur est intégralement remboursé sur son solde.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
          <div className="text-indigo-600 shrink-0 mt-0.5">
            <Lock size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Validation par QR Code</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              L'échange physique de marchandises s'authentifie instantanément sur le terrain via le scan d'un QR code unique de reçu.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 text-xs sm:text-sm leading-relaxed">
        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-blue-600 pl-2">
            1. Objet du Service de Tiers de Confiance
          </h3>
          <p className="text-slate-600">
            Vendza agit exclusivement en tant qu'intermédiaire et facilitateur de confiance pour le marché p2p ou b2c haïtien. 
            Lorsqu'un acheteur effectue un paiement, l'argent n'est pas envoyé immédiatement au vendeur. Il est placé en séquestre 
            Vendza. Dès que la marchandise est délivrée et validée par scan ou confirmation manuelle, les fonds sont instantanément 
            crédités au vendeur.
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-blue-600 pl-2">
            2. Obligations des Vendeurs
          </h3>
          <p className="text-slate-600">
            Chaque vendeur s'engage à :
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-slate-500">
            <li>Décrire fidèlement les produits avec leurs prix réels en Gourdes (HTG).</li>
            <li>Maintenir les niveaux de stocks déclarés à jour.</li>
            <li>Effectuer la livraison dans les départements et communes d'Haïti spécifiés lors de l'abonnement du plan.</li>
            <li>Présenter le produit pour inspection physique au moment de la livraison avant que l'acheteur scanne le code.</li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-blue-600 pl-2">
            3. Protection de l'Acheteur & Annulation
          </h3>
          <p className="text-slate-600">
            L'acheteur dispose du droit d'annuler une commande tant que celle-ci n'est pas finalisée/livrée si :
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-slate-500">
            <li>Le délai convenu de livraison est dépassé sans notification valable du vendeur.</li>
            <li>Le produit livré physiquement présente un défaut majeur non mentionné dans la fiche descriptive.</li>
          </ul>
          <p className="text-slate-600">
            En cas d'annulation approuvée, les Gourdes séquestrées sont retournées à 100% sur le compte de l'acheteur.
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-blue-600 pl-2">
            4. Système d'Abonnement Vendeur
          </h3>
          <p className="text-slate-600">
            Pour vendre au-delà de sa zone immédiate ou publier un catalogue illimité, le vendeur doit souscrire à un forfait 
            Pro Local ou Pro National. Ces forfaits débloquent l'accès logistique à un plus grand nombre de communes d'Haïti.
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-blue-600 pl-2">
            5. Juridiction et Règlement de Différends
          </h3>
          <p className="text-slate-600">
            En cas de litige insoluble à l'amiable lors de l'échange de marchandise, le service client de Vendza intervient sous 
            24 heures pour évaluer la situation d'après les preuves d'échange de messagerie et de localisation, dans le respect 
            des lois commerciales en vigueur en République d'Haïti.
          </p>
        </section>
      </div>

      <div className="pt-4 border-t text-center">
        <p className="text-[11px] text-slate-400">
          En vous inscrivant sur Vendza.ht, vous déclarez avoir lu, compris et accepté l'ensemble de ces termes.
        </p>
      </div>
    </div>
  );
};
