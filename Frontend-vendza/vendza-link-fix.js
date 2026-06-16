'use strict';

(function () {
  function fixHref(raw, kind) {
    if (!window.VendzaUrls) return raw;
    if (kind === 'asset' && typeof window.VendzaUrls.fixAsset === 'function') {
      return window.VendzaUrls.fixAsset(raw);
    }
    if (typeof window.VendzaUrls.fixNav === 'function') {
      return window.VendzaUrls.fixNav(raw);
    }
    if (typeof window.VendzaUrls.fix === 'function') {
      return window.VendzaUrls.fix(raw);
    }
    return raw;
  }

  function fixElement(el, attr, kind) {
    if (!el) return;
    attr = attr || (el.hasAttribute('src') && !el.hasAttribute('href') ? 'src' : 'href');
    var raw = el.getAttribute(attr);
    if (!raw || /^(https?:|mailto:|tel:|javascript:|#)/i.test(raw)) return;
    var fixed = fixHref(raw, kind);
    if (fixed && fixed !== raw) el.setAttribute(attr, fixed);
  }

  function fixAllLinks(root) {
    root = root || document;
    root.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (el) {
      fixElement(el, 'href', 'asset');
    });
    root.querySelectorAll('script[src]').forEach(function (el) {
      fixElement(el, 'src', 'asset');
    });
    root.querySelectorAll('a[href]').forEach(function (el) {
      fixElement(el, 'href', 'nav');
    });
    root.querySelectorAll('form[action]').forEach(function (el) {
      fixElement(el, 'action', 'nav');
    });
  }

  function boot() {
    if (!window.VendzaUrls) return;
    fixAllLinks();
    document.addEventListener('vendza:auth', function () {
      fixAllLinks();
    });
  }

  function waitAndBoot() {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (window.VendzaUrls || tries > 80) {
        clearInterval(timer);
        boot();
      }
    }, 25);
  }

  window.VendzaLinkFix = {
    fixAll: fixAllLinks,
    fixHref: function (raw) { return fixHref(raw, 'nav'); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndBoot);
  } else {
    waitAndBoot();
  }
})();
