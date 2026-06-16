'use strict';

(function () {
  var cachedSession = null;

  function getClient() {
    return (typeof window !== 'undefined') ? (window.supabaseClient || window.supabase || null) : null;
  }

  function getPrefix() {
    if (window.VendzaUrls && typeof window.VendzaUrls.getRootPrefix === 'function') {
      return window.VendzaUrls.getRootPrefix();
    }
    return '';
  }

  function href(path) {
    path = String(path || '').replace(/^\//, '');
    if (!path || /^(https?:|mailto:|tel:|javascript:|#)/i.test(path)) return path;
    if (path.indexOf('..') >= 0) return path;

    var loc = String(window.location.pathname || '').replace(/\\/g, '/');
    var lower = loc.toLowerCase();

    if (lower.indexOf('/client/') >= 0 && path.indexOf('client/') === 0) {
      return path.slice(7);
    }
    if (lower.indexOf('/vendeur/') >= 0 && path.indexOf('vendeur/') === 0) {
      return path.slice(8);
    }
    if (lower.indexOf('/authentification/') >= 0 && path.indexOf('authentification/') === 0) {
      return path.slice(18);
    }

    if (window.VendzaUrls && typeof window.VendzaUrls.fix === 'function') {
      return window.VendzaUrls.fix(path);
    }

    var parts = loc.split('/').filter(Boolean);
    var last = parts[parts.length - 1] || '';
    var depth = parts.length - (/\.[a-z0-9]+$/i.test(last) ? 1 : 0);
    var marker = '/frontend-vendza/';
    var idx = lower.indexOf(marker);
    if (idx >= 0) {
      var inside = loc.slice(idx + marker.length).replace(/^\/+/, '');
      parts = inside.split('/').filter(Boolean);
      last = parts[parts.length - 1] || '';
      depth = parts.length - (/\.[a-z0-9]+$/i.test(last) ? 1 : 0);
    }
    return (depth > 0 ? '../'.repeat(depth) : '') + path;
  }

  function readLocalUser() {
    try {
      return JSON.parse(localStorage.getItem('vendza_user_data') || 'null');
    } catch (_) {
      return null;
    }
  }

  function persistUser(user) {
    if (!user) {
      try { localStorage.removeItem('vendza_user_data'); } catch (_) {}
      return;
    }
    try {
      localStorage.setItem('vendza_user_data', JSON.stringify(user));
    } catch (_) {}
  }

  function normalizeUserType(value) {
    var t = String(value || '').toLowerCase().trim();
    if (t === 'vendeur' || t === 'vendor' || t === 'seller') return 'vendeur';
    if (t === 'admin') return 'admin';
    if (t === 'client' || t === 'buyer') return 'client';
    return t || 'client';
  }

  function profilePathForType(userType) {
    if (userType === 'admin') return 'admin/admin.html';
    if (userType === 'vendeur') return 'vendeur/profil-vendeur.html';
    return 'client/profil-client.html';
  }

  function isAuthPage() {
    var path = String(window.location.pathname || '').toLowerCase();
    return path.indexOf('/authentification/connexion') >= 0
      || path.indexOf('/authentification/inscription') >= 0;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function resolveSession() {
    var client = getClient();
    var local = readLocalUser();
    var supaUser = null;

    if (client && client.auth && typeof client.auth.getUser === 'function') {
      try {
        var resp = await client.auth.getUser();
        supaUser = resp && resp.data && resp.data.user ? resp.data.user : null;
      } catch (_) {}
      if (!supaUser) {
        persistUser(null);
        local = null;
      }
    }

    if (!supaUser && (!local || !local.id)) {
      return {
        authenticated: false,
        user: null,
        userType: 'guest',
        email: '',
        displayName: '',
        initial: '',
        profilePath: 'authentification/connexion.html',
        avatarUrl: ''
      };
    }

    var meta = (supaUser && supaUser.user_metadata) ? supaUser.user_metadata : {};
    var email = String((supaUser && supaUser.email) || (local && local.email) || '').toLowerCase();
    var userType = normalizeUserType(
      (local && (local.userType || local.user_type || local.type))
      || meta.userType || meta.user_type || 'client'
    );

    if (email === 'jeandanielmichel004@gmail.com') {
      userType = 'admin';
    }

    var firstName = (local && (local.firstName || local.first_name))
      || meta.firstName || meta.first_name || '';
    var lastName = (local && (local.lastName || local.last_name))
      || meta.lastName || meta.last_name || '';
    var displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (!displayName) {
      displayName = email ? email.split('@')[0] : 'Utilisateur';
    }
    var initial = displayName.trim().charAt(0).toUpperCase() || 'U';
    var avatarUrl = (local && (local.avatar_url || local.avatarUrl || local.photo_url))
      || meta.avatar_url || meta.picture || '';

    var user = Object.assign({}, local || {}, {
      id: (supaUser && supaUser.id) || (local && local.id) || '',
      email: email || (local && local.email) || '',
      userType: userType,
      firstName: firstName,
      lastName: lastName,
      displayName: displayName,
      avatar_url: avatarUrl
    });

    persistUser(user);

    return {
      authenticated: true,
      user: user,
      userType: userType,
      email: email,
      displayName: displayName,
      initial: initial,
      profilePath: profilePathForType(userType),
      avatarUrl: avatarUrl
    };
  }

  function applyBodyState(session) {
    var type = session && session.authenticated ? session.userType : 'guest';
    document.body.setAttribute('data-user-type', type);
    document.body.setAttribute('data-authenticated', session && session.authenticated ? 'true' : 'false');
    document.documentElement.setAttribute('data-user-type', type);
    document.documentElement.setAttribute('data-authenticated', session && session.authenticated ? 'true' : 'false');
  }

  function updateAccountButton(session) {
    var btn = document.getElementById('accountBtn');
    if (!btn) return;

    session = session || cachedSession;
    if (!session) return;

    if (session.authenticated) {
      btn.href = href(session.profilePath);
      btn.setAttribute('aria-label', 'Mon profil — ' + session.displayName);
      btn.title = session.displayName;
      btn.classList.add('account-btn--avatar');
      if (session.avatarUrl) {
        btn.innerHTML = '<img class="account-avatar-img" src="' + escapeHtml(session.avatarUrl) + '" alt="">';
      } else {
        btn.innerHTML = '<span class="account-avatar" aria-hidden="true">' + escapeHtml(session.initial) + '</span>';
      }
    } else {
      btn.href = href('authentification/connexion.html');
      btn.setAttribute('aria-label', 'Se connecter');
      btn.title = 'Se connecter';
      btn.classList.remove('account-btn--avatar');
      btn.innerHTML = '<i class="fas fa-user" aria-hidden="true"></i>';
    }
  }

  function dispatchAuthEvent(session) {
    try {
      document.dispatchEvent(new CustomEvent('vendza:auth', { detail: session }));
    } catch (_) {}
  }

  async function guardAuthPages(session) {
    if (!isAuthPage()) return false;
    session = session || cachedSession || await resolveSession();
    if (!session.authenticated) return false;

    var target;
    if (window.VendzaAuthRedirect && typeof window.VendzaAuthRedirect.resolveAuthRedirect === 'function') {
      target = window.VendzaAuthRedirect.resolveAuthRedirect(session.user, session.email, session.userType);
    } else {
      target = href(session.profilePath);
    }
    window.location.replace(target);
    return true;
  }

  async function refresh() {
    var session = await resolveSession();
    cachedSession = session;
    applyBodyState(session);
    updateAccountButton(session);
    dispatchAuthEvent(session);
    await guardAuthPages(session);
    return session;
  }

  async function signOut() {
    var client = getClient();
    persistUser(null);
    cachedSession = null;
    if (client && client.auth && typeof client.auth.signOut === 'function') {
      try { await client.auth.signOut(); } catch (_) {}
    }
    applyBodyState({ authenticated: false, userType: 'guest' });
    updateAccountButton({ authenticated: false });
    dispatchAuthEvent({ authenticated: false, userType: 'guest' });
    window.location.href = href('index.html');
  }

  function getCachedSession() {
    return cachedSession;
  }

  function isAuthenticated() {
    return !!(cachedSession && cachedSession.authenticated);
  }

  async function init() {
    await refresh();
    window.addEventListener('storage', function (e) {
      if (e.key === 'vendza_user_data') refresh();
    });
  }

  window.VendzaAuth = {
    init: init,
    refresh: refresh,
    resolveSession: resolveSession,
    getCachedSession: getCachedSession,
    isAuthenticated: isAuthenticated,
    readLocalUser: readLocalUser,
    persistUser: persistUser,
    profilePathForType: profilePathForType,
    updateAccountButton: updateAccountButton,
    guardAuthPages: guardAuthPages,
    signOut: signOut,
    href: href
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
