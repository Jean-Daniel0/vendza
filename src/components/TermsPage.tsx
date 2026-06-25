import React from 'react';
import { ArrowLeft, ShieldCheck, Smartphone, RefreshCw, Lock, AlertTriangle, XCircle, Mail, Phone, Globe } from 'lucide-react';

interface TermsPageProps {
  onBack?: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
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
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Lock size={24} />
          </div>
          <div>
            <h1 className="font-sans text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Conditions d'Utilisation
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
        <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-150/50 flex gap-3">
          <div className="text-blue-600 shrink-0 mt-0.5">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Séquestre Sécurisé</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Les fonds de chaque commande sont conservés en tiers de confiance (séquestre) jusqu'à confirmation finale de la livraison.
            </p>
          </div>
        </div>

        <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-150/50 flex gap-3">
          <div className="text-blue-600 shrink-0 mt-0.5">
            <Smartphone size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Paiement Mobile</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Tous les paiements et retraits s'appuient sur MonCash pour garantir l'immédiateté et la traçabilité.
            </p>
          </div>
        </div>

        <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-150/50 flex gap-3">
          <div className="text-blue-600 shrink-0 mt-0.5">
            <RefreshCw size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Remboursements Garantis</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Si le vendeur ne livre pas ou si le produit ne correspond pas, l'acheteur est intégralement remboursé sur son solde.
            </p>
          </div>
        </div>

        <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-150/50 flex gap-3">
          <div className="text-blue-600 shrink-0 mt-0.5">
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

      {/* Mandatory Agreement Callout */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
        <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
          <strong>Accord obligatoire.</strong> En créant un compte, en achetant ou en vendant sur Vendza, vous acceptez intégralement les présentes Conditions d'Utilisation. Veuillez les lire attentivement avant d'utiliser nos services.
        </div>
      </div>

      {/* Main Document Sections */}
      <div className="space-y-8 text-xs sm:text-sm leading-relaxed text-slate-600">
        
        {/* SECTION 01 */}
        <section id="s1" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">01</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Acceptation des conditions et champ d'application
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Qu'est-ce que Vendza ?</h4>
            <p>
              Vendza est une marketplace haïtienne en ligne qui met en relation des acheteurs et des vendeurs locaux sur le territoire d'Haïti. Vendza agit exclusivement en tant qu'intermédiaire de confiance et n'est pas le vendeur direct des produits proposés sur la plateforme. Chaque vendeur est un tiers indépendant qui assume la pleine responsabilité des produits qu'il publie et vend.
            </p>
            <p>
              Notre mission est de faciliter le commerce local haïtien en offrant un système de paiement sécurisé par séquestre (escrow), une validation de livraison par QR code unique, et une infrastructure fiable pour les transactions entre particuliers et professionnels.
            </p>
            
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Conditions d'acceptation</h4>
            <p>En utilisant Vendza de quelque manière que ce soit — navigation, inscription, achat ou vente — vous déclarez :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Avoir <strong>18 ans ou plus</strong> et être légalement capable de contracter</li>
              <li>Avoir lu, compris et accepté intégralement les présentes Conditions d'Utilisation</li>
              <li>Avoir lu et accepté notre Politique de Confidentialité</li>
              <li>Utiliser la plateforme de bonne foi et dans le respect des lois applicables</li>
              <li>Fournir des informations exactes, complètes et à jour lors de votre inscription</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Territoire d'application</h4>
            <p>
              Les présentes Conditions d'Utilisation s'appliquent à l'utilisation de la plateforme Vendza sur le territoire d'Haïti. Vendza est principalement conçu pour et destiné aux résidents d'Haïti. L'utilisation de la plateforme depuis un autre territoire est possible mais se fait sous la seule responsabilité de l'utilisateur.
            </p>
          </div>
        </section>

        {/* SECTION 02 */}
        <section id="s2" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">02</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Inscription et gestion du compte
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Création d'un compte</h4>
            <p>
              Pour accéder à la plupart des fonctionnalités de Vendza, vous devez créer un compte en fournissant des informations exactes et complètes. Vous pouvez vous inscrire en tant que <strong>client</strong> (acheteur) ou en tant que <strong>vendeur</strong>. Un même utilisateur ne peut pas posséder plusieurs comptes actifs simultanément.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Vous êtes responsable de l'exactitude des informations fournies lors de l'inscription</li>
              <li>Vous vous engagez à maintenir vos informations à jour en cas de changement</li>
              <li>Chaque personne physique ne peut posséder qu'un seul compte de chaque type</li>
              <li>Les comptes créés au nom de tiers sans leur consentement sont strictement interdits</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Sécurité et confidentialité du compte</h4>
            <p>Vous êtes seul responsable de la sécurité de votre compte Vendza. À ce titre :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Vous devez choisir un mot de passe fort et unique, jamais utilisé sur d'autres services</li>
              <li>Vous ne devez jamais partager vos identifiants de connexion avec un tiers</li>
              <li>Vous devez nous signaler immédiatement toute utilisation non autorisée de votre compte</li>
              <li>Vendza ne sera pas responsable des pertes résultant d'un accès non autorisé à votre compte dû à votre négligence</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Fermeture du compte</h4>
            <p>
              Vous pouvez fermer votre compte à tout moment depuis vos paramètres ou en contactant notre support. La fermeture d'un compte entraîne la perte de toutes les données associées, des avis publiés et de l'historique des transactions. Les commandes en cours au moment de la fermeture doivent être finalisées avant la suppression effective du compte.
            </p>
          </div>
        </section>

        {/* SECTION 03 */}
        <section id="s3" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">03</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Règles pour les vendeurs
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Conditions pour vendre sur Vendza</h4>
            <p>Pour vendre sur Vendza, vous devez :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Avoir 18 ans ou plus et être légalement autorisé à exercer une activité commerciale</li>
              <li>Posséder un compte MonCash actif et vérifié pour recevoir vos paiements</li>
              <li>Choisir un plan d'abonnement — Gratuit, Pro Local ou Pro National</li>
              <li>Accepter les taux de commission applicables à votre plan</li>
              <li>Vous engager à livrer les produits commandés dans les délais annoncés</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Obligations relatives aux produits</h4>
            <p>Chaque vendeur est seul responsable des produits qu'il publie sur Vendza. À ce titre, vous vous engagez à :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Publier uniquement des produits que vous possédez réellement et que vous êtes en mesure de livrer</li>
              <li>Fournir des descriptions exactes, complètes et non trompeuses de vos produits</li>
              <li>Utiliser uniquement vos propres photos ou des photos dont vous possédez les droits</li>
              <li>Afficher des prix honnêtes, non abusivement gonflés ou trompeurs</li>
              <li>Mettre à jour le stock de vos produits en temps réel pour éviter les commandes impossibles à honorer</li>
              <li>Indiquer clairement les délais de livraison réalistes pour votre zone de couverture</li>
              <li>Ne jamais publier de produits appartenant aux catégories interdites (voir section 09)</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Obligations relatives aux commandes</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Vous engager à traiter chaque commande payée dans les 24 heures suivant la réception</li>
              <li>Contacter le client en cas de retard ou d'impossibilité de livraison</li>
              <li>Remettre le QR code de validation au client au moment de la livraison</li>
              <li>Ne jamais tenter de forcer ou de manipuler le scan du QR code sans livraison réelle</li>
              <li>Conserver une preuve de livraison en cas de litige</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Plans d'abonnement et couverture</h4>
            <p>
              Chaque plan d'abonnement offre une couverture géographique différente. En souscrivant à un plan, vous vous engagez à livrer uniquement dans les départements couverts par votre plan :
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li><strong>Plan Gratuit</strong> — 1 département de couverture seulement</li>
              <li><strong>Pro Local (350 Gdes/mois)</strong> — jusqu'à 5 départements selon vos sélections</li>
              <li><strong>Pro National (499 Gdes/mois)</strong> — couverture nationale, les 10 départements d'Haïti</li>
            </ul>
          </div>
        </section>

        {/* SECTION 04 */}
        <section id="s4" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">04</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Règles pour les acheteurs
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <p>En tant qu'acheteur sur Vendza, vous vous engagez à :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Fournir des informations de livraison exactes (département, commune, téléphone)</li>
              <li>Être disponible pour réceptionner votre commande dans le délai convenu</li>
              <li>Scanner le QR code <strong>uniquement</strong> après avoir réellement reçu et vérifié votre commande</li>
              <li>Ne jamais scanner le QR code avant d'avoir inspecté le produit reçu</li>
              <li>Signaler tout problème dans les <strong>24 heures</strong> suivant le scan du QR code</li>
              <li>Ne pas abuser du système de litige en faisant de fausses déclarations</li>
            </ul>

            <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-xl mt-3 flex gap-2.5">
              <span className="text-amber-600 shrink-0 mt-0.5 font-bold">⚠️</span>
              <p className="text-[11px] sm:text-xs text-amber-800 leading-normal">
                <strong>Important — Le scan du QR code est définitif.</strong> En scannant le QR code de votre commande, vous confirmez officiellement avoir reçu votre produit et vous déclenchez le paiement au vendeur. Inspectez toujours votre commande avant de scanner. Vous disposez de 24h après le scan pour signaler un problème.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 05 */}
        <section id="s5" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">05</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Système de paiement et commissions
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Système de paiement par séquestre (Escrow)</h4>
            <p>
              Vendza utilise un système de paiement sécurisé par séquestre pour protéger à la fois l'acheteur et le vendeur. Le fonctionnement est le suivant :
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-500">
              <li>Le client effectue son paiement via MonCash au moment de la commande.</li>
              <li>Le montant est retenu par Vendza jusqu'à confirmation de la livraison.</li>
              <li>Le client reçoit sa commande et scanne le QR code de validation.</li>
              <li>Vendza libère automatiquement le paiement au vendeur, déduction faite de la commission.</li>
              <li>Le vendeur reçoit le montant net sur son compte MonCash.</li>
            </ol>
            <p>
              Ce système garantit que le vendeur est payé uniquement après livraison confirmée, et que l'acheteur ne perd pas son argent si la livraison n'a pas lieu.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-4">Commissions Vendza</h4>
            <p>
              Vendza prélève une commission sur le <strong>montant total de chaque commande</strong> (prix du produit + frais de livraison). Cette commission varie selon le plan d'abonnement du vendeur :
            </p>

            <div className="overflow-x-auto border border-slate-150 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-150">
                    <th className="p-3">Plan</th>
                    <th className="p-3">Abonnement</th>
                    <th className="p-3 text-center">Commission par vente</th>
                    <th className="p-3 text-right">Exemple (1 000 Gdes)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Plan Gratuit</td>
                    <td className="p-3">0 Gdes</td>
                    <td className="p-3 text-center text-blue-600 font-mono font-bold">12%</td>
                    <td className="p-3 text-right font-mono">Le vendeur reçoit 880 Gdes</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Pro Local</td>
                    <td className="p-3 text-blue-600">350 Gdes/mois</td>
                    <td className="p-3 text-center text-blue-600 font-mono font-bold">10%</td>
                    <td className="p-3 text-right font-mono">Le vendeur reçoit 900 Gdes</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-800">Pro National</td>
                    <td className="p-3 text-emerald-600">499 Gdes/mois</td>
                    <td className="p-3 text-center text-emerald-600 font-mono font-bold">5%</td>
                    <td className="p-3 text-right font-mono">Le vendeur reçoit 950 Gdes</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3.5 bg-indigo-50/50 border border-indigo-150/60 rounded-xl mt-3 flex gap-2.5">
              <span className="text-indigo-600 shrink-0 mt-0.5 font-bold">💡</span>
              <p className="text-[11px] sm:text-xs text-indigo-800 leading-normal">
                <strong>Conseil.</strong> Un vendeur Pro National qui réalise des ventes régulières rentabilisera rapidement son abonnement grâce à la commission réduite à 5%. Pour une vente de 10 000 Gdes, la différence entre le plan Gratuit (12%) et le plan Pro National (5%) représente une économie de 700 Gdes sur une seule transaction.
              </p>
            </div>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-4">Délai de versement au vendeur</h4>
            <p>
              Le paiement est libéré au vendeur de manière automatique et instantanée dès que le client scanne le QR code de validation de livraison. En cas de litige résolu en faveur du vendeur, le paiement est libéré dans les <strong>24 heures</strong> suivant la décision de Vendza.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Modification des tarifs</h4>
            <p>
              Vendza se réserve le droit de modifier ses tarifs de commission et d'abonnement. Tout changement de tarif sera communiqué aux utilisateurs concernés avec un préavis de <strong>30 jours</strong> par email et notification sur la plateforme.
            </p>
          </div>
        </section>

        {/* SECTION 06 */}
        <section id="s6" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">06</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Système de livraison et validation QR
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Le QR code de validation</h4>
            <p>
              Chaque commande payée sur Vendza génère automatiquement un QR code unique et infalsifiable. Ce QR code est la pièce centrale du système de sécurité de Vendza :
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Il est unique à chaque commande — deux commandes ne peuvent jamais avoir le même QR code.</li>
              <li>Il encode l'identifiant unique de la commande (UUID) et pointe vers la page de confirmation Vendza.</li>
              <li>Il ne peut être utilisé qu'une seule fois — une fois scanné, la commande est définitivement marquée comme livrée.</li>
              <li>Il est valide jusqu'à la livraison ou l'annulation de la commande.</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Remise du QR code</h4>
            <p>Le vendeur est responsable de remettre le QR code au client au moment de la livraison. Ce QR code peut être :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Imprimé et collé sur le colis ou remis sur papier.</li>
              <li>Envoyé électroniquement par message ou email avant la livraison.</li>
              <li>Présenté sur l'écran du téléphone du vendeur lors de la remise en main propre.</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Conséquences du scan</h4>
            <p>Le scan du QR code par le client constitue une confirmation officielle et irréversible que :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Le client a bien reçu sa commande physiquement.</li>
              <li>La livraison est considérée comme accomplie avec succès.</li>
              <li>Le paiement sera libéré au vendeur automatiquement.</li>
              <li>Le délai de 24h pour contester commence à courir à partir de ce moment.</li>
            </ul>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl mt-3 flex gap-2.5">
              <XCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
              <p className="text-[11px] sm:text-xs text-rose-800 leading-normal font-medium">
                <strong>Tentative de fraude.</strong> Toute tentative de scanner le QR code sans avoir effectué la livraison réelle, ou de forcer un client à scanner sans avoir reçu son produit, constitue une fraude grave entraînant la suspension immédiate et définitive du compte vendeur, sans remboursement de l'abonnement.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 07 */}
        <section id="s7" className="space-y-4">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">07</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Litiges et résolution des conflits
            </h3>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Processus de résolution d'un litige</h4>
            <p>
              En cas de désaccord entre un acheteur et un vendeur, Vendza intervient comme arbitre neutre selon le processus chronologique suivant :
            </p>

            <div className="space-y-3 mt-4">
              <div className="relative pl-6 border-l-2 border-blue-500 py-1 space-y-1">
                <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                <div className="font-bold text-slate-800 text-xs flex justify-between">
                  <span>Étape 1 : Signalement du problème</span>
                  <span className="text-blue-600 font-mono text-[10px]">Dans les 24h après scan QR</span>
                </div>
                <p className="text-xs text-slate-500">
                  Le client signale le problème via la plateforme ou par email à <strong>info@vendza.store</strong> en fournissant tous les détails et preuves disponibles (photos, messages, etc.).
                </p>
              </div>

              <div className="relative pl-6 border-l-2 border-blue-500 py-1 space-y-1">
                <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                <div className="font-bold text-slate-800 text-xs flex justify-between">
                  <span>Étape 2 : Notification des deux parties</span>
                  <span className="text-blue-600 font-mono text-[10px]">Dans les 24h suivant le signalement</span>
                </div>
                <p className="text-xs text-slate-500">
                  Vendza notifie le vendeur du litige ouvert et lui demande de fournir ses preuves de livraison (photos, confirmations, échanges de messages).
                </p>
              </div>

              <div className="relative pl-6 border-l-2 border-blue-500 py-1 space-y-1">
                <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                <div className="font-bold text-slate-800 text-xs flex justify-between">
                  <span>Étape 3 : Tentative de résolution amiable</span>
                  <span className="text-blue-600 font-mono text-[10px]">Jusqu'à 48h</span>
                </div>
                <p className="text-xs text-slate-500">
                  Les deux parties ont la possibilité de se mettre d'accord directement via la messagerie Vendza. Vendza facilite le dialogue sans intervenir directement.
                </p>
              </div>

              <div className="relative pl-6 py-1 space-y-1">
                <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                <div className="font-bold text-slate-800 text-xs flex justify-between">
                  <span>Étape 4 : Décision définitive de Vendza</span>
                  <span className="text-blue-600 font-mono text-[10px]">Dans les 72h suivant l'ouverture</span>
                </div>
                <p className="text-xs text-slate-500">
                  Si aucun accord n'est trouvé, Vendza examine les preuves des deux parties et tranche définitivement. Cette décision est sans appel et immédiatement applicable.
                </p>
              </div>
            </div>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-4">Cas particulier — QR scanné mais produit non reçu</h4>
            <p>Si un client déclare ne pas avoir reçu sa commande alors que le QR code a été scanné, Vendza considère que :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Le QR code scanné constitue une <strong>présomption de livraison</strong> en faveur du vendeur.</li>
              <li>Le client dispose de <strong>24 heures</strong> après le scan pour contester et fournir des preuves.</li>
              <li>Passé ce délai, la livraison est considérée comme définitivement confirmée et aucune contestation n'est recevable.</li>
              <li>En cas de preuve de fraude avérée de la part du vendeur, Vendza peut décider d'un remboursement et suspendre le compte.</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Décision de Vendza</h4>
            <p>
              La décision rendue par Vendza à l'issue du processus de 72 heures est <strong>définitive et sans appel</strong>. En utilisant la plateforme, vous acceptez de vous soumettre à cette décision. Vendza s'engage à rendre ses décisions de manière impartiale, en se basant uniquement sur les preuves fournies par les deux parties.
            </p>
          </div>
        </section>

        {/* SECTION 08 */}
        <section id="s8" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">08</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Remboursements et annulations
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Conditions de remboursement</h4>
            <p>Un remboursement peut être accordé dans les cas suivants :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Le produit reçu ne correspond pas à la description publiée sur Vendza.</li>
              <li>Le produit reçu est défectueux ou endommagé.</li>
              <li>La commande n'a pas été livrée dans le délai annoncé et aucun accord n'a été trouvé.</li>
              <li>Une fraude avérée de la part du vendeur est constatée par Vendza.</li>
            </ul>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl mt-3 flex gap-2.5">
              <span className="text-amber-600 shrink-0 font-bold">⏰</span>
              <p className="text-[11px] sm:text-xs text-amber-800 leading-normal">
                <strong>Délai strict de 24 heures.</strong> Toute demande de remboursement doit être effectuée dans les <strong>24 heures suivant la confirmation de livraison</strong> (scan du QR code). Passé ce délai, aucune demande de remboursement ne sera acceptée, quelle qu'en soit la raison.
              </p>
            </div>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Ce que couvre le remboursement</h4>
            <p>En cas de remboursement accordé par Vendza :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Le <strong>prix du produit</strong> est remboursé intégralement par le vendeur.</li>
              <li>Les <strong>frais de livraison ne sont pas remboursés</strong> — ils couvrent un service déjà rendu.</li>
              <li>La commission Vendza prélevée sur la transaction n'est pas remboursée.</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Délai de remboursement</h4>
            <p>
              Une fois la décision de remboursement rendue par Vendza, le client recevra son remboursement sur son compte MonCash dans un délai de <strong>24 heures</strong>. Ce délai peut être prolongé en cas de problème technique indépendant de la volonté de Vendza.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Annulation avant livraison</h4>
            <p>
              Un client peut annuler sa commande tant que le vendeur n'a pas encore effectué la livraison et que le QR code n'a pas été scanné. Dans ce cas, le remboursement intégral — produit et frais de livraison — est effectué dans les 24 heures suivant l'annulation.
            </p>
          </div>
        </section>

        {/* SECTION 09 */}
        <section id="s9" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">09</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Produits et comportements interdits
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Produits strictement interdits</h4>
            <p>
              Il est strictement interdit de publier, vendre ou acheter les catégories de produits suivantes sur Vendza. Toute violation entraîne la suppression immédiate du produit et la suspension du compte :
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="p-3 bg-red-50 border border-red-150 rounded-xl flex gap-2.5 items-center">
                <span className="text-base shrink-0">🔫</span>
                <span className="text-[11px] sm:text-xs font-bold text-red-900">Armes à feu, munitions et explosifs</span>
              </div>
              <div className="p-3 bg-red-50 border border-red-150 rounded-xl flex gap-2.5 items-center">
                <span className="text-base shrink-0">💊</span>
                <span className="text-[11px] sm:text-xs font-bold text-red-900">Drogues, stupéfiants et substances illicites</span>
              </div>
              <div className="p-3 bg-red-50 border border-red-150 rounded-xl flex gap-2.5 items-center">
                <span className="text-base shrink-0">⛔</span>
                <span className="text-[11px] sm:text-xs font-bold text-red-900">Produits contrefaits, volés ou de provenance illicite</span>
              </div>
              <div className="p-3 bg-red-50 border border-red-150 rounded-xl flex gap-2.5 items-center">
                <span className="text-base shrink-0">🔞</span>
                <span className="text-[11px] sm:text-xs font-bold text-red-900">Contenu adulte, pornographique ou sexuellement explicite</span>
              </div>
              <div className="p-3 bg-red-50 border border-red-150 rounded-xl flex gap-2.5 items-center sm:col-span-2">
                <span className="text-base shrink-0">💉</span>
                <span className="text-[11px] sm:text-xs font-bold text-red-900">Médicaments non homologués ou produits pharmaceutiques sans prescription</span>
              </div>
            </div>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-4">Comportements strictement interdits</h4>
            <p>Les comportements suivants sont interdits sur Vendza et peuvent entraîner une suspension immédiate du compte :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li><strong>Faux avis et manipulation de notes</strong> — publier de faux avis sur sa propre boutique ou sur celle d'un concurrent, ou inciter des tiers à le faire.</li>
              <li><strong>Spam et harcèlement</strong> — envoyer des messages non sollicités, harceler ou menacer d'autres utilisateurs via la messagerie Vendza.</li>
              <li><strong>Création de comptes multiples</strong> — créer un nouveau compte après une suspension pour contourner les sanctions.</li>
              <li><strong>Prix trompeurs</strong> — afficher des prix artificiellement gonflés pour créer une fausse impression de remise, ou modifier le prix après la commande.</li>
              <li><strong>Photos trompeuses</strong> — utiliser des photos volées, modifiées ou ne représentant pas fidèlement le produit réel vendu.</li>
              <li><strong>Fraude au QR code</strong> — scanner ou faire scanner un QR code sans remise réelle du produit commandé.</li>
              <li><strong>Usurpation d'identité</strong> — se faire passer pour un autre utilisateur, pour Vendza ou pour une autorité.</li>
            </ul>
          </div>
        </section>

        {/* SECTION 10 */}
        <section id="s10" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">10</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Sanctions et suspension de compte
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Principe de sanctions</h4>
            <p>
              Vendza applique des sanctions proportionnelles à la gravité de l'infraction commise. La politique de sanction est la suivante : <strong>suspension immédiate et définitive selon la gravité</strong> de la violation. Vendza se réserve le droit d'apprécier la gravité de chaque situation individuellement.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Tableau des sanctions</h4>
            <div className="overflow-x-auto border border-slate-150 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-150">
                    <th className="p-3">Type d'infraction</th>
                    <th className="p-3">Sanction applicable</th>
                    <th className="p-3 text-right">Préavis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="p-3 font-medium text-slate-800">Fraude au QR code, produits illicites, usurpation d'identité</td>
                    <td className="p-3 text-rose-600 font-bold">Suspension immédiate et définitive</td>
                    <td className="p-3 text-right">Aucun préavis</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-800">Faux avis, spam grave, escroquerie avérée</td>
                    <td className="p-3 text-rose-600 font-bold">Suspension immédiate et définitive</td>
                    <td className="p-3 text-right">Aucun préavis</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-800">Création de compte après suspension</td>
                    <td className="p-3 text-rose-600 font-bold">Suspension immédiate et définitive</td>
                    <td className="p-3 text-right">Aucun préavis</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-800">Photos trompeuses, description inexacte grave</td>
                    <td className="p-3 text-amber-600 font-bold">Suspension temporaire (48h)</td>
                    <td className="p-3 text-right">48 heures</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-800">Prix abusifs, harcèlement mineur</td>
                    <td className="p-3 text-amber-600 font-bold">Avertissement puis suspension 48h</td>
                    <td className="p-3 text-right">48 heures</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-800">Non-respect des délais de livraison répété</td>
                    <td className="p-3 text-slate-500 font-bold">Avertissement + baisse de visibilité</td>
                    <td className="p-3 text-right">48 heures</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Procédure de suspension</h4>
            <p>
              En cas de suspension avec préavis de 48 heures, Vendza notifiera l'utilisateur par email en précisant la raison de la suspension et la date d'entrée en vigueur. L'utilisateur dispose de ce délai pour régulariser sa situation ou contester la décision par email à <strong>info@vendza.store</strong>.
            </p>
            <p>
              En cas de suspension immédiate, l'utilisateur sera notifié par email après l'application de la sanction. Aucun remboursement d'abonnement ne sera effectué en cas de suspension pour faute grave.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Contestation d'une sanction</h4>
            <p>
              Tout utilisateur sanctionné peut contester la décision en envoyant un email détaillé à <strong>info@vendza.store</strong> dans les 7 jours suivant la notification. Vendza examinera la contestation et communiquera sa décision finale dans un délai de 5 jours ouvrables. La décision rendue sur contestation est définitive.
            </p>
          </div>
        </section>

        {/* SECTION 11 */}
        <section id="s11" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">11</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Responsabilités de Vendza
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Ce que Vendza garantit</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>La sécurité des paiements via le système d'escrow MonCash.</li>
              <li>La confidentialité de vos données personnelles conformément à notre Politique de Confidentialité.</li>
              <li>Un traitement impartial des litiges dans le délai de 72 heures.</li>
              <li>La disponibilité de la plateforme avec un objectif de 99% de temps de fonctionnement.</li>
              <li>La notification préalable de tout changement majeur des conditions.</li>
            </ul>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Responsabilité partagée</h4>
            <p>
              Vendza et le vendeur partagent la responsabilité en cas de produit défectueux ou non conforme. Le vendeur est responsable en premier lieu de la qualité et de la conformité de ses produits. Vendza intervient en tant que médiateur et peut être tenu partiellement responsable si une défaillance de ses systèmes de vérification a permis la mise en vente d'un produit frauduleux.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Limitations de responsabilité</h4>
            <p>Vendza ne peut être tenu responsable dans les situations suivantes :</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-500">
              <li>Les actions, omissions ou manquements des vendeurs indépendants.</li>
              <li>La qualité, l'authenticité ou la conformité des produits vendus par les vendeurs.</li>
              <li>Les interruptions de service dues à des causes extérieures (pannes internet, force majeure).</li>
              <li>Les pertes résultant d'un accès non autorisé à votre compte dû à votre négligence.</li>
              <li>Les décisions commerciales prises par les vendeurs (prix, délais, disponibilité).</li>
            </ul>
          </div>
        </section>

        {/* SECTION 12 */}
        <section id="s12" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">12</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Propriété intellectuelle
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Propriété de Vendza</h4>
            <p>
              Le nom "Vendza", le logo, le design de la plateforme, les textes, les fonctionnalités et tous les éléments originaux de la plateforme sont la propriété exclusive de Vendza et sont protégés par les droits d'auteur applicables. Toute reproduction, modification ou utilisation non autorisée est strictement interdite.
            </p>

            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mt-3">Contenu des vendeurs</h4>
            <p>
              En publiant des photos, descriptions ou tout autre contenu sur Vendza, vous accordez à Vendza une licence non exclusive pour afficher, reproduire et promouvoir ce contenu dans le cadre de la plateforme. Vous garantissez posséder tous les droits nécessaires sur le contenu que vous publiez.
            </p>
          </div>
        </section>

        {/* SECTION 13 */}
        <section id="s13" className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">13</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Modifications des conditions
            </h3>
          </div>
          
          <div className="space-y-2.5">
            <p>
              Vendza se réserve le droit de modifier les présentes Conditions d'Utilisation à tout moment. Toute modification significative sera notifiée aux utilisateurs par email et par notification sur la plateforme au moins <strong>15 jours avant son entrée en vigueur</strong>.
            </p>
            <p>
              En continuant à utiliser Vendza après l'entrée en vigueur des nouvelles conditions, vous les acceptez intégralement. Si vous n'allez pas accepter les modifications, vous devez cesser d'utiliser la plateforme et supprimer votre compte avant la date d'entrée en vigueur.
            </p>
            <p>
              La date de la dernière mise à jour est indiquée en haut de ce document. L'historique des versions précédentes est disponible sur demande à <strong>info@vendza.store</strong>.
            </p>
          </div>
        </section>

        {/* SECTION 14 */}
        <section id="s14" className="space-y-4">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">14</span>
            <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base">
              Contact et support
            </h3>
          </div>
          
          <p>
            Pour toute question relative aux présentes Conditions d'Utilisation, tout signalement d'infraction ou toute demande de support, notre équipe est disponible et s'engage à vous répondre dans un délai de <strong>48 heures ouvrables</strong>.
          </p>

          <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 sm:p-5 text-center space-y-4 mt-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">📬 Contactez l'équipe Vendza</p>
            
            <div className="flex flex-wrap justify-center gap-3">
              <a 
                href="mailto:info@vendza.store" 
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-2xs transition"
              >
                <Mail size={14} className="text-blue-500" />
                <span>info@vendza.store</span>
              </a>
              <a 
                href="tel:+50941953739" 
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-2xs transition"
              >
                <Phone size={14} className="text-emerald-500" />
                <span>+509 4195 37 39</span>
              </a>
              <a 
                href="https://www.vendza.store" 
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-2xs transition"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe size={14} className="text-indigo-500" />
                <span>www.vendza.store</span>
              </a>
            </div>

            <p className="text-[10px] sm:text-[11px] text-slate-400 max-w-lg mx-auto leading-relaxed pt-2 border-t border-slate-200/60">
              Document rédigé et approuvé par l'équipe Vendza S.A. · Version 1.0 · Mai 2026<br />
              Ces conditions constituent l'accord légal complet entre Vendza et ses utilisateurs.<br />
              À lire conjointement avec la Politique de Confidentialité.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
};
