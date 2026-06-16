'use strict';

(function () {
  var PRODUITS = [];
  var currentTab = '';
  var currentView = 'list';
  var deleteTarget = null;
  var currentUserId = '';

  function byId(id) { return document.getElementById(id); }

  function getClient() { return window.supabaseClient || window.supabase || null; }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    var t = byId('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function fmt(n) {
    var num = Number(n || 0);
    if (!Number.isFinite(num)) return '0';
    return Math.round(num).toLocaleString('fr-FR');
  }

  function pct(p, o) {
    var prix = Number(p);
    var old = Number(o);
    if (old && old > prix) return '-' + Math.round((1 - prix / old) * 100) + '%';
    return null;
  }

  function stockClass(s) {
    var n = Number(s) || 0;
    if (n === 0) return 'sp-out';
    if (n <= 3) return 'sp-low';
    return 'sp-ok';
  }

  function stockLabel(s) {
    var n = Number(s) || 0;
    if (n === 0) return '⚡ Épuisé';
    if (n <= 3) return '⚠ ' + n + ' restants';
    return '✓ ' + n + ' en stock';
  }

  function statusBadge(st) {
    if (st === 'brouillon') return '<span class="pbadge pb-draft">Brouillon</span>';
    if (st === 'epuise') return '<span class="pbadge pb-low">Épuisé</span>';
    return '';
  }

  function pickImage(client, row) {
    var raw = row.image_url || row.image || row.image_path || row.storage_path || '';
    if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() && client) {
      var path = raw.trim().replace(/^images\//i, '').replace(/^\/+/, '');
      var pub = client.storage.from('images').getPublicUrl(path);
      if (pub && pub.data && pub.data.publicUrl) return pub.data.publicUrl;
    }
    return '';
  }

  function deriveStatut(row) {
    var st = String(row.status || '').toLowerCase();
    var stock = Number(row.stock != null ? row.stock : (row.quantity != null ? row.quantity : row.stock_quantity));
    if (st === 'draft') return 'brouillon';
    if (!Number.isFinite(stock) || stock <= 0) return 'epuise';
    return 'actif';
  }

  function readVentes(row) {
    var v = row.sales_count != null ? row.sales_count
      : (row.units_sold != null ? row.units_sold : (row.ventes != null ? row.ventes : row.sold_count));
    var n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function normalizeRow(row, client) {
    var cat = row.category || row.categorie || 'Autre';
    var stock = Number(row.stock != null ? row.stock : (row.quantity != null ? row.quantity : row.stock_quantity));
    var oldVal = row.old_price != null ? Number(row.old_price) : null;
    return {
      id: row.id,
      nom: row.name || row.title || row.product_name || 'Produit',
      cat: cat,
      emoji: row.emoji || '📦',
      prix: Number(row.price || 0),
      old: oldVal && oldVal > 0 ? oldVal : null,
      stock: Number.isFinite(stock) ? stock : 0,
      statut: deriveStatut(row),
      ventes: readVentes(row),
      date: row.created_at ? new Date(row.created_at) : new Date(),
      img: pickImage(client, row),
      _raw: row
    };
  }

  function buildDuplicateRow(source, displayName) {
    var row = source._raw || {};
    return {
      vendor_id: currentUserId,
      name: displayName,
      description: row.description || '',
      category: row.category || row.categorie || source.cat || '',
      price: source.prix,
      old_price: source.old,
      stock: source.stock,
      colors: Array.isArray(row.colors) ? row.colors : [],
      sizes: Array.isArray(row.sizes) ? row.sizes : [],
      capacities: Array.isArray(row.capacities) ? row.capacities : [],
      features: Array.isArray(row.features) ? row.features : [],
      tags: Array.isArray(row.tags) ? row.tags : (Array.isArray(row.keywords) ? row.keywords : []),
      departement: row.departement || row.department || '',
      commune: row.commune || '',
      delivery_time: row.delivery_time || row.delai_livraison || '',
      image_url: row.image_url || row.image || null,
      image: row.image_url || row.image || null,
      gallery: Array.isArray(row.gallery) ? row.gallery : [],
      status: 'draft'
    };
  }

  async function requireVendor() {
    var client = getClient();
    if (!client) {
      window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html';
      return false;
    }
    var auth = await client.auth.getUser();
    var user = auth && auth.data && auth.data.user;
    if (!user) {
      window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html';
      return false;
    }
    currentUserId = user.id;
    return true;
  }

  async function fetchProducts(client) {
    var filters = ['vendor_id', 'seller_id', 'owner_id', 'user_id', 'created_by'];
    for (var i = 0; i < filters.length; i += 1) {
      try {
        var resp = await client
          .from('products')
          .select('*')
          .eq(filters[i], currentUserId)
          .order('created_at', { ascending: false })
          .limit(300);
        if (!resp.error && Array.isArray(resp.data) && resp.data.length) {
          return resp.data.map(function (row) { return normalizeRow(row, client); });
        }
      } catch (_) {}
    }
    return [];
  }

  async function updateOwnedProduct(client, id, patch) {
    var saveFn = window.VendzaProductSave && window.VendzaProductSave.saveProductRow;
    if (saveFn) {
      var saved = await saveFn(client, {
        row: Object.assign({}, patch),
        editId: id,
        vendorId: currentUserId
      });
      return { data: saved.data, error: saved.error };
    }
    var upd = await client.from('products').update(patch).eq('id', id).eq('vendor_id', currentUserId).select().single();
    if (!upd.error) return upd;
    return client.from('products').update(patch).eq('id', id).select().single();
  }

  async function deleteOwnedProduct(client, id) {
    var del = await client.from('products').delete().eq('id', id).eq('vendor_id', currentUserId);
    if (!del.error) return del;
    return client.from('products').delete().eq('id', id);
  }

  function setLoading() {
    var container = byId('products-container');
    if (!container) return;
    container.className = '';
    container.innerHTML =
      '<div class="empty">' +
      '<div class="empty-icon">⏳</div>' +
      '<h3>Chargement…</h3>' +
      '<p>Récupération de votre catalogue.</p>' +
      '</div>';
  }

  function render() {
    var searchEl = byId('search-input');
    var catEl = byId('filter-cat');
    var sortEl = byId('filter-sort');
    var search = searchEl ? searchEl.value.toLowerCase().trim() : '';
    var cat = catEl ? catEl.value : '';
    var sort = sortEl ? sortEl.value : 'recent';

    var data = PRODUITS.filter(function (p) {
      var matchTab = !currentTab || p.statut === currentTab;
      var matchSearch = !search
        || p.nom.toLowerCase().indexOf(search) >= 0
        || String(p.cat).toLowerCase().indexOf(search) >= 0;
      var matchCat = !cat || p.cat === cat;
      return matchTab && matchSearch && matchCat;
    });

    if (sort === 'prix-asc') data.sort(function (a, b) { return a.prix - b.prix; });
    else if (sort === 'prix-desc') data.sort(function (a, b) { return b.prix - a.prix; });
    else if (sort === 'stock') data.sort(function (a, b) { return a.stock - b.stock; });
    else data.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });

    var total = PRODUITS.length;
    var actifs = PRODUITS.filter(function (p) { return p.statut === 'actif'; }).length;
    var stockSum = PRODUITS.reduce(function (a, p) { return a + (Number(p.stock) || 0); }, 0);
    var ventesSum = PRODUITS.reduce(function (a, p) { return a + (Number(p.ventes) || 0); }, 0);

    if (byId('hs-total')) byId('hs-total').textContent = String(total);
    if (byId('hs-actifs')) byId('hs-actifs').textContent = String(actifs);
    if (byId('hs-stock')) byId('hs-stock').textContent = String(stockSum);
    if (byId('hs-ventes')) byId('hs-ventes').textContent = String(ventesSum);
    if (byId('tab-all')) byId('tab-all').textContent = String(total);
    if (byId('tab-actif')) byId('tab-actif').textContent = String(actifs);
    if (byId('tab-brouillon')) byId('tab-brouillon').textContent = String(PRODUITS.filter(function (p) { return p.statut === 'brouillon'; }).length);
    if (byId('tab-epuise')) byId('tab-epuise').textContent = String(PRODUITS.filter(function (p) { return p.statut === 'epuise'; }).length);

    var container = byId('products-container');
    if (!container) return;

    if (!data.length) {
      container.className = '';
      container.innerHTML =
        '<div class="empty">' +
        '<div class="empty-icon">📦</div>' +
        '<h3>Aucun produit trouvé</h3>' +
        '<p>Essayez d\'ajuster vos filtres ou créez votre premier produit.</p>' +
        '<a class="btn-empty" href="produit.html">+ Créer un produit</a>' +
        '</div>';
      return;
    }

    if (currentView === 'list') {
      container.className = 'products-list';
      container.innerHTML = data.map(function (p, i) { return cardListHtml(p, i); }).join('');
    } else {
      container.className = 'products-grid';
      container.innerHTML = data.map(function (p, i) { return cardGridHtml(p, i); }).join('');
    }
  }

  function imgBlock(p) {
    if (p.img) return '<img src="' + esc(p.img) + '" alt="">';
    return esc(p.emoji);
  }

  function badgesHtml(p) {
    var parts = [];
    var sale = pct(p.prix, p.old);
    if (sale) parts.push('<span class="pbadge pb-sale">' + esc(sale) + '</span>');
    parts.push(statusBadge(p.statut));
    if (p.stock <= 3 && p.stock > 0) parts.push('<span class="pbadge pb-low">Stock bas</span>');
    return parts.join('');
  }

  function cardListHtml(p, i) {
    return (
      '<div class="prod-card list-view" style="animation-delay:' + (i * 0.06) + 's">' +
      '<div class="prod-inner">' +
      '<div class="prod-img">' + imgBlock(p) + '<div class="prod-badges">' + badgesHtml(p) + '</div></div>' +
      '<div class="prod-body">' +
      '<div><div class="prod-cat">' + esc(p.cat) + '</div>' +
      '<div class="prod-name">' + esc(p.nom) + '</div>' +
      '<div class="prod-meta-row">' +
      '<span class="prod-price">' + fmt(p.prix) + ' <span style="font-size:10px;font-weight:400;color:var(--faint)">Gdes</span></span>' +
      (p.old ? '<span class="prod-old">' + fmt(p.old) + '</span>' : '') +
      '<span class="stock-pill ' + stockClass(p.stock) + '">' + esc(stockLabel(p.stock)) + '</span>' +
      '</div></div>' +
      '<div class="prod-actions">' +
      '<button type="button" class="btn-action btn-share" data-action="share" data-id="' + esc(p.id) + '" title="Partager">Partager</button>' +
      '<button type="button" class="btn-action btn-edit" data-action="edit" data-id="' + esc(p.id) + '">Modifier</button>' +
      '<button type="button" class="btn-action btn-delete" data-action="delete" data-id="' + esc(p.id) + '">Supprimer</button>' +
      '<div class="action-menu-wrap">' +
      '<button type="button" class="btn-more" data-action="menu" data-id="' + esc(p.id) + '">⋯</button>' +
      '<div class="action-menu" id="menu-' + esc(p.id) + '">' +
      '<button type="button" class="am-item" data-action="duplicate" data-id="' + esc(p.id) + '">Dupliquer</button>' +
      '<button type="button" class="am-item" data-action="toggle" data-id="' + esc(p.id) + '">' +
      (p.statut === 'actif' ? 'Désactiver' : 'Activer') + '</button>' +
      '<button type="button" class="am-item" data-action="share" data-id="' + esc(p.id) + '">Partager</button>' +
      '<button type="button" class="am-item" data-action="view" data-id="' + esc(p.id) + '">Voir l\'annonce</button>' +
      '<div class="am-sep"></div>' +
      '<button type="button" class="am-item danger" data-action="delete" data-id="' + esc(p.id) + '">Supprimer</button>' +
      '</div></div></div></div></div></div>'
    );
  }

  function cardGridHtml(p, i) {
    return (
      '<div class="prod-card grid-view" style="animation-delay:' + (i * 0.06) + 's">' +
      '<div class="prod-img">' + imgBlock(p) + '<div class="prod-badges">' + badgesHtml(p) + '</div></div>' +
      '<div class="prod-body">' +
      '<div class="prod-cat">' + esc(p.cat) + '</div>' +
      '<div class="prod-name">' + esc(p.nom) + '</div>' +
      '<div style="margin-bottom:8px;">' +
      '<span class="prod-price">' + fmt(p.prix) + '</span>' +
      '<span style="font-size:9px;color:var(--faint);margin-left:2px;">Gdes</span>' +
      (p.old ? '<span class="prod-old">' + fmt(p.old) + '</span>' : '') +
      '</div>' +
      '<div style="margin-bottom:10px;"><span class="stock-pill ' + stockClass(p.stock) + '">' + esc(stockLabel(p.stock)) + '</span></div>' +
      '<div class="prod-actions prod-actions-grid">' +
      '<button type="button" class="btn-action btn-share" data-action="share" data-id="' + esc(p.id) + '">Partager</button>' +
      '<button type="button" class="btn-action btn-edit" data-action="edit" data-id="' + esc(p.id) + '">Modifier</button>' +
      '<button type="button" class="btn-action btn-delete" data-action="delete" data-id="' + esc(p.id) + '">Suppr.</button>' +
      '</div></div></div>'
    );
  }

  function findProduct(id) {
    return PRODUITS.find(function (x) { return String(x.id) === String(id); });
  }

  function editProduct(id) {
    window.location.href = window.VZ ? window.VZ.url('vendorProductEdit', 'edit=' + encodeURIComponent(id)) : 'produit.html?edit=' + encodeURIComponent(id);
  }

  function toShareProduct(p) {
    var row = (p && p._raw) ? p._raw : {};
    return {
      id: p.id,
      name: p.nom,
      description: row.description || '',
      price: p.prix,
      imageResolved: p.img,
      image_url: row.image_url || row.image || null
    };
  }

  function shareProductById(id) {
    var p = findProduct(id);
    if (!p || !window.VendzaShare || typeof window.VendzaShare.shareProduct !== 'function') {
      showToast('Partage indisponible');
      return;
    }
    closeAllMenus();
    window.VendzaShare.shareProduct(toShareProduct(p)).then(function (result) {
      if (result && result.ok && result.method === 'clipboard') showToast('Lien copié');
      else if (result && result.ok) showToast('Produit partagé');
    }).catch(function () {
      showToast('Impossible de partager');
    });
  }

  function viewProduct(id) {
    var p = findProduct(id);
    if (!p || !p._raw) return;
    var row = p._raw;
    try {
      localStorage.setItem('vendza_selected_product', JSON.stringify({
        id: row.id,
        name: p.nom,
        price: p.prix,
        old_price: p.old,
        description: row.description || '',
        image: p.img,
        image_url: row.image_url || row.image || null,
        category: p.cat,
        vendor_id: row.vendor_id || currentUserId,
        vendor_name: 'Vendeur',
        colors: Array.isArray(row.colors) ? row.colors : [],
        capacities: Array.isArray(row.capacities) ? row.capacities : [],
        features: Array.isArray(row.features) ? row.features : [],
        gallery: Array.isArray(row.gallery) ? row.gallery : []
      }));
    } catch (_) {}
    window.location.href = window.VZ ? window.VZ.product(id) : '../detail-produit.html?id=' + encodeURIComponent(id);
  }

  async function duplicateProduct(id) {
    var client = getClient();
    var p = findProduct(id);
    if (!client || !p) return;
    closeAllMenus();
    showToast('Duplication…');
    var dupRow = buildDuplicateRow(p, (p.nom || 'Produit') + ' (copie)');
    var saveFn = window.VendzaProductSave && window.VendzaProductSave.saveProductRow;
    var dupSaved = saveFn
      ? await saveFn(client, { row: dupRow, vendorId: currentUserId })
      : await client.from('products').insert([dupRow]).select().single().then(function (r) {
          return { data: r.data, error: r.error };
        });
    if (dupSaved.error || !dupSaved.data) {
      showToast('Erreur : ' + ((dupSaved.error && dupSaved.error.message) || 'duplication'));
      return;
    }
    PRODUITS.unshift(normalizeRow(dupSaved.data, client));
    render();
    showToast('Produit dupliqué en brouillon');
  }

  async function toggleStatus(id) {
    var client = getClient();
    var p = findProduct(id);
    if (!client || !p) return;
    closeAllMenus();
    var activate = p.statut !== 'actif';
    var patch = activate
      ? { status: 'published' }
      : { status: 'draft' };
    var upd = await updateOwnedProduct(client, id, patch);
    if (upd.error) {
      showToast('Erreur : ' + (upd.error.message || 'mise à jour'));
      return;
    }
    var idx = PRODUITS.findIndex(function (x) { return String(x.id) === String(id); });
    if (idx >= 0) PRODUITS[idx] = normalizeRow(upd.data, client);
    render();
    showToast(activate ? 'Produit activé' : 'Produit désactivé');
  }

  function confirmDelete(id) {
    deleteTarget = id;
    var modal = byId('confirm-modal');
    if (modal) modal.classList.add('open');
    closeAllMenus();
  }

  function closeConfirm() {
    var modal = byId('confirm-modal');
    if (modal) modal.classList.remove('open');
    deleteTarget = null;
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    var client = getClient();
    if (!client) return;
    var id = deleteTarget;
    closeConfirm();
    showToast('Suppression…');
    var del = await deleteOwnedProduct(client, id);
    if (del.error) {
      showToast('Erreur : ' + (del.error.message || 'suppression'));
      return;
    }
    PRODUITS = PRODUITS.filter(function (p) { return String(p.id) !== String(id); });
    render();
    showToast('Produit supprimé');
  }

  function toggleMenu(id, ev) {
    if (ev) ev.stopPropagation();
    var menu = byId('menu-' + id);
    if (!menu) return;
    var isOpen = menu.classList.contains('open');
    closeAllMenus();
    if (!isOpen) menu.classList.add('open');
  }

  function closeAllMenus() {
    document.querySelectorAll('.action-menu').forEach(function (m) {
      m.classList.remove('open');
    });
  }

  function setView(v) {
    currentView = v;
    var listBtn = byId('vt-list');
    var gridBtn = byId('vt-grid');
    if (listBtn) listBtn.classList.toggle('active', v === 'list');
    if (gridBtn) gridBtn.classList.toggle('active', v === 'grid');
    render();
  }

  function setTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.stab').forEach(function (btn) {
      var t = btn.getAttribute('data-tab') || '';
      btn.classList.toggle('active', t === tab);
    });
    render();
  }

  function bindUi() {
    var search = byId('search-input');
    if (search) search.addEventListener('input', render);

    var cat = byId('filter-cat');
    var sort = byId('filter-sort');
    if (cat) cat.addEventListener('change', render);
    if (sort) sort.addEventListener('change', render);

    var vtList = byId('vt-list');
    var vtGrid = byId('vt-grid');
    if (vtList) vtList.addEventListener('click', function () { setView('list'); });
    if (vtGrid) vtGrid.addEventListener('click', function () { setView('grid'); });

    document.querySelectorAll('.stab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTab(btn.getAttribute('data-tab') || '');
      });
    });

    var container = byId('products-container');
    if (container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');
        if (!id) return;
        if (action === 'edit') editProduct(id);
        else if (action === 'delete') confirmDelete(id);
        else if (action === 'menu') toggleMenu(id, e);
        else if (action === 'duplicate') duplicateProduct(id);
        else if (action === 'toggle') toggleStatus(id);
        else if (action === 'view') viewProduct(id);
        else if (action === 'share') shareProductById(id);
      });
    }

    var cancelBtn = byId('btn-cancel-delete');
    if (cancelBtn) cancelBtn.addEventListener('click', closeConfirm);

    var confirmBtn = byId('confirm-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', executeDelete);

    var modal = byId('confirm-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeConfirm();
      });
    }

    document.addEventListener('click', closeAllMenus);
  }

  async function init() {
    try {
      if (!(await requireVendor())) return;
      bindUi();
      var client = getClient();
      PRODUITS = await fetchProducts(client);
      render();
    } catch (_) {
      setLoading();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
