(function () {
  function getClient(){ return (typeof window !== 'undefined') ? (window.supabaseClient || window.supabase || null) : null; }
  function normalizeText(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
  const state={products:[],search:'',category:'',dept:'',commune:'',vendorId:''};
  try{
    const vp=new URLSearchParams(window.location.search||'').get('vendor_id');
    if(vp) state.vendorId=String(vp).trim();
  }catch(_){}
  const BASE_CATEGORIES = ['electronique','Audio','Wearable','Maison','Photo','Gaming','Mode','Beaute','Accessoires','Alimentaire','Sport'];
  const CAT_ICONS = {
    electronique:'📱', audio:'🎧', wearable:'⌚', maison:'🏠', photo:'📷',
    gaming:'🎮', mode:'👗', beaute:'🧴', accessoires:'🧳', alimentaire:'🛒', sport:'⚽'
  };

  function updateCartBadges(){
    try{const cart=JSON.parse(localStorage.getItem('vendza_cart')||'[]');const n=cart.reduce((t,it)=>t+(Number(it.quantity)||1),0);['nav-cart-count','cart-count'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=String(n);});}catch(_){ }
  }

  function addToCart(p){
    if(window.VendzaCartGuard&&window.VendzaCartGuard.isOwnProductSync(p)){window.VendzaCartGuard.notifyBlocked();return;}
    let cart=[];try{cart=JSON.parse(localStorage.getItem('vendza_cart')||'[]');}catch(_){ }
    const id=String(p.id||p.product_id||p.productId||Date.now());
    const idx=cart.findIndex(it=>String(it.id)===id);
    if(idx>=0) cart[idx].quantity=Number(cart[idx].quantity||1)+1;
    else cart.push({
      id:id,
      name:p.name||p.title||'Produit',
      price:Number(p.price||p.prix||0),
      image:p.imageUrl||p.image||'',
      quantity:1,
      product_id:p.id||p.product_id||null,
      vendor_id:p.vendor_id||p.vendorId||null,
      vendor_name:p.shopName||p.vendorName||p.vendor_name||'Vendeur',
      category:p.category||p.categorie||''
    });
    localStorage.setItem('vendza_cart',JSON.stringify(cart));
    updateCartBadges();
  }

  function pickImage(client,p){
    const raw=p.image_url||p.image||p.image_path||p.storage_path||p.product_image_path||'';
    if(typeof raw==='string' && /^https?:\/\//i.test(raw)) return raw;
    if(typeof raw==='string' && raw.trim()){
      const path=raw.trim().replace(/^images\//i,'').replace(/^\/+/, '');
      const pub=client.storage.from('images').getPublicUrl(path);
      if(pub && pub.data && pub.data.publicUrl) return pub.data.publicUrl;
    }
    return '';
  }

  async function resolveVendorMap(client,products){
    const ids=Array.from(new Set((products||[]).map(p=>p&&p.vendor_id).filter(Boolean)));const map={}; if(!ids.length) return map;
    const sources=[{table:'profiles',key:'id'},{table:'users',key:'id'},{table:'vendors',key:'id'},{table:'vendors',key:'user_id'}];
    for(const s of sources){
      try{const r=await client.from(s.table).select('*').in(s.key,ids); if(r.error||!Array.isArray(r.data)) continue;
        r.data.forEach(row=>{
          const id=row[s.key]; if(!id||map[id]) return;
          const shop=row.shop_name||row.store_name||row.boutique||'';
          const person=row.vendor_name||row.full_name||row.display_name||row.name||[row.first_name,row.last_name].filter(Boolean).join(' ');
          const shopName=String(shop||person||'Vendeur').trim()||'Vendeur';
          map[id]={
            shopName:shopName,
            name:String(person||shop||'Vendeur').trim()||'Vendeur',
            departement:row.departement||row.department||row.dept||row.region||'',
            commune:row.commune||row.city||row.location||''
          };
        });
      }catch(_){ }
    }
    return map;
  }

  function match(p){
    if(state.vendorId && String(p.vendor_id||'')!==state.vendorId) return false;
    if(state.category && normalizeText(p.category)!==normalizeText(state.category)) return false;
    if(state.dept && normalizeText(p.departement)!==normalizeText(state.dept)) return false;
    if(state.commune && normalizeText(p.commune)!==normalizeText(state.commune)) return false;
    if(state.search){const hay=normalizeText([p.name,p.description,p.category,p.shopName,p.vendorName,p.departement,p.commune].join(' ')); if(!hay.includes(normalizeText(state.search))) return false;}
    return true;
  }

  function escHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function vendorLineHtml(p){
    if(window.VendzaVerified&&typeof window.VendzaVerified.shopLineHtml==='function'){
      const shop=window.VendzaVerified.getShopName?window.VendzaVerified.getShopName(p):(p.shopName||p.vendorName||'Vendeur');
      return window.VendzaVerified.shopLineHtml(shop,!!p.vendorVerified,16);
    }
    let label=p.shopName||p.shop_name||p.store_name||p.vendorName||'Vendeur';
    if(window.VendzaVerified&&typeof window.VendzaVerified.formatParShopName==='function'){
      label=window.VendzaVerified.formatParShopName(label);
    }else if(!/^par\s+/i.test(String(label))){
      label='Par '+String(label).trim();
    }
    const shop=escHtml(label);
    return '<span class="p-card-shop-line"><span class="p-card-shop-name">'+shop+'</span></span>';
  }

  function cardHtml(p){
    const old=Number(p.old_price||0), cur=Number(p.price||0);
    const oldHtml=(old>cur)?('<span class="p-card-old">'+old.toLocaleString('fr-FR')+'</span>'):'';
    const img=p.imageUrl?('<img src="'+p.imageUrl+'" alt="'+(p.name||'Produit')+'" loading="lazy">'):'<i class="fas fa-box-open"></i>';
    return '<article class="p-card" data-id="'+p.id+'"><div class="p-card-img">'+img+'</div><div class="p-card-body"><div class="p-card-name">'+(p.name||'Produit')+'</div><div class="p-card-vendor">'+vendorLineHtml(p)+'</div><div class="p-card-bottom"><div><span class="p-card-price">'+Number(p.price||0).toLocaleString('fr-FR')+' Gdes</span>'+oldHtml+'</div><button class="btn-add" data-add="'+p.id+'" type="button">+</button></div></div></article>';
  }

  function renderList(el,items){ if(!el) return; el.innerHTML=items.length?items.map(cardHtml).join(''):'<div style="padding:16px;color:#6b7280;">Aucun produit.</div>'; }

  function render(){
    const data=state.products.filter(match);
    const trend=data.slice().sort((a,b)=>Number(b.price||0)-Number(a.price||0));
    const promo=data.filter(p=>Number(p.old_price||0)>Number(p.price||0));
    const newest=data.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    renderList(document.getElementById('pop'),data.slice(0,12));
    renderList(document.getElementById('trend'),trend.slice(0,12));
    renderList(document.getElementById('promo'),promo.slice(0,12));
    renderList(document.getElementById('new'),newest.slice(0,12));
    renderList(document.getElementById('all-grid'),data);
  }

  function fillSelect(el,vals,first){ if(!el) return; el.innerHTML='<option value="">'+first+'</option>'; vals.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);}); }

  function initFilters(){
    const qSearch=document.getElementById('qSearch'), qCategory=document.getElementById('qCategory'), qDept=document.getElementById('qDept'), qCommune=document.getElementById('qCommune');
    const catsLine=document.getElementById('catsLine');
    const deptMap={};
    state.products.forEach(p=>{const d=String(p.departement||'').trim(), c=String(p.commune||'').trim(); if(!d) return; if(!deptMap[d]) deptMap[d]=[]; if(c && !deptMap[d].includes(c)) deptMap[d].push(c);});
    // Default Haitian departments and communes if no products
    const defaultDeptMap = {
      "Artibonite": ["Dessalines", "Gonaïves", "Saint-Marc", "Verrettes"],
      "Centre": ["Hinche", "Mirebalais", "Lascahobas"],
      "Grande-Anse": ["Jérémie", "Anse-d'Hainault", "Corail", "Roseaux"],
      "Nippes": ["Miragoâne", "Petit-Trou-de-Nippes", "L'Asile"],
      "Nord": ["Cap-Haïtien", "Limbé", "Grande Rivière du Nord", "Plaisance"],
      "Nord-Est": ["Fort-Liberté", "Ouanaminthe", "Trou-du-Nord"],
      "Nord-Ouest": ["Port-de-Paix", "Saint-Louis du Nord", "Môle Saint-Nicolas"],
      "Ouest": ["Port-au-Prince", "Léogâne", "Arcahaie", "Cabaret", "Cornillon", "Croix-des-Bouquets", "Fonds-Verrettes", "Gressier", "Kenscoff", "Petion-Ville", "Tabarre"],
      "Sud": ["Les Cayes", "Aquin", "Cavaillon", "Chardonnières", "Port-Salut"],
      "Sud-Est": ["Jacmel", "Bainet", "Belle-Anse", "Marigot"]
    };
    // Merge with product-based deptMap
    Object.keys(defaultDeptMap).forEach(dept => {
      if (!deptMap[dept]) deptMap[dept] = [];
      defaultDeptMap[dept].forEach(comm => {
        if (!deptMap[dept].includes(comm)) deptMap[dept].push(comm);
      });
    });
    const liveCats = state.products.map((p)=>String(p.category||'').trim()).filter(Boolean);
    const cats=Array.from(new Set(BASE_CATEGORIES.concat(liveCats))).sort((a,b)=>a.localeCompare(b,'fr'));
    if (qCategory) fillSelect(qCategory,cats,'Toutes categories');
    fillSelect(qDept,Object.keys(deptMap).sort((a,b)=>a.localeCompare(b,'fr')),'Département');
    fillSelect(qCommune,[],'Commune'); qCommune.disabled=true;

    if (catsLine) {
      const current = catsLine.querySelector('.cat-pill.active');
      catsLine.innerHTML = '';
      const allBtn = document.createElement('button');
      allBtn.className = 'cat-pill' + ((state.category || '') === '' ? ' active' : '');
      allBtn.setAttribute('data-cat', '');
      allBtn.textContent = '🏠 Tout';
      catsLine.appendChild(allBtn);
      cats.forEach((cat) => {
        if (!cat) return;
        const btn = document.createElement('button');
        btn.className = 'cat-pill' + (normalizeText(state.category) === normalizeText(cat) ? ' active' : '');
        btn.setAttribute('data-cat', cat);
        const icon = CAT_ICONS[normalizeText(cat)] || '📦';
        btn.textContent = icon + ' ' + cat;
        catsLine.appendChild(btn);
      });
      if (current && current.getAttribute('data-cat') === '' && !state.category) {
        allBtn.classList.add('active');
      }
    }

    function refreshCommune(){const d=qDept.value||'';const vals=(deptMap[d]||[]).sort((a,b)=>a.localeCompare(b,'fr'));fillSelect(qCommune,vals,'Commune');qCommune.disabled=!vals.length;}
    qSearch.addEventListener('input',()=>{state.search=qSearch.value||'';render();});
    if (qCategory) qCategory.addEventListener('change',()=>{state.category=qCategory.value||'';render();});
    qDept.addEventListener('change',()=>{state.dept=qDept.value||'';state.commune='';refreshCommune();render();});
    qCommune.addEventListener('change',()=>{state.commune=qCommune.value||'';render();});

    const chips = document.querySelectorAll('#catsLine .cat-pill');
    chips.forEach((chip) => {
      chip.addEventListener('click', function () {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.category = chip.getAttribute('data-cat') || '';
        if (qCategory) qCategory.value = state.category;
        render();
      });
    });
  }

  function bindEvents(){
    document.addEventListener('click',(e)=>{
      const add=e.target.closest('[data-add]');
      if(add){e.preventDefault();e.stopPropagation();const id=add.getAttribute('data-add');const p=state.products.find(x=>String(x.id)===String(id));if(p)addToCart(p);return;}
      const card=e.target.closest('.p-card'); if(!card) return;
      const id=card.getAttribute('data-id'); const p=state.products.find(x=>String(x.id)===String(id)); if(!p) return;
      localStorage.setItem('vendza_selected_product',JSON.stringify({id:p.id,name:p.name,price:p.price,old_price:p.old_price,description:p.description,image:p.imageUrl,image_url:p.image_url||null,image_path:p.image_path||p.storage_path||p.product_image_path||null,category:p.category,vendor_id:p.vendor_id,vendor_name:p.vendorName||'Vendeur',colors:Array.isArray(p.colors)?p.colors:[],capacities:Array.isArray(p.capacities)?p.capacities:[],features:Array.isArray(p.features)?p.features:[],gallery:Array.isArray(p.gallery)?p.gallery:[]}));
      window.location.href=(window.VendzaUrls&&window.VendzaUrls.productDetailHref?window.VendzaUrls.productDetailHref(p.id):('detail-produit.html'+(p.id?('?id='+encodeURIComponent(p.id)):'')));
    });
  }

  async function hydrateSubnav(){
    const left=document.getElementById('subnavLeft'); if(!left) return;
    const cl=getClient(); if(!cl||!cl.auth) return;
    try{const {data}=await cl.auth.getUser();const user=data&&data.user;
      if(!user){left.innerHTML='<a href="authentification/inscription.html" class="btn btn-primary" style="padding:8px 12px;">Connectez-vous</a>';return;}
      let stored=null; try{stored=JSON.parse(localStorage.getItem('vendza_user_data')||'null');}catch(_){ }
      const first=stored&&stored.firstName?stored.firstName:(user.user_metadata&&(user.user_metadata.firstName||user.user_metadata.first_name))||'';
      const last=stored&&stored.lastName?stored.lastName:(user.user_metadata&&(user.user_metadata.lastName||user.user_metadata.last_name))||'';
      const display=[first,last].filter(Boolean).join(' ')||(user.email?user.email.split('@')[0]:'Utilisateur');
      const initial=(display||'U').trim().charAt(0).toUpperCase();
      const userType=(stored&&stored.userType)||(user.user_metadata&&user.user_metadata.userType)||'client';
      const profile=userType==='vendeur'?'vendeur/profil-vendeur.html':'client/profil-client.html';
      left.innerHTML='<a href="'+profile+'" class="user-profile-link" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;"><div class="avatar" style="cursor:pointer;">'+initial+'</div><div class="user-id">'+display+'</div></a>';
    }catch(_){ }
  }

  async function load(){
    const cl=getClient(); if(!cl||typeof cl.from!=='function') return;
    try{
      const {data,error}=await cl.from('products').select('*'); if(error||!Array.isArray(data)) return;
      const vendorMap=await resolveVendorMap(cl,data);
      const vendorIds=Array.from(new Set(data.map(p=>p&&p.vendor_id).filter(Boolean)));
      const verifiedSet=(window.VendzaVerified&&typeof window.VendzaVerified.fetchVerifiedSet==='function')?await window.VendzaVerified.fetchVerifiedSet(cl,vendorIds):{};
      state.products=data.map(p=>{
        const v=p.vendor_id?(vendorMap[p.vendor_id]||{}):{};
        const shopName=v.shopName||p.shop_name||p.store_name||p.boutique||v.name||p.vendor_name||'Vendeur';
        return Object.assign({},p,{
          shopName:String(shopName).trim()||'Vendeur',
          vendorName:v.name||p.vendor_name||shopName||'Vendeur',
          vendorVerified:!!(p.vendor_id&&verifiedSet[String(p.vendor_id)]),
          departement:p.departement||p.department||p.dept||v.departement||'',
          commune:p.commune||p.city||p.location||v.commune||'',
          imageUrl:pickImage(cl,p)
        });
      });
      initFilters(); render();
    }catch(_){ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    updateCartBadges();
    hydrateSubnav();
    load().catch(function () {});
  });

  let endTime = Date.now() + (6 * 3600 + 24 * 60) * 1000;
  function tick() {
    const diff = Math.max(0, endTime - Date.now());
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    const eh = document.getElementById('cd-h');
    const em = document.getElementById('cd-m');
    const es = document.getElementById('cd-s');
    if (eh) eh.textContent = h;
    if (em) em.textContent = m;
    if (es) es.textContent = s;
  }
  setInterval(tick, 1000);
  tick();
})();
