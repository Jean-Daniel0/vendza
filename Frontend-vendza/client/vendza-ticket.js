'use strict';

document.addEventListener('DOMContentLoaded', async function () {
  var root = document.getElementById('ticket-root');
  var stateWrap = document.getElementById('ticket-state');
  var loadingEl = document.getElementById('ticket-loading');
  var errorEl = document.getElementById('ticket-error');
  var btnPrint = document.getElementById('btn-print');
  var btnDl = document.getElementById('btn-dl');
  var qrInstance = null;

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function showError(msg) {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = msg;
    }
    if (root) root.hidden = true;
  }

  function showTicket() {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) errorEl.hidden = true;
    if (stateWrap) stateWrap.style.display = 'none';
    if (root) {
      root.hidden = false;
      root.removeAttribute('hidden');
    }
  }

  function fmt(n) {
    var num = Number(n);
    if (!Number.isFinite(num)) num = 0;
    return 'HTG ' + num.toLocaleString('fr-FR');
  }

  function formatOrderDisplayId(id) {
    if (!id) return '—';
    var s = String(id).replace(/-/g, '').toUpperCase();
    if (s.length >= 8) return 'CMD-' + s.slice(0, 8);
    return '#' + String(id).slice(0, 12);
  }

  function pickFirst(row, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var v = row[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }

  function parseItems(row) {
    if (window.VendzaOrderPrices) return window.VendzaOrderPrices.parseOrderItems(row);
    var name = pickFirst(row, ['product_name', 'title', 'item_name', 'description']) || 'Produit';
    var qte = Math.max(1, parseInt(row.quantity || row.qty || 1, 10) || 1);
    var unit = Number(row.unit_price ?? row.price ?? 0);
    var total = Number(row.total_amount ?? row.total ?? row.amount ?? 0);
    if (!unit && total > 0) unit = total / qte;
    return [{ nom: name, qte: qte, prix: unit }];
  }

  function resolveStatus(row) {
    var s = String(row.status || row.order_status || row.state || '').toLowerCase();
    var validated = Boolean(row.is_validated);
    if (validated || ['paid', 'completed', 'success', 'validated', 'validee', 'livree', 'delivered', 'done'].indexOf(s) >= 0) {
      return { cls: 'payee', label: 'Commande payée' };
    }
    if (['cancelled', 'canceled', 'annulee', 'annule'].indexOf(s) >= 0) {
      return { cls: 'en-cours', label: 'Commande annulée' };
    }
    return { cls: 'en-cours', label: 'Commande en cours' };
  }

  function isOwner(row, uid) {
    var buyer = pickFirst(row, ['user_id', 'buyer_id', 'client_id', 'customer_id']);
    return buyer && String(buyer) === String(uid);
  }

  function isVendor(row, uid) {
    var vendor = pickFirst(row, ['vendor_id', 'seller_id', 'owner_id']);
    return vendor && String(vendor) === String(uid);
  }

  function isTypeOrColumnError(err) {
    var msg = String((err && err.message) || '').toLowerCase();
    return (
      msg.indexOf('invalid input syntax') >= 0 ||
      msg.indexOf('operator does not exist') >= 0 ||
      (msg.indexOf("could not find the '") >= 0 && msg.indexOf('column') >= 0)
    );
  }

  async function fetchOrder(client, orderId) {
    var resp = await client.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!resp.error && resp.data) return resp.data;
    if (resp.error && !isTypeOrColumnError(resp.error)) throw resp.error;

    var byQr = await client.from('orders').select('*').eq('qr_code', orderId).maybeSingle();
    if (!byQr.error && byQr.data) return byQr.data;
    if (byQr.error && !isTypeOrColumnError(byQr.error)) throw byQr.error;
    return null;
  }

  async function resolveClientName(client, row) {
    var fromOrder = pickFirst(row, [
      'client_name', 'client_nom', 'buyer_name', 'customer_name', 'nom_client'
    ]);
    if (fromOrder) return String(fromOrder);

    var buyerId = pickFirst(row, ['user_id', 'buyer_id', 'client_id', 'customer_id']);
    if (buyerId && client) {
      try {
        var prof = await client.from('users').select('*').eq('id', buyerId).maybeSingle();
        if (prof.data) {
          var u = prof.data;
          var name = u.full_name || u.display_name || u.name ||
            [u.first_name, u.last_name].filter(Boolean).join(' ') ||
            [u.prenom, u.nom].filter(Boolean).join(' ');
          if (name) return String(name).trim();
        }
      } catch (_) {}
    }

    return 'Client';
  }

  function isVendorPage() {
    return /\/vendeur\//i.test(window.location.pathname) ||
      new URLSearchParams(window.location.search).get('role') === 'vendeur';
  }

  function buildQr(orderRow, qrData) {
    var box = document.getElementById('qr-box');
    if (!box || typeof QRCodeStyling !== 'function') return;
    box.innerHTML = '';
    var payload = (qrData && qrData.payload) || orderRow.qr_payload || orderRow.qr_code || String(orderRow.id);
    qrInstance = new QRCodeStyling({
      width: 140,
      height: 140,
      data: payload,
      dotsOptions: { color: '#1d4ed8', type: 'rounded' },
      cornersSquareOptions: { color: '#1d4ed8', type: 'extra-rounded' },
      cornersDotOptions: { color: '#2563eb' },
      backgroundOptions: { color: '#ffffff' },
      qrOptions: { errorCorrectionLevel: 'H' }
    });
    qrInstance.append(box);
    if (btnDl) {
      btnDl.disabled = false;
      btnDl.onclick = function () {
        qrInstance.download({ name: 'vendza-ticket-' + String(orderRow.id), extension: 'png' });
      };
    }
  }

  function renderTicket(cmd, displayId) {
    var status = resolveStatus(cmd.raw || {});
    var badge = document.getElementById('status-badge');
    var statusLabel = document.getElementById('status-label');
    if (badge) {
      badge.className = 'status-badge ' + status.cls;
    }
    if (statusLabel) statusLabel.textContent = status.label;

    document.getElementById('order-num').textContent = '#' + displayId;
    var qrLabel = document.getElementById('qr-id-label');
    if (qrLabel) {
      qrLabel.textContent = displayId;
      qrLabel.title = String(cmd.raw.id || '');
    }

    var list = document.getElementById('product-list');
    if (list) {
      list.innerHTML = cmd.produits.map(function (p) {
        return (
          '<div class="product-row">' +
          '<div><div class="p-name">' + escapeHtml(p.nom) + '</div>' +
          '<div class="p-qty">Qté : ' + p.qte + ' × ' + fmt(p.prix) + '</div></div>' +
          '<div class="p-price">' + fmt(p.prix * p.qte) + '</div>' +
          '</div>'
        );
      }).join('');
    }

    document.getElementById('subtotal').textContent = fmt(cmd.subtotal);
    document.getElementById('livraison').textContent = fmt(cmd.fraisLivraison);
    document.getElementById('total').textContent = fmt(cmd.subtotal + cmd.fraisLivraison);

    var d = cmd.date instanceof Date ? cmd.date : new Date(cmd.date);
    document.getElementById('meta-date').textContent = d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    document.getElementById('meta-time').textContent = d.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('meta-client').textContent = cmd.client;
    document.getElementById('meta-livraison').textContent = cmd.livraison;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mapOrderToTicket(row, clientName, produitsOverride) {
    var produits = produitsOverride || parseItems(row);
    var subtotal = produits.reduce(function (sum, p) { return sum + p.prix * p.qte; }, 0);
    if (window.VendzaOrderPrices) {
      var orderTotal = window.VendzaOrderPrices.orderTotal(row, produits);
      if (orderTotal > subtotal) subtotal = orderTotal;
    }
    var frais = Number(
      pickFirst(row, ['shipping_fee', 'delivery_fee', 'frais_livraison', 'shipping_amount']) || 0
    );
    if (!frais && row.total_amount && subtotal) {
      var diff = Number(row.total_amount) - subtotal;
      if (diff > 0 && diff < 5000) frais = diff;
    }
    var livraison = pickFirst(row, [
      'delivery_commune', 'commune', 'ville', 'city',
      'delivery_address', 'adresse_livraison', 'shipping_address'
    ]) || 'Haïti';

    return {
      raw: row,
      id: row.id,
      client: clientName,
      date: row.created_at || row.date || new Date().toISOString(),
      livraison: livraison,
      subtotal: subtotal,
      fraisLivraison: frais,
      produits: produits
    };
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', function () { window.print(); });
  }

  var orderId = new URLSearchParams(window.location.search).get('id') || '';
  if (!orderId) {
    showError('Aucune commande spécifiée. Ouvrez le ticket depuis votre historique.');
    return;
  }

  var client = getClient();
  if (!client || !client.auth) {
    showError('Connexion requise. Veuillez vous connecter.');
    return;
  }

  try {
    var authResp = await client.auth.getUser();
    var user = authResp && authResp.data && authResp.data.user;
    if (!user) {
      showError('Veuillez vous connecter pour afficher votre ticket.');
      var redirectPath = isVendorPage()
        ? 'vendeur/vendza-ticket.html?id=' + orderId
        : 'client/vendza-ticket.html?id=' + orderId;
      window.location.href = window.VZ ? window.VZ.login(redirectPath) : '../authentification/connexion.html?redirect=' + encodeURIComponent(redirectPath);
      return;
    }

    var order = await fetchOrder(client, orderId);
    if (!order) {
      showError('Commande introuvable.');
      return;
    }

    if (!isOwner(order, user.id) && !isVendor(order, user.id)) {
      showError('Vous n\'avez pas accès à ce ticket.');
      return;
    }

    var clientName = await resolveClientName(client, order);
    var pricing = window.VendzaOrderPrices
      ? await window.VendzaOrderPrices.resolveOrderPricing(client, order)
      : { items: parseItems(order), total: Number(order.total_amount ?? order.total ?? order.amount ?? 0) };
    var ticket = mapOrderToTicket(order, clientName, pricing.items);
    if (!ticket.subtotal && pricing.total) ticket.subtotal = pricing.total;
    var displayId = formatOrderDisplayId(order.id);

    var vendorId = pickFirst(order, ['vendor_id', 'seller_id', 'owner_id']) || '';
    var qrData = null;
    if (window.VendzaQR && typeof window.VendzaQR.ensureOrderQr === 'function') {
      qrData = await window.VendzaQR.ensureOrderQr(client, order, vendorId);
    }

    renderTicket(ticket, displayId);

    var asVendor = isVendor(order, user.id) || isVendorPage();
    var qrPanel = document.getElementById('ticket-qr-panel');
    var ticketBody = document.querySelector('.ticket-body');
    var btnConfirm = document.getElementById('btn-confirm-reception');
    var pageSub = document.querySelector('.ticket-page-sub');
    var pageTitle = document.querySelector('.ticket-page-title');
    var navBack = document.querySelector('.ticket-nav .nav-back');
    var vendorNote = document.getElementById('ticket-vendor-note');

    if (asVendor) {
      if (qrPanel) {
        qrPanel.hidden = false;
        qrPanel.removeAttribute('hidden');
      }
      if (ticketBody) ticketBody.classList.remove('ticket-body--no-qr');
      if (btnConfirm) btnConfirm.hidden = true;
      if (pageTitle) pageTitle.textContent = 'Ticket vendeur';
      if (navBack) {
        navBack.href = isVendorPage() ? 'commande-recu.html' : '../vendeur/commande-recu.html';
        navBack.innerHTML = '<i class="fas fa-arrow-left"></i> Mes commandes reçues';
      }
      if (pageSub) {
        pageSub.textContent = 'Imprimez ce ticket : articles, client, total et QR code pour la livraison.';
      }
      if (vendorNote) vendorNote.hidden = false;
      buildQr(order, qrData);
      if (new URLSearchParams(window.location.search).get('print') === '1') {
        setTimeout(function () { window.print(); }, 600);
      }
    } else {
      if (vendorNote) vendorNote.hidden = true;
      if (qrPanel) qrPanel.hidden = true;
      if (ticketBody) ticketBody.classList.add('ticket-body--no-qr');
      if (btnDl) btnDl.style.display = 'none';
      if (btnConfirm) {
        btnConfirm.hidden = false;
        btnConfirm.removeAttribute('hidden');
        btnConfirm.href = 'confirmation.html?id=' + encodeURIComponent(order.id);
      }
      if (pageSub) {
        pageSub.textContent = 'Présentez ce ticket lors de la récupération ou de la livraison';
      }
    }

    showTicket();
  } catch (err) {
    showError('Erreur : ' + ((err && err.message) || 'chargement impossible'));
  }
});
