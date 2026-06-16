'use strict';

(function () {
  function setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      if (!btn.hasAttribute('data-vz-loading') && !btn.classList.contains('vz-force-loading')) return;
      if (btn.classList.contains('vz-btn-loading')) return;
      btn.classList.add('vz-btn-loading');
      btn.setAttribute('aria-busy', 'true');
      if (btn.tagName === 'BUTTON' || btn.tagName === 'INPUT') {
        btn.dataset.vzWasDisabled = btn.disabled ? '1' : '0';
        btn.disabled = true;
      }
    } else {
      btn.classList.remove('vz-btn-loading');
      btn.removeAttribute('aria-busy');
      if ((btn.tagName === 'BUTTON' || btn.tagName === 'INPUT') && btn.dataset.vzWasDisabled !== '1') {
        btn.disabled = false;
      }
    }
  }

  function wrap(fn, opts) {
    opts = opts || {};
    var run = typeof fn === 'function' ? fn : function () { return fn; };
    if (opts.button) {
      if (opts.button.setAttribute) opts.button.setAttribute('data-vz-loading', '1');
      setButtonLoading(opts.button, true);
    }
    return Promise.resolve().then(run).finally(function () {
      if (opts.button) setButtonLoading(opts.button, false);
    });
  }

  function initExplicitButtonLoading() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-vz-loading]');
      if (!btn || btn.classList.contains('vz-btn-loading')) return;
      setButtonLoading(btn, true);
      window.setTimeout(function () { setButtonLoading(btn, false); }, 20000);
    }, true);
  }

  function boot() {
    initExplicitButtonLoading();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.VendzaLoading = {
    setButtonLoading: setButtonLoading,
    wrap: wrap
  };

  window.VendzaButtonLoading = { setLoading: setButtonLoading };
})();
