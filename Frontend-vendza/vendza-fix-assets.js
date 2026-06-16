'use strict';

/**
 * Corrige les href/src relatifs quand la page est servie via une URL propre (/panier, /tableau-de-bord…).
 * À placer en fin de <head>, après les <link rel="stylesheet">.
 */
(function () {
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
    livraison: 'vendeur/livraison.html',
    'creer-produit': 'vendeur/produit.html',
    confirmation: 'client/confirmation.html',
    scanner: 'client/confirmation.html',
    ticket: 'client/vendza-ticket.html',
    'ticket-commande': 'client/vendza-ticket.html',
    'ticket-vendeur': 'vendeur/vendza-ticket.html',
    'code-qr': 'vendeur/codeQRpage.html',
    'qr-commande': 'vendeur/codeQRpage.html',
    conditions: 'conditions-utilisation.html',
    'conditions-utilisation': 'conditions-utilisation.html',
    confidentialite: 'politique-confidentialite.html',
    'politique-confidentialite': 'politique-confidentialite.html'
  };

  var FILE_CANONICAL = {
    'vendeur/abonnement.html': 'vendeur/Abonnement.html'
  };

  function canonicalFile(path) {
    var p = String(path || '').replace(/^\/+/, '').replace(/\\/g, '/');
    var key = p.toLowerCase();
    return FILE_CANONICAL[key] || p;
  }

  function isFileProtocol() {
    return window.location.protocol === 'file:';
  }

  function resolveCurrentPageFile() {
    var bare = String(window.location.pathname || '')
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '');
    if (!bare) return 'index.html';
    var segment = bare.indexOf('/') >= 0 ? bare.split('/').pop() : bare;
    if (/\.[a-z0-9]+$/i.test(segment)) return canonicalFile(bare);
    var key = segment.toLowerCase();
    if (SLUG_ALIASES[key]) return SLUG_ALIASES[key];
    return canonicalFile(segment + '.html');
  }

  function splitHref(raw) {
    var href = String(raw || '').trim();
    if (!href || href === '#') return { path: '', query: '', hash: '' };
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
    return { path: href, query: query, hash: hash };
  }

  function toRootUrl(rawHref) {
    if (!rawHref) return rawHref;
    if (/^(https?:|\/\/|data:|mailto:|tel:|javascript:|#)/i.test(rawHref)) return rawHref;
    if (rawHref.charAt(0) === '/') return rawHref;

    var parts = splitHref(rawHref);
    var path = parts.path;
    if (!path) return rawHref;

    var file = resolveCurrentPageFile();
    var dirParts = file.split('/').filter(Boolean);
    dirParts.pop();

    var segments = path.split('/');
    var resolved = dirParts.slice();
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (!seg || seg === '.') continue;
      if (seg === '..') resolved.pop();
      else resolved.push(canonicalFile(seg));
    }

    return '/' + resolved.join('/') + parts.query + parts.hash;
  }

  function fixAttribute(el, attr) {
    var raw = el.getAttribute(attr);
    if (!raw) return;
    var fixed = toRootUrl(raw);
    if (fixed && fixed !== raw) el.setAttribute(attr, fixed);
  }

  if (isFileProtocol()) {
    return;
  }

  document.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (el) {
    fixAttribute(el, 'href');
  });

  document.querySelectorAll('script[src]').forEach(function (el) {
    fixAttribute(el, 'src');
  });
})();
