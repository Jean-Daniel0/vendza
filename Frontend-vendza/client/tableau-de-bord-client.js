'use strict';

document.addEventListener('DOMContentLoaded', async function () {
  const userNameEl = document.getElementById('userName');
  const userEmailEl = document.getElementById('userEmail');
  const ordersCountEl = document.getElementById('ordersCount');
  const deliveredCountEl = document.getElementById('deliveredCount');
  const cartItemsEl = document.getElementById('cartItems');
  const cartCountEl = document.getElementById('cartCount');
  const ordersListEl = document.getElementById('ordersList');

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function readLocalUser() {
    try { return JSON.parse(localStorage.getItem('vendza_user_data') || 'null'); } catch (_) { return null; }
  }

  function readCartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
      if (!Array.isArray(cart)) return 0;
      return cart.reduce(function (sum, item) { return sum + (Number(item && item.quantity) || 1); }, 0);
    } catch (_) {
      return 0;
    }
  }

  function normalizeStatus(status) {
    const s = String(status || '').toLowerCase();
    if (['paid', 'completed', 'success', 'validated', 'validee', 'livree', 'delivered', 'done'].includes(s)) return 'delivered';
    if (['cancelled', 'canceled', 'annulee', 'annule'].includes(s)) return 'cancelled';
    return 'pending';
  }

  function statusLabel(status) {
    if (status === 'delivered') return 'Livree';
    if (status === 'cancelled') return 'Annulee';
    return 'En cours';
  }

  function formatAmount(v) {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  }

  function mapOrder(row) {
    return {
      id: row.id || row.order_id || row.reference || '',
      title: row.product_name || row.title || row.item_name || row.description || 'Commande',
      status: normalizeStatus(row.status || row.order_status || row.state),
      total: Number(row.total_amount ?? row.total ?? row.amount ?? row.price ?? 0),
      date: row.created_at || row.createdAt || row.date || new Date().toISOString()
    };
  }

  function renderOrders(orders) {
    if (!ordersListEl) return;
    ordersListEl.innerHTML = '';
    if (!orders.length) {
      const empty = document.createElement('div');
      empty.className = 'order';
      empty.innerHTML = '<div class="title">Aucune commande pour le moment.</div>';
      ordersListEl.appendChild(empty);
      return;
    }

    orders.slice(0, 6).forEach(function (o) {
      const item = document.createElement('div');
      item.className = 'order';
      item.innerHTML =
        '<div class="meta"><span>' + (o.id || '—') + '</span><span>' + new Date(o.date).toLocaleDateString() + '</span></div>' +
        '<div class="title">' + o.title + '</div>' +
        '<div class="meta"><span>Total</span><strong>' + formatAmount(o.total) + ' Gdes</strong></div>' +
        '<div class="status ' + o.status + '">' + statusLabel(o.status) + '</div>';
      ordersListEl.appendChild(item);
    });
  }

  function renderStats(orders) {
    if (ordersCountEl) ordersCountEl.textContent = String(orders.length);
    if (deliveredCountEl) deliveredCountEl.textContent = String(orders.filter(function (o) { return o.status === 'delivered'; }).length);
    const cartCount = readCartCount();
    if (cartItemsEl) cartItemsEl.textContent = String(cartCount);
    if (cartCountEl) cartCountEl.textContent = String(cartCount);
  }

  function bindLogout() {
    const logoutLink = document.querySelector('a[href*="connexion.html"]');
    if (!logoutLink) return;
    logoutLink.addEventListener('click', async function (e) {
      e.preventDefault();
      try {
        const client = getClient();
        if (client && client.auth) await client.auth.signOut();
      } catch (_) {}
      localStorage.removeItem('vendza_user_data');
      localStorage.removeItem('vendza_auth_token');
      window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html';
    });
  }

  async function fetchOrdersFromDb(client, uid) {
    const filters = ['buyer_id', 'client_id', 'user_id', 'customer_id'];
    for (let i = 0; i < filters.length; i += 1) {
      const col = filters[i];
      try {
        const query = client.from('orders').select('*').eq(col, uid).order('created_at', { ascending: false }).limit(50);
        const resp = await query;
        if (!resp.error && Array.isArray(resp.data)) return resp.data.map(mapOrder);
      } catch (_) {}
    }
    return [];
  }

  async function resolveUser() {
    const local = readLocalUser();
    const client = getClient();
    if (!client || !client.auth) return local;

    try {
      const resp = await client.auth.getUser();
      const authUser = resp && resp.data && resp.data.user;
      if (!authUser) return local;

      let profile = null;
      try {
        const p = await client.from('users').select('*').eq('id', authUser.id).maybeSingle();
        if (!p.error) profile = p.data || null;
      } catch (_) {}

      const resolved = {
        id: authUser.id,
        email: authUser.email || (profile && profile.email) || '',
        firstName: (profile && (profile.first_name || (profile.full_name || '').split(' ')[0])) || (local && local.firstName) || '',
        lastName: (profile && (profile.last_name || (profile.full_name || '').split(' ').slice(1).join(' '))) || (local && local.lastName) || '',
        userType: (profile && (profile.user_type || profile.userType)) || (local && local.userType) || 'client'
      };
      localStorage.setItem('vendza_user_data', JSON.stringify(Object.assign({}, local || {}, resolved)));
      return Object.assign({}, local || {}, resolved);
    } catch (_) {
      return local;
    }
  }

  const userData = await resolveUser();
  if (!userData || !userData.id) {
    window.location.replace('../authentification/connexion.html');
    return;
  }

  const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim() || 'Client Vendza';
  if (userNameEl) userNameEl.textContent = fullName;
  if (userEmailEl) userEmailEl.textContent = userData.email || '—';

  let orders = [];
  const client = getClient();
  if (client) {
    orders = await fetchOrdersFromDb(client, userData.id);
  }
  renderStats(orders);
  renderOrders(orders);
  bindLogout();
});
