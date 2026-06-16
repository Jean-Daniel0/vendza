import React from 'react';
import { Lock, Eye, ShieldAlert, ArrowLeft, Database, Mail } from 'lucide-react';

interface PrivacyPageProps {
  onBack?: () => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
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
        <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
          <Lock size={24} />
        </div>
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Politique de Confidentialité
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Dernière mise à jour : 22 Mai 2026</p>
        </div>
      </div>

      <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
        Chez <strong className="text-slate-800">Vendza.ht</strong>, la protection de votre vie privée est au cœur de notre démarche 
        comme tiers de confiance. Cette politique décrit la manière dont nous collectons, utilisons, divulguons et protégeons 
        vos renseignements personnels lorsque vous utilisez notre site internet et nos systèmes de paiement sécurisé en Haïti.
      </p>

      {/* Grid of Key principles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <div className="p-4 bg-teal-50/30 rounded-xl border border-teal-100 flex gap-3">
          <div className="text-teal-700 shrink-0 mt-0.5">
            <Eye size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Transparence Totale</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Nous n'utilisons vos informations de contact que pour finaliser l'échange de paniers physiques et sécuriser les fonds de paiement.
            </p>
          </div>
        </div>

        <div className="p-4 bg-teal-50/30 rounded-xl border border-teal-100 flex gap-3">
          <div className="text-blue-600 shrink-0 mt-0.5">
            <Database size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Zéro Revente de Données</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Vos coordonnées téléphoniques et géographiques ne seront jamais vendues ou distribuées à des tiers marketing.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 text-xs sm:text-sm leading-relaxed">
        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-teal-600 pl-2">
            1. Données que nous collectons
          </h3>
          <p className="text-slate-600">
            Afin de mener à bien les transactions sur la plateforme, nous recueillons les renseignements suivants lors de la création de compte :
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-slate-500">
            <li><strong className="text-slate-700">Identité :</strong> Votre prénom et votre nom de famille.</li>
            <li><strong className="text-slate-700">Coordonnées :</strong> Email et numéro de téléphone valide (requis pour les liaisons de paiement mobile).</li>
            <li><strong className="text-slate-700">Localisation logistique :</strong> Département et commune de résidence pour configurer et facturer correctement les frais de livraison locale haïtienne.</li>
            <li><strong className="text-slate-700">Profil professionnel :</strong> Le nom de votre boutique et sa description (uniquement si vous vous inscrivez en tant que Vendeur).</li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-teal-600 pl-2">
            2. Comment nous utilisons vos informations
          </h3>
          <p className="text-slate-600">
            Vos données servent à faire fonctionner et à sécuriser la plateforme, plus spécifiquement :
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1 text-slate-500">
            <li>Permettre la mise en relation sécurisée entre acheteur et vendeur via le module d'Inbox messagerie instantanée.</li>
            <li>Fournir au transporteur ou au vendeur les détails géographiques nécessaires à la livraison physique de votre colis.</li>
            <li>Générer vos QR codes de reçus d'achat indispensables au déblocage final de la garantie de paiement.</li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-teal-600 pl-2">
            3. Sécurité de votre compte
          </h3>
          <p className="text-slate-600">
            Nous mettons en œuvre des mesures de sécurité techniques pour préserver la sécurité de vos données nominatives. 
            Vos mots de passe sont encodés et stockés de façon hautement protégée. Cependant, n'oubliez pas d'utiliser un mot 
            de passe unique pour Vendza et de ne jamais transmettre vos codes confidentiels de transactions financières à quiconque.
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-teal-600 pl-2">
            4. Partage restreint d'informations
          </h3>
          <p className="text-slate-600">
            Seules les informations de livraison indispensables (comme votre prénom, nom, numéro de téléphone et commune de 
            destination) sont partagées avec le vendeur de qui vous achetez l'article afin d'assurer l'acheminement, ainsi qu'au 
            vendeur scannant votre QR code.
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="font-serif font-bold text-slate-900 border-l-2 border-teal-600 pl-2">
            5. Vos Droits
          </h3>
          <p className="text-slate-600">
            Vous conservez à tout moment le droit de demander l'accès, la rectification ou la suppression complète de vos 
            renseignements personnels enregistrés sur Vendza.ht en contactant notre service d'assistance par courrier électronique.
          </p>
        </section>
      </div>

      <div className="pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Mail size={12} /> support@vendza.ht
        </span>
        <p className="text-[11px] text-slate-400">
          Vendza protège vos échanges de Port-au-Prince à Cap-Haïtien.
        </p>
      </div>
    </div>
  );
};
