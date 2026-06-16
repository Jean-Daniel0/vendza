'use strict';

(function () {
  var allOrders = [];
  var currentTab = '';
  var qrInstance = null;
  var currentUid = '';

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function readLocalUser() {
    try { return JSON.parse(localStorage.getItem('vendza_user_data') || 'null'); } catch (_) { return null; }
  }

  function fmt(n) {
    var num = Number(n || 0);
    return num.toLocaleString('fr-FR') + ' Gdes';
  }

  function fmtDate(d) {
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return '—'; }
  }

  function fmtTime(d) {
    try {
      return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return ''; }
  }

  function pickFirst(row, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var v = row[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }

  function mapUiStatus(status) {
    var s = String(status || '').toLowerCase();
    if (['paid', 'completed', 'validated', 'success'].indexOf(s) >= 0) return 'paid';
    if (['cancelled', 'canceled', 'cancel', 'annulee', 'annule'].indexOf(s) >= 0) return 'cancel';
    if (['delivered', 'livree', 'livre', 'shipped'].indexOf(s) >= 0) return 'paid';
    return 'pending';
  }

  function statusLabelHtml(ui) {
    if (ui === 'paid') return '<span class="cr-cmd-status paid"><span class="dot"></span>Payée</span>';
    if (ui === 'pending') return '<span class="cr-cmd-status pending"><span class="dot"></span>En attente</span>';
    return '<span class="cr-cmd-status cancel"><span class="dot"></span>Annulée</span>';
  }

  function parseItems(row) {
    if (window.VendzaOrderPrices) return window.VendzaOrderPrices.parseOrderItems(row);
    var name = pickFirst(row, ['product_name', 'title', 'item_name']) || 'Produit';
    var qte = Math.max(1, parseInt(row.quantity || row.qty || 1, 10) || 1);
    var unit = Number(row.unit_price ?? row.price ?? 0);
    var total = Number(row.total_amount ?? row.total ?? row.amount ?? 0);
    if (!unit && total > 0) unit = total / qte;
    return [{ nom: name, qte: qte, prix: unit }];
  }

  function mapOrder(row) {
    var client = pickFirst(row, ['client_name', 'buyer_name', 'customer_name', 'client_full_name', 'buyer_full_name']);
    var produits = parseItems(row);
    var total = window.VendzaOrderPrices
      ? window.VendzaOrderPrices.orderTotal(row, produits)
      : Number(row.total_amount ?? row.total ?? row.amount ?? row.price ?? 0);
    if (!total && produits.length) {
      total = produits.reduce(function (s, p) { return s + p.prix * p.qte; }, 0);
    }
    return {
      id: row.id || row.order_id || '',
      statut: mapUiStatus(row.status || row.order_status || row.state),
      rawStatus: row.status || row.order_status || 'pending',
      client: client || 'Client',
      date: row.created_at || row.date || new Date().toISOString(),
      total: total,
      produits: produits
    };
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  async function fetchVendorOrders(client, uid) {
    var cols = ['vendor_id', 'seller_id', 'owner_id', 'user_id'];
    var i;
    for (i = 0; i < cols.length; i += 1) {
      try {
        var resp = await client.from('orders').select('*').eq(cols[i], uid).order('created_at', { ascending: false }).limit(200);
        if (!resp.error && Array.isArray(resp.data) && resp.data.length) return resp.data.map(mapOrder);
      } catch (_) {}
    }
    return [];
  }

  async function adaptiveUpdateOrder(client, orderId, status) {
    var body = { status: status, order_status: status };
    var keys = Object.keys(body);
    var k;
    for (k = 0; k < keys.length; k += 1) {
      try {
        var payload = {};
        payload[keys[k]] = body[keys[k]];
        var resp = await client.from('orders').update(payload).eq('id', orderId);
        if (!resp.error) return { ok: true };
      } catch (_) {}
    }
    return { ok: false };
  }

  function monthRevenue(orders) {
    var now = new Date();
    return orders.filter(function (c) {
      var d = new Date(c.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && c.statut === 'paid';
    }).reduce(function (s, c) { return s + (Number(c.total) || 0); }, 0);
  }

  function updateStats() {
    var paid = allOrders.filter(function (c) { return c.statut === 'paid'; }).length;
    var pending = allOrders.filter(function (c) { return c.statut === 'pending'; }).length;
    var cancel = allOrders.filter(function (c) { return c.statut === 'cancel'; }).length;

    function set(id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(v);
    }

    set('stat-total', allOrders.length);
    set('stat-paid', paid);
    set('stat-pending', pending);
    set('stat-revenue', monthRevenue(allOrders).toLocaleString('fr-FR'));
    set('tab-all', allOrders.length);
    set('tab-paid', paid);
    set('tab-pending', pending);
    set('tab-cancel', cancel);

    var sb = document.getElementById('sb-count');
    if (sb) {
      if (allOrders.length > 0) {
        sb.hidden = false;
        sb.textContent = allOrders.length > 99 ? '99+' : String(allOrders.length);
      } else {
        sb.hidden = true;
      }
    }
  }

  function getFiltered() {
    var search = (document.getElementById('search-input').value || '').toLowerCase().trim();
    var days = parseInt(document.getElementById('filter-periode').value || '0', 10);
    var from = days > 0 ? new Date() : null;
    if (from) from.setDate(from.getDate() - days);

    return allOrders.filter(function (c) {
      if (currentTab && c.statut !== currentTab) return false;
      if (from && new Date(c.date) < from) return false;
      if (search) {
        var hay = [c.client, c.id].concat(c.produits.map(function (p) { return p.nom; })).join(' ').toLowerCase();
        if (hay.indexOf(search) < 0) return false;
      }
      return true;
    });
  }

  function renderCommandes() {
    var list = document.getElementById('commandes-list');
    if (!list) return;
    var filtered = getFiltered();

    if (!filtered.length) {
      list.innerHTML = '<div class="cr-empty"><div class="cr-empty-icon">📭</div><h3>Aucune commande trouvée</h3><p>Essayez d\'ajuster vos filtres</p></div>';
      return;
    }

    list.innerHTML = filtered.map(function (c, i) {
      var idShort = c.id ? ('#' + String(c.id).replace(/-/g, '').slice(0, 8).toUpperCase()) : '#—';
      var productsHtml = c.produits.map(function (p) {
        return '<div class="cr-product-line"><div><div class="cr-pname">' + escapeHtml(p.nom) + '</div><div class="cr-pqty">Qté : ' + p.qte + ' × ' + fmt(p.prix) + '</div></div><div class="cr-pprice">' + fmt(p.prix * p.qte) + '</div></div>';
      }).join('');

      var ticketHref = window.VZ
        ? window.VZ.url('vendorTicket', 'id=' + encodeURIComponent(c.id))
        : (window.VendzaUrls
          ? window.VendzaUrls.page('vendorTicket', 'id=' + encodeURIComponent(c.id))
          : 'vendza-ticket.html?id=' + encodeURIComponent(c.id));
      var actions = '<a class="cr-btn-sm cr-btn-ticket" href="' + ticketHref + '">🎟️ Ticket complet</a>' +
        '<button type="button" class="cr-btn-sm cr-btn-qr" data-qr="' + escapeAttr(c.id) + '" data-client="' + escapeAttr(c.client) + '">⬡ QR rapide</button>' +
        '<button type="button" class="cr-btn-sm cr-btn-detail" data-toggle="' + i + '">📋 Voir articles</button>';

      if (c.statut === 'paid') {
        actions += '<button type="button" class="cr-btn-sm cr-btn-deliver" data-deliver="' + escapeAttr(c.id) + '">🚚 Marquer livré</button>';
      }
      if (c.statut === 'pending') {
        actions += '<button type="button" class="cr-btn-sm cr-btn-cancel" data-cancel="' + escapeAttr(c.id) + '">✕ Annuler</button>';
      }

      return '<article class="cr-cmd-card" style="animation-delay:' + (i * 0.06) + 's">' +
        '<div class="cr-cmd-main">' +
        '<div class="cr-cmd-left">' +
        '<div class="cr-cmd-top"><span class="cr-cmd-id" title="' + escapeAttr(c.id) + '">' + idShort + '</span>' + statusLabelHtml(c.statut) + '</div>' +
        '<div class="cr-cmd-client">' + escapeHtml(c.client) + '</div>' +
        '<div class="cr-cmd-meta"><span>📅 ' + fmtDate(c.date) + '</span><span>🕐 ' + fmtTime(c.date) + '</span>' +
        '<span>📦 ' + c.produits.length + ' article' + (c.produits.length > 1 ? 's' : '') + '</span></div>' +
        '</div>' +
        '<div class="cr-cmd-right"><div class="cr-cmd-total">' + fmt(c.total) + '</div></div>' +
        '</div>' +
        '<div class="cr-cmd-products" id="products-' + i + '">' + productsHtml + '</div>' +
        '<div class="cr-cmd-actions">' + actions + '</div>' +
        '</article>';
    }).join('');

    bindCardActions();
    if (window.VendzaUrls && typeof window.VendzaUrls.patchDomNavigation === 'function') {
      window.VendzaUrls.patchDomNavigation(list);
    }
  }

  function bindCardActions() {
    document.querySelectorAll('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = btn.getAttribute('data-toggle');
        var el = document.getElementById('products-' + idx);
        if (!el) return;
        var open = el.classList.toggle('open');
        btn.textContent = open ? '▲ Masquer articles' : '📋 Voir articles';
      });
    });

    document.querySelectorAll('[data-qr]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openQR(btn.getAttribute('data-qr'), btn.getAttribute('data-client'));
      });
    });

    document.querySelectorAll('[data-deliver]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        markDelivered(btn.getAttribute('data-deliver'));
      });
    });

    document.querySelectorAll('[data-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cancelOrder(btn.getAttribute('data-cancel'));
      });
    });
  }

  function qrUrl(orderId) {
    if (window.VZ) {
      return window.location.origin + window.VZ.url('clientConfirmation', 'id=' + encodeURIComponent(orderId));
    }
    if (window.VendzaUrls) {
      return window.location.origin + window.VendzaUrls.page('clientConfirmation', 'id=' + encodeURIComponent(orderId));
    }
    return window.location.origin + '/confirmation?id=' + encodeURIComponent(orderId);
  }

  function openQR(orderId, client) {
    if (!orderId || typeof QRCodeStyling === 'undefined') {
      window.location.href = window.VZ ? window.VZ.url('vendorQr', 'id=' + encodeURIComponent(orderId || '')) : 'codeQRpage.html?id=' + encodeURIComponent(orderId || '');
      return;
    }
    document.getElementById('modal-client').textContent = 'Client : ' + (client || '—');
    document.getElementById('modal-id').textContent = orderId;
    var box = document.getElementById('modal-qr-box');
    box.innerHTML = '';

    qrInstance = new QRCodeStyling({
      width: 180,
      height: 180,
      data: qrUrl(orderId),
      dotsOptions: { color: '#1e40af', type: 'rounded' },
      cornersSquareOptions: { color: '#0d9488', type: 'extra-rounded' },
      cornersDotOptions: { color: '#2563eb' },
      backgroundOptions: { color: '#ffffff' },
      qrOptions: { errorCorrectionLevel: 'H' }
    });
    qrInstance.append(box);

    document.getElementById('modal-dl-btn').onclick = function () {
      qrInstance.download({ name: 'vendza-qr-' + orderId, extension: 'png' });
    };

    document.getElementById('qr-modal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('qr-modal').classList.remove('open');
  }

  async function markDelivered(orderId) {
    if (!confirm('Marquer cette commande comme livrée ?')) return;
    var client = getClient();
    if (!client) return;
    var r = await adaptiveUpdateOrder(client, orderId, 'delivered');
    if (!r.ok) {
      alert('Impossible de mettre à jour le statut.');
      return;
    }
    var o = allOrders.find(function (x) { return x.id === orderId; });
    if (o) { o.statut = 'paid'; o.rawStatus = 'delivered'; }
    updateStats();
    renderCommandes();
  }

  async function cancelOrder(orderId) {
    if (!confirm('Annuler cette commande ?')) return;
    var client = getClient();
    if (!client) return;
    var r = await adaptiveUpdateOrder(client, orderId, 'cancelled');
    if (!r.ok) {
      alert('Impossible d\'annuler la commande.');
      return;
    }
    var o = allOrders.find(function (x) { return x.id === orderId; });
    if (o) { o.statut = 'cancel'; o.rawStatus = 'cancelled'; }
    updateStats();
    renderCommandes();
  }

  async function resolveUid() {
    var local = readLocalUser();
    var uid = local && local.id ? local.id : '';
    var client = getClient();
    if (client && client.auth) {
      try {
        var auth = await client.auth.getUser();
        if (auth && auth.data && auth.data.user) uid = auth.data.user.id;
      } catch (_) {}
    }
    return uid;
  }

  document.addEventListener('DOMContentLoaded', async function () {
    currentUid = await resolveUid();
    if (!currentUid) {
      window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html';
      return;
    }

    var client = getClient();
    if (client) allOrders = await fetchVendorOrders(client, currentUid);
    updateStats();
    renderCommandes();

    document.getElementById('search-input').addEventListener('input', renderCommandes);
    document.getElementById('filter-periode').addEventListener('change', renderCommandes);
    document.getElementById('btn-filter').addEventListener('click', renderCommandes);

    document.querySelectorAll('.cr-status-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.cr-status-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        currentTab = tab.getAttribute('data-tab') || '';
        renderCommandes();
      });
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('qr-modal').addEventListener('click', function (e) {
      if (e.target.id === 'qr-modal') closeModal();
    });
    document.getElementById('modal-print').addEventListener('click', function () { window.print(); });

    document.getElementById('cr-logout').addEventListener('click', async function () {
      if (!confirm('Se déconnecter ?')) return;
      try {
        if (client && client.auth) await client.auth.signOut();
      } catch (_) {}
      localStorage.removeItem('vendza_user_data');
      window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html';
    });
  });
})();
