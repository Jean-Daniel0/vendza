'use strict';

(function () {
  var DEFAULT_SITE = 'https://vendza.ht';

  function getBaseUrl() {
    if (window.VendzaSite && window.VendzaSite.BASE_URL) {
      return String(window.VendzaSite.BASE_URL).replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location &&
        (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      return window.location.origin;
    }
    return DEFAULT_SITE;
  }

  function stripText(value, maxLen) {
    var text = String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (maxLen && text.length > maxLen) {
      text = text.slice(0, Math.max(0, maxLen - 1)).trim() + '…';
    }
    return text;
  }

  function resolveImageUrl(product) {
    if (product.imageResolved) return product.imageResolved;
    if (product.imageUrl) return product.imageUrl;
    if (product.image_url && /^https?:\/\//i.test(product.image_url)) return product.image_url;
    if (product.image && /^https?:\/\//i.test(product.image)) return product.image;
    if (product.img && /^https?:\/\//i.test(product.img)) return product.img;
    return getBaseUrl() + '/og-default.jpg';
  }

  function productPageUrl(productId) {
    var base = getBaseUrl();
    var path = '/detail-produit';
    if (!productId) return base + path;
    return base + path + '?id=' + encodeURIComponent(String(productId));
  }

  function buildSharePayload(product) {
    var name = product.name || product.nom || product.title || product.product_name || 'Produit';
    var price = Number(product.price != null ? product.price : product.prix);
    var priceSuffix = Number.isFinite(price) && price > 0
      ? ' — ' + Math.round(price).toLocaleString('fr-FR') + ' Gdes'
      : '';
    var description = stripText(product.description, 160)
      || ('Découvrez « ' + name + ' » sur Vendza.');
    var image = resolveImageUrl(product);
    var url = productPageUrl(product.id);
    return {
      title: name + priceSuffix + ' | Vendza',
      description: description,
      image: image,
      url: url,
      type: 'product',
      siteName: 'Vendza',
      productName: name
    };
  }

  function upsertMeta(kind, key, content) {
    if (!content) return;
    var el;
    if (kind === 'property') {
      el = document.querySelector('meta[property="' + key + '"]');
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', key);
        document.head.appendChild(el);
      }
    } else if (kind === 'name') {
      el = document.querySelector('meta[name="' + key + '"]');
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', key);
        document.head.appendChild(el);
      }
    }
    if (el) el.setAttribute('content', content);
  }

  function applyProductMeta(product) {
    if (!product) return null;
    var meta = buildSharePayload(product);
    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('property', 'og:site_name', meta.siteName);
    upsertMeta('property', 'og:type', meta.type);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:image', meta.image);
    upsertMeta('property', 'og:url', meta.url);
    upsertMeta('property', 'og:locale', 'fr_HT');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:image', meta.image);

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', meta.url);
    return meta;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('clipboard unavailable'));
  }

  function shareProduct(product, options) {
    options = options || {};
    var meta = applyProductMeta(product);
    if (!meta) return Promise.resolve({ ok: false });

    var shareData = {
      title: meta.productName,
      text: meta.description,
      url: meta.url
    };

    if (navigator.share) {
      return navigator.share(shareData).then(function () {
        return { ok: true, method: 'native', url: meta.url };
      }).catch(function (err) {
        if (err && err.name === 'AbortError') {
          return { ok: false, cancelled: true };
        }
        return copyText(meta.url).then(function () {
          return { ok: true, method: 'clipboard', url: meta.url };
        });
      });
    }

    return copyText(meta.url).then(function () {
      return { ok: true, method: 'clipboard', url: meta.url };
    });
  }

  window.VendzaShare = {
    getBaseUrl: getBaseUrl,
    productPageUrl: productPageUrl,
    buildSharePayload: buildSharePayload,
    applyProductMeta: applyProductMeta,
    shareProduct: shareProduct
  };
})();
