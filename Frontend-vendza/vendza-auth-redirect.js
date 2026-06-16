'use strict';

(function () {
  function normalizeRedirectPath(path) {
    var p = String(path || '').trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) {
      try {
        var u = new URL(p, window.location.href);
        if (u.origin !== window.location.origin) return '';
        p = u.pathname + u.search + u.hash;
      } catch (_) {
        return '';
      }
    }
    p = p.replace(/^\//, '');
    if (p.indexOf('..') >= 0) return '';
    if (window.VendzaUrls && typeof window.VendzaUrls.fix === 'function') {
      return window.VendzaUrls.fix(p);
    }
    if (!/\.[a-z0-9]+$/i.test((p.split('?')[0].split('#')[0].split('/').pop() || ''))) {
      p = p.split('?')[0] + '.html' + (String(path).includes('?') ? '?' + String(path).split('?').slice(1).join('?') : '');
    }
    return p;
  }

  function profilePathForUser(userInfo, tabHint) {
    var type = userInfo && userInfo.userType ? String(userInfo.userType).toLowerCase() : '';
    var tab = tabHint || 'client';
    if (type === 'admin') return 'admin/admin.html';
    if (type === 'vendeur' || type === 'vendor' || tab === 'vendeur') {
      return 'vendeur/profil-vendeur.html';
    }
    return 'client/profil-client.html';
  }

  function resolveAuthRedirect(userInfo, email, tabHint) {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var custom = normalizeRedirectPath(params.get('redirect'));
      if (custom) return custom.indexOf('..') === 0 ? custom : '../' + custom;
    } catch (_) {}

    if (String(email || '').toLowerCase() === 'jeandanielmichel004@gmail.com') {
      return '../admin/admin.html';
    }

    return '../' + profilePathForUser(userInfo, tabHint);
  }

  window.VendzaAuthRedirect = {
    profilePathForUser: profilePathForUser,
    resolveAuthRedirect: resolveAuthRedirect,
    goAfterAuth: function (userInfo, email, tabHint, delayMs) {
      delayMs = delayMs == null ? 700 : delayMs;
      var target = resolveAuthRedirect(userInfo, email, tabHint);
      window.setTimeout(function () {
        window.location.href = target;
      }, delayMs);
    }
  };
})();
