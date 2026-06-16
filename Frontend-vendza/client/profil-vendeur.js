'use strict';

(function () {
  var vendorId = '';
  var productId = '';
  var vendorNameParam = '';

  function byId(id) { return document.getElementById(id); }

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function queryParams() {
    try { return new URLSearchParams(window.location.search || ''); }
    catch (_) { return new URLSearchParams(''); }
  }

  function showToast(msg) {
    var t = byId('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function updateCartBadge() {
    try {
      var cart = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
      var n = Array.isArray(cart) ? cart.reduce(function (s, i) { return s + (Number(i && i.quantity) || 1); }, 0) : 0;
      var el = byId('cart-count');
      if (el) el.textContent = String(n);
    } catch (_) {}
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function withCacheBust(url) {
    if (!url) return '';
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now();
  }

  function getPublicUrl(client, path) {
    if (!client || !path) return '';
    var pub = client.storage.from('images').getPublicUrl(path);
    return (pub && pub.data && pub.data.publicUrl) || '';
  }

  function pickImage(client, p) {
    var raw = p.image_url || p.image || p.image_path || p.storage_path || '';
    if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
      var path = raw.trim().replace(/^images\//i, '').replace(/^\/+/, '');
      if (vendorId && p.id && path.indexOf('/') < 0) {
        path = vendorId + '/' + p.id + '/' + path;
      }
      return getPublicUrl(client, path);
    }
    if (client && vendorId && p.id) {
      return getPublicUrl(client, vendorId + '/' + p.id + '/cover.jpg');
    }
    return '';
  }

  function mapFromProfile(row, vendorName) {
    var nom = row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || vendorName || 'Vendeur';
    return {
      id: row.id || vendorId,
      nom: String(nom).trim() || 'Vendeur',
      boutique: row.shop_name || row.store_name || row.boutique || row.vendor_name || '',
      desc: row.description || row.shop_description || row.bio || row.about || '',
      dept: row.departement || row.department || row.dept || '',
      commune: row.commune || row.city || '',
      delai: row.delai_livraison || row.delivery_time || row.delivery_delay || '',
      avatarUrl: row.avatar_url || row.avatarUrl || row.profile_image || row.photo_url || '',
      coverUrl: row.cover_url || row.coverUrl || row.cover_image || row.banner_url || '',
      createdAt: row.created_at || row.createdAt || null,
      planCode: 'free',
      coverageDepartments: [],
      _vendorVerified: false
    };
  }

  async function fetchVendorRow(client, userId) {
    if (!client || !userId) return null;
    try {
      var resp = await client.from('users').select('*').or('id.eq.' + userId + ',user_id.eq.' + userId).maybeSingle();
      if (!resp.error && resp.data) return resp.data;
    } catch (_) {}
    try {
      var resp2 = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!resp2.error && resp2.data) return resp2.data;
    } catch (_) {}
    try {
      var resp3 = await client.from('vendors').select('*').or('id.eq.' + userId + ',user_id.eq.' + userId).maybeSingle();
      if (!resp3.error && resp3.data) return resp3.data;
    } catch (_) {}
    return null;
  }

  function mergeVendor(profil, vendor) {
    if (!vendor) return profil;
    profil.boutique = profil.boutique || vendor.shop_name || vendor.store_name || vendor.boutique || vendor.name || vendor.vendor_name || '';
    profil.desc = profil.desc || vendor.description || vendor.shop_description || vendor.bio || '';
    profil.delai = profil.delai || vendor.delai_livraison || vendor.delivery_time || vendor.delivery_delay || '';
    profil.dept = profil.dept || vendor.departement || vendor.department || '';
    profil.commune = profil.commune || vendor.commune || vendor.city || '';
    profil.coverageDepartments = (profil.coverageDepartments && profil.coverageDepartments.length)
      ? profil.coverageDepartments
      : (window.VendzaVerified && window.VendzaVerified.parseDepartmentsArray
        ? window.VendzaVerified.parseDepartmentsArray(vendor.coverage_departments)
        : []);
    profil.coverUrl = profil.coverUrl || vendor.cover_url || vendor.cover_image || vendor.banner_url || '';
    profil.avatarUrl = profil.avatarUrl || vendor.avatar_url || vendor.profile_image || vendor.photo_url || '';
    profil.createdAt = profil.createdAt || vendor.created_at || null;
    return profil;
  }

  async function resolveCoverFromStorage(client, userId, existing) {
    var dbUrl = existing ? String(existing).trim() : '';
    if (!client || !userId) return dbUrl ? withCacheBust(dbUrl) : '';
    try {
      var list = await client.storage.from('images').list(userId, { limit: 50 });
      var files = (list && list.data) || [];
      var coverFile = files.find(function (f) {
        return f && f.name && /^cover\./i.test(f.name);
      });
      if (coverFile) return withCacheBust(getPublicUrl(client, userId + '/' + coverFile.name));
    } catch (_) {}
    var fallback = getPublicUrl(client, userId + '/cover.jpg');
    if (fallback && fallback.indexOf('/cover.jpg') >= 0) return withCacheBust(fallback);
    return dbUrl ? withCacheBust(dbUrl) : '';
  }

  async function resolveAvatarFromStorage(client, userId, existing) {
    var dbUrl = existing ? String(existing).trim() : '';
    if (!client || !userId) return dbUrl ? withCacheBust(dbUrl) : '';
    try {
      var list = await client.storage.from('images').list(userId, { limit: 40 });
      var files = (list && list.data) || [];
      var avatarFile = files.find(function (f) {
        return f && f.name && /^avatar\./i.test(f.name);
      });
      if (avatarFile) return withCacheBust(getPublicUrl(client, userId + '/' + avatarFile.name));
    } catch (_) {}
    return dbUrl ? withCacheBust(dbUrl) : '';
  }

  async function fetchVendorProfile(client, id, nameHint) {
    var profil = mapFromProfile({}, decodeURIComponent(nameHint || '') || 'Vendeur');
    profil.id = id;
    if (!client || !id) return profil;
    try {
      var resp = await client.from('users').select('*').eq('id', id).maybeSingle();
      if (!resp.error && resp.data) profil = mapFromProfile(resp.data, nameHint);
    } catch (_) {}
    var vendor = await fetchVendorRow(client, id);
    profil = mergeVendor(profil, vendor);
    profil.avatarUrl = await resolveAvatarFromStorage(client, id, profil.avatarUrl);
    profil.coverUrl = await resolveCoverFromStorage(client, id, profil.coverUrl);

    try {
      var sub = window.VendzaSubscription
        ? await window.VendzaSubscription.querySubscription(client, id)
        : await client.from('vendor_subscriptions').select('plan_code,status,expires_at,departments').eq('user_id', id).maybeSingle();
      if (sub && !sub.error && sub.data && String(sub.data.status || '').toLowerCase() === 'active') {
        profil.planCode = window.VendzaSubscription
          ? window.VendzaSubscription.planCodeFromRow(sub.data)
          : (sub.data.plan_code || 'free');
        var exp = sub.data.expires_at ? new Date(sub.data.expires_at).getTime() : null;
        if (!exp || exp > Date.now()) {
          profil._vendorVerified = window.VendzaVerified && window.VendzaVerified.isProPlanCode(profil.planCode);
          var extra = window.VendzaVerified && window.VendzaVerified.parseDepartmentsArray
            ? window.VendzaVerified.parseDepartmentsArray(sub.data.departments)
            : [];
          if (extra.length) profil.coverageDepartments = extra;
        }
      }
    } catch (_) {}

    if (!profil._vendorVerified && window.VendzaVerified && typeof window.VendzaVerified.fetchVerifiedSet === 'function') {
      try {
        var verifiedSet = await window.VendzaVerified.fetchVerifiedSet(client, [id]);
        profil._vendorVerified = !!verifiedSet[String(id)];
        if (profil._vendorVerified && !profil.planCode) profil.planCode = 'pro-350';
      } catch (_) {}
    }

    if (!profil._vendorVerified && vendor && (vendor.is_verified || vendor.verified || vendor.is_pro)) {
      profil._vendorVerified = true;
    }

    profil._shopName = displayName(profil);
    if (!profil.boutique) profil.boutique = profil._shopName;

    try {
      var localFields = JSON.parse(localStorage.getItem('vendza_vendor_profile_fields_' + id) || '{}') || {};
      if (localFields.dept) profil.dept = localFields.dept;
      if (localFields.commune) profil.commune = localFields.commune;
      if (localFields.delai) profil.delai = localFields.delai;
      if (localFields.coverageDepartments && window.VendzaVerified) {
        var extraLocal = window.VendzaVerified.parseDepartmentsArray(localFields.coverageDepartments);
        if (extraLocal.length) profil.coverageDepartments = extraLocal;
      }
    } catch (_) {}

    return profil;
  }

  async function fetchStats(client, userId) {
    var stats = { products: 0, orders: 0, rating: null, reviewCount: 0 };
    if (!client || !userId) return stats;
    var pCols = ['vendor_id', 'seller_id', 'owner_id', 'user_id'];
    var oCols = ['vendor_id', 'seller_id', 'owner_id'];
    var i;
    for (i = 0; i < pCols.length; i += 1) {
      try {
        var pr = await client.from('products').select('id', { count: 'exact', head: true }).eq(pCols[i], userId);
        if (!pr.error && typeof pr.count === 'number') { stats.products = pr.count; break; }
      } catch (_) {}
    }
    for (i = 0; i < oCols.length; i += 1) {
      try {
        var or = await client.from('orders').select('id', { count: 'exact', head: true }).eq(oCols[i], userId);
        if (!or.error && typeof or.count === 'number') { stats.orders = or.count; break; }
      } catch (_) {}
    }
    return stats;
  }

  async function fetchVendorProducts(client, userId) {
    if (!client || !userId || userId === 'undefined') return [];
    var cols = ['vendor_id', 'seller_id', 'owner_id', 'user_id'];
    var i;
    for (i = 0; i < cols.length; i += 1) {
      try {
        var resp = await client.from('products').select('*').eq(cols[i], userId).order('created_at', { ascending: false }).limit(20);
        if (!resp.error && Array.isArray(resp.data)) {
          return resp.data.filter(function (p) {
            var colVal = p[cols[i]] || p.vendor_id || p.seller_id || p.owner_id || p.user_id;
            return String(colVal || '').trim().toLowerCase() === String(userId).trim().toLowerCase() && String(p.status || '').toLowerCase() !== 'draft';
          });
        }
      } catch (_) {}
    }
    return [];
  }

  async function fetchVendorReviews(client, userId) {
    if (!client || !userId) return [];
    var reviews = [];
    try {
      var r1 = await client.from('reviews').select('*').eq('vendor_id', userId).order('created_at', { ascending: false }).limit(15);
      if (!r1.error && Array.isArray(r1.data)) reviews = r1.data;
    } catch (_) {}
    if (reviews.length) return reviews;
    var products = await fetchVendorProducts(client, userId);
    var ids = products.map(function (p) { return p.id; }).filter(Boolean);
    if (!ids.length) return [];
    try {
      var r2 = await client.from('reviews').select('*').in('product_id', ids).order('created_at', { ascending: false }).limit(15);
      if (!r2.error && Array.isArray(r2.data)) return r2.data;
    } catch (_) {}
    return [];
  }

  function formatRelativeDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var diff = Date.now() - d.getTime();
      var days = Math.floor(diff / 86400000);
      if (days < 1) return "Aujourd'hui";
      if (days === 1) return 'Hier';
      if (days < 7) return 'Il y a ' + days + ' jours';
      if (days < 30) return 'Il y a ' + Math.floor(days / 7) + ' semaine' + (days >= 14 ? 's' : '');
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch (_) {
      return '';
    }
  }

  function starsHtml(rating, max) {
    max = max || 5;
    var rounded = Math.round(Number(rating) || 0);
    var html = '';
    var i;
    for (i = 1; i <= max; i += 1) {
      html += '<span class="star' + (i > rounded ? ' empty' : '') + '">★</span>';
    }
    return html;
  }

  function displayName(profil) {
    if (window.VendzaVerified && typeof window.VendzaVerified.getShopName === 'function') {
      return window.VendzaVerified.getShopName(profil);
    }
    return (profil.boutique || profil.nom || 'Vendeur').trim();
  }

  function handleSlug(name) {
    return '@' + String(name || 'vendeur').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 32);
  }

  function applyCover(url) {
    var cover = byId('profile-cover');
    if (!cover) return;
    if (url) {
      cover.style.backgroundImage = 'url("' + String(url).replace(/"/g, '&quot;') + '")';
      cover.style.backgroundSize = 'cover';
      cover.style.backgroundPosition = 'center';
      cover.classList.add('has-photo');
    } else {
      cover.style.backgroundImage = '';
      cover.classList.remove('has-photo');
    }
  }

  function renderAvatar(profil) {
    var av = byId('avatar-display');
    var letter = byId('avatar-letter');
    var name = displayName(profil);
    var initial = name.charAt(0).toUpperCase();
    if (profil.avatarUrl && av) {
      av.innerHTML = '<img src="' + escapeHtml(profil.avatarUrl) + '" alt="">';
    } else if (letter) {
      letter.textContent = initial;
    }
  }

  function renderProfile(profil, stats) {
    var name = displayName(profil);
    var verified = (window.VendzaVerified && window.VendzaVerified.isProPlanCode(profil.planCode)) || !!profil._vendorVerified;
    var nomEl = byId('vendeur-nom');
    if (nomEl) {
      if (window.VendzaVerified && typeof window.VendzaVerified.applyShopLine === 'function') {
        window.VendzaVerified.applyShopLine(nomEl, name, verified, 24);
      } else {
        nomEl.textContent = name;
      }
    }
    if (byId('vendeur-handle')) byId('vendeur-handle').textContent = handleSlug(name);
    document.title = name + ' — Vendza';

    var zone = [profil.dept, profil.commune].filter(Boolean).join(' · ');
    if (byId('tag-zone')) byId('tag-zone').textContent = zone || 'Haïti';

    if (profil.createdAt && byId('tag-membre')) {
      try {
        var y = new Date(profil.createdAt).getFullYear();
        if (y > 2000) byId('tag-membre').textContent = 'Membre depuis ' + y;
      } catch (_) {}
    }

    var planEl = byId('tag-plan');
    if (planEl && profil.planCode && profil.planCode !== 'free') {
      planEl.hidden = false;
      planEl.textContent = profil.planCode.indexOf('elite') >= 0 ? '⭐ Vendeur Elite' : '⭐ Vendeur Pro';
    }

    var tagCoverage = byId('tag-coverage');
    if (tagCoverage) {
      var coverageText = window.VendzaVerified && window.VendzaVerified.formatCoverageLabel
        ? window.VendzaVerified.formatCoverageLabel(profil)
        : '';
      if (coverageText && verified) {
        tagCoverage.hidden = false;
        tagCoverage.textContent = '🗺️ ' + coverageText;
      } else {
        tagCoverage.hidden = true;
      }
    }

    var rowCoverage = byId('row-coverage');
    var infoCoverage = byId('info-coverage');
    var covLabel = window.VendzaVerified && window.VendzaVerified.formatCoverageLabel
      ? window.VendzaVerified.formatCoverageLabel(profil)
      : '';
    if (rowCoverage) rowCoverage.hidden = !(covLabel && verified);
    if (infoCoverage) infoCoverage.textContent = covLabel || '—';

    var coverVerified = document.querySelector('.cover-verified');
    if (coverVerified) {
      if (verified) {
        coverVerified.hidden = false;
        coverVerified.innerHTML = (window.VendzaVerified ? window.VendzaVerified.badgeHtml({ size: 16, inline: true }) : '') + ' Vendeur vérifié';
      } else {
        coverVerified.hidden = true;
      }
    }

    if (byId('stat-produits')) byId('stat-produits').textContent = String(stats.products);
    if (byId('stat-ventes')) byId('stat-ventes').textContent = String(stats.orders);
    if (byId('stat-note')) byId('stat-note').textContent = stats.rating != null ? String(stats.rating) : '—';
    if (byId('stat-livraison')) byId('stat-livraison').textContent = profil.delai || '—';

    var infoBoutique = byId('info-boutique');
    if (infoBoutique) {
      if (window.VendzaVerified && typeof window.VendzaVerified.applyShopLine === 'function') {
        window.VendzaVerified.applyShopLine(infoBoutique, profil.boutique || name, verified, 20);
      } else {
        infoBoutique.textContent = profil.boutique || name;
      }
    }
    if (byId('info-dept')) byId('info-dept').textContent = profil.dept || '—';
    if (byId('info-commune')) byId('info-commune').textContent = profil.commune || '—';
    if (byId('info-livraison')) {
      byId('info-livraison').textContent = zone || 'Sur demande';
    }
    if (byId('info-delai')) byId('info-delai').textContent = profil.delai || '—';
    if (byId('info-date') && profil.createdAt) {
      try {
        byId('info-date').textContent = new Date(profil.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      } catch (_) {
        byId('info-date').textContent = '—';
      }
    }
    var rowDesc = byId('row-desc');
    if (rowDesc) rowDesc.hidden = false;
    if (byId('info-desc')) {
      byId('info-desc').textContent = profil.desc ? profil.desc : 'Ce vendeur n\'a pas encore ajouté de description.';
    }

    applyCover(profil.coverUrl);
    renderAvatar(profil);
  }

  function renderReviews(reviews) {
    var list = byId('reviews-list');
    var empty = byId('reviews-empty');
    if (!list) return;

    if (!reviews.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      if (byId('rating-num')) byId('rating-num').textContent = '—';
      if (byId('rating-stars')) byId('rating-stars').innerHTML = '';
      if (byId('rating-count')) byId('rating-count').textContent = '';
      return;
    }

    if (empty) empty.hidden = true;
    var avg = reviews.reduce(function (s, r) { return s + (Number(r.rating) || 0); }, 0) / reviews.length;
    var avgText = avg.toFixed(1);
    if (byId('rating-num')) byId('rating-num').textContent = avgText;
    if (byId('rating-stars')) byId('rating-stars').innerHTML = starsHtml(avg);
    if (byId('rating-count')) byId('rating-count').textContent = 'sur ' + reviews.length + ' avis';

    var sat = byId('rating-satisfaction');
    if (sat) {
      var pct = Math.round((reviews.filter(function (r) { return Number(r.rating) >= 4; }).length / reviews.length) * 100);
      sat.hidden = false;
      sat.textContent = '⬆ ' + pct + '% de satisfaction';
    }

    list.innerHTML = reviews.slice(0, 6).map(function (r) {
      var author = r.author_name || r.user_name || r.reviewer_name || 'Client';
      var initial = author.charAt(0).toUpperCase();
      var rating = Number(r.rating) || 0;
      var stars = '';
      var i;
      for (i = 1; i <= 5; i += 1) {
        stars += '<span' + (i > rating ? ' style="color:var(--border)"' : '') + '>★</span>';
      }
      return (
        '<article class="review">' +
        '<div class="review-top">' +
        '<div class="reviewer"><div class="reviewer-av">' + escapeHtml(initial) + '</div>' +
        '<div><div class="reviewer-name">' + escapeHtml(author) + '</div>' +
        '<div class="reviewer-date">' + escapeHtml(formatRelativeDate(r.created_at)) + '</div></div></div>' +
        '<div class="review-stars">' + stars + '</div>' +
        '</div>' +
        '<p class="review-text">' + escapeHtml(r.comment || r.content || r.review_text || '') + '</p>' +
        '</article>'
      );
    }).join('');

  }

  function renderProducts(client, products) {
    var scroll = byId('products-scroll');
    var empty = byId('products-empty');
    if (!scroll) return;

    if (!products.length) {
      scroll.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    scroll.innerHTML = products.map(function (p) {
      var imgUrl = pickImage(client, p);
      var imgInner = imgUrl
        ? '<img src="' + escapeHtml(imgUrl) + '" alt="">'
        : '<span>📦</span>';
      var href = '../detail-produit.html?id=' + encodeURIComponent(p.id);
      return (
        '<a class="mini-product" href="' + href + '">' +
        '<div class="mini-img">' + imgInner + '</div>' +
        '<div class="mini-info">' +
        '<div class="mini-name">' + escapeHtml(p.name || 'Produit') + '</div>' +
        '<div class="mini-price">' + Number(p.price || 0).toLocaleString('fr-FR') + ' Gdes</div>' +
        '</div></a>'
      );
    }).join('');
  }

  function contactUrl() {
    if (productId) {
      return '../detail-produit.html?id=' + encodeURIComponent(productId) + '#contact';
    }
    return '../authentification/connexion.html?redirect=' + encodeURIComponent(
      'client/profil-vendeur.html?vendor_id=' + vendorId + (vendorNameParam ? '&vendor_name=' + vendorNameParam : '')
    );
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var params = queryParams();
    vendorId = (params.get('vendor_id') || params.get('id') || '').trim();
    productId = (params.get('product_id') || params.get('from_product') || '').trim();
    vendorNameParam = (params.get('vendor_name') || '').trim();

    updateCartBadge();

    if (!vendorId) {
      showToast('Vendeur introuvable');
      setTimeout(function () { window.location.href = window.VZ ? window.VZ.url('home') : '../index.html'; }, 1600);
      return;
    }

    var back = byId('nav-back');
    if (back) {
      if (productId) {
        back.href = '../detail-produit.html?id=' + encodeURIComponent(productId);
        back.textContent = '← Retour au produit';
      } else if (document.referrer) {
        back.href = 'javascript:history.back()';
        back.textContent = '← Retour';
      }
    }

    var allLink = byId('link-all-products');
    if (allLink) {
      allLink.href = '../index.html?vendor_id=' + encodeURIComponent(vendorId);
    }

    var contactHref = contactUrl();
    var btnContact = byId('btn-contact');
    var btnWrite = byId('btn-write');
    if (btnContact) btnContact.href = contactHref;
    if (btnWrite) btnWrite.href = contactHref;

    byId('btn-report').addEventListener('click', function () {
      showToast('Merci. Notre équipe examinera votre signalement.');
    });

    var client = getClient();
    var profil = await fetchVendorProfile(client, vendorId, vendorNameParam);
    var stats = await fetchStats(client, vendorId);
    var reviews = await fetchVendorReviews(client, vendorId);
    var products = await fetchVendorProducts(client, vendorId);

    if (reviews.length) {
      var sum = reviews.reduce(function (s, r) { return s + (Number(r.rating) || 0); }, 0);
      stats.rating = (sum / reviews.length).toFixed(1);
      stats.reviewCount = reviews.length;
    }

    renderProfile(profil, stats);
    renderReviews(reviews);
    renderProducts(client, products);
  });
})();
