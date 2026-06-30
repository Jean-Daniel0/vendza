import React, { useState, useEffect } from 'react';
import { 
  Check, Save, ArrowRight, ArrowLeft, Paintbrush, 
  HelpCircle, Sparkles, Image as ImageIcon, Plus, Trash2, X, FileText, Info, DollarSign, MapPin
} from 'lucide-react';
import { Product } from '../types';

interface CreateProductProps {
  onAddProduct: (product: Omit<Product, 'id' | 'vendeur' | 'vendeurId' | 'rating' | 'dateCreation'>) => void;
  onUpdateProduct?: (productId: string, updates: Partial<Product>) => void;
  productToEdit?: Product | null;
  clearProductToEdit?: () => void;
  onNavigate: (view: string) => void;
  user?: any;
}

const COMMUNES: Record<string, string[]> = {
  Ouest: ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Croix-des-Bouquets', 'Léogâne', 'Carrefour'],
  Nord: ['Cap-Haïtien', 'Limbé', 'Plaisance', 'Grande-Rivière du Nord'],
  Sud: ['Les Cayes', 'Jacmel', 'Saint-Louis du Sud', 'Aquin'],
  Artibonite: ['Gonaïves', 'Saint-Marc', 'Gros-Morne', 'Dessalines'],
  Centre: ['Hinche', 'Mirebalais', 'Lascahobas'],
  'Nord-Est': ['Fort-Liberté', 'Ouanaminthe', 'Trou-du-Nord'],
  'Nord-Ouest': ['Port-de-Paix', 'Saint-Louis du Nord', 'Môle Saint-Nicolas'],
  Nippes: ['Miragoâne', 'Petit-Goâve', 'Grand-Goâve'],
  'Sud-Est': ['Jacmel', 'Bainet', 'Belle-Anse'],
  "Grand'Anse": ['Jérémie', 'Moron', "Anse-d'Hainault"]
};

const PRESET_IMAGES = [
  { label: 'Sac à dos noir', url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12' },
  { label: 'Casque Audio', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e' },
  { label: 'Montre analogique', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30' },
  { label: 'Sneaker rouge', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff' },
  { label: 'Robe d\'été fleurie', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f' },
  { label: 'Parfum de luxe', url: 'https://images.unsplash.com/photo-1594035910387-fea47794261f' },
];

export const CreateProduct: React.FC<CreateProductProps> = ({
  onAddProduct,
  onUpdateProduct,
  productToEdit = null,
  clearProductToEdit,
  onNavigate,
  user = null
}) => {
  const [step, setStep] = useState<number>(1);
  const isEditing = !!productToEdit;
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const isPaidPlan = user?.plan === 'Pro Local' || user?.plan === 'Pro National';

  // Form Field States
  const [nom, setNom] = useState<string>('');
  const [cat, setCat] = useState<string>('');
  const [desc, setDesc] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  
  const [prix, setPrix] = useState<number>(0);
  const [oldPrice, setOldPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(5);

  const [mainPreviewUrl, setMainPreviewUrl] = useState<string>('');
  const [galleryPreview, setGalleryPreview] = useState<string[]>(['', '', '', '', '']);

  const [selectedCouleurs, setSelectedCouleurs] = useState<string[]>(['Bleu']);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [selectedTailles, setSelectedTailles] = useState<string[]>(['M']);
  const [capacitesStr, setCapacitesStr] = useState<string>('');
  const [delaiLivraison, setDelaiLivraison] = useState<string>('48h');
  const [statut, setStatut] = useState<'actif' | 'brouillon'>('actif');

  const [customSpecName, setCustomSpecName] = useState<string>('');
  const [customSpecValue, setCustomSpecValue] = useState<string>('');
  const [specs, setSpecs] = useState<Record<string, string>>({});

  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedCommune, setSelectedCommune] = useState<string>('');

  const PRESET_COLORS = [
    { label: 'Rouge', color: '#dc2626' },
    { label: 'Bleu', color: '#2563eb' },
    { label: 'Noir', color: '#0c1445' },
    { label: 'Blanc', color: '#ffffff', border: true },
    { label: 'Vert', color: '#16a34a' },
    { label: 'Jaune', color: '#f59e0b' }
  ];

  const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

  // Seed product data on edit or force free plan registration location
  useEffect(() => {
    if (!isPaidPlan && user) {
      setSelectedDept(user.departement || '');
      setSelectedCommune(user.commune || '');
    }

    if (productToEdit) {
      setNom(productToEdit.nom || '');
      setCat(productToEdit.cat || '');
      setDesc(productToEdit.desc || '');
      setTags(productToEdit.tags || []);
      setPrix(productToEdit.prix || 0);
      setOldPrice(productToEdit.oldPrice || 0);
      setStock(productToEdit.stock !== undefined ? productToEdit.stock : 5);
      setStatut(productToEdit.statut || 'actif');
      setDelaiLivraison(productToEdit.delaiLivraison || '48h');
      
      const colors = productToEdit.couleurs || [];
      setSelectedCouleurs(colors);
      const customOnes = colors.filter(c => !PRESET_COLORS.some(pc => pc.label === c));
      setCustomColors(customOnes);

      const sizes = productToEdit.tailles || [];
      setSelectedTailles(sizes);

      setCapacitesStr((productToEdit.capacites || []).join(', '));

      // Parse characteristics
      const originSpecs = { ...(productToEdit.caracteristiques || {}) };
      const originStr = originSpecs['Origine'] || '';
      delete originSpecs['Origine'];
      setSpecs(originSpecs);

      if (isPaidPlan) {
        if (originStr) {
          const parts = originStr.split(',');
          if (parts.length >= 2) {
            const comm = parts[0].trim();
            const dept = parts[1].trim();
            setSelectedDept(dept);
            setSelectedCommune(comm);
          } else if (parts.length === 1 && parts[0].trim()) {
            setSelectedCommune(parts[0].trim());
          }
        } else {
          setSelectedDept('');
          setSelectedCommune('');
        }
      }

      setMainPreviewUrl(productToEdit.image_url || '');
      const originalGallery = productToEdit.gallery || [];
      const updatedGallery = ['', '', '', '', ''];
      for (let i = 0; i < 5; i++) {
        if (originalGallery[i]) {
          updatedGallery[i] = originalGallery[i];
        }
      }
      setGalleryPreview(updatedGallery);
    } else {
      // Clear values to default
      setNom('');
      setCat('');
      setDesc('');
      setTags([]);
      setPrix(0);
      setOldPrice(0);
      setStock(5);
      setSelectedCouleurs(['Bleu']);
      setCustomColors([]);
      setSelectedTailles(['M']);
      setCapacitesStr('');
      setDelaiLivraison('48h');
      setStatut('actif');
      if (isPaidPlan) {
        setSelectedDept('');
        setSelectedCommune('');
      }
      setSpecs({});
      setMainPreviewUrl('');
      setGalleryPreview(['', '', '', '', '']);
    }
  }, [productToEdit, isPaidPlan, user?.id, user?.departement, user?.commune]);

  // Completion criteria evaluation
  const checks = [
    { label: 'Nom du produit (>= 3 chars)', ok: nom.trim().length >= 3 },
    { label: 'Catégorie', ok: cat !== '' },
    { label: 'Description (>= 10 chars)', ok: desc.trim().length >= 10 },
    { label: 'Prix de vente (> 0 HTG)', ok: prix > 0 },
    { label: 'Stock valide', ok: stock >= 0 },
    { label: 'Image principale du produit', ok: mainPreviewUrl !== '' },
    { label: 'Origine Département', ok: selectedDept !== '' },
    { label: 'Origine Commune', ok: selectedCommune !== '' },
  ];

  const doneChecks = checks.filter(c => c.ok).length;
  const completionPct = Math.round((doneChecks / checks.length) * 100);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = tagsInput.trim().toLowerCase();
      if (val && !tags.includes(val)) {
        setTags(prev => [...prev, val]);
      }
      setTagsInput('');
    }
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleAddSpec = () => {
    if (!customSpecName.trim() || !customSpecValue.trim()) return;
    setSpecs(prev => ({ ...prev, [customSpecName.trim()]: customSpecValue.trim() }));
    setCustomSpecName('');
    setCustomSpecValue('');
  };

  const handleRemoveSpec = (key: string) => {
    setSpecs(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("La taille de l'image ne peut pas dépasser 5 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setMainPreviewUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGallerySlotChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("La taille de l'image ne peut pas dépasser 5 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const updated = [...galleryPreview];
          updated[index] = event.target.result as string;
          setGalleryPreview(updated);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveGallerySlot = (index: number) => {
    const updated = [...galleryPreview];
    updated[index] = '';
    setGalleryPreview(updated);
  };

  // Publish / Save product
  const handleSave = async (targetStatut?: 'actif' | 'brouillon') => {
    const finalStatut = targetStatut || statut;
    const isSaveAsDraft = finalStatut === 'brouillon';

    if (!nom.trim()) {
      alert("⚠️ Le nom du produit est obligatoire.");
      return;
    }

    if (!isSaveAsDraft && completionPct < 70) {
      alert(`⚠️ Fiche incomplète (${completionPct}%). Veuillez atteindre au moins 70% de complétion pour publier votre produit, ou sauvegardez-le comme Brouillon.`);
      return;
    }

    setIsAnalyzing(true);
    let seoScore = 100;
    let seoWarn = "";

    if (mainPreviewUrl) {
      try {
        const isBase64 = mainPreviewUrl.startsWith('data:');
        const response = await fetch('/api/moderate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageUrl: isBase64 ? undefined : mainPreviewUrl,
            imageBase64: isBase64 ? mainPreviewUrl : undefined
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.shouldLowerSeo) {
            seoScore = 30; // Reduce ranking score
            seoWarn = result.warning || "Qualité d'image insuffisante ou illustration détectée.";
          }
        } else {
          console.warn("Sightengine proxy returned non-OK status");
        }
      } catch (err) {
        console.error("Failed to moderate product image:", err);
      }
    }
    setIsAnalyzing(false);

    const compiledCaracs: Record<string, string> = {
      ...specs,
      'Origine': `${selectedCommune}, ${selectedDept}`
    };

    const cleanGallery = [mainPreviewUrl, ...galleryPreview.filter(Boolean)];
    const compiledCapacites = capacitesStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (isEditing && productToEdit && onUpdateProduct) {
      onUpdateProduct(productToEdit.id, {
        nom,
        cat,
        desc,
        prix,
        oldPrice: oldPrice > 0 ? oldPrice : undefined,
        stock,
        image_url: mainPreviewUrl,
        couleurs: selectedCouleurs,
        tailles: selectedTailles,
        capacites: compiledCapacites,
        caracteristiques: compiledCaracs,
        tags: tags.length > 0 ? tags : [cat.toLowerCase()],
        gallery: cleanGallery,
        statut: finalStatut,
        delaiLivraison,
        departement: selectedDept,
        commune: selectedCommune,
        scoreReferencement: seoScore,
        seoWarning: seoWarn || undefined
      });
      if (seoScore < 100) {
        alert(`📢 Produit enregistré mais référencement réduit...\n\n⚠️ ${seoWarn}\n\nVotre produit a été mis à jour, mais son référencement automatique dans le catalogue a été abaissé à ${seoScore}/100. Pensez à utiliser une photo physique nette pour retrouver un classement optimal.`);
      } else {
        alert(isSaveAsDraft ? "💾 Brouillon enregistré avec succès !" : "✅ Fiche produit mise à jour avec succès (Référencement Optimal ✨) !");
      }
    } else {
      onAddProduct({
        nom,
        cat,
        desc,
        prix,
        oldPrice: oldPrice > 0 ? oldPrice : undefined,
        stock,
        image_url: mainPreviewUrl,
        couleurs: selectedCouleurs,
        tailles: selectedTailles,
        capacites: compiledCapacites,
        caracteristiques: compiledCaracs,
        statut: finalStatut,
        tags: tags.length > 0 ? tags : [cat.toLowerCase(), 'nouveau'],
        gallery: cleanGallery,
        delaiLivraison,
        departement: selectedDept,
        commune: selectedCommune,
        scoreReferencement: seoScore,
        seoWarning: seoWarn || undefined
      });
      if (seoScore < 100) {
        alert(`📢 Produit publié mais référencement réduit...\n\n⚠️ ${seoWarn}\n\nVotre produit a été publié avec succès, mais son référencement automatique dans le catalogue a été abaissé à ${seoScore}/100. Pensez à utiliser une photo physique nette pour retrouver un classement optimal.`);
      } else {
        alert(isSaveAsDraft ? "💾 Brouillon enregistré" : "✅ Nouveau produit créé et mis en vente avec succès - Référencement Optimal ✨ !");
      }
    }

    if (clearProductToEdit) clearProductToEdit();
    onNavigate('vendor-dashboard');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-1 sm:px-4">
      {/* breadcrumb back row */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Espace Marchand</span>
          <h1 className="font-serif text-xl font-bold text-[#0c1445]">
            {isEditing ? "Modifier intégralement le produit" : "Ajouter un produit en vente"}
          </h1>
        </div>
        <button
          onClick={() => {
            if (clearProductToEdit) clearProductToEdit();
            onNavigate('vendor-dashboard');
          }}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl cursor-pointer transition"
        >
          Annuler
        </button>
      </div>

      {/* Completion Score header in style of creer-produit-v2.css */}
      <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between text-xs font-bold text-[#0c1445]">
          <span className="uppercase tracking-wide font-black">Complétion de la fiche technique</span>
          <span className="font-mono text-blue-600 text-sm font-black">{completionPct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {checks.map((check, idx) => (
            <span 
              key={idx} 
              className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 transition ${
                check.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-200/50'
              }`}
            >
              {check.ok ? '✓' : '○'} {check.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 leading-normal">
          * Atteignez au moins <strong className="text-slate-600">70% de complétion</strong> pour enregistrer ou publier ce produit.
        </p>
      </div>

      {/* Dynamic Nav Stepper */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-100">
        {[
          { label: 'Général', id: 1 },
          { label: 'Tarification', id: 2 },
          { label: 'Images', id: 3 },
          { label: 'Variantes', id: 4 },
          { label: 'Expédition', id: 5 }
        ].map((s, idx) => (
          <React.Fragment key={s.id}>
            {idx > 0 && <div className={`flex-1 h-0.5 min-w-[8px] ${step >= s.id ? 'bg-emerald-500' : 'bg-slate-100'}`} />}
            <button
              onClick={() => setStep(s.id)}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs transition cursor-pointer shrink-0 ${
                step === s.id 
                  ? 'bg-[#0c1445] text-white shadow-xs font-bold' 
                  : step > s.id 
                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-100' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200/50'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                step > s.id ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600 font-bold'
              }`}>
                {step > s.id ? '✓' : s.id}
              </span>
              <span>{s.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Main Forms wizard */}
      <div className="bg-white border border-slate-200/60 p-5 rounded-3xl shadow-xs space-y-5">
        
        {/* STEP 1: GENERAL INFO */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-50">
              <span className="text-xl">📝</span>
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0c1445]">Informations principales</h3>
                <p className="text-[10px] text-slate-400">Définissez le nom, la catégorie et les termes d'indexation</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nom du produit <span className="text-red-500">*</span></label>
                <span className={`text-[10px] font-mono ${nom.length > 50 ? 'text-amber-500' : 'text-slate-400'}`}>{nom.length}/80</span>
              </div>
              <input
                type="text"
                maxLength={80}
                placeholder="Ex : Robe rétro bleu marine en fil de soie"
                className="w-full py-2.5 px-3.5 border border-slate-200 rounded-xl text-xs bg-slate-50 hover:bg-white focus:bg-white focus:border-blue-600 transition outline-none shadow-3xs"
                value={nom}
                onChange={e => setNom(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Catégorie <span className="text-red-500">*</span></label>
              <select
                className="w-full py-2.5 px-3.5 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-700 font-bold hover:bg-white focus:bg-white transition shadow-3xs"
                value={cat}
                onChange={e => setCat(e.target.value)}
              >
                <option value="">Sélectionnez une catégorie…</option>
                <option value="Mode">👗 Mode</option>
                <option value="Électronique">📱 Électronique</option>
                <option value="Audio">🎧 Audio</option>
                <option value="Wearable">⌚ Wearable</option>
                <option value="Maison">🏠 Maison</option>
                <option value="Photo">📷 Photo</option>
                <option value="Gaming">🎮 Gaming</option>
                <option value="Beauté">🧴 Beauté</option>
                <option value="Accessoires">🎒 Accessoires</option>
                <option value="Alimentaire">🛒 Alimentaire</option>
                <option value="Sport">⚽ Sport</option>
                <option value="Autre">📦 Autre</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Description <span className="text-red-500">*</span></label>
                <span className="text-[10px] font-mono text-slate-400">{desc.length}/500</span>
              </div>
              <textarea
                maxLength={500}
                placeholder="Décrivez votre produit en détails (matière, qualité, usage, dimensions)..."
                rows={4}
                className="w-full text-xs text-slate-700 p-3.5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white focus:bg-white focus:border-blue-600 transition outline-none overflow-y-auto leading-relaxed shadow-3xs"
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Mots clés / Tags</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-2xl min-h-[44px]">
                {tags.map((tg, idx) => (
                  <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                    #{tg}
                    <button type="button" onClick={() => handleRemoveTag(idx)} className="text-blue-500 hover:text-red-500 cursor-pointer">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Tapez un mot puis Entré..."
                  className="bg-transparent border-none outline-none text-xs flex-1 min-w-[120px]"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  onKeyDown={handleAddTag}
                />
              </div>
              <span className="text-[10px] text-slate-400 leading-normal block">Ajoutez des tags comme "homme", "luxe", "promotion" pour optimiser les filtres</span>
            </div>
          </div>
        )}

        {/* STEP 2: PRICING */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-50">
              <span className="text-xl">💰</span>
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0c1445]">Tarification & Stocks</h3>
                <p className="text-[10px] text-slate-400">Configurez le prix de vente en gourdes et l'état des réserves</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Prix de vente (Gdes/HTG) *</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    className="w-full py-2.5 pl-3 pr-8 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50 hover:bg-white focus:bg-white focus:border-blue-600 transition outline-none shadow-3xs"
                    value={prix || ''}
                    onChange={e => setPrix(Math.max(0, Number(e.target.value)))}
                  />
                  <span className="absolute top-2.5 right-3 font-bold font-mono text-[10.5px] text-slate-400">HTG</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Ancien Prix (Barré) <span className="text-[10px] text-slate-400 lowercase">(optionnel)</span></label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="Pour simuler une remise"
                    className="w-full py-2.5 pl-3 pr-8 border border-slate-200 rounded-xl text-xs font-mono bg-slate-50 hover:bg-white focus:bg-white focus:border-blue-600 transition outline-none shadow-3xs text-slate-500"
                    value={oldPrice || ''}
                    onChange={e => setOldPrice(Math.max(0, Number(e.target.value)))}
                  />
                  <span className="absolute top-2.5 right-3 font-mono text-[10.5px] text-slate-400">HTG</span>
                </div>
              </div>
            </div>

            {/* Price Preview in style of poser-html */}
            {prix > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex justify-between items-center animate-fade-in shadow-3xs">
                <div>
                  <span className="text-[10px] font-black text-emerald-800 uppercase block tracking-wider leading-none mb-1">Prix final affiché</span>
                  <span className="font-mono text-emerald-700 font-extrabold text-sm">{prix.toLocaleString('fr-FR')} HTG (Gourdes)</span>
                </div>
                {oldPrice > prix ? (
                  <span className="bg-red-500 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-4xs">
                    -{Math.round((1 - prix / oldPrice) * 100)}% de rabais
                  </span>
                ) : (
                  <span className="text-[10.5px] font-semibold text-slate-600 bg-white px-2 py-1 rounded-lg">Standard</span>
                )}
              </div>
            )}

            <div className="space-y-2 border-t pt-3 border-dashed border-slate-100">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Quantité disponible en stock *</label>
              <input
                type="number"
                min="0"
                className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50 hover:bg-white focus:bg-white focus:border-blue-600 transition shadow-3xs"
                value={stock}
                onChange={e => setStock(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <div className="flex gap-1.5 flex-wrap">
                {[1, 5, 10, 25, 50, 100].map(pNum => (
                  <button
                    type="button"
                    key={pNum}
                    onClick={() => setStock(pNum)}
                    className={`px-3 py-1.5 border rounded-xl font-mono text-xs font-bold transition cursor-pointer ${
                      stock === pNum 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-4xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {pNum} {pNum === 100 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: IMAGES */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-50">
              <span className="text-xl">🖼️</span>
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0c1445]">Photographies</h3>
                <p className="text-[10px] text-slate-400">Chargez l'illustration principale ou des visuels secondaires</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Image de couverture (Principale) *</label>
              
              {/* Main zone upload */}
              {mainPreviewUrl ? (
                <div className="border border-slate-200 rounded-2xl overflow-hidden relative group/cover aspect-video bg-slate-50">
                  <img src={mainPreviewUrl} alt="Aperçu principal" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition duration-150">
                    <button
                      type="button"
                      onClick={() => setMainPreviewUrl('')}
                      className="px-4 py-2 bg-red-650 hover:bg-red-700 font-bold bg-red-600 text-white rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      <Trash2 size={13} /> Retirer la photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 flex flex-col items-center justify-center text-center gap-2 hover:border-blue-400 transition relative">
                  <span className="text-3xl">📷</span>
                  <span className="text-xs font-bold text-slate-700">Choisir un fichier ou Glisser l'image</span>
                  <span className="text-[10.5px] text-slate-400">Taille max : 5 Mo (PNG, JPG, WEBP)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMainImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              )}

              {/* URL pasting option wrapper */}
              <div className="space-y-1 pt-1">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Ou saisir un lien d'image web</span>
                <input
                  type="text"
                  placeholder="Collez l'URL de votre image directement ici..."
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white"
                  value={mainPreviewUrl}
                  onChange={e => setMainPreviewUrl(e.target.value)}
                />
              </div>

              {/* Raccourcis d'aperçus présélectionnés */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Images de prévisualisation rapides</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PRESET_IMAGES.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setMainPreviewUrl(preset.url)}
                      className="group p-1 border rounded-xl bg-slate-50 hover:bg-white transition text-left cursor-pointer border-slate-200 shadow-4xs overflow-hidden"
                    >
                      <div className="aspect-square rounded-lg overflow-hidden mb-1 relative bg-white">
                        <img src={preset.url} alt={preset.label} className="w-full h-full object-cover transition duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 block truncate leading-tight text-center">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gallery Block */}
            <div className="space-y-2 border-t pt-4 border-slate-100">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Galerie d'images complémentaires <span className="text-[10px] text-slate-400 lowercase">(jusqu'à 5)</span></label>
              
              <div className="grid grid-cols-5 gap-2">
                {galleryPreview.map((slot, index) => (
                  <div key={index} className="aspect-square border border-slate-200 rounded-xl overflow-hidden relative bg-slate-50 flex items-center justify-center">
                    {slot ? (
                      <>
                        <img src={slot} alt={`Galerie ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => handleRemoveGallerySlot(index)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-md transition cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </>
                    ) : (
                      <div className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/50">
                        <Plus size={14} className="text-slate-400" />
                        <span className="text-[8.5px] font-black text-slate-400 block mt-0.5">#{index + 1}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleGallerySlotChange(index, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: VARIATIONS */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-50">
              <span className="text-xl">🎨</span>
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0c1445]">Variantes de couleurs &amp; Tailles</h3>
                <p className="text-[10px] text-slate-400">Configurez les visuels de déclinaisons de l'article</p>
              </div>
            </div>
 
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Couleurs disponibles <span className="text-slate-400 lowercase font-medium">(sélectionnez toutes celles applicables)</span></label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(palette => {
                  const isSelected = selectedCouleurs.includes(palette.label);
                  return (
                    <button
                      type="button"
                      key={palette.label}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCouleurs(prev => prev.filter(c => c !== palette.label));
                        } else {
                          setSelectedCouleurs(prev => [...prev, palette.label]);
                        }
                      }}
                      className={`py-2 px-3 border rounded-xl flex items-center gap-2 cursor-pointer text-xs font-semibold max-h-[36px] transition ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/50 text-blue-800 font-bold' 
                          : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <span 
                        className={`w-3.5 h-3.5 rounded-full border border-slate-350 shadow-4xs ${palette.border ? 'border-slate-300' : ''}`} 
                        style={{ backgroundColor: palette.color }} 
                      />
                      <span>{palette.label}</span>
                    </button>
                  );
                })}

                {customColors.map(col => {
                  const isSelected = selectedCouleurs.includes(col);
                  return (
                    <button
                      type="button"
                      key={col}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCouleurs(prev => prev.filter(c => c !== col));
                        } else {
                          setSelectedCouleurs(prev => [...prev, col]);
                        }
                      }}
                      className={`py-2 px-3 border rounded-xl flex items-center gap-2 cursor-pointer text-xs font-semibold max-h-[36px] transition ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/50 text-blue-800 font-bold' 
                          : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-305 bg-slate-400 shadow-4xs" />
                      <span>{col}</span>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomColors(prev => prev.filter(c => c !== col));
                          setSelectedCouleurs(prev => prev.filter(c => c !== col));
                        }}
                        className="text-slate-450 hover:text-red-500 pl-1 font-bold font-sans"
                      >
                        ×
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    const name = prompt('Nom de la couleur personnalisée (Ex: Beige, Kaki, Rose) :');
                    if (name && name.trim()) {
                      const trimmed = name.trim();
                      if (!customColors.includes(trimmed)) {
                        setCustomColors(prev => [...prev, trimmed]);
                      }
                      if (!selectedCouleurs.includes(trimmed)) {
                        setSelectedCouleurs(prev => [...prev, trimmed]);
                      }
                    }
                  }}
                  className="py-2 px-3 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer"
                >
                  + Autre couleur
                </button>
              </div>
            </div>
 
            <div className="space-y-2 border-t pt-3 border-slate-100">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Tailles ou Dimensions proposées <span className="text-slate-400 lowercase font-medium">(sélectionnez toutes celles applicables)</span></label>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map(sz => {
                  const isSelected = selectedTailles.includes(sz);
                  return (
                    <button
                      type="button"
                      key={sz}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTailles(prev => prev.filter(s => s !== sz));
                        } else {
                          setSelectedTailles(prev => [...prev, sz]);
                        }
                      }}
                      className={`px-3.5 py-2 border rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-3xs' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Capacities Section inline with the HTML form */}
            <div className="space-y-1.5 border-t pt-3 border-slate-100">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Capacités / Volumes <span className="text-[10px] text-slate-400 lowercase font-medium">(Optionnel)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 64GB, 128GB, 256GB ou 50ml, 100ml, 200ml"
                className="w-full py-2.5 px-3.5 border border-slate-100 rounded-xl text-xs bg-slate-50 hover:bg-white focus:bg-white transition outline-none shadow-3xs"
                value={capacitesStr}
                onChange={e => setCapacitesStr(e.target.value)}
              />
              <span className="text-[9.5px] text-slate-400 block">Séparez les différentes valeurs par une virgule (ex: 64GB, 128GB).</span>
            </div>
 
            {/* Fiches custom specs inline with original HTML */}
            <div className="space-y-3 border-t pt-3 border-dashed border-slate-100">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Caractéristiques supplémentaires &amp; Fiche Technique</label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Propriété (Ex: Matière)"
                  className="flex-1 py-2 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                  value={customSpecName}
                  onChange={e => setCustomSpecName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Valeur (Ex: Denim suprême)"
                  className="flex-1 py-2 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                  value={customSpecValue}
                  onChange={e => setCustomSpecValue(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddSpec}
                  className="px-4 py-2 bg-slate-105 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
                >
                  Ajouter
                </button>
              </div>
 
              {Object.keys(specs).length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-1.5 shadow-4xs divide-y divide-slate-100">
                  {Object.entries(specs).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center py-2 first:pt-0 last:pb-0 text-xs">
                      <div>
                        <span className="font-extrabold text-[#0c1445] pr-1.5">{k}:</span>
                        <span className="text-slate-600">{v}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpec(k)}
                        className="text-slate-400 hover:text-red-500 cursor-pointer p-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: DETAILS & SHIPPING */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-50">
              <span className="text-xl">📦</span>
              <div>
                <h3 className="font-serif text-sm font-bold text-[#0c1445]">Départ d'expédition & Origine</h3>
                <p className="text-[10px] text-slate-400">Renseignez la position géographique en Haïti pour de meilleurs frais de livraison</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Département d'origine *</label>
                <select
                  className="w-full py-2.5 px-3.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-bold text-slate-700 outline-none hover:bg-white transition disabled:opacity-60 disabled:bg-slate-100"
                  value={selectedDept}
                  onChange={e => {
                    setSelectedDept(e.target.value);
                    setSelectedCommune('');
                  }}
                  disabled={!isPaidPlan}
                >
                  <option value="">Sélectionnez un Département…</option>
                  {Object.keys(COMMUNES).map(deptKey => (
                    <option key={deptKey} value={deptKey}>{deptKey}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Commune d'origine *</label>
                <select
                  className="w-full py-2.5 px-3.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-bold text-slate-700 outline-none hover:bg-white transition disabled:opacity-60 disabled:bg-slate-100"
                  value={selectedCommune}
                  onChange={e => setSelectedCommune(e.target.value)}
                  disabled={!selectedDept || !isPaidPlan}
                >
                  <option value="">Sélectionnez une Commune…</option>
                  {(COMMUNES[selectedDept] || []).map(commKey => (
                    <option key={commKey} value={commKey}>{commKey}</option>
                  ))}
                </select>
              </div>
            </div>

            {!isPaidPlan && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <span className="text-amber-500 text-sm mt-0.5">💡</span>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  <strong>Plan Gratuit:</strong> Vos produits sont automatiquement rattachés à votre commune d'inscription (<strong>{user?.commune || 'Pétion-Ville'}, {user?.departement || 'Ouest'}</strong>). Passez à un plan payant (<strong>Pro Local</strong> ou <strong>Pro National</strong>) pour choisir librement d'autres localités d'expédition pour chaque article.
                </p>
              </div>
            )}

            {/* Estimated delivery delay dropdown */}
            <div className="space-y-1 border-t pt-3 border-slate-100">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Délai de livraison estimé</label>
              <select
                className="w-full py-2.5 px-3.5 border border-slate-200 rounded-xl text-xs bg-slate-50 font-bold text-slate-700 outline-none hover:bg-white transition"
                value={delaiLivraison}
                onChange={e => setDelaiLivraison(e.target.value)}
              >
                <option value="">Sélectionner…</option>
                <option value="24h">24 heures</option>
                <option value="48h">48 heures</option>
                <option value="3j">2-3 jours</option>
                <option value="semaine">1 semaine</option>
                <option value="remise">Remise en main propre</option>
              </select>
            </div>

            {/* Premium Status Toggle mapping the HTML theme */}
            <div className="space-y-2 border-t pt-3 border-slate-100">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Statut du produit lors de l'enregistrement</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatut('actif')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex gap-3 items-center ${
                    statut === 'actif'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-550 hover:bg-white'
                  }`}
                >
                  <span className="text-xl">🟢</span>
                  <div>
                    <span className="text-xs font-bold block">Publié</span>
                    <span className="text-[10px] opacity-85 block">Visible immédiatement</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStatut('brouillon')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex gap-3 items-center ${
                    statut === 'brouillon'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-800'
                      : 'border-slate-200 bg-slate-50 text-slate-550 hover:bg-white'
                  }`}
                >
                  <span className="text-xl">📝</span>
                  <div>
                    <span className="text-xs font-bold block">Brouillon</span>
                    <span className="text-[10px] opacity-85 block">Sauvegarder pour plus tard</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-blue-800 shadow-4xs">
              <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
              <p className="text-[10px] sm:text-[10.5px] leading-relaxed">
                <strong>Conseil logistique :</strong> Les colis partant de la même région bénéficient d'un rabais d'acheminement de <strong className="text-blue-900">400 Gdes</strong>. Choisissez rigoureusement votre localité d'inventaire.
              </p>
            </div>
          </div>
        )}

        {/* Wizard Footer controls */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-between items-center">
          <button
            type="button"
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-xl text-xs inline-flex items-center gap-1 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            disabled={step === 1 || isAnalyzing}
          >
            <ArrowLeft size={13} /> Précédent
          </button>

          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 animate-pulse bg-blue-50 px-4 py-2.5 rounded-xl border border-blue-100">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></span>
              🔍 Diagnostic qualité & type de photo (Sightengine)...
            </div>
          ) : step < 5 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSave('brouillon')}
                className="py-2 px-3.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-1"
              >
                💾 Brouillon
              </button>
              <button
                type="button"
                onClick={() => setStep(prev => Math.min(5, prev + 1))}
                className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
              >
                Suivant <ArrowRight size={13} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSave('brouillon')}
                className="py-2.5 px-4 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-850 font-bold text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-1"
              >
                💾 Enregistrer en Brouillon
              </button>

              <button
                type="button"
                onClick={() => handleSave('actif')}
                disabled={completionPct < 70}
                className={`py-2.5 px-5 rounded-xl font-black text-xs inline-flex items-center gap-1.5 tracking-wider uppercase shadow-md transition-all cursor-pointer ${
                  completionPct >= 70
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-95'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                }`}
              >
                <Save size={13} /> {isEditing ? "Enregistrer & Publier !" : "Mettre en Vente !"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
