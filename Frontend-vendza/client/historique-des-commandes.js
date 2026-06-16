'use strict';

document.addEventListener('DOMContentLoaded', async function () {
  function finishLoad() {}
  var COMMANDES = [];
  var currentTab = '';

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function readLocalUser() {
    try { return JSON.parse(localStorage.getItem('vendza_user_data') || 'null'); } catch (_) { return null; }
  }

  function fmt(n) {
    return 'HTG ' + Number(n || 0).toLocaleString('fr-FR');
  }

  function fmtDate(d) {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtTime(d) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function showToast(msg) {
    var t = document.getElementById('hist-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function clientConfirmed(row) {
    return Boolean(row.client_confirmed || row.reception_confirmed || row.buyer_confirmed);
  }

  function mapStatut(row) {
    var s = String(row.status || row.order_status || row.state || '').toLowerCase();
    if (['cancelled', 'canceled', 'annulee', 'annule', 'refused', 'refusee'].indexOf(s) >= 0) return 'annulee';
    if (clientConfirmed(row)) return 'livree';
    if (['pending', 'attente', 'en_attente', 'waiting', 'new'].indexOf(s) >= 0) return 'attente';
    if (['payee', 'paid', 'validated', 'en_cours', 'processing', 'delivered', 'livree', 'shipped', 'confirmed'].indexOf(s) >= 0) return 'payee';
    return 'payee';
  }

  function statusLabel(s) {
    var map = { livree: '✓ Livrée', payee: '⚡ En cours', attente: '⏳ En attente', annulee: '✕ Annulée' };
    return map[s] || s;
  }

  function parseProduits(row, items) {
    if (items && items.length) {
      return items.map(function (it) {
        return {
          nom: it.name || it.product_name || it.nom || 'Produit',
          emoji: '📦',
          qte: Math.max(1, parseInt(it.quantity || it.qte || it.qty || 1, 10) || 1)
        };
      });
    }
    return [{
      nom: row.product_name || row.title || row.item_name || 'Commande',
      emoji: '📦',
      qte: Math.max(1, parseInt(row.quantity || row.qty || 1, 10) || 1)
    }];
  }

  function mapOrder(row, index) {
    var items = window.VendzaOrderPrices ? window.VendzaOrderPrices.parseOrderItems(row) : [];
    var total = window.VendzaOrderPrices
      ? window.VendzaOrderPrices.orderTotal(row, items)
      : Number(row.total_amount ?? row.total ?? row.amount ?? row.price ?? 0);
    var date = new Date(row.created_at || row.date || Date.now());
    var statut = mapStatut(row);
    var id = String(row.id || '');
    return {
      id: id,
      shortId: '#' + String(index + 1).padStart(4, '0'),
      vendeur: row.vendor_name || row.vendor || row.seller_name || 'Vendeur',
      date: date,
      total: total,
      statut: statut,
      produits: parseProduits(row, items),
      raw: row
    };
  }

  function render() {
    var list = document.getElementById('commandes-list');
    if (!list) return;

    var search = (document.getElementById('search-input') || {}).value || '';
    search = search.toLowerCase();
    var periode = parseInt((document.getElementById('filter-periode') || {}).value, 10) || 0;
    var sort = (document.getElementById('filter-sort') || {}).value || 'recent';
    var now = new Date();

    var data = COMMANDES.filter(function (c) {
      var matchTab = !currentTab || c.statut === currentTab;
      var matchSearch = !search ||
        c.vendeur.toLowerCase().indexOf(search) >= 0 ||
        c.id.toLowerCase().indexOf(search) >= 0 ||
        c.produits.some(function (p) { return p.nom.toLowerCase().indexOf(search) >= 0; });
      var matchPeriode = !periode || (now - c.date) / 86400000 <= periode;
      return matchTab && matchSearch && matchPeriode;
    });

    if (sort === 'ancien') data.sort(function (a, b) { return a.date - b.date; });
    else if (sort === 'total-desc') data.sort(function (a, b) { return b.total - a.total; });
    else data.sort(function (a, b) { return b.date - a.date; });

    var total = COMMANDES.length;
    var livrees = COMMANDES.filter(function (c) { return c.statut === 'livree'; }).length;
    var depenses = COMMANDES.reduce(function (a, c) { return a + c.total; }, 0);

    var elTotal = document.getElementById('stat-total');
    var elLivrees = document.getElementById('stat-livrees');
    var elDepenses = document.getElementById('stat-depenses');
    if (elTotal) elTotal.textContent = String(total);
    if (elLivrees) elLivrees.textContent = String(livrees);
    if (elDepenses) elDepenses.textContent = depenses.toLocaleString('fr-FR');

    var tabs = { all: total, livree: 0, payee: 0, attente: 0, annulee: 0 };
    COMMANDES.forEach(function (c) {
      if (tabs[c.statut] !== undefined) tabs[c.statut] += 1;
    });
    var tabAll = document.getElementById('tab-all');
    var tabLivree = document.getElementById('tab-livree');
    var tabPayee = document.getElementById('tab-payee');
    var tabAttente = document.getElementById('tab-attente');
    var tabAnnulee = document.getElementById('tab-annulee');
    if (tabAll) tabAll.textContent = String(total);
    if (tabLivree) tabLivree.textContent = String(tabs.livree);
    if (tabPayee) tabPayee.textContent = String(tabs.payee);
    if (tabAttente) tabAttente.textContent = String(tabs.attente);
    if (tabAnnulee) tabAnnulee.textContent = String(tabs.annulee);

    if (!data.length) {
      list.innerHTML =
        '<div class="empty">' +
        '<div class="empty-icon">📦</div>' +
        '<h3>Aucune commande trouvée</h3>' +
        '<p>Essayez d\'ajuster vos filtres ou explorez le catalogue.</p>' +
        '<a class="btn-shop" href="../index.html">🛍️ Explorer le catalogue</a>' +
        '</div>';
      return;
    }

    list.innerHTML = data.map(function (c, i) {
      var articleCount = c.produits.reduce(function (a, p) { return a + p.qte; }, 0);
      var actions =
        '<button type="button" class="btn-act btn-ticket" data-ticket="' + c.id + '">🎟️ Voir le ticket</button>';
      if (c.statut !== 'livree' && c.statut !== 'annulee') {
        actions += '<button type="button" class="btn-act btn-scan" data-scan="' + c.id + '">📱 Scanner QR</button>';
      }
      if (c.statut === 'livree') {
        actions += '<button type="button" class="btn-act btn-reorder" data-reorder="' + c.id + '">🔁 Recommander</button>';
      }

      return (
        '<div class="cmd-card ' + c.statut + '" style="animation:histFadeUp .4s ' + (i * 0.08) + 's ease both">' +
        '<div class="cmd-main">' +
        '<div class="cmd-top">' +
        '<div class="cmd-left">' +
        '<div class="cmd-id" title="' + c.id + '">' + c.shortId + ' · ' + c.id.substring(0, 8) + '…</div>' +
        '<div class="cmd-title">' + c.produits.map(function (p) { return p.nom; }).join(', ') + '</div>' +
        '<div class="cmd-vendeur">🏪 ' + c.vendeur + '</div>' +
        '</div>' +
        '<div class="cmd-right">' +
        '<div class="cmd-total">' + fmt(c.total) + '</div>' +
        '<div class="cmd-status s-' + c.statut + '">' + statusLabel(c.statut) + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="cmd-meta">' +
        '<span>📅 ' + fmtDate(c.date) + '</span>' +
        '<span>🕐 ' + fmtTime(c.date) + '</span>' +
        '<span>📦 ' + articleCount + ' article' + (articleCount > 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div class="cmd-products">' +
        c.produits.map(function (p) {
          return '<div class="prod-chip"><span class="prod-emoji">' + p.emoji + '</span><span>' + p.nom + ' × ' + p.qte + '</span></div>';
        }).join('') +
        '</div>' +
        '<div class="cmd-actions">' + actions + '</div>' +
        '</div></div>'
      );
    }).join('');

    list.querySelectorAll('[data-ticket]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.href = window.VZ ? window.VZ.url('clientTicket', 'id=' + encodeURIComponent(btn.getAttribute('data-ticket'))) : 'vendza-ticket.html?id=' + encodeURIComponent(btn.getAttribute('data-ticket'));
      });
    });
    list.querySelectorAll('[data-scan]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.href = window.VZ ? window.VZ.url('clientConfirmation', 'id=' + encodeURIComponent(btn.getAttribute('data-scan'))) : 'confirmation.html?id=' + encodeURIComponent(btn.getAttribute('data-scan'));
      });
    });
    list.querySelectorAll('[data-reorder]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showToast('🛍️ Redirection vers le catalogue…');
        setTimeout(function () { window.location.href = window.VZ ? window.VZ.url('home') : '../index.html'; }, 800);
      });
    });
  }

  function setTab(el, tab) {
    document.querySelectorAll('.stab').forEach(function (t) { t.classList.remove('active'); });
    if (el) el.classList.add('active');
    currentTab = tab;
    render();
  }

  async function fetchOrders(client, uid) {
    if (!client || !uid) return [];
    var filter =
      'buyer_id.eq.' + uid +
      ',client_id.eq.' + uid +
      ',user_id.eq.' + uid +
      ',customer_id.eq.' + uid;
    try {
      var grouped = await client
        .from('orders')
        .select('*')
        .or(filter)
        .order('created_at', { ascending: false });
      if (!grouped.error && Array.isArray(grouped.data) && grouped.data.length) {
        return grouped.data;
      }
    } catch (_) {}

    var buyerCols = ['buyer_id', 'client_id', 'customer_id', 'user_id'];
    var merged = [];
    var seen = {};
    var lastError = null;
    for (var i = 0; i < buyerCols.length; i += 1) {
      try {
        var resp = await client
          .from('orders')
          .select('*')
          .eq(buyerCols[i], uid)
          .order('created_at', { ascending: false });
        if (resp.error) {
          lastError = resp.error;
          continue;
        }
        if (!Array.isArray(resp.data)) continue;
        resp.data.forEach(function (row) {
          var key = String(row.id || '');
          if (!key || seen[key]) return;
          seen[key] = true;
          merged.push(row);
        });
      } catch (err) {
        lastError = err;
      }
    }
    merged.sort(function (a, b) {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    if (!merged.length && lastError) {
      console.warn('[historique commandes]', lastError.message || lastError);
    }
    return merged;
  }

  var tabsEl = document.getElementById('status-tabs');
  if (tabsEl) {
    tabsEl.querySelectorAll('.stab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTab(btn, btn.getAttribute('data-tab') || '');
      });
    });
  }

  var searchInput = document.getElementById('search-input');
  var filterPeriode = document.getElementById('filter-periode');
  var filterSort = document.getElementById('filter-sort');
  if (searchInput) searchInput.addEventListener('input', render);
  if (filterPeriode) filterPeriode.addEventListener('change', render);
  if (filterSort) filterSort.addEventListener('change', render);

  var client = getClient();
  var userLocal = readLocalUser();
  var uid = userLocal && userLocal.id ? userLocal.id : '';

  if (client && client.auth) {
    try {
      var auth = await client.auth.getUser();
      var user = auth && auth.data && auth.data.user;
      if (user && user.id) uid = user.id;
    } catch (_) {}
  }

  if (!uid) {
    var list = document.getElementById('commandes-list');
    if (list) {
      list.innerHTML =
        '<div class="empty"><div class="empty-icon">🔒</div>' +
        '<h3>Connexion requise</h3>' +
        '<p>Connectez-vous pour voir vos commandes.</p>' +
        '<a class="btn-shop" href="../authentification/connexion.html">Se connecter</a></div>';
    }
    finishLoad();
    return;
  }

  if (client) {
    var rows = await fetchOrders(client, uid);
    COMMANDES = rows.map(function (row, idx) { return mapOrder(row, idx); });
  } else {
    var listNoClient = document.getElementById('commandes-list');
    if (listNoClient) {
      listNoClient.innerHTML =
        '<div class="empty"><div class="empty-icon">⚠️</div>' +
        '<h3>Service indisponible</h3>' +
        '<p>Impossible de charger Supabase. Réessayez plus tard.</p></div>';
    }
    finishLoad();
    return;
  }

  render();
  finishLoad();
});
