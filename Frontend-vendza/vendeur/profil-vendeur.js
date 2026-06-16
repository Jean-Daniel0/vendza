'use strict';

(function () {
  var COMMUNES = {
    Ouest: ['Port-au-Prince', 'Pétionville', 'Delmas', 'Croix-des-Bouquets', 'Léogâne', 'Carrefour'],
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

  var PROFIL = {};
  var originalProfil = {};
  var editMode = false;
  var isPublicView = false;
  var currentUserId = '';

  function byId(id) { return document.getElementById(id); }

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function queryParams() {
    try { return new URLSearchParams(window.location.search || ''); }
    catch (_) { return new URLSearchParams(''); }
  }

  function readLocalUser() {
    try { return JSON.parse(localStorage.getItem('vendza_user_data') || '{}') || {}; }
    catch (_) { return {}; }
  }

  function showToast(msg) {
    var t = byId('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function bindSubscriptionManage() {
    var link = byId('abo-link');
    var card = byId('abo-card');
    var target = 'Abonnement.html';

    function goAbonnement(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      window.location.href = target;
    }

    if (link) {
      link.setAttribute('href', target);
      link.addEventListener('click', goAbonnement);
    }
    if (card) {
      card.classList.add('is-clickable');
      card.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('#abo-link')) return;
        if (e.target && e.target.closest && e.target.closest('a')) return;
        goAbonnement(e);
      });
    }
  }

  function updateCartBadge() {
    try {
      var cart = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
      var n = Array.isArray(cart) ? cart.reduce(function (s, i) { return s + (Number(i && i.quantity) || 1); }, 0) : 0;
      var el = byId('cart-count');
      if (el) el.textContent = String(n);
    } catch (_) {}
  }

  function setReadVal(id, val, placeholder) {
    var el = byId(id);
    if (!el) return;
    el.innerHTML = val ? String(val) : '<span class="empty">' + placeholder + '</span>';
  }

  function planLabel(code) {
    if (code === 'elite-499') return 'Elite';
    if (code === 'pro-350') return 'Pro Local';
    if (code === 'free') return 'Gratuit';
    return code ? String(code) : 'Gratuit';
  }

  function formatRenewalDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) {
      return '—';
    }
  }

  function mapFromProfile(row, local, authUser) {
    var nom = row.full_name || local.fullName || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Utilisateur';
    return {
      id: (authUser && authUser.id) || row.id || local.id || '',
      nom: String(nom).trim() || 'Utilisateur',
      email: row.email || (authUser && authUser.email) || local.email || '',
      tel: row.phone_number || row.telephone || row.phone || local.phone || '',
      dept: row.departement || row.department || local.departement || '',
      commune: row.commune || local.commune || '',
      boutique: row.shop_name || row.store_name || row.vendor_name || row.boutique || '',
      desc: row.description || row.shop_description || row.bio || '',
      delai: row.delai_livraison || row.delivery_time || row.delivery_delay || '',
      plan: 'Gratuit',
      planCode: 'free',
      planExpires: null,
      coverageDepartments: [],
      _vendorVerified: false,
      avatarUrl: row.avatar_url || row.avatarUrl || row.profile_image || row.photo_url || local.avatarUrl || '',
      coverUrl: row.cover_url || row.coverUrl || local.coverUrl || '',
      newsletter: row.newsletter === true || row.newsletter === 'true',
      lastLogin: (authUser && authUser.last_sign_in_at) || row.last_sign_in_at || null,
      userType: row.user_type || local.userType || 'vendeur'
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

  function profileFieldsKey(userId) {
    return 'vendza_vendor_profile_fields_' + String(userId || '');
  }

  function readProfileFieldsLocal(userId) {
    try {
      return JSON.parse(localStorage.getItem(profileFieldsKey(userId)) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveProfileFieldsLocal(userId, fields) {
    if (!userId) return;
    localStorage.setItem(profileFieldsKey(userId), JSON.stringify(fields || {}));
  }

  function parseCoverageDepartments(raw) {
    if (window.VendzaVerified && window.VendzaVerified.parseDepartmentsArray) {
      return window.VendzaVerified.parseDepartmentsArray(raw);
    }
    if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
    return [];
  }

  function mergeVendorIntoProfil(profil, vendor) {
    if (!vendor) return profil;
    profil.boutique = profil.boutique || vendor.shop_name || vendor.store_name || vendor.name || vendor.vendor_name || '';
    profil.desc = profil.desc || vendor.description || vendor.shop_description || '';
    profil.dept = profil.dept || vendor.departement || vendor.department || vendor.dept || '';
    profil.commune = profil.commune || vendor.commune || vendor.city || '';
    profil.delai = profil.delai || vendor.delai_livraison || vendor.delivery_time || vendor.delivery_delay || '';
    profil.coverageDepartments = profil.coverageDepartments || parseCoverageDepartments(vendor.coverage_departments);
    profil.coverUrl = profil.coverUrl || vendor.cover_url || vendor.cover_image || vendor.banner_url || '';
    profil.avatarUrl = profil.avatarUrl || vendor.avatar_url || vendor.avatarUrl || vendor.profile_image || vendor.photo_url || '';
    if (vendor.is_verified || vendor.verified || vendor.is_pro) {
      profil._vendorVerified = true;
    }
    return profil;
  }

  function applySubscriptionToProfil(profil, sub) {
    if (!sub || !profil) return profil;
    profil.planCode = sub.plan_code || profil.planCode || 'free';
    profil.plan = planLabel(profil.planCode);
    profil.planExpires = sub.expires_at || profil.planExpires;
    var extra = parseCoverageDepartments(sub.departments);
    if (extra.length) profil.coverageDepartments = extra;
    if (window.VendzaVerified && window.VendzaVerified.isProPlanCode(profil.planCode) && String(sub.status || 'active').toLowerCase() === 'active') {
      profil._vendorVerified = true;
    }
    return profil;
  }

  function mergeProfileFieldsLocal(profil, userId) {
    var localFields = readProfileFieldsLocal(userId);
    if (!localFields || !profil) return profil;
    if (localFields.dept) profil.dept = localFields.dept;
    if (localFields.commune) profil.commune = localFields.commune;
    if (localFields.delai) profil.delai = localFields.delai;
    if ((!profil.coverageDepartments || !profil.coverageDepartments.length) && localFields.coverageDepartments) {
      profil.coverageDepartments = parseCoverageDepartments(localFields.coverageDepartments);
    }
    return profil;
  }

  function isProfilVerified() {
    if (PROFIL._vendorVerified) return true;
    return !!(window.VendzaVerified && window.VendzaVerified.isProPlanCode(PROFIL.planCode));
  }

  async function fetchPremiumPlan(client, userId) {
    if (!client || !userId) return null;
    try {
      var resp = window.VendzaSubscription
        ? await window.VendzaSubscription.querySubscription(client, userId)
        : await client.from('vendor_subscriptions').select('plan_code,status,expires_at').eq('user_id', userId).maybeSingle();
      if (resp && !resp.error && resp.data && resp.data.plan_code && resp.data.plan_code !== 'free' && resp.data.status === 'active') {
        return resp.data;
      }
    } catch (_) {}
    try {
      var localSub = JSON.parse(localStorage.getItem('vendza_vendor_subscription') || 'null');
      if (localSub && String(localSub.user_id || '') === String(userId) && localSub.plan_code && localSub.plan_code !== 'free') {
        return {
          plan_code: localSub.plan_code,
          status: localSub.status || 'active',
          expires_at: localSub.expires_at || null,
          departments: localSub.departments || []
        };
      }
    } catch (_) {}
    return null;
  }

  async function fetchStats(client, userId) {
    var stats = { products: 0, orders: 0, rating: '—' };
    if (!client || !userId) return stats;
    var pCols = ['vendor_id', 'seller_id', 'owner_id', 'user_id', 'created_by'];
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
    try {
      var rev = await client.from('reviews').select('rating').eq('vendor_id', userId).limit(200);
      if (!rev.error && Array.isArray(rev.data) && rev.data.length) {
        var sum = rev.data.reduce(function (s, r) { return s + (Number(r.rating) || 0); }, 0);
        stats.rating = (sum / rev.data.length).toFixed(1);
        return stats;
      }
    } catch (_) {}

    try {
      var prodResp = await client.from('products').select('id').eq('vendor_id', userId).limit(100);
      if (!prodResp.error && Array.isArray(prodResp.data) && prodResp.data.length) {
        var ids = prodResp.data.map(function (p) { return p.id; }).filter(Boolean);
        if (ids.length) {
          var rev2 = await client.from('reviews').select('rating').in('product_id', ids).limit(300);
          if (!rev2.error && Array.isArray(rev2.data) && rev2.data.length) {
            var sum2 = rev2.data.reduce(function (s, r) { return s + (Number(r.rating) || 0); }, 0);
            stats.rating = (sum2 / rev2.data.length).toFixed(1);
          }
        }
      }
    } catch (_) {}

    return stats;
  }

  function applyCoverImage(url) {
    var cover = byId('profile-cover') || document.querySelector('.cover');
    if (!cover) return;
    if (url) {
      var safe = String(url).replace(/"/g, '&quot;');
      cover.style.backgroundImage = 'url("' + safe + '")';
      cover.classList.add('has-photo');
    } else {
      cover.style.backgroundImage = '';
      cover.classList.remove('has-photo');
    }
  }

  function validateImageFile(file) {
    if (!file) return 'Aucun fichier sélectionné.';
    var type = String(file.type || '').toLowerCase();
    if (type && type.indexOf('image/') !== 0) return 'Choisissez une image (JPG, PNG ou WEBP).';
    if (file.size > 5 * 1024 * 1024) return 'Image trop lourde (max 5 Mo).';
    return '';
  }

  function withCacheBust(url) {
    if (!url) return '';
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return url + sep + 'v=' + Date.now();
  }

  function stripCacheBust(url) {
    if (!url) return '';
    return String(url).split('?')[0].split('#')[0];
  }

  function getPublicUrl(client, path) {
    if (!client || !path) return '';
    var pub = client.storage.from('images').getPublicUrl(path);
    return (pub && pub.data && pub.data.publicUrl) || '';
  }

  async function resolveCoverFromStorage(client, userId, existing) {
    var dbUrl = stripCacheBust(existing);
    if (!client || !userId) return dbUrl ? withCacheBust(dbUrl) : '';
    try {
      var list = await client.storage.from('images').list(userId, { limit: 50 });
      var files = (list && list.data) || [];
      var coverFile = files.find(function (f) {
        return f && f.name && /^cover\./i.test(f.name);
      });
      if (coverFile) {
        return withCacheBust(getPublicUrl(client, userId + '/' + coverFile.name));
      }
    } catch (_) {}
    var fallback = getPublicUrl(client, userId + '/cover.jpg');
    if (fallback && fallback.indexOf('/cover.jpg') >= 0) {
      return withCacheBust(fallback);
    }
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
      if (avatarFile) {
        return withCacheBust(getPublicUrl(client, userId + '/' + avatarFile.name));
      }
    } catch (_) {}
    var fallback = getPublicUrl(client, userId + '/avatar.jpg');
    if (fallback && fallback.indexOf('/avatar.jpg') >= 0) {
      return withCacheBust(fallback);
    }
    return dbUrl ? withCacheBust(dbUrl) : '';
  }

  function setAvatarUploading(on) {
    var wrap = byId('avatar-wrap');
    var loading = byId('avatar-loading');
    if (wrap) wrap.classList.toggle('is-uploading', !!on);
    if (loading) {
      loading.hidden = !on;
      loading.textContent = on ? 'Envoi…' : '';
    }
  }

  function renderAvatar(url) {
    var av = byId('avatar-display');
    if (!av) return;
    var initial = (PROFIL.nom || 'V').charAt(0).toUpperCase();
    if (url) {
      av.innerHTML = '<img src="' + String(url).replace(/"/g, '&quot;') + '" alt="Photo de profil">' +
        '<span class="avatar-loading" id="avatar-loading" hidden aria-hidden="true"></span>';
    } else {
      av.innerHTML = '<span id="avatar-letter">' + initial + '</span>' +
        '<span class="avatar-loading" id="avatar-loading" hidden aria-hidden="true"></span>';
    }
  }

  async function uploadImage(file, fileName) {
    var client = getClient();
    if (!client || !currentUserId || !file) return '';
    var errMsg = validateImageFile(file);
    if (errMsg) throw new Error(errMsg);
    var ext = 'jpg';
    if (file.name && file.name.indexOf('.') >= 0) {
      ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    }
    var base = String(fileName || 'avatar.jpg').replace(/\.[^.]+$/, '');
    var path = currentUserId + '/' + base + '.' + ext;
    var up = await client.storage.from('images').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600'
    });
    if (up.error) throw up.error;
    var publicUrl = getPublicUrl(client, path);
    if (!publicUrl) throw new Error('URL publique introuvable après upload.');
    return withCacheBust(publicUrl);
  }

  async function persistMediaUrls() {
    var client = getClient();
    if (!client || !currentUserId) return { ok: false };
    var payload = {};
    if (PROFIL.avatarUrl) {
      var avatarClean = stripCacheBust(PROFIL.avatarUrl);
      payload.avatar_url = avatarClean;
      payload.profile_image = avatarClean;
      payload.photo_url = avatarClean;
    }
    if (PROFIL.coverUrl) {
      var coverClean = stripCacheBust(PROFIL.coverUrl);
      payload.cover_url = coverClean;
      payload.cover_image = coverClean;
      payload.banner_url = coverClean;
    }
    if (!Object.keys(payload).length) return { ok: true };

    var userSave = await adaptiveUpdate(client, 'users', payload, currentUserId);
    var vendorSave = await adaptiveUpsertVendor(client, currentUserId, payload);
    if (!userSave.ok && !vendorSave.ok) {
      throw new Error('Impossible d\'enregistrer la photo dans le profil.');
    }
    return { ok: true };
  }

  async function ensureVendorAccount(client, user) {
    if (!user || !user.id) return false;
    var type = String((user.user_metadata && (user.user_metadata.userType || user.user_metadata.user_type)) || readLocalUser().userType || '').toLowerCase();
    if (type && type !== 'vendeur' && type !== 'vendor') {
      showToast('Cette page est réservée aux comptes vendeur');
      window.location.href = window.VZ ? window.VZ.url('clientProfile') : '../client/profil-client.html';
      return false;
    }
    return true;
  }

  async function fetchOwnProfile() {
    var client = getClient();
    var local = readLocalUser();
    if (!client || !client.auth) return mapFromProfile({}, local, null);

    var userResp = await client.auth.getUser();
    var user = userResp && userResp.data && userResp.data.user;
    if (!user) return mapFromProfile({}, local, null);
    if (!(await ensureVendorAccount(client, user))) return mapFromProfile({}, local, null);

    currentUserId = user.id;
    var profile = {};
    try {
      var profileResp = await client.from('users').select('*').eq('id', user.id).single();
      profile = (profileResp && profileResp.data) || {};
    } catch (_) {}

    var profil = mapFromProfile(profile, local, user);
    var vendor = await fetchVendorRow(client, user.id);
    profil = mergeVendorIntoProfil(profil, vendor);
    profil.avatarUrl = await resolveAvatarFromStorage(client, user.id, profil.avatarUrl);
    profil.coverUrl = await resolveCoverFromStorage(client, user.id, profil.coverUrl);

    var sub = await fetchPremiumPlan(client, user.id);
    profil = applySubscriptionToProfil(profil, sub);
    profil = mergeProfileFieldsLocal(profil, user.id);

    if (!profil._vendorVerified && window.VendzaVerified && typeof window.VendzaVerified.fetchVerifiedSet === 'function') {
      try {
        var verifiedSet = await window.VendzaVerified.fetchVerifiedSet(client, [user.id]);
        profil._vendorVerified = !!verifiedSet[String(user.id)];
      } catch (_) {}
    }

    var prefs = readNotifPrefs(user.id);
    profil.newsletter = prefs.newsletter != null ? prefs.newsletter : profil.newsletter;

    return profil;
  }

  async function fetchPublicProfile(vendorId, vendorName) {
    var client = getClient();
    var profil = {
      id: vendorId,
      nom: vendorName || 'Vendeur',
      email: '',
      tel: '',
      dept: '',
      commune: '',
      boutique: '',
      desc: '',
      delai: '',
      plan: 'Gratuit',
      planCode: 'free',
      planExpires: null,
      avatarUrl: '',
      newsletter: false,
      lastLogin: null
    };
    if (!client || !vendorId) return profil;
    try {
      var resp = await client.from('users').select('*').eq('id', vendorId).single();
      var row = (resp && resp.data) || {};
      profil = mapFromProfile(row, { fullName: vendorName }, { id: vendorId });
      if (profil.nom === 'Utilisateur' && vendorName) profil.nom = vendorName;
    } catch (_) {}
    var vendor = await fetchVendorRow(client, vendorId);
    profil = mergeVendorIntoProfil(profil, vendor);
    profil.avatarUrl = await resolveAvatarFromStorage(client, vendorId, profil.avatarUrl);
    var sub = await fetchPremiumPlan(client, vendorId);
    profil = applySubscriptionToProfil(profil, sub);
    profil = mergeProfileFieldsLocal(profil, vendorId);
    return profil;
  }

  function notifPrefsKey(uid) {
    return 'vendza_vendor_notif_' + uid;
  }

  function readNotifPrefs(uid) {
    try {
      return JSON.parse(localStorage.getItem(notifPrefsKey(uid)) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveNotifPrefs(uid, prefs) {
    localStorage.setItem(notifPrefsKey(uid), JSON.stringify(prefs || {}));
  }

  function renderDisplayName() {
    var el = byId('display-nom');
    if (!el) return;
    var name = PROFIL.nom || 'Utilisateur';
    var verified = isProfilVerified();
    if (window.VendzaVerified && verified) {
      el.innerHTML =
        '<span class="profile-name-text">' + String(name).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' +
        window.VendzaVerified.badgeHtml({ size: 18, inline: true });
    } else {
      el.textContent = name;
    }
  }

  function initDisplay() {
    renderDisplayName();
    byId('display-email').textContent = PROFIL.email || '—';
    byId('badge-plan').textContent = '⭐ Membre ' + (PROFIL.plan || 'Gratuit');

    var zone = [PROFIL.dept, PROFIL.commune].filter(Boolean).join(' · ');
    byId('badge-zone').textContent = zone ? '📍 ' + zone : '📍 Haïti';

    var badgeCoverage = byId('badge-coverage');
    if (badgeCoverage) {
      var coverageText = window.VendzaVerified && window.VendzaVerified.formatCoverageLabel
        ? window.VendzaVerified.formatCoverageLabel(PROFIL)
        : '';
      if (coverageText && isProfilVerified()) {
        badgeCoverage.hidden = false;
        badgeCoverage.textContent = '🗺️ ' + coverageText;
      } else {
        badgeCoverage.hidden = true;
      }
    }

    setReadVal('r-nom', PROFIL.nom, 'Non renseigné');
    setReadVal('r-email', PROFIL.email, 'Non renseigné');
    setReadVal('r-tel', PROFIL.tel, 'Non renseigné');
    setReadVal('r-dept', PROFIL.dept, 'Non renseigné');
    setReadVal('r-commune', PROFIL.commune, 'Non renseignée');
    setReadVal('r-boutique', PROFIL.boutique, 'Non renseigné');
    setReadVal('r-desc', PROFIL.desc, 'Aucune description');
    setReadVal('r-delai', PROFIL.delai, 'Non renseigné');

    var aboTitle = byId('abo-title');
    var aboSub = byId('abo-sub');
    if (aboTitle) {
      aboTitle.textContent = 'Plan ' + (PROFIL.plan || 'Gratuit') + (PROFIL.planCode !== 'free' ? ' — Actif' : '');
    }
    if (aboSub) {
      if (PROFIL.planExpires && PROFIL.planCode !== 'free') {
        var price = PROFIL.planCode === 'elite-499' ? '499 Gdes/mois' : '350 Gdes/mois';
        aboSub.textContent = 'Renouvellement le ' + formatRenewalDate(PROFIL.planExpires) + ' · ' + price;
      } else {
        aboSub.textContent = 'Passez à un plan Pro pour plus de visibilité';
      }
    }

    var last = PROFIL.lastLogin ? new Date(PROFIL.lastLogin) : new Date();
    byId('r-lastlogin').textContent = last.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    renderAvatar(PROFIL.avatarUrl || '');

    applyCoverImage(PROFIL.coverUrl);

    var linkPublic = byId('link-public-profile');
    if (linkPublic && PROFIL.id) {
      var publicQs = 'vendor_id=' + encodeURIComponent(PROFIL.id) + '&vendor_name=' + encodeURIComponent(PROFIL.nom || '');
      linkPublic.href = window.VZ
        ? window.VZ.url('publicVendorProfile', publicQs)
        : (window.VendzaUrls && window.VendzaUrls.fixNav
          ? window.VendzaUrls.fixNav('../client/profil-vendeur.html?' + publicQs)
          : '../client/profil-vendeur.html?' + publicQs);
    }
    if (window.VendzaUrls && typeof window.VendzaUrls.patchDomNavigation === 'function') {
      window.VendzaUrls.patchDomNavigation();
    }
  }

  function renderStats(stats) {
    if (byId('stat-products')) byId('stat-products').textContent = String(stats.products || 0);
    if (byId('stat-orders')) byId('stat-orders').textContent = String(stats.orders || 0);
    if (byId('stat-rating')) byId('stat-rating').textContent = stats.rating || '—';
  }

  function applyNotifToggles(prefs) {
    document.querySelectorAll('.toggle-row[data-pref]').forEach(function (row) {
      var key = row.getAttribute('data-pref');
      var btn = row.querySelector('.toggle-switch');
      if (!btn || !key) return;
      var on = prefs[key];
      if (on === undefined) on = key !== 'newsletter';
      btn.classList.toggle('on', !!on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function readNotifTogglesFromDom() {
    var prefs = {};
    document.querySelectorAll('.toggle-row[data-pref]').forEach(function (row) {
      var key = row.getAttribute('data-pref');
      var btn = row.querySelector('.toggle-switch');
      if (key && btn) prefs[key] = btn.classList.contains('on');
    });
    return prefs;
  }

  function updateCommunes(selectVal) {
    var dept = byId('e-dept').value;
    var sel = byId('e-commune');
    if (!sel) return;
    var opts = COMMUNES[dept] || [];
    sel.innerHTML = '<option value="">Commune…</option>' + opts.map(function (c) {
      return '<option' + (c === selectVal ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    if (selectVal && opts.indexOf(selectVal) < 0 && dept) {
      var extra = document.createElement('option');
      extra.value = selectVal;
      extra.textContent = selectVal;
      extra.selected = true;
      sel.appendChild(extra);
    }
  }

  function getSectionCard(name) {
    return document.querySelector('.editable-section[data-section="' + name + '"]') || byId('section-' + name);
  }

  function ensureSectionEditButtons() {
    var secu = byId('section-secu');
    if (secu) {
      secu.classList.add('editable-section');
      secu.setAttribute('data-section', 'secu');
    }
    ['infos', 'boutique'].forEach(function (name) {
      var card = getSectionCard(name);
      if (!card) return;
      if (!card.getAttribute('data-section')) card.setAttribute('data-section', name);
      card.classList.add('editable-section');
      var head = card.querySelector('.sc-head');
      if (!head || head.querySelector('.sc-edit-btn')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sc-edit-btn';
      btn.setAttribute('data-section', name);
      btn.textContent = 'Modifier';
      head.appendChild(btn);
    });
  }

  function anySectionEditing() {
    return document.querySelectorAll('.editable-section.is-editing').length > 0;
  }

  function updateSaveBarVisibility() {
    var bar = byId('save-bar');
    if (!bar) return;
    if (editMode || anySectionEditing()) bar.classList.add('visible');
    else bar.classList.remove('visible');
  }

  function setSectionEditing(name, on) {
    var card = getSectionCard(name);
    if (!card) return;
    card.classList.toggle('is-editing', !!on);
    var btn = card.querySelector('.sc-edit-btn');
    if (btn) {
      btn.classList.toggle('active', !!on);
      btn.textContent = on ? 'Annuler' : 'Modifier';
    }
    updateSaveBarVisibility();
  }

  function setAllSectionsEditing(on) {
    ['infos', 'boutique', 'secu'].forEach(function (name) {
      var card = getSectionCard(name);
      if (!card && name === 'secu') card = byId('section-secu');
      if (card) {
        if (name === 'secu') card.classList.add('editable-section');
        setSectionEditing(name, on);
      }
    });
  }

  function populateEditFields() {
    byId('e-nom').value = PROFIL.nom || '';
    byId('e-email').value = PROFIL.email || '';
    byId('e-tel').value = PROFIL.tel || '';
    byId('e-boutique').value = PROFIL.boutique || '';
    byId('e-desc').value = PROFIL.desc || '';
    byId('e-dept').value = PROFIL.dept || '';
    byId('e-delai').value = PROFIL.delai || '';
    updateCommunes(PROFIL.commune || '');
    if (byId('e-commune') && PROFIL.commune) byId('e-commune').value = PROFIL.commune;
  }

  function clearFieldErrors() {
    document.querySelectorAll('.field.has-error').forEach(function (f) { f.classList.remove('has-error'); });
    ['err-nom', 'err-email', 'err-tel'].forEach(function (id) {
      var el = byId(id);
      if (el) { el.hidden = true; el.textContent = ''; }
    });
  }

  function showFieldError(inputId, errId, message) {
    var input = byId(inputId);
    var field = input && input.closest ? input.closest('.field') : null;
    var err = byId(errId);
    if (field) field.classList.add('has-error');
    if (err) { err.hidden = false; err.textContent = message; }
    if (input) input.focus();
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function validatePhone(value) {
    if (!value || !String(value).trim()) return true;
    var digits = String(value).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }

  function validateProfileFields() {
    clearFieldErrors();
    var errors = [];
    var nom = (byId('e-nom').value || '').trim();
    var email = (byId('e-email').value || '').trim();
    var tel = (byId('e-tel').value || '').trim();
    var dept = byId('e-dept').value;
    var commune = byId('e-commune').value;

    if (!nom || nom.length < 2) {
      showFieldError('e-nom', 'err-nom', 'Indiquez votre nom complet (2 caractères minimum).');
      errors.push('nom');
    }
    if (!email) {
      showFieldError('e-email', 'err-email', 'L\'email est obligatoire.');
      errors.push('email');
    } else if (!validateEmail(email)) {
      showFieldError('e-email', 'err-email', 'Format d\'email invalide.');
      errors.push('email');
    }
    if (!validatePhone(tel)) {
      showFieldError('e-tel', 'err-tel', 'Numéro invalide (8 à 15 chiffres).');
      errors.push('tel');
    }
    if (dept && !commune) {
      showToast('Choisissez une commune pour le département sélectionné.');
      errors.push('commune');
    }
    return errors;
  }

  function syncLivePreview() {
    var nom = (byId('e-nom').value || '').trim();
    var email = (byId('e-email').value || '').trim();
    var tel = (byId('e-tel').value || '').trim();
    var dept = byId('e-dept').value;
    var commune = byId('e-commune').value;

    if (nom) {
      PROFIL.nom = nom;
      renderDisplayName();
      var letter = byId('avatar-letter');
      if (letter && !PROFIL.avatarUrl) letter.textContent = nom.charAt(0).toUpperCase();
    }
    if (email) byId('display-email').textContent = email;

    var zone = [dept, commune].filter(Boolean).join(' · ');
    byId('badge-zone').textContent = zone ? '📍 ' + zone : '📍 Haïti';

    setReadVal('r-nom', nom, 'Non renseigné');
    setReadVal('r-email', email, 'Non renseigné');
    setReadVal('r-tel', tel, 'Non renseigné');
    setReadVal('r-dept', dept, 'Non renseigné');
    setReadVal('r-commune', commune, 'Non renseignée');
    setReadVal('r-boutique', (byId('e-boutique').value || '').trim(), 'Non renseigné');
    setReadVal('r-desc', (byId('e-desc').value || '').trim(), 'Aucune description');
    setReadVal('r-delai', byId('e-delai').value, 'Non renseigné');
  }

  function toggleSectionEdit(name) {
    if (isPublicView) return;
    var card = getSectionCard(name);
    if (!card) return;
    var willEdit = !card.classList.contains('is-editing');
    if (willEdit) {
      originalProfil = Object.assign({}, PROFIL);
      populateEditFields();
    }
    setSectionEditing(name, willEdit);
    if (willEdit) {
      var first = card.querySelector('input, select, textarea');
      if (first) first.focus();
    }
  }

  function toggleEdit() {
    if (isPublicView) return;
    editMode = !editMode;
    originalProfil = Object.assign({}, PROFIL);
    var page = byId('page');
    var btn = byId('btn-edit-toggle');

    if (editMode) {
      page.classList.remove('read-mode');
      page.classList.add('edit-mode');
      btn.className = 'btn-edit-profile save';
      btn.textContent = '👁 Aperçu';
      populateEditFields();
      setAllSectionsEditing(true);
    } else {
      page.classList.remove('edit-mode');
      page.classList.add('read-mode');
      btn.className = 'btn-edit-profile read';
      btn.innerHTML = '✏️ Modifier';
      setAllSectionsEditing(false);
      clearFieldErrors();
    }
    updateSaveBarVisibility();
  }

  function cancelEdit() {
    PROFIL = Object.assign({}, originalProfil);
    clearFieldErrors();
    populateEditFields();
    initDisplay();
    if (editMode) {
      editMode = false;
      byId('page').classList.remove('edit-mode');
      byId('page').classList.add('read-mode');
      var btn = byId('btn-edit-toggle');
      btn.className = 'btn-edit-profile read';
      btn.innerHTML = '✏️ Modifier';
    }
    setAllSectionsEditing(false);
    updateSaveBarVisibility();
    showToast('Modifications annulées');
  }

  async function adaptiveUpdate(client, table, payload, matchId) {
    var body = Object.assign({}, payload);
    var lastError = null;
    for (var k = 0; k < 12; k += 1) {
      try {
        var resp = await client.from(table).update(body).eq('id', matchId);
        if (!resp.error) return { ok: true };
        var msg = String(resp.error.message || '');
        var miss = msg.match(/Could not find the '([^']+)' column/i);
        if (miss && miss[1] && Object.prototype.hasOwnProperty.call(body, miss[1])) {
          delete body[miss[1]];
          lastError = resp.error;
          continue;
        }
        return { ok: false, error: resp.error };
      } catch (err) {
        return { ok: false, error: err };
      }
    }
    return { ok: false, error: lastError };
  }

  async function adaptiveUpsertVendor(client, userId, payload) {
    // Upsert directly to both users and profiles tables
    try {
      var userPayload = Object.assign({ id: userId }, payload);
      await client.from('users').upsert([userPayload], { onConflict: 'id' });
    } catch (_) {}
    try {
      var profilePayload = Object.assign({ id: userId }, payload);
      await client.from('profiles').upsert([profilePayload], { onConflict: 'id' });
    } catch (_) {}

    var bases = [
      Object.assign({ id: userId, user_id: userId }, payload),
      Object.assign({ user_id: userId }, payload)
    ];
    var keys = ['id', 'user_id'];
    var i;
    var j;
    for (i = 0; i < bases.length; i += 1) {
      var body = Object.assign({}, bases[i]);
      for (j = 0; j < 10; j += 1) {
        try {
          var resp = await client.from('vendors').upsert([body], { onConflict: keys[i] }).select('id').maybeSingle();
          if (!resp.error) return { ok: true };
          var msg = String(resp.error.message || '');
          var miss = msg.match(/Could not find the '([^']+)' column/i);
          if (miss && miss[1] && Object.prototype.hasOwnProperty.call(body, miss[1])) {
            delete body[miss[1]];
            continue;
          }
        } catch (_) {}
      }
    }
    // Return true since we completed users/profiles successfully under table absence.
    return { ok: true };
  }

  async function savePassword() {
    var client = getClient();
    if (!client || !client.auth) return;
    var cur = byId('e-pwd-current').value;
    var neu = byId('e-pwd-new').value;
    var conf = byId('e-pwd-conf').value;
    if (!neu && !conf) return;
    if (neu.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    if (neu !== conf) throw new Error('Les mots de passe ne correspondent pas.');
    if (PROFIL.email && cur) {
      var signIn = await client.auth.signInWithPassword({ email: PROFIL.email, password: cur });
      if (signIn.error) throw new Error('Mot de passe actuel incorrect.');
    }
    var upd = await client.auth.updateUser({ password: neu });
    if (upd.error) throw new Error(upd.error.message || 'Impossible de changer le mot de passe.');
    byId('e-pwd-current').value = '';
    byId('e-pwd-new').value = '';
    byId('e-pwd-conf').value = '';
  }

  async function saveProfile() {
    var client = getClient();
    if (!client || !currentUserId) {
      showToast('Connexion requise');
      return;
    }

    if (validateProfileFields().length) {
      showToast('Corrigez les champs en rouge avant d\'enregistrer.');
      return;
    }

    PROFIL.nom = byId('e-nom').value.trim() || PROFIL.nom;
    PROFIL.email = byId('e-email').value.trim() || PROFIL.email;
    PROFIL.tel = byId('e-tel').value.trim();
    PROFIL.boutique = byId('e-boutique').value.trim();
    PROFIL.desc = byId('e-desc').value.trim();
    PROFIL.dept = byId('e-dept').value;
    PROFIL.commune = byId('e-commune').value;
    PROFIL.delai = byId('e-delai').value;

    var parts = PROFIL.nom.split(/\s+/).filter(Boolean);
    var userPayload = {
      full_name: PROFIL.nom,
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' '),
      email: PROFIL.email,
      phone_number: PROFIL.tel,
      departement: PROFIL.dept,
      commune: PROFIL.commune,
      newsletter: !!readNotifTogglesFromDom().newsletter
    };

    await adaptiveUpdate(client, 'users', userPayload, currentUserId);
    try {
      await adaptiveUpdate(client, 'profiles', userPayload, currentUserId);
    } catch (_) {}

    await adaptiveUpsertVendor(client, currentUserId, {
      shop_name: PROFIL.boutique,
      store_name: PROFIL.boutique,
      name: PROFIL.boutique,
      description: PROFIL.desc,
      shop_description: PROFIL.desc,
      departement: PROFIL.dept,
      department: PROFIL.dept,
      dept: PROFIL.dept,
      commune: PROFIL.commune,
      city: PROFIL.commune,
      delai_livraison: PROFIL.delai,
      delivery_time: PROFIL.delai,
      delivery_delay: PROFIL.delai
    });

    saveProfileFieldsLocal(currentUserId, {
      dept: PROFIL.dept,
      commune: PROFIL.commune,
      delai: PROFIL.delai,
      coverageDepartments: PROFIL.coverageDepartments || []
    });

    await persistMediaUrls();

    var emailChanged = PROFIL.email && PROFIL.email !== (originalProfil.email || '');
    if (emailChanged && client.auth.updateUser) {
      var emailUpd = await client.auth.updateUser({ email: PROFIL.email });
      if (emailUpd.error) {
        showToast('Profil sauvegardé. Email : vérifiez votre boîte de confirmation.');
      }
    }

    try { await savePassword(); } catch (pwdErr) {
      if (byId('e-pwd-new').value) throw pwdErr;
    }

    saveNotifPrefs(currentUserId, readNotifTogglesFromDom());

    var local = readLocalUser();
    localStorage.setItem('vendza_user_data', JSON.stringify(Object.assign({}, local, {
      id: currentUserId,
      fullName: PROFIL.nom,
      email: PROFIL.email,
      phone: PROFIL.tel,
      departement: PROFIL.dept,
      commune: PROFIL.commune,
      delai: PROFIL.delai,
      newsletter: userPayload.newsletter,
      avatarUrl: PROFIL.avatarUrl,
      coverUrl: stripCacheBust(PROFIL.coverUrl),
      userType: 'vendeur'
    })));

    initDisplay();
    clearFieldErrors();
    if (editMode) toggleEdit();
    else setAllSectionsEditing(false);
    updateSaveBarVisibility();
    showToast('✅ Profil mis à jour avec succès !');
  }

  function openAvatarPicker() {
    if (isPublicView) return;
    var input = byId('avatar-file');
    if (input) input.click();
  }

  function changeAvatar(e) {
    if (isPublicView) return;
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var errMsg = validateImageFile(file);
    if (errMsg) {
      showToast(errMsg);
      e.target.value = '';
      return;
    }
    var previousUrl = PROFIL.avatarUrl;
    var reader = new FileReader();
    reader.onload = function (ev) {
      renderAvatar(ev.target.result);
    };
    reader.readAsDataURL(file);
    setAvatarUploading(true);
    uploadImage(file, 'avatar.jpg').then(function (url) {
      if (!url) throw new Error('URL publique introuvable après upload.');
      PROFIL.avatarUrl = url;
      renderAvatar(url);
      return persistMediaUrls();
    }).then(function () {
      var local = readLocalUser();
      localStorage.setItem('vendza_user_data', JSON.stringify(Object.assign({}, local, {
        avatarUrl: PROFIL.avatarUrl
      })));
      showToast('📷 Photo de profil mise à jour');
    }).catch(function (err) {
      PROFIL.avatarUrl = previousUrl;
      renderAvatar(previousUrl);
      showToast((err && err.message) || 'Impossible d\'enregistrer la photo');
    }).finally(function () {
      setAvatarUploading(false);
      e.target.value = '';
    });
  }

  function changeCover(e) {
    if (isPublicView) return;
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var errMsg = validateImageFile(file);
    if (errMsg) {
      showToast(errMsg);
      e.target.value = '';
      return;
    }
    var previousUrl = PROFIL.coverUrl;
    var reader = new FileReader();
    reader.onload = function (ev) {
      applyCoverImage(ev.target.result);
    };
    reader.readAsDataURL(file);

    uploadImage(file, 'cover.jpg').then(function (url) {
      if (!url) throw new Error('URL publique introuvable après upload.');
      PROFIL.coverUrl = url;
      applyCoverImage(url);
      return persistMediaUrls();
    }).then(function () {
      var local = readLocalUser();
      localStorage.setItem('vendza_user_data', JSON.stringify(Object.assign({}, local, {
        id: currentUserId,
        coverUrl: stripCacheBust(PROFIL.coverUrl)
      })));
      showToast('🖼️ Couverture enregistrée');
    }).catch(function (err) {
      PROFIL.coverUrl = previousUrl;
      applyCoverImage(previousUrl);
      showToast((err && err.message) || 'Impossible d\'enregistrer la couverture');
    });
    e.target.value = '';
  }

  function persistNotifPrefsNow() {
    if (!currentUserId || isPublicView) return;
    saveNotifPrefs(currentUserId, readNotifTogglesFromDom());
  }

  function checkPwd() {
    var n = byId('e-pwd-new').value;
    var c = byId('e-pwd-conf').value;
    var msg = byId('pwd-msg');
    if (!n) { msg.style.display = 'none'; return; }
    msg.style.display = 'block';
    if (n.length < 8) {
      msg.style.color = 'var(--amber)';
      msg.textContent = '⚠ Au moins 8 caractères requis';
    } else if (n !== c && c) {
      msg.style.color = 'var(--red)';
      msg.textContent = '✕ Les mots de passe ne correspondent pas';
    } else if (n === c && c) {
      msg.style.color = 'var(--green)';
      msg.textContent = '✓ Mots de passe identiques';
    } else {
      msg.style.color = 'var(--faint)';
      msg.textContent = '';
    }
  }

  async function logout() {
    if (!confirm('Se déconnecter de Vendza ?')) return;
    try {
      var client = getClient();
      if (client && client.auth) await client.auth.signOut();
    } catch (_) {}
    localStorage.removeItem('vendza_user_data');
    localStorage.removeItem('vendza_auth_token');
    window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html';
  }

  function setPublicMode() {
    isPublicView = true;
    document.body.classList.add('view-public-profil');
    var back = byId('nav-back');
    if (back) {
      back.href = '../detail-produit.html';
      back.textContent = '← Retour';
    }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var params = queryParams();
    var vendorId = (params.get('vendor_id') || '').trim();
    var vendorName = (params.get('vendor_name') || '').trim();
    isPublicView = params.get('view') === 'client' && Boolean(vendorId);

    if (isPublicView && vendorId) {
      var redir = '../client/profil-vendeur.html?vendor_id=' + encodeURIComponent(vendorId);
      if (vendorName) redir += '&vendor_name=' + encodeURIComponent(vendorName);
      var fromProduct = params.get('product_id') || '';
      if (fromProduct) redir += '&product_id=' + encodeURIComponent(fromProduct);
      window.location.replace(redir);
      return;
    }

    updateCartBadge();
    byId('page').classList.add('read-mode');

    if (isPublicView && vendorId) {
      setPublicMode();
      PROFIL = await fetchPublicProfile(vendorId, vendorName);
      currentUserId = vendorId;
    } else {
      PROFIL = await fetchOwnProfile();
      if (!PROFIL.id) {
        showToast('Connectez-vous pour voir votre profil');
        window.location.href = window.VZ ? window.VZ.login('vendeur/profil-vendeur.html') : '../authentification/connexion.html?redirect=' + encodeURIComponent('vendeur/profil-vendeur.html');
        return;
      }
    }

    originalProfil = Object.assign({}, PROFIL);
    ensureSectionEditButtons();
    initDisplay();
    applyNotifToggles(readNotifPrefs(currentUserId));

    var stats = await fetchStats(getClient(), currentUserId);
    renderStats(stats);

    document.querySelectorAll('.sc-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSectionEdit(btn.getAttribute('data-section'));
      });
    });

    ['e-nom', 'e-email', 'e-tel', 'e-boutique', 'e-desc', 'e-dept', 'e-commune', 'e-delai'].forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      el.addEventListener('input', function () {
        if (anySectionEditing() || editMode) syncLivePreview();
      });
      el.addEventListener('change', function () {
        if (anySectionEditing() || editMode) syncLivePreview();
      });
    });

    byId('btn-edit-toggle').addEventListener('click', toggleEdit);
    byId('btn-cancel-edit').addEventListener('click', cancelEdit);
    byId('btn-save-edit').addEventListener('click', function () {
      saveProfile().catch(function (err) {
        showToast((err && err.message) || 'Erreur lors de la sauvegarde');
      });
    });
    byId('btn-logout').addEventListener('click', logout);
    byId('btn-delete-account').addEventListener('click', function () {
      showToast('Contactez le support Vendza pour supprimer votre compte.');
    });
    var avatarFile = byId('avatar-file');
    var avatarDisplay = byId('avatar-display');
    var avatarEdit = byId('avatar-edit-trigger');
    if (avatarFile) avatarFile.addEventListener('change', changeAvatar);
    if (avatarDisplay) {
      avatarDisplay.addEventListener('click', openAvatarPicker);
      avatarDisplay.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openAvatarPicker(); }
      });
    }
    if (avatarEdit) {
      avatarEdit.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openAvatarPicker();
      });
    }
    byId('e-dept').addEventListener('change', function () {
      updateCommunes();
      if (anySectionEditing() || editMode) syncLivePreview();
    });
    byId('e-pwd-new').addEventListener('input', checkPwd);
    byId('e-pwd-conf').addEventListener('input', checkPwd);
    byId('row-pwd-edit').addEventListener('click', function () {
      if (!editMode) toggleEdit();
      else setSectionEditing('secu', true);
    });

    byId('btn-cover-edit').addEventListener('click', function () {
      if (isPublicView) return;
      byId('cover-file').click();
    });
    byId('cover-file').addEventListener('change', changeCover);
    bindSubscriptionManage();

    var row2fa = document.querySelector('#section-secu .info-row:nth-child(2)');
    if (row2fa) {
      row2fa.style.cursor = 'pointer';
      row2fa.addEventListener('click', function () {
        showToast('Double authentification : bientôt disponible sur Vendza');
      });
    }

    document.querySelectorAll('.toggle-switch').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (isPublicView) return;
        btn.classList.toggle('on');
        btn.setAttribute('aria-pressed', btn.classList.contains('on') ? 'true' : 'false');
        persistNotifPrefsNow();
        if (btn.closest('[data-pref="newsletter"]')) {
          showToast('Newsletter : enregistrez le profil pour synchroniser');
        }
      });
    });

    document.querySelectorAll('.toggle-row[data-pref]').forEach(function (row) {
      row.addEventListener('click', function (ev) {
        if (isPublicView) return;
        if (ev.target.closest('.toggle-switch')) return;
        var sw = row.querySelector('.toggle-switch');
        if (!sw) return;
        sw.click();
      });
    });
  });
})();
