'use strict';

(function () {
  var ROUTES = {
    home: 'index.html',
    about: 'a-propos.html',
    product: 'detail-produit.html',
    login: 'authentification/connexion.html',
    signup: 'authentification/inscription.html',
    cart: '/client/panier',
    clientDashboard: 'client/tableau-de-bord-client.html',
    clientProfile: 'client/profil-client.html',
    clientOrders: 'client/historique-des-commandes.html',
    clientMessages: 'client/mes-messages.html',
    clientConfirmation: 'client/confirmation.html',
    clientTicket: 'client/vendza-ticket.html',
    vendorDashboard: 'vendeur/tableau-de-bord-vendeur.html',
    vendorProfile: 'vendeur/profil-vendeur.html',
    vendorProducts: 'vendeur/mes-produit.html',
    vendorInbox: 'vendeur/boite-de-reception-vendeur.html',
    vendorOrders: 'vendeur/commande-recu.html',
    vendorSubscription: 'vendeur/Abonnement.html',
    vendorProductEdit: 'vendeur/produit.html',
    vendorDelivery: 'vendeur/livraison.html',
    vendorQr: 'vendeur/codeQRpage.html',
    vendorTicket: 'vendeur/vendza-ticket.html',
    publicVendorProfile: 'client/profil-vendeur.html',
    conditions: 'conditions-utilisation.html',
    privacy: 'politique-confidentialite.html',
    admin: 'admin/admin.html'
  };

  var SLUG_ALIASES = {
    accueil: 'index.html',
    index: 'index.html',
    'a-propos': 'a-propos.html',
    'detail-produit': 'detail-produit.html',
    produit: 'detail-produit.html',
    panier: '/client/panier',
    connexion: 'authentification/connexion.html',
    inscription: 'authentification/inscription.html',
    'profil-client': 'client/profil-client.html',
    'tableau-de-bord-client': 'client/tableau-de-bord-client.html',
    'historique-commandes': 'client/historique-des-commandes.html',
    'historique-des-commandes': 'client/historique-des-commandes.html',
    'mes-messages': 'client/mes-messages.html',
    'profil-vendeur': 'client/profil-vendeur.html',
    'mon-profil-vendeur': 'vendeur/profil-vendeur.html',
    'tableau-de-bord': 'vendeur/tableau-de-bord-vendeur.html',
    'tableau-de-bord-vendeur': 'vendeur/tableau-de-bord-vendeur.html',
    'mes-produits': 'vendeur/mes-produit.html',
    'mes-produit': 'vendeur/mes-produit.html',
    'boite-reception': 'vendeur/boite-de-reception-vendeur.html',
    'commandes-recues': 'vendeur/commande-recu.html',
    'commande-recu': 'vendeur/commande-recu.html',
    abonnement: 'vendeur/Abonnement.html',
    'conditions-utilisation': 'conditions-utilisation.html',
    conditions: 'conditions-utilisation.html',
    'politique-confidentialite': 'politique-confidentialite.html',
    confidentialite: 'politique-confidentialite.html',
    livraison: 'vendeur/livraison.html',
    'creer-produit': 'vendeur/produit.html',
    confirmation: 'client/confirmation.html',
    scanner: 'client/confirmation.html',
    ticket: 'client/vendza-ticket.html',
    'ticket-commande': 'client/vendza-ticket.html',
    'ticket-vendeur': 'vendeur/vendza-ticket.html',
    'code-qr': 'vendeur/codeQRpage.html',
    'qr-commande': 'vendeur/codeQRpage.html',
    admin: 'admin/admin.html'
  };

  var FILE_CANONICAL = {
    'vendeur/abonnement.html': 'vendeur/Abonnement.html'
  };

  var ASSET_EXT = /\.(css|js|mjs|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map|json)$/i;

  /** Pages à la racine du site (pas relatives au dossier vendeur/client courant). */
  var SITE_ROOT_HTML = {
    'index.html': '/',
    'a-propos.html': '/a-propos',
    'conditions-utilisation.html': '/conditions-utilisation',
    'politique-confidentialite.html': '/politique-confidentialite',
    'detail-produit.html': '/detail-produit'
  };

  function splitHref(raw) {
    var href = String(raw || '').trim();
    if (!href || href === '#') return { href: href, path: '', query: '', hash: '' };
    var hash = '';
    var hashIdx = href.indexOf('#');
    if (hashIdx >= 0) {
      hash = href.slice(hashIdx);
      href = href.slice(0, hashIdx);
    }
    var query = '';
    var qIdx = href.indexOf('?');
    if (qIdx >= 0) {
      query = href.slice(qIdx);
      href = href.slice(0, qIdx);
    }
    return { href: raw, path: href, query: query, hash: hash };
  }

  function canonicalFile(path) {
    var p = String(path || '').replace(/^\/+/, '').replace(/\\/g, '/');
    var key = p.toLowerCase();
    if (FILE_CANONICAL[key]) return FILE_CANONICAL[key];
    return p;
  }

  function slugToFile(slug) {
    var s = String(slug || '').replace(/^\/+/, '').replace(/\/+$/, '');
    if (!s) return 'index.html';
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(s)) return s;
    if (s.indexOf('..') >= 0) return s;
    if (/\.[a-z0-9]+$/i.test(s)) return canonicalFile(s);
    var key = s.toLowerCase();
    if (SLUG_ALIASES[key]) return SLUG_ALIASES[key];
    if (ROUTES[key]) return ROUTES[key];
    return canonicalFile(s + '.html');
  }

  function pathnameOnly() {
    return String(window.location.pathname || '').replace(/\\/g, '/');
  }

  function resolveCurrentPageFile() {
    var bare = pathnameOnly().replace(/^\/+/, '').split('?')[0].replace(/\/+$/, '');
    if (!bare) return 'index.html';
    if (/\.[a-z0-9]+$/i.test(bare)) return canonicalFile(bare);
    var key = bare.toLowerCase();
    if (SLUG_ALIASES[key]) return SLUG_ALIASES[key];
    return slugToFile(bare);
  }

  function getRootPrefix() {
    var path = pathnameOnly();
    var marker = '/frontend-vendza/';
    var idx = path.toLowerCase().indexOf(marker);
    if (idx !== -1) {
      var inside = path.slice(idx + marker.length).replace(/^\/+/, '');
      if (!inside) return '';
      var parts = inside.split('/').filter(Boolean);
      var last = parts[parts.length - 1] || '';
      var depth = parts.length - (/\.[a-z0-9]+$/i.test(last) ? 1 : 0);
      return depth > 0 ? '../'.repeat(depth) : '';
    }

    var file = resolveCurrentPageFile();
    var parts = file.split('/').filter(Boolean);
    if (parts.length <= 1) return '';
    return '../'.repeat(parts.length - 1);
  }

  function isRootRelativePath(path) {
    return path.indexOf('/') >= 0 && path.indexOf('..') < 0;
  }

  function isAssetPath(path) {
    return ASSET_EXT.test(String(path || '').split('?')[0]);
  }

  /** Fichier physique → URL publique Netlify (/_redirects). */
  function filePathToPublicUrl(filePath, query, hash) {
    var f = canonicalFile(String(filePath || '').replace(/^\/+/, ''));
    var key = f.toLowerCase();
    query = query || '';
    hash = hash || '';

    if (SITE_ROOT_HTML[key]) {
      return SITE_ROOT_HTML[key] + query + hash;
    }

    var slug;
    for (slug in SLUG_ALIASES) {
      if (SLUG_ALIASES[slug].toLowerCase() === key) {
        if (slug === 'index' || slug === 'accueil') return '/' + query + hash;
        return '/' + slug + query + hash;
      }
    }

    return '/' + f + query + hash;
  }

  function resolveToFilePath(rawHref) {
    var parts = splitHref(rawHref);
    var path = parts.path;
    if (!path) return { file: '', query: parts.query, hash: parts.hash };

    if (path.indexOf('..') < 0 && path.indexOf('/') < 0 && SITE_ROOT_HTML[canonicalFile(path).toLowerCase()]) {
      return {
        file: canonicalFile(path),
        query: parts.query,
        hash: parts.hash
      };
    }

    var pageFile = resolveCurrentPageFile();
    var dirParts = pageFile.split('/').filter(Boolean);
    dirParts.pop();

    if (path.charAt(0) === '/') {
      return {
        file: slugToFile(path.slice(1)),
        query: parts.query,
        hash: parts.hash
      };
    }

    var segments = path.split('/');
    var resolved = dirParts.slice();
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (!seg || seg === '.') continue;
      if (seg === '..') resolved.pop();
      else resolved.push(canonicalFile(seg));
    }
    return {
      file: resolved.join('/'),
      query: parts.query,
      hash: parts.hash
    };
  }

  function resolveToRootUrl(rawHref) {
    var r = resolveToFilePath(rawHref);
    if (!r.file) return rawHref;
    return '/' + r.file.replace(/^\/+/, '') + r.query + r.hash;
  }

  function fixAsset(rawHref) {
    var parts = splitHref(rawHref);
    var path = parts.path;
    if (!path || path === '#') return parts.href;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(path)) return parts.href;
    return resolveToRootUrl(rawHref);
  }

  function fixNav(rawHref) {
    var parts = splitHref(rawHref);
    var path = parts.path;
    if (!path || path === '#') return parts.href;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(path)) return parts.href;

    var r = resolveToFilePath(rawHref);
    if (!r.file) return parts.href;

    if (isAssetPath(r.file)) {
      return '/' + r.file + r.query + r.hash;
    }

    return filePathToPublicUrl(r.file, r.query, r.hash);
  }

  function fix(rawHref) {
    var parts = splitHref(rawHref);
    var path = parts.path;
    if (!path || path === '#') return parts.href;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(path)) return parts.href;
    if (isAssetPath(path)) return fixAsset(rawHref);
    return fixNav(rawHref);
  }

  function page(routeKeyOrPath, query) {
    var base = ROUTES[routeKeyOrPath] || routeKeyOrPath;
    var url = fix(base);
    if (query) {
      var q = String(query).replace(/^\?/, '');
      if (q) url += (url.indexOf('?') >= 0 ? '&' : '?') + q;
    }
    return url;
  }

  function productDetailHref(productId) {
    return page('product', productId ? 'id=' + encodeURIComponent(productId) : '');
  }

  function productDetailPath(productId) {
    var q = productId ? '?id=' + encodeURIComponent(productId) : '';
    return '/detail-produit' + q;
  }

  function go(target, query) {
    window.location.href = page(target, query);
  }

  function loginHref(redirectPath) {
    if (!redirectPath) return page('login');
    return page('login', 'redirect=' + encodeURIComponent(String(redirectPath).replace(/^\//, '')));
  }

  window.VendzaUrls = {
    ROUTES: ROUTES,
    SLUG_ALIASES: SLUG_ALIASES,
    getRootPrefix: getRootPrefix,
    resolveCurrentPageFile: resolveCurrentPageFile,
    fix: fix,
    fixNav: fixNav,
    fixAsset: fixAsset,
    filePathToPublicUrl: filePathToPublicUrl,
    patchDomNavigation: patchDomNavigation,
    page: page,
    href: page,
    productDetailHref: productDetailHref,
    productDetailPath: productDetailPath,
    loginHref: loginHref,
    go: go
  };

  window.VZ = {
    url: page,
    go: go,
    login: loginHref,
    product: productDetailHref
  };

  function patchDomNavigation(root) {
    root = root || document;
    root.querySelectorAll('a[href]').forEach(function (el) {
      var raw = el.getAttribute('href');
      if (!raw || /^(https?:|mailto:|tel:|javascript:|#)/i.test(raw)) return;
      var fixed = fixNav(raw);
      if (fixed && fixed !== raw) el.setAttribute('href', fixed);
    });
    root.querySelectorAll('form[action]').forEach(function (form) {
      var raw = form.getAttribute('action');
      if (!raw || /^(https?:|mailto:|tel:|javascript:|#)/i.test(raw)) return;
      var fixed = fixNav(raw);
      if (fixed && fixed !== raw) form.setAttribute('action', fixed);
    });
  }

  if (!window.__vendzaNavFixBoot) {
    window.__vendzaNavFixBoot = true;

    function observeDynamicLinks() {
      if (!window.MutationObserver || !document.body) return;
      var timer = null;
      var obs = new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () { patchDomNavigation(); }, 50);
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }

    function bootNavFix() {
      patchDomNavigation();
      observeDynamicLinks();
      document.addEventListener('vendza:auth', function () {
        patchDomNavigation();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootNavFix);
    } else {
      bootNavFix();
    }
  }
})();
