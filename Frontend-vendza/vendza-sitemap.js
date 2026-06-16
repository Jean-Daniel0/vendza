'use strict';

(function () {
  function siteBase() {
    if (window.VendzaSite && window.VendzaSite.BASE_URL) {
      return String(window.VendzaSite.BASE_URL).replace(/\/+$/, '');
    }
    return String(window.location.origin || '').replace(/\/+$/, '');
  }

  function productCanonicalUrl(productId) {
    return siteBase() + '/detail-produit?id=' + encodeURIComponent(String(productId));
  }

  function sitemapEndpoints() {
    return ['/sitemap.xml', '/.netlify/functions/sitemap'];
  }

  async function refreshSitemapCache() {
    var endpoints = sitemapEndpoints();
    var i;
    for (i = 0; i < endpoints.length; i += 1) {
      try {
        await fetch(endpoints[i] + '?refresh=1', { method: 'GET', cache: 'no-store' });
      } catch (_) {}
    }
  }

  function pingSearchEngines() {
    var sitemapLoc = encodeURIComponent(siteBase() + '/sitemap.xml');
    var engines = [
      'https://www.google.com/ping?sitemap=' + sitemapLoc,
      'https://www.bing.com/ping?sitemap=' + sitemapLoc
    ];
    engines.forEach(function (url) {
      try {
        fetch(url, { mode: 'no-cors', keepalive: true });
      } catch (_) {}
    });
  }

  /**
   * Appelé après publication d'un produit : rafraîchit le sitemap (tous les produits)
   * et signale aux moteurs qu'une URL catalogue a été mise à jour.
   */
  async function notifyProductPublished(productId) {
    await refreshSitemapCache();
    pingSearchEngines();
    if (!productId) return { ok: true };
    return { ok: true, url: productCanonicalUrl(productId) };
  }

  window.VendzaSitemap = {
    notifyProductPublished: notifyProductPublished,
    refreshSitemapCache: refreshSitemapCache,
    productCanonicalUrl: productCanonicalUrl
  };
})();
