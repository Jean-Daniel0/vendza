import React, { useState } from 'react';
import { Shield, Sparkles, MapPin, CheckCircle, Mail, Phone, Clock, ArrowRight, Heart } from 'lucide-react';

export const AboutPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !body) return;
    setSubmitted(true);
    setName('');
    setEmail('');
    setSubject('');
    setBody('');
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="space-y-12">
      {/* Toast popup */}
      {submitted && (
        <div className="fixed bottom-5 right-5 z-60 bg-teal-900 border border-teal-400 text-teal-100 text-xs font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-teal-400" />
          <span>✓ Message envoyé avec succès à l'équipe Vendza ! Nous vous répondrons sous 24h.</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0c1445] via-[#101f5c] to-[#043430] text-white p-8 sm:p-12 shadow-sm text-center">
        <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <span className="text-[10px] bg-teal-500/20 text-teal-300 font-mono font-extrabold uppercase tracking-widest border border-teal-400/20 px-3 py-1 rounded-full backdrop-blur-xs">
            Notre Histoire
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight mt-2">
            La confiance au cœur <br /> du commerce <em className="text-teal-300 font-normal">haïtien</em>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-lg mx-auto font-medium">
            Vendza est né d'une conviction simple : le commerce en ligne en Haïti doit reposer sur la transparence, la sécurité et la confiance mutuelle entre acheteurs et vendeurs.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-7 space-y-4">
          <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">
            Notre Mission
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-black text-[#0c1445] tracking-tight">
            Construire un commerce <em className="text-teal-600 font-sans font-bold">de confiance</em> en Haïti
          </h2>
          <div className="text-xs leading-relaxed text-slate-500 space-y-3 font-medium">
            <p>
              Vendza est une marketplace haïtienne qui connecte acheteurs et vendeurs locaux avec un système de paiement sécurisé unique : votre argent est retenu par Vendza et libéré au vendeur uniquement après confirmation de la livraison par QR code.
            </p>
            <p>
              Ce modèle protège les deux parties — l'acheteur contre les fraudes, le vendeur contre les faux litiges. Une approche de séquestre numérique pensée sur-mesure pour la réalité du marché haïtien.
            </p>
          </div>
        </div>

        <div className="md:col-span-5 bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col justify-center text-center space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <span className="block text-lg font-extrabold text-blue-600 font-mono">500+</span>
              <span className="text-[9px] text-[#9aa3bf] font-bold uppercase tracking-wide block">Produits</span>
            </div>
            <div className="w-px h-8 bg-slate-200 self-center mx-auto" />
            <div className="space-y-0.5">
              <span className="block text-lg font-extrabold text-blue-600 font-mono">120+</span>
              <span className="text-[9px] text-[#9aa3bf] font-bold uppercase tracking-wide block">Vendeurs</span>
            </div>
          </div>
          <div className="h-px bg-slate-200" />
          <div>
            <span className="inline-block bg-teal-50 border border-teal-100 rounded-full px-4 py-1 text-teal-700 font-black text-[9px] uppercase tracking-wider">
              🛡️ 100% Transactions Sécurisées
            </span>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ce qui nous guide</span>
          <h2 className="font-serif text-lg sm:text-xl font-black text-[#0c1445]">Nos valeurs fondamentales</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Chaque décision que nous prenons est guidée par ces trois piliers d'excellence.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-xs">
          <div className="bg-white border hover:border-blue-300 transition-all rounded-3xl p-5 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
              🔒
            </div>
            <h3 className="font-serif text-xs font-black text-slate-800 uppercase tracking-wider">Confiance &amp; sécurité</h3>
            <p className="text-slate-500 leading-relaxed font-semibold">
              Notre système de garantie et de validation par QR code garantit que chaque transaction est honnête. Ni l'acheteur ni le vendeur ne peut être trompé.
            </p>
          </div>

          <div className="bg-white border hover:border-amber-300 transition-all rounded-3xl p-5 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold">
              🇭🇹
            </div>
            <h3 className="font-serif text-xs font-black text-slate-800 uppercase tracking-wider">Ancrage local</h3>
            <p className="text-slate-500 leading-relaxed font-semibold">
              Vendza est conçu pour et par des Haïtiens. Monnaie locale, départements et communes d'Haïti, support en créole — nous pensons local avant tout.
            </p>
          </div>

          <div className="bg-white border hover:border-teal-300 transition-all rounded-3xl p-5 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl font-bold">
              🚀
            </div>
            <h3 className="font-serif text-xs font-black text-slate-800 uppercase tracking-wider">Innovation &amp; accessibilité</h3>
            <p className="text-slate-500 leading-relaxed font-semibold">
              Pas besoin d'être technicien pour vendre sur Vendza. Notre plateforme est pensée pour être simple, rapide et accessible à tous, partout en Haïti.
            </p>
          </div>
        </div>
      </section>

      {/* How it works grid */}
      <section className="bg-slate-50/50 border border-slate-100 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Le processus de confiance</span>
          <h2 className="font-serif text-lg sm:text-xl font-black text-[#0c1445]">Comment fonctionnent les paiements sécurisés Vendza</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-xs font-sans">
          {[
            { step: '01', icon: '🛍️', title: 'Commande', desc: 'Le client dépose son paiement en Gourdes dans le système sécurisé.' },
            { step: '02', icon: '🔒', title: 'Sécurisation', desc: "L'argent est bloqué par Vendza, protégeant ainsi le vendeur contre les faux litiges." },
            { step: '03', icon: '📦', title: 'Envoi', desc: 'Le vendeur s’occupe du colisage et de la livraison de la commande.' },
            { step: '04', icon: '📱', title: 'Validation QR', desc: "À la livraison physique, le code QR est scanné pour confirmer la conformité." },
            { step: '05', icon: '✅', title: 'Paiement', desc: "L'argent est immédiatement versé sur le compte mobile du vendeur." }
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl relative shadow-2xs flex flex-col justify-between space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-sm font-black text-blue-900 font-mono tracking-wider">{item.step}</span>
                <span className="text-lg">{item.icon}</span>
              </div>
              <h4 className="font-serif text-xs font-black text-slate-800 tracking-tight">{item.title}</h4>
              <p className="text-slate-500 text-[10.5px] leading-relaxed font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team Section */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">L'équipe</span>
          <h2 className="font-serif text-lg sm:text-xl font-black text-[#0c1445]">Le fondateur de Vendza</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">La vision et la technique réunies pour propulser le commerce sécurisé en Haïti.</p>
        </div>

        <div className="max-w-md mx-auto text-xs font-sans text-center">
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-2xs p-6 space-y-4 font-sans">
            <div className="w-16 h-16 rounded-2xl mx-auto bg-gradient-to-br from-[#0c1445] to-[#0d9488] flex items-center justify-center text-white text-2xl font-serif font-black shadow-md">
              JD
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight">Jean-Daniel MICHEL</h4>
              <p className="text-[10.5px] text-teal-600 font-bold uppercase tracking-wider">Entrepreneur &amp; Développeur</p>
            </div>
            <p className="text-slate-500 leading-relaxed font-medium text-[11px] max-w-xs mx-auto">
              Passionné par la tech, l'innovation financière et le développement économique local, j'ai conçu et développé la plateforme Vendza pour offrir une infrastructure de commerce sécurisée, moderne et adaptée à la réalité haïtienne.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch pt-4">
        <div className="md:col-span-5 bg-white border border-slate-100 p-5 rounded-3xl shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Une Question ?
            </span>
            <h2 className="font-serif text-lg font-black text-[#0c1445] tracking-tight">Contactez Vendza</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">Une suggestion ou une demande de partenariat ? Notre équipe est disponible en continu.</p>
          </div>

          <div className="space-y-3 text-xs font-sans">
            <div className="flex items-center gap-3 p-2 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-base text-slate-400">📧</span>
              <div>
                <div className="text-[9px] text-[#9aa3bf] font-bold uppercase tracking-wide">Email direct</div>
                <a href="mailto:vendza@gmail.com" className="font-semibold text-blue-600">vendza@gmail.com</a>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-base text-slate-400">📞</span>
              <div>
                <div className="text-[9px] text-[#9aa3bf] font-bold uppercase tracking-wide">Téléphone</div>
                <a href="tel:+50941953739" className="font-semibold text-slate-700">+509 4195 3739</a>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-base text-slate-400">📍</span>
              <div>
                <div className="text-[9px] text-[#9aa3bf] font-bold uppercase tracking-wide font-sans">Siège</div>
                <span className="font-semibold text-slate-700">Port-au-Prince, Haïti</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 bg-white border border-slate-100 p-6 rounded-3xl shadow-2xs">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Votre nom</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 focus:outline-none focus:border-blue-600 rounded-xl bg-slate-50/60" 
                  placeholder="Nom complet" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email <span className="text-red-500">*</span></label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full py-2 px-3 border border-slate-200 focus:outline-none focus:border-blue-600 rounded-xl bg-slate-50/60" 
                  placeholder="votre@email.com" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sujet</label>
              <input 
                type="text" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full py-2 px-3 border border-slate-200 focus:outline-none focus:border-blue-600 rounded-xl bg-slate-50/60" 
                placeholder="Ex : Problème technique, Devenir Vendeur" 
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Message <span className="text-red-500">*</span></label>
              <textarea 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={4}
                className="w-full py-2 px-3 border border-slate-200 focus:outline-none focus:border-blue-600 rounded-xl bg-slate-50/60 font-medium leading-relaxed" 
                placeholder="Rédigez votre demande ici..." 
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#0c1445] hover:bg-blue-950 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider text-[10px]"
            >
              Envoyer le message <ArrowRight size={13} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
