'use strict';

(function () {
  function loadScriptOnce(relativeSrc, sync) {
    if (document.querySelector('script[src*="' + relativeSrc + '"]')) return;
    var prefix = '';
    if (window.VendzaUrls && typeof window.VendzaUrls.getRootPrefix === 'function') {
      prefix = window.VendzaUrls.getRootPrefix();
    } else {
      var path = String(window.location.pathname || '').replace(/\\/g, '/');
      var segments = path.split('/').filter(Boolean);
      var last = segments[segments.length - 1] || '';
      var isFile = /\.[a-z0-9]+$/i.test(last);
      var depth = Math.max(0, segments.length - (isFile ? 1 : 0));
      prefix = depth > 0 ? '../'.repeat(depth) : '';
    }
    var s = document.createElement('script');
    s.src = prefix + relativeSrc;
    if (sync) s.async = false;
    document.head.appendChild(s);
  }
  /**
   * If some pages include root-relative references (e.g. src="/vendza-urls.js")
   * they won't load when opened via file://. Inject corrected relative
   * script tags now so the assets load without editing every HTML file.
   */
  function fixRootRelativeScripts() {
    try {
      var list = ['vendza-fix-assets.js', 'vendza-urls.js'];
      var prefix = (typeof getRootPrefix === 'function') ? getRootPrefix() : '';
      list.forEach(function (name) {
        var sel = 'script[src="/' + name + '"]';
        document.querySelectorAll(sel).forEach(function (old) {
          if (document.querySelector('script[src*="' + name + '"]')) return;
          var s = document.createElement('script');
          s.src = prefix + name;
          s.async = false;
          old.parentNode.insertBefore(s, old.nextSibling);
        });
      });
    } catch (e) {
      /* non-fatal */
    }
  }

  fixRootRelativeScripts();

  if (!window.VendzaUrls) loadScriptOnce('vendza-urls.js', true);
  loadScriptOnce('vendza-link-fix.js', true);
  loadScriptOnce('vendza-auth.js');
  loadScriptOnce('vendza-top-bar.js');
  loadScriptOnce('guest-drawer.js');

  function getClient() {
    return (typeof window !== 'undefined') ? (window.supabaseClient || window.supabase || null) : null;
  }

  function getRootPrefix() {
    if (window.VendzaUrls && typeof window.VendzaUrls.getRootPrefix === 'function') {
      return window.VendzaUrls.getRootPrefix();
    }
    var normalized = window.location.pathname.replace(/\\/g, '/');
    var marker = '/frontend-vendza/';
    var idx = normalized.toLowerCase().indexOf(marker);
    if (idx !== -1) {
      var inside = normalized.slice(idx + marker.length).replace(/^\/+/, '');
      if (!inside) return '';
      var parts = inside.split('/').filter(Boolean);
      var last = parts[parts.length - 1] || '';
      var depth = parts.length - (/\.[a-z0-9]+$/i.test(last) ? 1 : 0);
      return depth > 0 ? '../'.repeat(depth) : '';
    }
    var segments = normalized.split('/').filter(Boolean);
    if (!segments.length) return '';
    var lastSeg = segments[segments.length - 1] || '';
    var isFile = /\.[a-z0-9]+$/i.test(lastSeg);
    return '../'.repeat(Math.max(0, segments.length - (isFile ? 1 : 0)));
  }

  function fixHref(raw) {
    if (window.VendzaUrls && typeof window.VendzaUrls.fix === 'function') {
      return window.VendzaUrls.fix(raw);
    }
    return raw;
  }

  function fixAllLinks() {
    if (window.VendzaLinkFix && typeof window.VendzaLinkFix.fixAll === 'function') {
      window.VendzaLinkFix.fixAll();
      return;
    }
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href) return;
      if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) return;
      var fixed = fixHref(href);
      if (fixed && fixed !== href) a.setAttribute('href', fixed);
    });
  }

  function whenVendzaReady(fn) {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (window.VendzaUrls || tries > 100) {
        clearInterval(timer);
        fn();
      }
    }, 20);
  }

  function safeJsonParse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function readUser() {
    return safeJsonParse(localStorage.getItem('vendza_user_data') || 'null', null);
  }

  function readCart() {
    var c = safeJsonParse(localStorage.getItem('vendza_cart') || '[]', []);
    return Array.isArray(c) ? c : [];
  }

  function cartCount() {
    return readCart().reduce(function (sum, item) {
      return sum + (Number(item && item.quantity) || 1);
    }, 0);
  }

  function updateCartBadges() {
    var count = String(cartCount());
    ['#nav-cart-count', '#globalCartCount', '.cart-count', '#cart-count', '[data-cart-count]'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.textContent = count; });
    });
  }

  function setBodyState(user) {
    var type = user && (user.userType || user.user_type || user.type)
      ? String(user.userType || user.user_type || user.type).toLowerCase()
      : 'guest';
    document.body.setAttribute('data-user-type', type);
    document.body.setAttribute('data-authenticated', user ? 'true' : 'false');
  }

  async function syncAuthSnapshot() {
    if (window.VendzaAuth && typeof window.VendzaAuth.refresh === 'function') {
      var session = await window.VendzaAuth.refresh();
      setBodyState(session && session.authenticated ? session.user : null);
      return;
    }
    var client = getClient();
    if (!client || !client.auth || typeof client.auth.getUser !== 'function') {
      setBodyState(readUser());
      return;
    }
    try {
      var resp = await client.auth.getUser();
      var user = resp && resp.data && resp.data.user;
      if (!user) {
        setBodyState(null);
        return;
      }
      var localUser = readUser() || {};
      setBodyState(localUser.id ? localUser : { id: user.id, email: user.email, userType: 'client' });
    } catch (_) {
      setBodyState(readUser());
    }
  }

  function setButtonLoading(btn, loading) {
    if (window.VendzaLoading && typeof window.VendzaLoading.setButtonLoading === 'function') {
      window.VendzaLoading.setButtonLoading(btn, loading);
    }
  }

  function onReady() {
    window.VendzaRuntime = window.VendzaRuntime || {};
    window.VendzaRuntime.rootPrefix = getRootPrefix();
    window.VendzaRuntime.fixHref = fixHref;
    window.VendzaRuntime.setButtonLoading = setButtonLoading;
    window.VendzaRuntime.go = function (target, query) {
      if (window.VendzaUrls && window.VendzaUrls.go) window.VendzaUrls.go(target, query);
      else window.location.href = fixHref(target);
    };

    fixAllLinks();
    updateCartBadges();
    syncAuthSnapshot();

    document.addEventListener('vendza:auth', function (e) {
      var session = e && e.detail;
      setBodyState(session && session.authenticated ? session.user : null);
      fixAllLinks();
    });

    window.addEventListener('storage', function (e) {
      if (e.key === 'vendza_cart') updateCartBadges();
      if (e.key === 'vendza_user_data') {
        updateCartBadges();
        if (window.VendzaAuth && typeof window.VendzaAuth.refresh === 'function') {
          window.VendzaAuth.refresh();
        } else {
          setBodyState(readUser());
        }
      }
    });
  }

  function boot() {
    whenVendzaReady(onReady);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
