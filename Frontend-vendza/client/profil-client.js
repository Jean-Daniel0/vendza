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
  var currentUserId = '';

  function byId(id) { return document.getElementById(id); }

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function notify(message) {
    var toast = byId('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notify._t);
    notify._t = setTimeout(function () { toast.classList.remove('show'); }, 2800);
  }

  function readUser() {
    try { return JSON.parse(localStorage.getItem('vendza_user_data') || '{}') || {}; }
    catch (e) { return {}; }
  }

  function notifKey(uid) { return 'vendza_client_notif_' + uid; }

  function loadNotifPrefs(uid) {
    try {
      var raw = localStorage.getItem(notifKey(uid));
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function saveNotifPrefs(uid, prefs) {
    if (!uid) return;
    localStorage.setItem(notifKey(uid), JSON.stringify(prefs));
  }

  function readNotifTogglesFromDom() {
    var prefs = {};
    document.querySelectorAll('[data-notif-btn]').forEach(function (btn) {
      var key = btn.getAttribute('data-notif-btn');
      if (key) prefs[key] = btn.classList.contains('on');
    });
    return prefs;
  }

  function applyNotifPrefs(prefs) {
    if (!prefs) return;
    document.querySelectorAll('[data-notif-btn]').forEach(function (btn) {
      var key = btn.getAttribute('data-notif-btn');
      if (key && typeof prefs[key] === 'boolean') {
        btn.classList.toggle('on', prefs[key]);
      }
    });
  }

  function bindNotifToggles(uid) {
    document.querySelectorAll('[data-notif-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.classList.toggle('on');
        saveNotifPrefs(uid, readNotifTogglesFromDom());
      });
    });
  }

  function updateCommunes(selectVal) {
    var dept = byId('departement') && byId('departement').value;
    var sel = byId('commune');
    if (!sel) return;
    var opts = COMMUNES[dept] || [];
    sel.innerHTML = '<option value="">Choisir…</option>' +
      opts.map(function (c) {
        return '<option' + (c === selectVal ? ' selected' : '') + '>' + c + '</option>';
      }).join('');
  }

  function setReadVal(id, val, placeholder) {
    var el = byId(id);
    if (!el) return;
    el.innerHTML = val
      ? String(val)
      : '<span class="empty-val">' + placeholder + '</span>';
  }

  function fullName(data) {
    var first = (data.firstName || '').trim();
    var last = (data.lastName || '').trim();
    return [first, last].filter(Boolean).join(' ').trim() || data.fullName || 'Utilisateur';
  }

  function initDisplay() {
    var name = fullName(PROFIL);
    var letter = (name.charAt(0) || 'U').toUpperCase();
    var av = byId('avatar-display');
    var avLetter = byId('avatar-letter');

    if (PROFIL.avatarUrl && av) {
      av.innerHTML = '<img src="' + PROFIL.avatarUrl + '" alt="">';
    } else if (avLetter) {
      avLetter.textContent = letter;
    }

    if (byId('profileName')) byId('profileName').textContent = name;
    if (byId('profileEmail')) byId('profileEmail').textContent = PROFIL.email || '';
    if (byId('firstName')) byId('firstName').value = PROFIL.firstName || '';
    if (byId('lastName')) byId('lastName').value = PROFIL.lastName || '';
    if (byId('email')) byId('email').value = PROFIL.email || '';
    if (byId('phone')) byId('phone').value = PROFIL.phone || '';
    if (byId('departement')) byId('departement').value = PROFIL.departement || '';
    updateCommunes(PROFIL.commune || '');
    if (byId('userType')) byId('userType').value = PROFIL.userType || 'client';

    var zone = [PROFIL.departement, PROFIL.commune].filter(Boolean).join(' · ');
    if (byId('badge-zone')) byId('badge-zone').textContent = zone ? '📍 ' + zone : '📍 Haïti';

    setReadVal('r-nom', name, 'Non renseigné');
    setReadVal('r-email', PROFIL.email, 'Non renseigné');
    setReadVal('r-tel', PROFIL.phone, 'Non renseigné');
    setReadVal('r-dept', PROFIL.departement, 'Non renseigné');
    setReadVal('r-commune', PROFIL.commune, 'Non renseignée');

    if (byId('r-lastlogin')) {
      byId('r-lastlogin').textContent = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
    }

    var cart = 0;
    try {
      var raw = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
      if (Array.isArray(raw)) {
        cart = raw.reduce(function (s, i) { return s + (Number(i && i.quantity) || 1); }, 0);
      }
    } catch (_) {}
    if (byId('stat-panier')) byId('stat-panier').textContent = String(cart);
    if (byId('cart-count')) byId('cart-count').textContent = String(cart);
    if (byId('stat-commandes')) byId('stat-commandes').textContent = String(PROFIL.commandes || 0);
    if (byId('stat-livrees')) byId('stat-livrees').textContent = String(PROFIL.livrees || 0);
  }

  function toggleEdit() {
    editMode = !editMode;
    var page = byId('page');
    var btn = byId('btn-edit-toggle');
    var bar = byId('save-bar');
    if (!page) return;

    if (editMode) {
      originalProfil = Object.assign({}, PROFIL);
      page.classList.remove('read-mode');
      page.classList.add('edit-mode');
      document.body.classList.add('edit-mode');
      document.body.classList.remove('read-mode');
      if (btn) { btn.className = 'btn-edit-toggle btn-save'; btn.textContent = '👁 Aperçu'; }
      if (bar) bar.classList.add('visible');
    } else {
      page.classList.remove('edit-mode');
      page.classList.add('read-mode');
      document.body.classList.remove('edit-mode');
      document.body.classList.add('read-mode');
      if (btn) { btn.className = 'btn-edit-toggle btn-read'; btn.innerHTML = '✏️ Modifier'; }
      if (bar) bar.classList.remove('visible');
    }
  }

  function cancelEdit() {
    PROFIL = Object.assign({}, originalProfil);
    initDisplay();
    if (editMode) toggleEdit();
    notify('Modifications annulées');
  }

  async function readSupabaseUserData() {
    var client = getClient();
    if (!client || !client.auth || !client.from) return {};
    try {
      var userResp = await client.auth.getUser();
      var user = userResp && userResp.data && userResp.data.user;
      if (!user) return {};
      var profileResp = await client.from('users').select('*').eq('id', user.id).maybeSingle();
      var profile = (profileResp && profileResp.data) || {};
      return {
        id: user.id,
        email: user.email || profile.email || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        fullName: profile.full_name || '',
        phone: profile.phone_number || '',
        userType: profile.user_type || 'client',
        departement: profile.departement || '',
        commune: profile.commune || ''
      };
    } catch (e) {
      return {};
    }
  }

  async function fetchOrderStats(uid) {
    var client = getClient();
    if (!client || !client.from || !uid) return { total: 0, livrees: 0 };
    var filter = 'buyer_id.eq.' + uid + ',client_id.eq.' + uid + ',user_id.eq.' + uid + ',customer_id.eq.' + uid;
    try {
      var resp = await client.from('orders').select('status').or(filter);
      if (resp.error || !Array.isArray(resp.data)) return { total: 0, livrees: 0 };
      var livrees = resp.data.filter(function (o) {
        var s = String(o.status || '').toLowerCase();
        return s === 'delivered' || s === 'livree' || s === 'livrée' || s === 'completed';
      }).length;
      return { total: resp.data.length, livrees: livrees };
    } catch (_) {
      return { total: 0, livrees: 0 };
    }
  }

  async function fetchPremiumPlan(userId) {
    var client = getClient();
    if (!client || !client.from || !userId) return null;
    try {
      var resp = await client.from('vendor_subscriptions').select('plan_code,status').eq('user_id', userId).maybeSingle();
      if (resp && !resp.error && resp.data && resp.data.plan_code && resp.data.plan_code !== 'free' && resp.data.status === 'active') {
        return resp.data.plan_code;
      }
    } catch (_) {}
    return null;
  }

  function renderPremiumBadge(planCode) {
    var badge = byId('premiumBadge');
    if (!badge) return;
    if (!planCode) {
      badge.style.display = 'none';
      return;
    }
    badge.style.display = 'inline-flex';
    badge.classList.remove('premium-pro', 'premium-elite');
    if (planCode === 'elite-499') {
      badge.textContent = '⭐ Membre Elite';
      badge.classList.add('premium-elite');
    } else {
      badge.textContent = '⭐ Membre Pro';
      badge.classList.add('premium-pro');
    }
  }

  async function savePassword() {
    var client = getClient();
    if (!client || !client.auth) return;
    var cur = byId('e-pwd-current') && byId('e-pwd-current').value;
    var neu = byId('e-pwd-new') && byId('e-pwd-new').value;
    var conf = byId('e-pwd-conf') && byId('e-pwd-conf').value;
    if (!neu && !conf) return;
    if (neu.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    if (neu !== conf) throw new Error('Les mots de passe ne correspondent pas.');
    if (PROFIL.email && cur) {
      var signIn = await client.auth.signInWithPassword({ email: PROFIL.email, password: cur });
      if (signIn.error) throw new Error('Mot de passe actuel incorrect.');
    }
    var upd = await client.auth.updateUser({ password: neu });
    if (upd.error) throw new Error(upd.error.message || 'Impossible de changer le mot de passe.');
    if (byId('e-pwd-current')) byId('e-pwd-current').value = '';
    if (byId('e-pwd-new')) byId('e-pwd-new').value = '';
    if (byId('e-pwd-conf')) byId('e-pwd-conf').value = '';
  }

  async function saveProfile() {
    var client = getClient();
    if (!client || !currentUserId) {
      notify('Connexion requise');
      return;
    }

    PROFIL.firstName = byId('firstName').value.trim();
    PROFIL.lastName = byId('lastName').value.trim();
    PROFIL.email = byId('email').value.trim() || PROFIL.email;
    PROFIL.phone = byId('phone').value.trim();
    PROFIL.departement = byId('departement').value;
    PROFIL.commune = byId('commune').value;
    PROFIL.fullName = fullName(PROFIL);

    var payload = {
      first_name: PROFIL.firstName,
      last_name: PROFIL.lastName,
      full_name: PROFIL.fullName,
      email: PROFIL.email,
      phone_number: PROFIL.phone,
      departement: PROFIL.departement,
      commune: PROFIL.commune,
      user_type: 'client'
    };

    var upd = await client.from('users').update(payload).eq('id', currentUserId);
    if (upd.error) throw new Error(upd.error.message || 'Erreur lors de la sauvegarde');

    try { await savePassword(); } catch (pwdErr) {
      if (byId('e-pwd-new') && byId('e-pwd-new').value) throw pwdErr;
    }

    saveNotifPrefs(currentUserId, readNotifTogglesFromDom());

    var local = readUser();
    localStorage.setItem('vendza_user_data', JSON.stringify(Object.assign({}, local, {
      id: currentUserId,
      firstName: PROFIL.firstName,
      lastName: PROFIL.lastName,
      fullName: PROFIL.fullName,
      email: PROFIL.email,
      phone: PROFIL.phone,
      departement: PROFIL.departement,
      commune: PROFIL.commune,
      avatarUrl: PROFIL.avatarUrl,
      userType: 'client'
    })));

    initDisplay();
    if (editMode) toggleEdit();
    notify('✅ Profil mis à jour avec succès !');
  }

  async function logout() {
    try {
      var client = getClient();
      if (client && client.auth) await client.auth.signOut();
    } catch (e) {}
    localStorage.removeItem('vendza_user_data');
    localStorage.removeItem('vendza_auth_token');
    window.location.href = window.VendzaUrls && window.VendzaUrls.page
      ? window.VendzaUrls.page('login')
      : '../authentification/connexion.html';
  }

  function bindAvatar() {
    var fileInput = byId('avatar-file');
    var dot = byId('avatar-edit-dot');
    var av = byId('avatar-display');
    function openPicker() { if (fileInput) fileInput.click(); }
    if (dot) dot.addEventListener('click', openPicker);
    if (av) av.addEventListener('click', openPicker);
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          PROFIL.avatarUrl = ev.target.result;
          if (currentUserId) {
            var local = readUser();
            localStorage.setItem('vendza_user_data', JSON.stringify(Object.assign({}, local, {
              avatarUrl: PROFIL.avatarUrl
            })));
          }
          initDisplay();
          notify('📷 Photo de profil mise à jour');
        };
        reader.readAsDataURL(file);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = byId('page');
    if (page) {
      page.classList.add('read-mode');
      document.body.classList.add('read-mode');
    }

    if (byId('departement')) {
      byId('departement').addEventListener('change', function () { updateCommunes(''); });
    }

    if (byId('btn-edit-toggle')) byId('btn-edit-toggle').addEventListener('click', toggleEdit);
    if (byId('btn-cancel-edit')) byId('btn-cancel-edit').addEventListener('click', cancelEdit);
    if (byId('btn-save-profile')) {
      byId('btn-save-profile').addEventListener('click', function () {
        saveProfile().catch(function (err) {
          notify(err.message || 'Erreur de sauvegarde');
        });
      });
    }
    if (byId('pwd-read-row')) byId('pwd-read-row').addEventListener('click', function () {
      if (!editMode) toggleEdit();
    });
    if (byId('logoutBtn')) byId('logoutBtn').addEventListener('click', logout);

    bindAvatar();

    (async function init() {
      var localData = readUser();
      var remoteData = await readSupabaseUserData();
      var data = Object.assign({}, localData, remoteData);
      currentUserId = data.id || '';
      PROFIL = {
        id: currentUserId,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        fullName: data.fullName || fullName(data),
        email: data.email || '',
        phone: data.phone || '',
        departement: data.departement || '',
        commune: data.commune || '',
        userType: data.userType || 'client',
        avatarUrl: data.avatarUrl || localData.avatarUrl || '',
        commandes: 0,
        livrees: 0
      };

      if (currentUserId) {
        var stats = await fetchOrderStats(currentUserId);
        PROFIL.commandes = stats.total;
        PROFIL.livrees = stats.livrees;
        applyNotifPrefs(loadNotifPrefs(currentUserId));
        bindNotifToggles(currentUserId);
        var plan = await fetchPremiumPlan(currentUserId);
        renderPremiumBadge(plan);
      }

      initDisplay();
      notify('Profil chargé.');
    })();
  });
})();
