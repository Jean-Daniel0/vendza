'use strict';

document.addEventListener('DOMContentLoaded', async function () {
  const grid = document.getElementById('deliveries');
  const empty = document.getElementById('empty');
  const statusEl = document.getElementById('status');
  const qEl = document.getElementById('q');
  const periodEl = document.getElementById('period');
  const applyBtn = document.getElementById('apply');

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function readLocalUser() {
    try { return JSON.parse(localStorage.getItem('vendza_user_data') || 'null'); } catch (_) { return null; }
  }

  function parseDate(value) {
    const d = new Date(value || Date.now());
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  function getDeliveryDate(row) {
    return row.delivery_date || row.shipping_date || row.expected_date || row.estimated_delivery || row.created_at || new Date().toISOString();
  }

  function normalizeDeliveryStatus(row) {
    const raw = String(row.delivery_status || row.shipping_status || row.status || '').toLowerCase();
    if (['delayed', 'retardee', 'retard', 'late'].includes(raw)) return 'delayed';
    if (['today', 'aujourdhui', 'auj'].includes(raw)) return 'today';
    if (['delivered', 'livree', 'completed', 'done'].includes(raw)) return 'delivered';
    const target = parseDate(getDeliveryDate(row));
    const now = new Date();
    const sameDay =
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate();
    if (sameDay) return 'today';
    if (target < now) return 'delayed';
    return 'upcoming';
  }

  function mapRow(row) {
    return {
      id: row.id || row.order_id || '',
      status: normalizeDeliveryStatus(row),
      date: getDeliveryDate(row),
      slot: row.delivery_slot || row.slot || row.time_slot || '',
      client: row.buyer_name || row.customer_name || row.client_name || row.buyer_email || row.customer_email || 'Client',
      address: row.delivery_address || row.address || row.shipping_address || 'Adresse non renseignee',
      product: row.product_name || row.title || row.item_name || 'Produit'
    };
  }

  function badge(status) {
    if (status === 'today') return '<span class="badge badge-today">Aujourd\'hui</span>';
    if (status === 'upcoming') return '<span class="badge badge-upcoming">A venir</span>';
    if (status === 'delivered') return '<span class="badge badge-upcoming">Livree</span>';
    return '<span class="badge badge-delayed">Retardee</span>';
  }

  function render(items) {
    if (!grid || !empty) return;
    grid.innerHTML = '';
    if (!items.length) {
      empty.style.display = 'block';
      empty.textContent = 'Aucune livraison a afficher.';
      return;
    }
    empty.style.display = 'none';
    items.forEach(function (d) {
      const dt = parseDate(d.date);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="row"><strong>Livraison #' + (d.id || '') + '</strong>' + badge(d.status) + '</div>' +
        '<div class="muted">' + dt.toLocaleDateString() + (d.slot ? ' • ' + d.slot : '') + '</div>' +
        '<div><i class="fas fa-user"></i> Client: ' + d.client + '</div>' +
        '<div><i class="fas fa-location-dot"></i> Adresse: ' + d.address + '</div>' +
        '<div><i class="fas fa-box"></i> Produit: ' + d.product + '</div>';
      grid.appendChild(card);
    });
  }

  function applyFilters(items) {
    const status = statusEl ? String(statusEl.value || '').toLowerCase() : '';
    const q = qEl ? String(qEl.value || '').toLowerCase() : '';
    const days = parseInt((periodEl && periodEl.value) || '0', 10);
    const minDate = days > 0 ? new Date(Date.now() - (days * 24 * 60 * 60 * 1000)) : null;

    return items.filter(function (x) {
      if (status && x.status !== status) return false;
      if (minDate && parseDate(x.date) < minDate) return false;
      if (q) {
        const hay = [x.client, x.address, x.product, x.id].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  async function fetchVendorOrders(client, vendorId) {
    const cols = ['vendor_id', 'seller_id', 'owner_id', 'user_id'];
    for (let i = 0; i < cols.length; i += 1) {
      try {
        const col = cols[i];
        const resp = await client.from('orders').select('*').eq(col, vendorId).order('created_at', { ascending: false });
        if (!resp.error && Array.isArray(resp.data)) return resp.data.map(mapRow);
      } catch (_) {}
    }
    return [];
  }

  const client = getClient();
  const localUser = readLocalUser();
  let uid = localUser && localUser.id ? localUser.id : '';

  if (client && client.auth) {
    try {
      const auth = await client.auth.getUser();
      const user = auth && auth.data && auth.data.user;
      if (user && user.id) uid = user.id;
    } catch (_) {}
  }

  if (!uid || !client) {
    if (empty) {
      empty.style.display = 'block';
      empty.textContent = 'Veuillez vous connecter.';
    }
    return;
  }

  const rows = await fetchVendorOrders(client, uid);

  function refresh() {
    render(applyFilters(rows));
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', function (e) {
      e.preventDefault();
      refresh();
    });
  }
  if (qEl) qEl.addEventListener('input', refresh);
  if (statusEl) statusEl.addEventListener('change', refresh);
  if (periodEl) periodEl.addEventListener('change', refresh);

  refresh();
});
