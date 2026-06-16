'use strict';

(function () {
  var LEGACY_NAV_SELECTORS = [
    '.detail-top-nav',
    '.global-title-bar',
    '.mp-nav'
  ];

  function getPrefix() {
    if (window.VendzaUrls && typeof window.VendzaUrls.getRootPrefix === 'function') {
      return window.VendzaUrls.getRootPrefix();
    }
    var path = String(window.location.pathname || '').replace(/\\/g, '/');
    var segments = path.split('/').filter(Boolean);
    if (!segments.length) return '';
    var last = segments[segments.length - 1] || '';
    var isFile = /\.[a-z0-9]+$/i.test(last);
    var depth = Math.max(0, segments.length - (isFile ? 1 : 0));
    return depth > 0 ? '../'.repeat(depth) : '';
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
    return getPrefix() + path;
  }

  function isHomePage() {
    var path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    return path.endsWith('/index.html') || path.endsWith('/frontend-vendza/') || /\/index\.html$/i.test(path);
  }

  function buildTopShellHtml() {
    return (
      '<header class="top-shell" id="vendzaTopShell">' +
      '<nav class="top-nav" aria-label="Navigation principale">' +
      '<a class="brand" href="' + href('index.html') + '">Vend<span>za</span></a>' +
      '<div class="top-actions">' +
      '<a href="' + href('/client/panier') + '" class="icon-btn cart-btn" aria-label="Panier">' +
      '<i class="fas fa-cart-shopping" aria-hidden="true"></i>' +
      '<span class="badge" id="nav-cart-count">0</span>' +
      '</a>' +
      '<a href="' + href('authentification/connexion.html') + '" class="icon-btn account-btn" id="accountBtn" aria-label="Compte">' +
      '<i class="fas fa-user" aria-hidden="true"></i>' +
      '</a>' +
      '</div>' +
      '</nav>' +
      '</header>'
    );
  }

  function hideLegacyNavs() {
    LEGACY_NAV_SELECTORS.forEach(function (sel) {
      try {
        document.querySelectorAll(sel).forEach(function (el) {
          el.hidden = true;
          el.style.display = 'none';
        });
      } catch (_) {}
    });
    document.querySelectorAll('body > nav').forEach(function (el) {
      if (el.classList.contains('top-nav') || el.closest('header.top-shell')) return;
      el.hidden = true;
      el.style.display = 'none';
    });
  }

  function upgradeExistingTopShell() {
    var shell = document.querySelector('header.top-shell');
    if (!shell) return null;
    shell.querySelectorAll('.icon-btn[href*="panier"]').forEach(function (el) {
      el.classList.add('cart-btn');
    });
    var account = shell.querySelector('#accountBtn, .icon-btn[href*="connexion"]');
    if (account) account.classList.add('account-btn');
    var badge = shell.querySelector('#nav-cart-count, .cart-btn .badge');
    if (badge && !badge.id) badge.id = 'nav-cart-count';
    return shell;
  }

  function ensureTopShell() {
    if (!upgradeExistingTopShell() && !document.getElementById('vendzaTopShell')) {
      var tpl = document.createElement('template');
      tpl.innerHTML = buildTopShellHtml();
      var header = tpl.content.firstElementChild;
      if (header) document.body.insertBefore(header, document.body.firstChild);
    }
    document.body.classList.add('has-vendza-top-bar');
    document.body.classList.toggle('is-home-page', isHomePage());
    hideLegacyNavs();
  }

  function syncAccountFromAuth() {
    if (window.VendzaAuth && typeof window.VendzaAuth.updateAccountButton === 'function') {
      var session = window.VendzaAuth.getCachedSession && window.VendzaAuth.getCachedSession();
      if (session) {
        window.VendzaAuth.updateAccountButton(session);
        return;
      }
      if (typeof window.VendzaAuth.refresh === 'function') {
        window.VendzaAuth.refresh();
      }
    }
  }

  function init() {
    ensureTopShell();
    syncAccountFromAuth();
    document.addEventListener('vendza:auth', function (e) {
      if (window.VendzaAuth && e.detail) {
        window.VendzaAuth.updateAccountButton(e.detail);
      }
    });
  }

  window.VendzaTopBar = {
    init: init,
    ensure: ensureTopShell,
    href: href,
    getPrefix: getPrefix,
    syncAccountFromAuth: syncAccountFromAuth
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
