(function () {
  'use strict';

  function getRootPrefix() {
    if (window.VendzaUrls && typeof window.VendzaUrls.getRootPrefix === 'function') {
      return window.VendzaUrls.getRootPrefix();
    }
    var normalized = window.location.pathname.replace(/\\/g, '/');
    var lower = normalized.toLowerCase();
    var marker = '/frontend-vendza';
    var idx = lower.lastIndexOf(marker);
    if (idx !== -1) {
      var inside = normalized.slice(idx + marker.length).replace(/^\/+/, '');
      if (!inside) return '';
      var depth = Math.max(0, inside.split('/').length - 1);
      return '../'.repeat(depth);
    }
    var segments = normalized.split('/').filter(Boolean);
    if (!segments.length) return '';
    var last = segments[segments.length - 1] || '';
    var isFile = /\.[a-z0-9]+$/i.test(last);
    var depth = Math.max(0, segments.length - (isFile ? 1 : 0));
    return '../'.repeat(depth);
  }

  function isHomePage() {
    var path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    return path === '/' || path.endsWith('/index.html') || path.endsWith('/frontend-vendza/') || path.endsWith('/frontend-vendza');
  }

  function readStoredUser() {
    try {
      var raw = localStorage.getItem('vendza_user_data');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function readStoredUserType() {
    var parsed = readStoredUser();
    if (!parsed) return '';
    return String(parsed.userType || parsed.user_type || parsed.type || '').toLowerCase();
  }

  async function resolveUserType() {
    if (window.VendzaAuth) {
      var cached = window.VendzaAuth.getCachedSession && window.VendzaAuth.getCachedSession();
      if (cached && cached.authenticated && cached.userType) return cached.userType;
      if (typeof window.VendzaAuth.resolveSession === 'function') {
        var session = await window.VendzaAuth.resolveSession();
        if (session && session.authenticated) return session.userType;
      }
    }
    var localType = readStoredUserType();
    if (localType) return localType;
    try {
      var client = window.supabaseClient || window.supabase;
      if (client && client.auth && client.auth.getUser) {
        var resp = await client.auth.getUser();
        var email = resp && resp.data && resp.data.user && resp.data.user.email;
        if (String(email || '').toLowerCase() === 'jeandanielmichel004@gmail.com') return 'admin';
        var meta = resp && resp.data && resp.data.user && resp.data.user.user_metadata;
        var t = meta && (meta.userType || meta.user_type);
        return t ? String(t).toLowerCase() : '';
      }
    } catch (e) {}
    return '';
  }

  async function resolveAuthUser() {
    var local = readStoredUser() || {};
    try {
      var client = window.supabaseClient || window.supabase;
      if (client && client.auth && client.auth.getUser) {
        var resp = await client.auth.getUser();
        var user = resp && resp.data && resp.data.user;
        if (user) {
          var meta = user.user_metadata || {};
          var first = meta.firstName || meta.first_name || local.firstName || '';
          var last = meta.lastName || meta.last_name || local.lastName || '';
          var full = local.fullName || meta.fullName || meta.full_name || [first, last].filter(Boolean).join(' ');
          return {
            id: user.id,
            email: user.email || local.email || '',
            fullName: full || 'Utilisateur',
            avatarUrl: local.avatarUrl || meta.avatar_url || ''
          };
        }
      }
    } catch (_) {}
    return {
      id: local.id || '',
      email: local.email || '',
      fullName: local.fullName || [local.firstName, local.lastName].filter(Boolean).join(' ') || 'Utilisateur',
      avatarUrl: local.avatarUrl || ''
    };
  }

  function menuHref(prefix, path) {
    if (window.VendzaUrls && window.VendzaUrls.fixNav) return window.VendzaUrls.fixNav(path);
    if (window.VendzaUrls && window.VendzaUrls.fix) return window.VendzaUrls.fix(path);
    return prefix + path;
  }

  function readCartCount() {
    try {
      var cart = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
      if (!Array.isArray(cart)) return 0;
      return cart.reduce(function (s, item) { return s + (Number(item && item.quantity) || 1); }, 0);
    } catch (e) {
      return 0;
    }
  }

  function loadDrawerCss() {
    if (document.querySelector('link[href*="vendza-drawer.css"]')) return;
    var href;
    if (window.VendzaUrls && window.VendzaUrls.fix) {
      href = window.VendzaUrls.fix('vendza-drawer.css');
    } else {
      var currentScript = document.currentScript || Array.from(document.scripts).find(function (s) { return /guest-drawer\.js$/i.test(s.src || ''); });
      if (currentScript && currentScript.src) {
        try {
          href = new URL('vendza-drawer.css', currentScript.src).href;
        } catch (_) {
          href = getRootPrefix() + 'vendza-drawer.css';
        }
      } else {
        href = getRootPrefix() + 'vendza-drawer.css';
      }
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function normalizePath(p) {
    return String(p || '').replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') || '/';
  }

  function isLinkActive(href) {
    if (!href || href.charAt(0) === '#') return false;
    try {
      var current = normalizePath(window.location.pathname);
      var target = normalizePath(new URL(href, window.location.origin).pathname);
      if (current === target) return true;
      return current.split('/').pop() === target.split('/').pop();
    } catch (_) {
      return false;
    }
  }

  function itemHtml(opts) {
    var active = opts.href && isLinkActive(opts.href);
    var badge = '';
    if (opts.badgeId) {
      var show = Number(opts.badge) > 0;
      badge = '<span class="di-badge' + (opts.badgeClass ? ' ' + opts.badgeClass : '') + '" id="' + opts.badgeId + '"' + (show ? '' : ' style="display:none;"') + '>' + (show ? opts.badge : '0') + '</span>';
    }
    return (
      '<a class="vz-drawer-item' + (active ? ' active' : '') + '" href="' + opts.href + '">' +
      '<div class="vz-di-icon-wrap ' + (opts.color || '') + '"><span class="vz-di-icon">' + opts.icon + '</span></div>' +
      '<div class="vz-di-body"><div class="vz-di-label">' + opts.label + '</div>' +
      (opts.sub ? '<div class="vz-di-sub">' + opts.sub + '</div>' : '') +
      '</div>' + badge + '</a>'
    );
  }

  function sectionHtml(label, items) {
    return '<div class="vz-drawer-section"><div class="vz-drawer-section-label">' + label + '</div>' + items + '</div>';
  }

  function dividerHtml() {
    return '<div class="vz-drawer-divider"></div>';
  }

  function buildMenuBody(prefix, userType, cartCount, msgCount) {
    var h = function (p) { return menuHref(prefix, p); };
    var i = itemHtml;
    var parts = [];

    if (userType === 'admin') {
      parts.push(sectionHtml('Principal', i({ href: h('index.html'), icon: '🏠', label: 'Accueil', color: 'blue' })));
      return parts.join('');
    }

    if (userType === 'client' || userType === 'vendeur') {
      parts.push(sectionHtml('Principal', [
        i({ href: h('index.html'), icon: '🏠', label: 'Accueil', sub: 'Catalogue & produits', color: 'blue' }),
        i({ href: h('a-propos.html'), icon: 'ℹ️', label: 'À propos', sub: 'Notre mission', color: 'teal' }),
        i({ href: h('index.html#contact'), icon: '✉️', label: 'Nous contacter', sub: 'Support client', color: 'violet' })
      ].join('')));

      parts.push(dividerHtml());
      parts.push(sectionHtml('Mes achats', [
        i({ href: h('/client/panier'), icon: '🛒', label: 'Mon panier', sub: 'Articles en attente', color: 'amber', badgeId: 'vzBadgePanier', badge: cartCount, badgeClass: 'amber' }),
        i({ href: h('client/historique-des-commandes.html'), icon: '🕐', label: 'Historique des commandes', sub: 'Suivre mes achats', color: 'green' }),
        i({ href: h('client/confirmation.html'), icon: '📱', label: 'Scanner un QR code', sub: 'Valider une livraison', color: 'teal' })
      ].join('')));

      if (userType === 'vendeur') {
        parts.push(dividerHtml());
        parts.push(sectionHtml('Espace vendeur', [
          i({ href: h('vendeur/tableau-de-bord-vendeur.html'), icon: '📊', label: 'Tableau de bord', sub: 'Gérer ma boutique', color: 'blue' }),
          i({ href: h('vendeur/mes-produit.html'), icon: '📦', label: 'Mes produits', sub: 'Catalogue vendeur', color: 'teal' }),
          i({ href: h('vendeur/commande-recu.html'), icon: '🛍️', label: 'Commandes reçues', sub: 'Gérer les ventes', color: 'amber' }),
          i({ href: h('vendeur/boite-de-reception-vendeur.html'), icon: '💬', label: 'Messages', sub: 'Conversations clients', color: 'violet', badgeId: 'vzBadgeMessages', badge: msgCount }),
          i({ href: h('vendeur/livraison.html'), icon: '🚚', label: 'Livraisons', sub: 'Suivi des envois', color: 'green' })
        ].join('')));
      }

      parts.push(dividerHtml());
      var compte = [
        i({
          href: h(userType === 'vendeur' ? 'vendeur/profil-vendeur.html' : 'client/profil-client.html'),
          icon: '👤',
          label: 'Mon profil',
          sub: 'Informations & sécurité',
          color: 'blue'
        })
      ];
      if (userType === 'client') {
        compte.push(i({ href: h('client/tableau-de-bord-client.html'), icon: '📋', label: 'Tableau de bord', sub: 'Vue client', color: 'teal' }));
        compte.push(i({ href: h('client/mes-messages.html'), icon: '💬', label: 'Mes messages', sub: 'Discussions', color: 'violet' }));
      }
      compte.push(i({ href: h('vendeur/Abonnement.html'), icon: '⭐', label: 'Abonnement', sub: 'Plan & avantages', color: 'amber' }));
      parts.push(sectionHtml('Compte', compte.join('')));

      parts.push(dividerHtml());
      parts.push(
        '<div class="vz-drawer-section">' +
        '<button type="button" class="vz-drawer-item logout" id="vzDrawerLogout">' +
        '<div class="vz-di-icon-wrap red"><span class="vz-di-icon">🚪</span></div>' +
        '<div class="vz-di-body"><div class="vz-di-label">Déconnexion</div></div>' +
        '</button></div>'
      );
      return parts.join('');
    }

    parts.push(sectionHtml('Invité', [
      i({ href: h('authentification/connexion.html'), icon: '🔑', label: 'Se connecter', sub: 'Accéder à votre compte', color: 'blue' }),
      i({ href: h('authentification/inscription.html'), icon: '✨', label: 'S\'inscrire', sub: 'Créer un compte', color: 'teal' }),
      i({ href: h('index.html'), icon: '🏠', label: 'Accueil', sub: 'Catalogue', color: 'blue' }),
      i({ href: h('a-propos.html'), icon: 'ℹ️', label: 'À propos', sub: 'Notre mission', color: 'teal' }),
      i({ href: h('index.html#contact'), icon: '✉️', label: 'Nous contacter', sub: 'Support', color: 'violet' })
    ].join('')));
    return parts.join('');
  }

  function ensureDrawerDom(bodyHtml) {
    if (document.getElementById('vzDrawer')) return;
    var drawer = document.createElement('aside');
    drawer.id = 'vzDrawer';
    drawer.className = 'vz-drawer';
    drawer.setAttribute('aria-label', 'Menu Vendza');
    drawer.innerHTML = [
      '<div class="vz-drawer-header">',
      '<button type="button" class="vz-drawer-close" id="vzDrawerClose" aria-label="Fermer">✕</button>',
      '<div class="vz-drawer-user">',
      '<div class="vz-drawer-avatar" id="vzDrawerAvatar">U</div>',
      '<div>',
      '<div class="vz-drawer-user-name" id="vzDrawerName">Utilisateur</div>',
      '<div class="vz-drawer-user-email" id="vzDrawerEmail">—</div>',
      '<div class="vz-drawer-user-badges">',
      '<span class="vz-drawer-badge" id="vzDrawerRoleBadge">Invité</span>',
      '<span class="vz-drawer-badge green" id="vzDrawerConnBadge" style="display:none;">● Connecté</span>',
      '</div></div></div></div>',
      '<div class="vz-drawer-body" id="vzDrawerBody">' + bodyHtml + '</div>',
      '<div class="vz-drawer-footer"><div class="vz-drawer-footer-text">',
      '<strong>Vendza</strong> · vendza@gmail.com · +509 4195 37 39</div></div>'
    ].join('');

    var ov = document.createElement('div');
    ov.id = 'vzDrawerOverlay';
    ov.className = 'vz-drawer-overlay';
    ov.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ov);
    document.body.appendChild(drawer);
  }

  function ensureMenuButton(home) {
    if (document.getElementById('vzMenuFab') || document.getElementById('vzMenuBtnInline')) return;
    if (home) {
      var topNav = document.querySelector('.top-nav');
      if (topNav) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'vzMenuBtnInline';
        btn.className = 'vz-menu-btn-inline';
        btn.setAttribute('aria-label', 'Ouvrir le menu');
        btn.textContent = '☰';
        topNav.insertBefore(btn, topNav.firstChild);
        return;
      }
    }
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'vzMenuFab';
    fab.className = 'vz-menu-fab';
    fab.setAttribute('aria-label', 'Ouvrir le menu');
    fab.textContent = '☰';
    document.body.appendChild(fab);
  }

  function openDrawer() {
    var d = document.getElementById('vzDrawer');
    var o = document.getElementById('vzDrawerOverlay');
    if (d) d.classList.add('open');
    if (o) o.classList.add('open');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    var d = document.getElementById('vzDrawer');
    var o = document.getElementById('vzDrawerOverlay');
    if (d) d.classList.remove('open');
    if (o) o.classList.remove('open');
    document.body.classList.remove('drawer-open');
  }

  function bindDrawerEvents() {
    ['vzMenuFab', 'vzMenuBtnInline'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', openDrawer);
    });
    var closeBtn = document.getElementById('vzDrawerClose');
    var overlay = document.getElementById('vzDrawerOverlay');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);
    var drawer = document.getElementById('vzDrawer');
    if (drawer) {
      drawer.querySelectorAll('a.vz-drawer-item').forEach(function (a) {
        a.addEventListener('click', closeDrawer);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
    var logoutBtn = document.getElementById('vzDrawerLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        closeDrawer();
        if (!window.confirm('Se déconnecter de Vendza ?')) return;
        (async function () {
          try {
            var client = window.supabaseClient || window.supabase;
            if (client && client.auth) await client.auth.signOut();
          } catch (_) {}
          localStorage.removeItem('vendza_user_data');
          localStorage.removeItem('vendza_auth_token');
          var dest = (window.VendzaUrls && window.VendzaUrls.page)
            ? window.VendzaUrls.page('login')
            : menuHref(getRootPrefix(), 'authentification/connexion.html');
          window.location.href = dest;
        })();
      });
    }
  }

  function paintUserHeader(user, userType) {
    var name = user.fullName || 'Utilisateur';
    var letter = (name.trim().charAt(0) || 'U').toUpperCase();
    var av = document.getElementById('vzDrawerAvatar');
    if (av) {
      av.innerHTML = user.avatarUrl
        ? '<img src="' + user.avatarUrl + '" alt="">'
        : letter;
    }
    var nameEl = document.getElementById('vzDrawerName');
    var emailEl = document.getElementById('vzDrawerEmail');
    var roleBadge = document.getElementById('vzDrawerRoleBadge');
    var connBadge = document.getElementById('vzDrawerConnBadge');
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = user.email || '—';
    if (roleBadge) {
      if (userType === 'vendeur') roleBadge.textContent = '🏪 Vendeur';
      else if (userType === 'client') roleBadge.textContent = '👤 Client';
      else if (userType === 'admin') roleBadge.textContent = '⚙ Admin';
      else roleBadge.textContent = '👋 Invité';
    }
    if (connBadge) {
      connBadge.style.display = (userType === 'client' || userType === 'vendeur') ? '' : 'none';
    }
  }

  function updateCartBadges(count) {
    var bp = document.getElementById('vzBadgePanier');
    if (bp) {
      bp.textContent = String(count);
      bp.style.display = count > 0 ? '' : 'none';
    }
    document.querySelectorAll('#nav-cart-count, #globalCartCount, #cart-count, [data-cart-count]').forEach(function (el) {
      el.textContent = String(count);
    });
  }

  function bindCartCount() {
    function refresh() { updateCartBadges(readCartCount()); }
    refresh();
    window.addEventListener('storage', function (e) {
      if (e.key === 'vendza_cart') refresh();
    });
  }

  function getVendorInboxSeenKey(userId) {
    return 'vendza_vendor_inbox_last_seen_' + String(userId || '');
  }

  async function computeVendorUnreadCount() {
    try {
      var client = window.supabaseClient || window.supabase;
      if (!client || !client.auth) return 0;
      var authResp = await client.auth.getUser();
      var user = authResp && authResp.data && authResp.data.user;
      if (!user) return 0;
      var seenIso = localStorage.getItem(getVendorInboxSeenKey(user.id)) || '1970-01-01T00:00:00.000Z';
      var convResp = await client.from('conversations').select('id').eq('vendor_id', user.id);
      var convs = convResp && convResp.data;
      if (!Array.isArray(convs) || !convs.length) return 0;
      var ids = convs.map(function (c) { return c.id; }).filter(Boolean);
      if (!ids.length) return 0;
      var msgResp = await client.from('messages').select('id').in('conversation_id', ids).neq('sender_id', user.id).gt('created_at', seenIso);
      var msgs = msgResp && msgResp.data;
      return Array.isArray(msgs) ? msgs.length : 0;
    } catch (_) {
      return 0;
    }
  }

  function paintMessageBadge(count) {
    var bm = document.getElementById('vzBadgeMessages');
    if (!bm) return;
    bm.style.display = count > 0 ? '' : 'none';
    bm.textContent = String(count);
  }

  function ensureSystemNotifUi() {
    if (document.getElementById('systemNotifBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'systemNotifBtn';
    btn.className = 'system-notif-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Notifications');
    btn.innerHTML = '<i class="fas fa-bell"></i><span id="systemNotifBadge" class="system-notif-badge" style="display:none;">0</span>';
    var panel = document.createElement('div');
    panel.id = 'systemNotifPanel';
    panel.className = 'system-notif-panel';
    panel.innerHTML = '<div class="system-notif-head"><strong>Notifications</strong><button type="button" id="closeSystemNotif" aria-label="Fermer"><i class="fas fa-times"></i></button></div><div id="systemNotifList" class="system-notif-list"></div>';
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    function close() { document.body.classList.remove('system-notif-open'); }
    btn.addEventListener('click', function () { document.body.classList.toggle('system-notif-open'); });
    var closeBtn = document.getElementById('closeSystemNotif');
    if (closeBtn) closeBtn.addEventListener('click', close);
  }

  function renderSystemNotifs(items) {
    var list = document.getElementById('systemNotifList');
    var badge = document.getElementById('systemNotifBadge');
    if (!list || !badge) return;
    var safe = Array.isArray(items) ? items : [];
    if (!safe.length) {
      list.innerHTML = '<div class="system-notif-item"><small>Aucune notification.</small></div>';
      badge.style.display = 'none';
      return;
    }
    list.innerHTML = safe.map(function (x) {
      var title = String(x.title || '');
      var text = String(x.text || '');
      var href = x.href ? menuHref(getRootPrefix(), String(x.href).replace(/^\//, '')) : '';
      if (href) return '<a class="system-notif-item" href="' + href + '"><strong>' + title + '</strong><small>' + text + '</small></a>';
      return '<div class="system-notif-item"><strong>' + title + '</strong><small>' + text + '</small></div>';
    }).join('');
    badge.style.display = 'inline-flex';
    badge.textContent = String(safe.length);
  }

  async function bindVendorInboxBadge(userType) {
    if (userType !== 'vendeur') {
      renderSystemNotifs([]);
      return;
    }
    async function refresh() {
      var count = await computeVendorUnreadCount();
      paintMessageBadge(count);
      var notifs = count > 0 ? [{
        title: 'Nouveaux messages',
        text: count + ' message(s) non lus.',
        href: 'vendeur/boite-de-reception-vendeur.html'
      }] : [];
      renderSystemNotifs(notifs);
    }
    await refresh();
    setInterval(refresh, 15000);
  }

  async function bootGuestDrawer() {
    loadDrawerCss();
    var home = isHomePage();
    var prefix = getRootPrefix();
    if (window.VendzaTopBar && window.VendzaTopBar.ensure) window.VendzaTopBar.ensure();

    var userType = await resolveUserType();
    var user = await resolveAuthUser();
    var cartCount = readCartCount();
    var msgCount = userType === 'vendeur' ? await computeVendorUnreadCount() : 0;

    var bodyHtml = buildMenuBody(prefix, userType, cartCount, msgCount);
    document.body.classList.toggle('is-home-page', home);
    document.body.classList.add('has-vz-drawer', 'has-guest-drawer');

    ensureDrawerDom(bodyHtml);
    ensureMenuButton(home);
    paintUserHeader(user, userType);
    bindDrawerEvents();
    bindCartCount();
    ensureSystemNotifUi();
    await bindVendorInboxBadge(userType);

    if (window.VendzaUrls && window.VendzaUrls.patchDomNavigation) {
      window.VendzaUrls.patchDomNavigation();
    } else if (window.VendzaLinkFix && window.VendzaLinkFix.fixAll) {
      window.VendzaLinkFix.fixAll();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGuestDrawer);
  } else {
    bootGuestDrawer();
  }
})();
