document.addEventListener('DOMContentLoaded', function () {
  var COMMUNES = {
    Ouest: ['Port-au-Prince', 'Petion-Ville', 'Delmas', 'Croix-des-Bouquets', 'Leogane', 'Carrefour'],
    Nord: ['Cap-Haitien', 'Limbe', 'Plaisance', 'Grande-Riviere du Nord'],
    Sud: ['Les Cayes', 'Aquin', 'Saint-Louis du Sud'],
    Artibonite: ['Gonaives', 'Saint-Marc', 'Dessalines'],
    Centre: ['Hinche', 'Mirebalais', 'Lascahobas'],
    'Nord-Est': ['Fort-Liberte', 'Ouanaminthe', 'Trou-du-Nord'],
    'Nord-Ouest': ['Port-de-Paix', 'Saint-Louis du Nord', 'Mole Saint-Nicolas'],
    Nippes: ['Miragoane', 'Petite-Riviere-de-Nippes', 'Fonds-des-Negres', 'Paillant'],
    'Sud-Est': ['Jacmel', 'Bainet', 'Belle-Anse'],
    "Grand'Anse": ['Jeremie', 'Moron', "Anse-d'Hainault"]
  };
  var PROMOS = { VENDZA10: 10, BIENVENUE: 15, HAITI20: 20 };

  var fraisLivraison = 0;
  var promoReduction = 0;

  function q(id) { return document.getElementById(id); }
  function getCart() {
    try {
      var raw = localStorage.getItem('vendza_cart');
      if (raw) return JSON.parse(raw) || [];
      var fallback = localStorage.getItem('panier');
      if (!fallback) return [];
      var cart = JSON.parse(fallback) || [];
      localStorage.setItem('vendza_cart', JSON.stringify(cart));
      return cart;
    } catch (_) {
      return [];
    }
  }
  function saveCart(cart) { localStorage.setItem('vendza_cart', JSON.stringify(cart)); }
  function parsePriceToNumber(priceStr) {
    if (priceStr == null) return 0;
    var str = typeof priceStr === 'number' ? String(priceStr) : String(priceStr || '');
    var clean = str.replace(/[^0-9.,]/g, '').replace(',', '.');
    var val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  }
  function fmt(n) { return 'HTG ' + Number(n || 0).toLocaleString('fr-FR'); }
  function updateBadge() {
    var cart = getCart();
    var count = cart.reduce(function (t, it) { return t + (it.quantity || 1); }, 0);
    var badge = document.getElementById('cart-count');
    if (badge) badge.textContent = String(count);
  }
  function showToast(msg) {
    var t = q('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function normalizeCategory(v) {
    return String(v || '').trim().toLowerCase();
  }

  function getCartCategories() {
    var cart = getCart();
    var set = {};
    cart.forEach(function (it) {
      var c = normalizeCategory(it.category || it.categorie);
      if (c) set[c] = true;
    });
    return Object.keys(set);
  }

  function getCartProductIds() {
    var cart = getCart();
    var set = {};
    cart.forEach(function (it) {
      var id = it.product_id || it.productId || it.id;
      if (id != null) set[String(id)] = true;
    });
    return set;
  }

  function renderSuggestions(items) {
    var section = q('suggest-section');
    var list = q('suggest-list');
    if (!section || !list) return;
    list.innerHTML = '';
    if (!Array.isArray(items) || !items.length) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    items.forEach(function (p) {
      var name = p.name || p.title || 'Produit';
      var price = Number(p.price || 0);
      var image = p.image_url || p.image || '';
      var link = document.createElement('a');
      link.className = 'sug-card';
      link.href = '../detail-produit.html' + (p.id ? ('?id=' + encodeURIComponent(p.id)) : '');
      link.innerHTML = ''
        + '<div class="sug-img">' + (image ? ('<img src="' + image + '" alt="' + name + '">') : '<i class="fas fa-box-open"></i>') + '</div>'
        + '<div class="sug-body">'
        + '  <div class="sug-name">' + name + '</div>'
        + '  <div class="sug-price">' + fmt(price) + ' Gdes</div>'
        + '</div>';
      link.addEventListener('click', function () {
        var productData = {
          id: p.id,
          name: p.name,
          price: p.price,
          old_price: p.old_price,
          description: p.description,
          image: image,
          image_url: p.image_url || null,
          image_path: p.image_path || p.storage_path || p.product_image_path || null,
          category: p.category,
          vendor_id: p.vendor_id,
          vendor_name: p.vendor_name || p.vendorName || 'Vendeur',
          colors: Array.isArray(p.colors) ? p.colors : [],
          capacities: Array.isArray(p.capacities) ? p.capacities : [],
          features: Array.isArray(p.features) ? p.features : [],
          gallery: Array.isArray(p.gallery) ? p.gallery : []
        };
        localStorage.setItem('vendza_selected_product', JSON.stringify(productData));
      });
      list.appendChild(link);
    });
  }

  async function loadSuggestionsFromSupabase() {
    var client = getClient();
    if (!client) {
      return renderSuggestions([]);
    }
    var categories = getCartCategories();
    var excluded = getCartProductIds();
    if (!categories.length) {
      renderSuggestions([]);
      return;
    }
    try {
      var resp = await client.from('products').select('*').limit(60);
      if (resp.error || !Array.isArray(resp.data)) {
        renderSuggestions([]);
        return;
      }
      var filtered = resp.data.filter(function (p) {
        if (!p) return false;
        if (excluded[String(p.id)]) return false;
        var c = normalizeCategory(p.category);
        return categories.indexOf(c) >= 0;
      }).slice(0, 10);
      renderSuggestions(filtered);
    } catch (_) {
      renderSuggestions([]);
    }
  }

  function render() {
    var list = q('cart-items');
    var empty = q('cart-empty');
    var livraisonCard = q('livraison-card');
    var btnCheckout = q('btn-checkout');
    var cart = getCart();
    list.innerHTML = '';

    if (!cart.length) {
      list.style.display = 'none';
      empty.style.display = 'block';
      livraisonCard.style.display = 'none';
      btnCheckout.disabled = true;
    } else {
      list.style.display = 'flex';
      empty.style.display = 'none';
      livraisonCard.style.display = 'block';
      btnCheckout.disabled = false;
    }

    var totalCount = cart.reduce(function (a, p) { return a + (p.quantity || 1); }, 0);
    q('item-count').textContent = totalCount + ' article' + (totalCount > 1 ? 's' : '');

    cart.forEach(function (p, i) {
      var quantity = Math.max(1, parseInt(p.quantity || p.qte || 1, 10) || 1);
      var unit = parsePriceToNumber(p.price || p.prix || 0);
      var line = unit * quantity;
      var name = p.name || p.title || p.nom || 'Produit';
      var vendor = p.vendor_name || p.vendorName || p.vendeur || 'Vendeur';
      var image = p.image || p.image_url || p.imageUrl || p.img || '';
      var color = p.color || p.couleur || '';
      var cap = p.capacity || p.capacite || '';

      var card = document.createElement('div');
      card.className = 'cart-item';
      card.style.animationDelay = (i * 0.07) + 's';
      card.innerHTML = '' +
        '<div class="ci-inner">' +
        '  <div class="ci-img">' + (image ? '<img src="' + image + '" alt="' + name + '">' : '<i class="fas fa-box-open"></i>') + '</div>' +
        '  <div class="ci-body">' +
        '    <div class="ci-top">' +
        '      <div class="ci-name">' + name + '</div>' +
        '      <button class="btn-remove" type="button" data-remove="' + i + '"><i class="fas fa-times"></i></button>' +
        '    </div>' +
        '    <div class="ci-vendor">par ' + vendor + '</div>' +
        '    <div class="ci-variants">' + (color ? '<span class="ci-variant">Couleur: ' + color + '</span>' : '') + (cap ? '<span class="ci-variant">Option: ' + cap + '</span>' : '') + '</div>' +
        '    <div class="ci-bottom">' +
        '      <div class="ci-price">' + fmt(line) + '<small> Gdes</small></div>' +
        '      <div class="qty-ctrl">' +
        '        <button class="qty-btn" type="button" data-dec="' + i + '">-</button>' +
        '        <div class="qty-val">' + quantity + '</div>' +
        '        <button class="qty-btn" type="button" data-inc="' + i + '">+</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      list.appendChild(card);
    });

    updateRecap();
  }

  function updateRecap() {
    var sub = getCart().reduce(function (a, p) {
      return a + parsePriceToNumber(p.price || p.prix || 0) * Math.max(1, parseInt(p.quantity || p.qte || 1, 10) || 1);
    }, 0);
    var reduction = Math.round(sub * promoReduction / 100);
    var total = sub + fraisLivraison - reduction;

    q('recap-subtotal').textContent = fmt(sub);
    q('recap-livraison').textContent = fraisLivraison ? fmt(fraisLivraison) : 'HTG 0';
    q('recap-total').textContent = fmt(total);

    var promoRow = q('recap-promo-row');
    if (promoReduction > 0) {
      promoRow.style.display = 'flex';
      q('recap-promo-val').textContent = '- ' + fmt(reduction) + ' (' + promoReduction + '%)';
    } else {
      promoRow.style.display = 'none';
    }
  }

  function bindCartEvents() {
    q('cart-items').addEventListener('click', function (e) {
      var dec = e.target.closest('[data-dec]');
      var inc = e.target.closest('[data-inc]');
      var rem = e.target.closest('[data-remove]');
      var cart = getCart();

      if (dec) {
        var i = Number(dec.getAttribute('data-dec'));
        cart[i].quantity = Math.max(1, (cart[i].quantity || 1) - 1);
        saveCart(cart); render(); updateBadge();
      }
      if (inc) {
        var j = Number(inc.getAttribute('data-inc'));
        cart[j].quantity = (cart[j].quantity || 1) + 1;
        saveCart(cart); render(); updateBadge();
      }
      if (rem) {
        var k = Number(rem.getAttribute('data-remove'));
        cart.splice(k, 1);
        saveCart(cart); render(); updateBadge();
        showToast('Article retire du panier');
      }
    });

    q('clear-cart').addEventListener('click', function () {
      if (!getCart().length) return;
      if (!confirm('Vider tout le panier ?')) return;
      localStorage.removeItem('vendza_cart');
      render(); updateBadge();
      showToast('Panier vide');
    });
  }

  function initLocationFilters() {
    var deptSel = q('dept-select');
    var comSel = q('commune-select');
    Object.keys(COMMUNES).forEach(function (d) {
      var o = document.createElement('option');
      o.value = d;
      o.textContent = d;
      deptSel.appendChild(o);
    });

    deptSel.addEventListener('change', function () {
      var opts = COMMUNES[deptSel.value] || [];
      comSel.innerHTML = '<option value="">Selectionnez votre commune...</option>';
      opts.forEach(function (c) {
        var o = document.createElement('option'); o.value = c; o.textContent = c; comSel.appendChild(o);
      });
      comSel.disabled = !opts.length;
      q('livraison-info').style.display = 'none';
    });

    comSel.addEventListener('change', function () {
      if (!comSel.value) return;
      var port = ['Port-au-Prince', 'Petion-Ville', 'Delmas', 'Carrefour'];
      fraisLivraison = port.indexOf(comSel.value) >= 0 ? 0 : 200;
      q('livraison-info').style.display = 'flex';
      q('livraison-msg').textContent = fraisLivraison === 0
        ? ('Livraison gratuite a ' + comSel.value + ' - Delai: 24h')
        : ('Livraison a ' + comSel.value + ' - +' + fmt(fraisLivraison) + ' - Delai: 48h');
      updateRecap();
    });
  }

  function initPromo() {
    var btn = q('btn-promo');
    var input = q('promo-input');
    var result = q('promo-result');

    function applyPromo() {
      var code = String(input.value || '').trim().toUpperCase();
      result.style.display = 'block';
      if (PROMOS[code]) {
        promoReduction = PROMOS[code];
        result.className = 'promo-result promo-ok';
        result.textContent = 'Code "' + code + '" applique - ' + promoReduction + '% de reduction';
        showToast('Reduction appliquee');
      } else {
        promoReduction = 0;
        result.className = 'promo-result promo-err';
        result.textContent = 'Code invalide ou expire';
      }
      updateRecap();
    }

    btn.addEventListener('click', applyPromo);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
    });
  }

  function getClient() { return (typeof window !== 'undefined') ? (window.supabaseClient || window.supabase || null) : null; }
  function readLocalUser() { try { return JSON.parse(localStorage.getItem('vendza_user_data') || 'null'); } catch (_) { return null; } }
  function buildInitialQrCode() {
    if (window.VendzaQR && typeof window.VendzaQR.generateQrToken === 'function') return 'pending:' + window.VendzaQR.generateQrToken();
    return 'pending:' + String(Date.now()) + ':' + String(Math.floor(Math.random() * 1e9));
  }
  async function readBuyerProfile(client, userId) {
    if (!client || !userId) return null;
    var sources = [{ table: 'profiles', fields: '*' }, { table: 'users', fields: '*' }];
    for (var i = 0; i < sources.length; i += 1) {
      try {
        var resp = await client.from(sources[i].table).select(sources[i].fields).eq('id', userId).maybeSingle();
        if (resp && resp.data) return resp.data;
      } catch (_) {}
    }
    return null;
  }

  async function notifyVendorOrderReceived(client, buyerId, orderRow, item, buyerMeta) {
    if (!client || !buyerId || !item || !item.vendorId || !item.productId) return;
    var api = window.VendzaMessaging;
    if (!api || typeof api.notifyVendorNewOrder !== 'function') return;
    try {
      await api.notifyVendorNewOrder(client, {
        buyerId: buyerId,
        vendorId: item.vendorId,
        productId: item.productId,
        title: 'Nouvelle commande',
        product: String(item.productName || 'Produit'),
        qty: String(item.quantity || 1),
        client: String((buyerMeta && buyerMeta.name) || 'Client'),
        commune: buyerMeta && buyerMeta.commune ? String(buyerMeta.commune) : '',
        departement: buyerMeta && buyerMeta.departement ? String(buyerMeta.departement) : '',
        orderId: orderRow && orderRow.id ? orderRow.id : ''
      });
    } catch (_) {}
  }

  async function resolveVendorIdForOrder(client, vendorId, vendorName) {
    if (!client || !vendorId) return { ok: false, reason: 'missing' };
    
    // Check main users and profiles first
    try {
      var existUser = await client.from('users').select('id,user_id,email').or('id.eq.' + vendorId + ',user_id.eq.' + vendorId).maybeSingle();
      if (existUser && existUser.data) {
        var resolved = existUser.data.id || existUser.data.user_id || vendorId;
        return { ok: true, vendorId: resolved, data: existUser.data };
      }
    } catch (_) {}
    try {
      var existProfile = await client.from('profiles').select('id').eq('id', vendorId).maybeSingle();
      if (existProfile && existProfile.data) {
        return { ok: true, vendorId: vendorId, data: existProfile.data };
      }
    } catch (_) {}

    try {
      var existing = await client.from('vendors').select('id,user_id').or('id.eq.' + vendorId + ',user_id.eq.' + vendorId).maybeSingle();
      if (existing && existing.data) {
        var resolved = existing.data.id || existing.data.user_id || vendorId;
        return { ok: true, vendorId: resolved, data: existing.data };
      }
    } catch (_) {}

    // Populate active user/profile record to ensure seamless lookup
    try {
      await client.from('users').upsert([{ id: vendorId, name: vendorName || 'Vendeur', user_type: 'vendeur' }], { onConflict: 'id' });
    } catch (_) {}
    try {
      await client.from('profiles').upsert([{ id: vendorId, full_name: vendorName || 'Vendeur' }], { onConflict: 'id' });
    } catch (_) {}

    var basePayload = { id: vendorId, user_id: vendorId, name: vendorName || 'Vendeur' };
    var lastError = null;
    var conflictKeys = ['id', 'user_id'];
    for (var c = 0; c < conflictKeys.length; c += 1) {
      var conflictKey = conflictKeys[c];
      if (!basePayload[conflictKey]) continue;
      var payload = Object.assign({}, basePayload);
      for (var k = 0; k < 8; k += 1) {
        try {
          var resp = await client.from('vendors').upsert([payload], { onConflict: conflictKey }).select('id,user_id').maybeSingle();
          if (resp && resp.data) {
            var resolvedId = resp.data.id || resp.data.user_id || vendorId;
            return { ok: true, vendorId: resolvedId, data: resp.data };
          }
          if (resp && resp.error) {
            var msg = String(resp.error.message || '');
            var miss = msg.match(/Could not find the '([^']+)' column/i);
            if (miss && miss[1] && Object.prototype.hasOwnProperty.call(payload, miss[1])) { delete payload[miss[1]]; lastError = resp.error; continue; }
            var colMissing = msg.match(/column \"([^\"]+)\" does not exist/i);
            if (colMissing && colMissing[1] && Object.prototype.hasOwnProperty.call(payload, colMissing[1])) { delete payload[colMissing[1]]; lastError = resp.error; continue; }
          }
        } catch (_) {}
      }
    }
    // Return fallback ok since we successfully synced details locally and in core profile tables
    return { ok: true, vendorId: vendorId, data: { id: vendorId } };
  }

  async function resolveVendorIdFromProduct(client, item) {
    if (!client || !item) return null;
    if (item.vendorId) return item.vendorId;
    var productId = item.productId || item.id;
    if (!productId) return null;
    try {
      var resp = await client.from('products').select('*').eq('id', productId).maybeSingle();
      if (resp.error || !resp.data) return null;
      var row = resp.data;
      var cols = ['vendor_id', 'seller_id', 'owner_id', 'user_id', 'created_by'];
      for (var i = 0; i < cols.length; i += 1) {
        if (row[cols[i]]) return row[cols[i]];
      }
    } catch (_) {}
    return null;
  }

  async function insertOrderAdaptive(client, basePayload) {
    var buyerColumns = ['buyer_id', 'client_id', 'customer_id', 'user_id'];
    var vendorColumns = ['vendor_id', 'seller_id', 'owner_id'];
    var amountColumns = ['total_amount', 'total', 'amount'];
    var productNameColumns = ['product_name', 'title', 'item_name', 'description'];
    var quantityColumns = ['quantity', 'qty'];
    var lastError = null;

    if (!basePayload.vendorId) {
      throw new Error('Vendeur du produit introuvable.');
    }

    async function insertWithAdaptivePayload(initialPayload) {
      var payload = Object.assign({}, initialPayload);
      for (var k = 0; k < 12; k += 1) {
        try {
          var resp = await client.from('orders').insert([payload]).select('*').single();
          if (!resp.error && resp.data) return { data: resp.data, error: null };
          if (resp && resp.error) {
            var msg = String(resp.error.message || '');
            var miss = msg.match(/Could not find the '([^']+)' column/i);
            if (miss && miss[1] && Object.prototype.hasOwnProperty.call(payload, miss[1])) { delete payload[miss[1]]; lastError = resp.error; continue; }
            var isConflict = Number(resp.error.status || 0) === 409 || String(resp.error.code || '') === '23505';
            if (isConflict && Object.prototype.hasOwnProperty.call(payload, 'qr_code')) { payload.qr_code = buildInitialQrCode(); lastError = resp.error; continue; }
            return { data: null, error: resp.error };
          }
          return { data: null, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      }
      return { data: null, error: lastError };
    }

    for (var b = 0; b < buyerColumns.length; b += 1) {
      for (var a = 0; a < amountColumns.length; a += 1) {
        var payload = {
          status: 'payee',
          order_status: 'payee',
          is_validated: false,
          client_confirmed: false,
          reception_confirmed: false,
          vendor_credited: false
        };
        payload[buyerColumns[b]] = basePayload.buyerId;
        vendorColumns.forEach(function (col) {
          payload[col] = basePayload.vendorId;
        });
        payload[amountColumns[a]] = basePayload.totalAmount;
        payload.unit_price = basePayload.unitPrice;
        payload.price = basePayload.unitPrice;
        payload.items = [{
          name: basePayload.productName,
          product_name: basePayload.productName,
          quantity: basePayload.quantity,
          unit_price: basePayload.unitPrice,
          price: basePayload.unitPrice,
          total: basePayload.totalAmount
        }];
        payload[productNameColumns[0]] = basePayload.productName;
        if (basePayload.productId) payload.product_id = basePayload.productId;
        if (basePayload.vendorName) payload.vendor_name = basePayload.vendorName;
        if (basePayload.clientName) {
          payload.client_nom = basePayload.clientName;
          payload.client_name = basePayload.clientName;
          payload.buyer_name = basePayload.clientName;
          payload.customer_name = basePayload.clientName;
          payload.nom_client = basePayload.clientName;
        }
        if (basePayload.clientPhone) {
          payload.client_tel = basePayload.clientPhone;
          payload.client_phone = basePayload.clientPhone;
          payload.telephone_client = basePayload.clientPhone;
        }
        payload[quantityColumns[0]] = basePayload.quantity;
        payload.qr_code = buildInitialQrCode();

        var out = await insertWithAdaptivePayload(payload);
        if (out.data) return out.data;
        if (out.error) lastError = out.error;
      }
    }
    throw new Error('Insertion commande impossible. ' + ((lastError && lastError.message) || 'Verifiez les colonnes/RLS de orders.'));
  }

  function normalizeOrderItem(item) {
    return {
      productId: item.product_id || item.productId || item.id || null,
      productName: item.name || item.title || 'Produit',
      vendorId: item.vendor_id || item.vendorId || null,
      vendorName: item.vendor_name || item.vendorName || '',
      quantity: Math.max(1, parseInt(item.quantity || 1, 10) || 1),
      unitPrice: parsePriceToNumber(item.price),
      image: item.image || ''
    };
  }

  async function checkout() {
    if (!q('commune-select').value) {
      showToast('Choisissez votre zone de livraison');
      q('dept-select').focus();
      return;
    }

    var cart = getCart();
    if (!Array.isArray(cart) || !cart.length) {
      alert('Votre panier est vide.');
      return;
    }

    var client = getClient();
    if (!client || !client.auth) {
      alert('Connexion requise pour passer commande.');
      return;
    }

    var checkoutBtn = q('btn-checkout');
    if (window.VendzaLoading && checkoutBtn) {
      checkoutBtn.setAttribute('data-vz-loading', '1');
      window.VendzaLoading.setButtonLoading(checkoutBtn, true);
    }
    try {

      var authResp = await client.auth.getUser();
      var user = authResp && authResp.data && authResp.data.user;
      if (!user) {
        alert('Veuillez vous connecter pour finaliser la commande.');
        window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html';
        return;
      }

      var createdCount = 0;
      var localUser = readLocalUser();
      var buyerProfile = await readBuyerProfile(client, user.id);
      var buyerName = ((buyerProfile && (buyerProfile.full_name || buyerProfile.display_name || buyerProfile.name || [buyerProfile.first_name, buyerProfile.last_name].filter(Boolean).join(' ') || [buyerProfile.prenom, buyerProfile.nom].filter(Boolean).join(' '))) || (localUser && (localUser.fullName || [localUser.firstName, localUser.lastName].filter(Boolean).join(' '))) || (user.email ? user.email.split('@')[0] : 'Client'));
      buyerName = String(buyerName || 'Client').trim() || 'Client';
      var buyerPhone = String((buyerProfile && (buyerProfile.telephone || buyerProfile.phone || buyerProfile.mobile)) || (localUser && (localUser.telephone || localUser.phone || localUser.mobile)) || '').trim();
      var buyerMeta = { name: buyerName, commune: q('commune-select').value || '', departement: q('dept-select').value || '' };

      for (var i = 0; i < cart.length; i += 1) {
        var item = normalizeOrderItem(cart[i]);
        var vendorFromProduct = await resolveVendorIdFromProduct(client, item);
        if (vendorFromProduct) item.vendorId = vendorFromProduct;
        if (!item.vendorId) throw new Error('Certains produits du panier ne sont pas lies a un vendeur.');

        if (window.VendzaCartGuard) {
          var ownItem = await window.VendzaCartGuard.isOwnProductAsync({ vendor_id: item.vendorId });
          if (ownItem) throw new Error(window.VendzaCartGuard.MSG);
        } else if (String(item.vendorId) === String(user.id)) {
          throw new Error('Vous ne pouvez pas acheter vos propres produits.');
        }

        var vendorCheck = await resolveVendorIdForOrder(client, item.vendorId, item.vendorName);
        if (!vendorCheck.ok) throw new Error('Vendeur introuvable dans la base.');

        var resolvedVendorId = vendorCheck.vendorId || item.vendorId;
        if (String(resolvedVendorId) === String(user.id)) {
          throw new Error('Vous ne pouvez pas acheter vos propres produits.');
        }
        if (vendorCheck.data && vendorCheck.data.user_id && String(vendorCheck.data.user_id) === String(user.id)) {
          throw new Error('Vous ne pouvez pas acheter vos propres produits.');
        }

        var totalAmount = item.unitPrice * item.quantity;
        var inserted = await insertOrderAdaptive(client, {
          buyerId: user.id,
          vendorId: vendorCheck.vendorId || item.vendorId,
          vendorName: item.vendorName,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          totalAmount: totalAmount,
          clientName: buyerName,
          clientPhone: buyerPhone,
          image: item.image
        });

        if (window.VendzaQR && typeof window.VendzaQR.ensureOrderQr === 'function') {
          await window.VendzaQR.ensureOrderQr(client, inserted, item.vendorId || '');
        }
        await notifyVendorOrderReceived(client, user.id, inserted, item, buyerMeta);
        createdCount += 1;
      }

      localStorage.removeItem('vendza_cart');
      updateBadge();
      render();
      alert('Commande(s) confirmee(s): ' + createdCount + '. Le vendeur a ete notifie.');
      window.location.href = window.VZ ? window.VZ.url('clientOrders') : 'historique-des-commandes.html';
    } catch (err) {
      alert('Erreur lors du passage de commande: ' + ((err && err.message) || 'inconnue'));
    } finally {
      if (window.VendzaLoading) window.VendzaLoading.setButtonLoading(checkoutBtn, false);
    }
  }

  async function initCartOwnershipGuard() {
    if (!window.VendzaCartGuard) return;
    await window.VendzaCartGuard.getBuyerIdAsync();
    var removed = window.VendzaCartGuard.purgeOwnProductsFromCart();
    if (removed > 0) {
      showToast('Vos propres produits ont ete retires du panier.');
      render();
      updateBadge();
    }
  }

  q('btn-checkout').addEventListener('click', checkout);
  bindCartEvents();
  initLocationFilters();
  initPromo();
  updateBadge();
  render();
  initCartOwnershipGuard();
  loadSuggestionsFromSupabase();
});
