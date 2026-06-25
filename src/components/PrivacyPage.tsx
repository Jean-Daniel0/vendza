import React from 'react';
import { ArrowLeft, Shield, Eye, Lock, Mail, Phone, Globe, Database, UserCheck, AlertTriangle } from 'lucide-react';

interface PrivacyPageProps {
  onBack?: () => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8 max-w-3xl mx-auto shadow-xs text-slate-700 animate-fade-in">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Retour à l'écran précédent
        </button>
      )}

      {/* Header section with brand and meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl shrink-0">
            <Lock size={24} />
          </div>
          <div>
            <h1 className="font-sans text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Politique de Confidentialité
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Dernière mise à jour : Mai 2026 · Version 1.0</p>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-400 font-bold bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-lg inline-block self-start sm:self-center">
          Territoire : République d'Haïti
        </div>
      </div>

      {/* Key Principles Quick Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <div className="p-4 bg-teal-50/20 rounded-xl border border-teal-150/50 flex gap-3">
          <div className="text-teal-600 shrink-0 mt-0.5">
            <Eye size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Transparence Totale</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Nous n'utilisons vos informations de contact que pour finaliser l'échange de paniers physiques et sécuriser les fonds de paiement.
            </p>
          </div>
        </div>

        <div className="p-4 bg-teal-50/20 rounded-xl border border-teal-150/50 flex gap-3">
          <div className="text-teal-600 shrink-0 mt-0.5">
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

      {/* Mandatory Agreement Callout */}
      <div className="p-4 bg-teal-50/40 border border-teal-200 rounded-xl flex gap-3 items-start">
        <AlertTriangle className="text-teal-700 shrink-0 mt-0.5" size={18} />
        <div className="text-xs sm:text-sm text-teal-900 leading-relaxed">
          <strong>À lire avant de continuer.</strong> En créant un compte sur Vendza ou en utilisant nos services, vous acceptez les termes de cette Politique de Confidentialité. Si vous n'acceptez pas ces termes, veuillez ne pas utiliser la plateforme.
        </div>
      </div>

      {/* Main Document Sections */}
      <div className="space-y-8 text-xs sm:text-sm leading-relaxed text-slate-600">

        {/* SECTION 01 */}
        <section id="s1" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">01</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Présentation de Vendza et champ d'application
            </h3>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Qui est Vendza ?</h4>
            <p>
              Vendza est une marketplace haïtienne en ligne qui connecte des acheteurs et des vendeurs locaux sur le territoire d'Haïti. Notre plateforme, accessible à l'adresse <strong>www.vendza.store</strong>, permet aux vendeurs de publier et vendre leurs produits, et aux clients d'acheter en toute sécurité grâce à notre système de paiement sécurisé par séquestre (escrow) et de validation par QR code.
            </p>
            <p>
              Vendza agit en tant qu'intermédiaire de confiance entre les acheteurs et les vendeurs. Nous retenons les paiements des clients jusqu'à ce que la livraison soit confirmée par le scan du QR code unique attribué à chaque commande, garantissant ainsi la sécurité de chaque transaction.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">À qui s'applique cette politique ?</h4>
            <p>Cette Politique de Confidentialité s'applique à toutes les personnes qui interagissent avec Vendza, notamment :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Les <strong>clients</strong> qui créent un compte, naviguent sur la plateforme ou effectuent des achats.</li>
              <li>Les <strong>vendeurs</strong> qui créent une boutique, publient des produits et reçoivent des paiements.</li>
              <li>Les <strong>visiteurs</strong> qui consultent la plateforme sans créer de compte.</li>
              <li>Toute personne qui contacte notre service client ou interagit avec nos services.</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Engagement de Vendza envers votre vie privée</h4>
            <p>
              Vendza prend très au sérieux la protection de vos données personnelles. Nous nous engageons à ne collecter que les données strictement nécessaires au bon fonctionnement de nos services, à les protéger avec les mesures de sécurité appropriées et à vous informer de manière transparente de leur utilisation.
            </p>
            <p>
              Nous ne vendons jamais vos données personnelles à des tiers à des fins commerciales. Toute utilisation de vos données est faite dans le seul but d'améliorer votre expérience sur Vendza et d'assurer le bon fonctionnement de la plateforme.
            </p>
          </div>
        </section>

        {/* SECTION 02 */}
        <section id="s2" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">02</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Données personnelles collectées
            </h3>
          </div>

          <div className="space-y-3">
            <p>
              Vendza collecte différentes catégories de données personnelles selon votre rôle sur la plateforme (client ou vendeur) et selon la manière dont vous interagissez avec nos services.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-2">Données collectées lors de l'inscription</h4>
            <div className="overflow-x-auto border border-slate-150 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-150">
                    <th className="p-3">Donnée</th>
                    <th className="p-3">Obligatoire</th>
                    <th className="p-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Prénom & Nom</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Oui</td>
                    <td className="p-3">Votre prénom et nom tel que vous les déclarez.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Adresse email</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Oui</td>
                    <td className="p-3">Utilisée pour la connexion sécurisée et les notifications importantes.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Numéro de téléphone</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Oui</td>
                    <td className="p-3">Indispensable pour vous contacter ou coordonner les livraisons.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Département & Commune</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Oui</td>
                    <td className="p-3">Votre lieu de résidence en Haïti pour configurer la logistique locale.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Mot de passe</td>
                    <td className="p-3 text-emerald-600 font-bold">✓ Oui</td>
                    <td className="p-3">Stocké sous forme chiffrée de sécurité unidirectionnelle — jamais lisible.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Numéro MonCash</td>
                    <td className="p-3 text-amber-600 font-bold">Vendeurs</td>
                    <td className="p-3">Nécessaire pour recevoir vos revenus de ventes.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Nom & Logo de boutique</td>
                    <td className="p-3 text-amber-600 font-bold">Vendeurs</td>
                    <td className="p-3">Identifiants publics pour votre profil commercial.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Photo de profil</td>
                    <td className="p-3 text-slate-400">Non</td>
                    <td className="p-3">Optionnel, sert à personnaliser votre profil sur la marketplace.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Données collectées lors des transactions</h4>
            <p>Chaque transaction effectuée sur Vendza génère des données qui sont enregistrées dans notre système :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li><strong>Identifiant de commande (UUID)</strong> — généré automatiquement et encodé dans le QR code unique.</li>
              <li><strong>Détails des produits</strong> — nom, quantité, prix, et attributs de l'article acheté.</li>
              <li><strong>Montant total</strong> — incluant les produits, les frais de livraison, et les coupons éventuels.</li>
              <li><strong>Zone de livraison</strong> — département et commune de destination.</li>
              <li><strong>Dates et heures</strong> — horodatage précis de la commande, de la livraison, et du scan QR.</li>
              <li><strong>Statut de commande</strong> — en attente, payée, livrée, annulée.</li>
              <li><strong>Identifiants de transaction MonCash</strong> — références uniques de paiement de l'opérateur.</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Données collectées automatiquement</h4>
            <p>Lors de votre navigation sur Vendza, certaines données techniques sont collectées automatiquement :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li><strong>Adresse IP</strong> — pour des raisons de sécurité et de détection des fraudes géographiques.</li>
              <li><strong>Type de navigateur & Système d'exploitation</strong> — pour optimiser la compatibilité de l'interface.</li>
              <li><strong>Télémétrie d'usage</strong> — pages consultées, temps passé, et erreurs de crash pour améliorer la plateforme.</li>
            </ul>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl mt-3 flex gap-2.5">
              <span className="text-emerald-600 shrink-0 font-bold">✅</span>
              <p className="text-[11px] sm:text-xs text-emerald-800 leading-normal">
                <strong>Données exclues.</strong> Vendza ne collecte jamais les données suivantes : numéros de carte bancaire, codes PIN MonCash, mots de passe en clair, données biométriques, ou toute information non nécessaire au fonctionnement de la plateforme.
              </p>
            </div>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Historique complet des commandes</h4>
            <p>
              Vendza conserve l'intégralité de l'historique de vos commandes — qu'il s'agisse de vos achats en tant que client ou de vos ventes en tant que vendeur. Cet historique inclut toutes les commandes passées, annulées, livrées ou en cours, ainsi que les échanges de messages associés à chaque transaction.
            </p>
            <p>
              Cet historique est accessible depuis votre espace personnel sur la plateforme et peut être consulté à tout moment. Il vous sert de preuve en cas de litige et nous permet d'améliorer la qualité de nos services.
            </p>
          </div>
        </section>

        {/* SECTION 03 */}
        <section id="s3" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">03</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Finalités et utilisation des données
            </h3>
          </div>

          <div className="space-y-2.5">
            <p>Vendza utilise vos données personnelles uniquement pour les finalités décrites ci-dessous. Chaque utilisation de vos données est justifiée par une raison légitime et proportionnée :</p>
            
            <ul className="list-disc pl-5 space-y-1.5 text-slate-500">
              <li><strong>Fourniture et gestion des services :</strong> créer votre profil, publier des produits, orchestrer la commande, générer les QR codes sécurisés de livraison, retenir les fonds en séquestre et les libérer, et prélever nos commissions de service.</li>
              <li><strong>Communication et support :</strong> vous adresser des emails de facturation, des SMS/notifications de confirmation de livraison, des alertes de sécurité de compte, et répondre à vos requêtes au support.</li>
              <li><strong>Sécurité et lutte contre la fraude :</strong> authentifier votre identité de vendeur, repérer les comportements frauduleux ou les abus sur les scans de QR codes, et bloquer les contrevenants à nos CGU.</li>
              <li><strong>Améliorations techniques :</strong> identifier les ralentissements, résoudre les bugs logistiques, et affiner les parcours d'achats pour nos utilisateurs en Haïti.</li>
              <li><strong>Obligations légales :</strong> répondre aux exigences réglementaires et de coopération légale avec les autorités nationales haïtiennes compétentes si besoin.</li>
            </ul>
          </div>
        </section>

        {/* SECTION 04 */}
        <section id="s4" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">04</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Partage et communication des données
            </h3>
          </div>

          <div className="space-y-2.5">
            <p>Nous partageons vos informations personnelles uniquement dans les cas strictement délimités ci-dessous :</p>
            
            <ul className="list-disc pl-5 space-y-2 text-slate-500">
              <li><strong>Partage avec les vendeurs concernés :</strong> lorsque vous achetez un produit, Vendza transmet obligatoirement au vendeur votre prénom, votre nom de famille, votre numéro de téléphone et vos coordonnées géographiques (département et commune) de livraison pour lui permettre d'acheminer votre commande physique.</li>
              <li><strong>Partage avec l'opérateur MonCash :</strong> pour exécuter les transactions de débit (commande client) et de crédit (paiement escrow du vendeur), les références de commandes et les montants financiers associés sont échangés avec les plateformes sécurisées de paiement mobile.</li>
              <li><strong>Partage avec Supabase :</strong> notre hébergeur sécurisé stocke vos données sur des bases cryptées conformes aux normes d'audit industriel de haut niveau (SOC 2, ISO 27001).</li>
            </ul>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl mt-3 flex gap-2.5">
              <span className="text-rose-600 shrink-0 font-bold">🚫</span>
              <p className="text-[11px] sm:text-xs text-rose-800 leading-normal font-medium">
                <strong>Aucune revente commerciale.</strong> Vendza ne partage jamais vos données avec des annonceurs, des agences marketing, des courtiers en données ou tout autre tiers commercial. Vos données ne sont pas vendues, louées ou échangées à des fins publicitaires.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 05 */}
        <section id="s5" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">05</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Conservation et suppression des données
            </h3>
          </div>

          <div className="space-y-2.5">
            <p>
              Vendza conserve vos données personnelles pendant une durée de <strong>12 mois (1 an) après votre dernière activité</strong> sur la plateforme. L'activité s'entend comme toute connexion, achat, publication, ou message envoyé.
            </p>
            <p>
              À l'issue de cette période d'inactivité de 12 mois, votre compte utilisateur est supprimé et vos données personnelles effacées de nos serveurs actifs.
            </p>
            <p><strong>Exceptions de conservation :</strong></p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Les données de transaction comptable sont archivées pendant 3 ans pour des obligations de litige et de comptabilité.</li>
              <li>Les coordonnées de comptes suspendus pour fraude grave ou non-respect de nos CGU sont conservées de façon permanente pour éviter toute tentative de réinscription.</li>
            </ul>
            <p className="mt-2">
              Vous pouvez demander une suppression manuelle anticipée de votre compte à tout moment en écrivant à <strong>info@vendza.store</strong>. Nous exécutons ces demandes sous un délai de <strong>30 jours ouvrables</strong>.
            </p>
          </div>
        </section>

        {/* SECTION 06 */}
        <section id="s6" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">06</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Sécurité des données
            </h3>
          </div>

          <div className="space-y-2.5">
            <p>Nous mettons en place des protocoles de sécurité avancés pour protéger l'intégrité de vos informations nominatives :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li><strong>Hachage des mots de passe :</strong> vos mots de passe sont encodés via l'algorithme robuste de hachage bcrypt — ils ne sont jamais enregistrés ni lisibles en clair par nos administrateurs.</li>
              <li><strong>Chiffrement de transport :</strong> l'intégralité du trafic réseau de la plateforme s'effectue sous tunnel chiffré HTTPS (SSL/TLS).</li>
              <li><strong>Sécurité d'accès :</strong> l'accès aux bases de données intègre des politiques au niveau des lignes (Row Level Security) qui interdisent strictement à un compte d'accéder aux données d'un autre utilisateur.</li>
              <li><strong>QR codes infalsifiables :</strong> le système de QR code utilise un cryptage cryptographique basé sur des UUID non devinables pour éviter toute usurpation de livraison.</li>
            </ul>
            <p className="mt-2">
              En cas d'incident de sécurité avéré sur vos données, nous nous engageons à vous en informer par email sous <strong>72 heures</strong> à compter de sa détection.
            </p>
          </div>
        </section>

        {/* SECTION 07 */}
        <section id="s7" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">07</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Vos droits sur vos données
            </h3>
          </div>

          <div className="space-y-2.5">
            <p>Vous disposez à tout moment de droits fondamentaux de gestion de votre vie privée :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li><strong>Droit d'accès :</strong> demander un récapitulatif complet de l'intégralité de vos informations enregistrées.</li>
              <li><strong>Droit de rectification :</strong> corriger vos coordonnées directement via votre profil.</li>
              <li><strong>Droit à l'effacement :</strong> requérir l'effacement de vos données sous réserve d'obligations de transaction en cours.</li>
              <li><strong>Droit d'opposition :</strong> vous désinscrire des communications ou emails marketing en cliquant sur les liens de désinscription.</li>
            </ul>
            <p className="mt-2">
              Pour faire valoir ces droits, écrivez-nous simplement à <strong>info@vendza.store</strong>. Nous traiterons votre demande sous <strong>30 jours ouvrables</strong>.
            </p>
          </div>
        </section>

        {/* SECTION 08 */}
        <section id="s8" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">08</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Cookies et technologies de suivi
            </h3>
          </div>

          <div className="space-y-2.5">
            <p>
              Vendza utilise uniquement des cookies essentiels ou strictement techniques pour assurer la persistance de votre panier, mémoriser votre session utilisateur d'une page à l'autre et consolider la sécurité de notre passerelle de paiement MonCash.
            </p>
            <p>
              Nous n'hébergeons aucun pixel tiers d'annonceur ni de cookie de reciblage publicitaire comportemental. Aucun profilage commercial n'est mené sur nos serveurs.
            </p>
          </div>
        </section>

        {/* SECTION 09 */}
        <section id="s9" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">09</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Données des mineurs
            </h3>
          </div>

          <div className="space-y-2.5">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex gap-2.5">
              <span className="text-rose-600 shrink-0 font-bold">🔞</span>
              <p className="text-[11px] sm:text-xs text-rose-800 leading-normal font-medium">
                <strong>Accès réservé.</strong> L'accès à la marketplace et aux modules de paiement est strictement interdit aux personnes de moins de 18 ans. Vendza ne collecte pas intentionnellement de profils nominatifs de mineurs.
              </p>
            </div>
            <p className="mt-2">
              Si nous prenons conscience de l'enregistrement frauduleux d'un mineur, nous supprimerons immédiatement son compte ainsi que toutes ses traces numériques. Si vous détectez la présence d'un profil mineur, écrivez-nous à <strong>info@vendza.store</strong>.
            </p>
          </div>
        </section>

        {/* SECTION 10 */}
        <section id="s10" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">10</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Modifications de cette politique
            </h3>
          </div>

          <div className="space-y-2.5">
            <p>
              Vendza se réserve le droit d'adapter et de modifier à tout moment cette Politique de Confidentialité pour répondre aux changements technologiques ou aux exigences légales d'Haïti.
            </p>
            <p>
              Toute mise à jour substantielle fera l'objet d'un email de notification ou d'une alerte explicite sur la plateforme avec un préavis minimal de <strong>15 jours avant son application effective</strong>. En poursuivant votre navigation après ce délai, vous validez tacitement la nouvelle politique.
            </p>
          </div>
        </section>

        {/* SECTION 11 */}
        <section id="s11" className="space-y-4">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">11</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Contact et réclamations
            </h3>
          </div>

          <p>
            Pour toute question, demande de modification ou réclamation relative à vos données nominatives ou à la protection de votre vie privée, n'hésitez pas à nous joindre :
          </p>

          <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 sm:p-5 text-center space-y-4 mt-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">📬 Équipe de Protection des Données Personnelles</p>
            
            <div className="flex flex-wrap justify-center gap-3">
              <a 
                href="mailto:info@vendza.store" 
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-teal-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-2xs transition"
              >
                <Mail size={14} className="text-teal-500" />
                <span>info@vendza.store</span>
              </a>
              <a 
                href="tel:+50941953739" 
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-teal-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-2xs transition"
              >
                <Phone size={14} className="text-emerald-500" />
                <span>+509 4195 37 39</span>
              </a>
              <a 
                href="https://www.vendza.store" 
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-teal-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-2xs transition"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe size={14} className="text-indigo-500" />
                <span>www.vendza.store</span>
              </a>
            </div>

            <p className="text-[10px] sm:text-[11px] text-slate-400 max-w-lg mx-auto leading-relaxed pt-2 border-t border-slate-200/60">
              Document rédigé et approuvé par l'équipe Vendza S.A. · Version 1.0 · Mai 2026<br />
              Ce document constitue la politique officielle de confidentialité de la plateforme Vendza.<br />
              À lire conjointement avec les Conditions d'utilisation.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
};
