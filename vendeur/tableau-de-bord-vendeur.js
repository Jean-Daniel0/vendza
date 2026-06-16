'use strict';

(function () {
  const GOAL_REVENUE = 50000;
  let sidebarOpen = true;

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

  function isVendorRole(value) {
    const role = String(value || '').toLowerCase().trim();
    return role === 'vendeur' || role === 'vendor' || role === '1';
  }

  function fmt(n) {
    const num = Number(n || 0);
    if (!Number.isFinite(num) || num === 0) return '0';
    return Math.round(num).toLocaleString('fr-FR');
  }

  function shortId(id) {
    const s = String(id || '');
    if (!s) return '#—';
    return '#' + s.replace(/-/g, '').slice(0, 4).toUpperCase();
  }

  function mapUiStatus(status) {
    const s = String(status || '').toLowerCase();
    if (['paid', 'completed', 'validated'].includes(s)) return 'paid';
    if (['shipped', 'shipping', 'in_transit', 'delivered', 'livree', 'livré', 'livre'].includes(s)) return 'livree';
    if (['cancelled', 'canceled', 'cancel'].includes(s)) return 'cancel';
    return 'pending';
  }

  function statusHtml(s) {
    const ui = mapUiStatus(s);
    const map = { paid: '✓ Payée', pending: '⏳ En attente', cancel: '✕ Annulée', livree: '📦 Livrée' };
    const cls = { paid: 'status-paid', pending: 'status-pending', cancel: 'status-cancel', livree: 'status-livree' };
    return '<span class="vd-cmd-status ' + (cls[ui] || 'status-pending') + '">' + (map[ui] || s) + '</span>';
  }

  function formatDateFr(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) {
      return '—';
    }
  }

  function mapOrder(row, role) {
    const clientName = row.client_name || row.buyer_name || row.customer_name
      || row.client_full_name || row.buyer_full_name || '';
    const vendorName = row.vendor_name || row.seller_name || row.shop_name || '';
    const title = row.product_name || row.title || row.item_name || '';
    return {
      id: row.id || row.order_id || '',
      shortId: shortId(row.id || row.order_id),
      client: clientName || title || (role === 'buyer' ? 'Commande' : 'Client'),
      vendeur: vendorName || 'Boutique',
      date: row.created_at || row.date || new Date().toISOString(),
      total: window.VendzaOrderPrices
        ? window.VendzaOrderPrices.orderTotal(row, window.VendzaOrderPrices.parseOrderItems(row))
        : Number(row.total_amount ?? row.total ?? row.amount ?? row.price ?? 0),
      statut: row.status || row.order_status || 'pending'
    };
  }

  function mapProduct(row) {
    const name = row.name || row.title || row.product_name || 'Produit';
    const cat = [row.category, row.subcategory, row.gender].filter(Boolean).join(' · ') || 'Catalogue';
    const stock = Number(row.stock ?? row.quantity ?? row.stock_quantity ?? 0);
    const img = row.image_url || row.image || row.thumbnail || '';
    return {
      id: row.id || '',
      nom: name,
      emoji: row.emoji || (img ? '' : '📦'),
      img: img,
      cat: cat,
      prix: Number(row.price || 0),
      stock: Number.isFinite(stock) ? stock : 0
    };
  }

  async function resolveAuthUser() {
    const local = readLocalUser();
    const client = getClient();
    if (!client || !client.auth) return local;

    try {
      const resp = await client.auth.getUser();
      const authUser = resp && resp.data && resp.data.user;
      if (!authUser) return local;

      let profile = null;
      let vendor = null;
      try {
        const p = await client.from('users').select('*').eq('id', authUser.id).maybeSingle();
        if (!p.error) profile = p.data || null;
      } catch (_) {}
      try {
        const v = await client.from('vendors').select('*').eq('user_id', authUser.id).maybeSingle();
        if (!v.error) vendor = v.data || null;
      } catch (_) {
        try {
          const v2 = await client.from('vendors').select('*').eq('id', authUser.id).maybeSingle();
          if (!v2.error) vendor = v2.data || null;
        } catch (_) {}
      }

      const result = {
        id: authUser.id,
        email: authUser.email || (profile && profile.email) || '',
        firstName: (profile && (profile.first_name || (profile.full_name || '').split(' ')[0])) || (local && local.firstName) || '',
        lastName: (profile && (profile.last_name || (profile.full_name || '').split(' ').slice(1).join(' '))) || (local && local.lastName) || '',
        userType: (profile && (profile.user_type || profile.userType)) || (local && local.userType) || '',
        departement: (profile && profile.departement) || (local && local.departement) || '',
        commune: (profile && profile.commune) || (local && local.commune) || '',
        shopName: (vendor && (vendor.shop_name || vendor.business_name || vendor.store_name)) || '',
        avatarUrl: (vendor && (vendor.avatar_url || vendor.profile_image)) || (profile && profile.avatar_url) || '',
        description: (vendor && vendor.description) || ''
      };
      localStorage.setItem('vendza_user_data', JSON.stringify(Object.assign({}, local || {}, result)));
      return Object.assign({}, local || {}, result);
    } catch (_) {
      return local;
    }
  }

  async function fetchPlan(client, uid) {
    if (!client || !uid) return 'Plan Vendza';
    if (window.VendzaSubscription && window.VendzaSubscription.querySubscription) {
      try {
        const r = await window.VendzaSubscription.querySubscription(client, uid, ['plan_code', 'status']);
        if (!r.error && r.data) {
          const code = window.VendzaSubscription.planCodeFromRow(r.data);
          if (code && code !== 'free') return code;
          if (r.data.status === 'active') return 'Plan actif';
        }
      } catch (_) {}
    }
    return 'Plan Vendza';
  }

  async function fetchRating(client, uid) {
    if (!client) return null;
    const tables = ['reviews', 'product_reviews', 'avis'];
    for (let i = 0; i < tables.length; i += 1) {
      try {
        const r = await client.from(tables[i]).select('rating,note,stars').eq('vendor_id', uid).limit(100);
        if (!r.error && Array.isArray(r.data) && r.data.length) {
          const vals = r.data.map(function (row) {
            return Number(row.rating ?? row.note ?? row.stars ?? 0);
          }).filter(function (n) { return n > 0; });
          if (vals.length) {
            const avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
            return Math.round(avg * 10) / 10;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  async function queryTable(client, table, uid, role) {
    const vendorCols = ['vendor_id', 'seller_id', 'owner_id', 'user_id'];
    const buyerCols = ['buyer_id', 'client_id', 'user_id', 'customer_id'];
    const cols = role === 'buyer' ? buyerCols : vendorCols;
    for (let i = 0; i < cols.length; i += 1) {
      try {
        const resp = await client.from(table).select('*').eq(cols[i], uid).order('created_at', { ascending: false }).limit(50);
        if (!resp.error && Array.isArray(resp.data) && resp.data.length) return resp.data;
      } catch (_) {}
    }
    return [];
  }

  function revenueFromOrders(orders) {
    return orders
      .filter(function (o) {
        return ['paid', 'completed', 'validated', 'shipped', 'shipping', 'in_transit', 'delivered', 'livree'].includes(String(o.statut || '').toLowerCase());
      })
      .reduce(function (sum, o) { return sum + (Number(o.total) || 0); }, 0);
  }

  function monthRevenue(orders) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return orders.filter(function (o) {
      const d = new Date(o.date);
      return d.getFullYear() === y && d.getMonth() === m
        && ['paid', 'completed', 'validated', 'shipped', 'delivered', 'livree'].includes(String(o.statut || '').toLowerCase());
    }).reduce(function (sum, o) { return sum + (Number(o.total) || 0); }, 0);
  }

  function buildWeekChart(orders) {
    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const vals = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    orders.forEach(function (o) {
      const d = new Date(o.date);
      if (d < start) return;
      const paid = ['paid', 'completed', 'validated', 'shipped', 'delivered', 'livree'].includes(String(o.statut || '').toLowerCase());
      if (!paid) return;
      const idx = Math.floor((d - start) / 86400000);
      if (idx >= 0 && idx < 7) vals[idx] += Number(o.total) || 0;
    });

    const max = Math.max.apply(null, vals.concat([1]));
    const chartEl = document.getElementById('mini-chart');
    if (!chartEl) return;
    chartEl.innerHTML = labels.map(function (lbl, i) {
      const h = Math.max(4, Math.round((vals[i] / max) * 52));
      const current = i === 6 ? ' current' : '';
      return '<div class="vd-bar-wrap"><div class="vd-chart-bar' + current + '" style="height:' + h + 'px"></div><div class="vd-chart-lbl">' + lbl + '</div></div>';
    }).join('');
  }

  function setBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.hidden = false;
      el.textContent = count > 99 ? '99+' : String(count);
    } else {
      el.hidden = true;
    }
  }

  function renderCommandes(orders) {
    const el = document.getElementById('commandes-list');
    if (!el) return;
    if (!orders.length) {
      el.innerHTML = '<div class="vd-empty"><div class="vd-empty-icon">📭</div><p>Aucune commande reçue pour l\'instant</p></div>';
      return;
    }
    el.innerHTML = orders.slice(0, 5).map(function (c) {
      return '<a class="vd-cmd-card" href="commande-recu.html">' +
        '<div class="vd-cmd-num">' + c.shortId + '</div>' +
        '<div class="vd-cmd-body"><div class="vd-cmd-client">' + escapeHtml(c.client) + '</div>' +
        '<div class="vd-cmd-date">📅 ' + formatDateFr(c.date) + '</div></div>' +
        '<div class="vd-cmd-right"><div class="vd-cmd-total">' + fmt(c.total) +
        ' <span style="font-size:10px;font-weight:400;color:var(--faint)">Gdes</span></div>' +
        statusHtml(c.statut) + '</div></a>';
    }).join('');
  }

  function renderProduits(products) {
    const el = document.getElementById('produits-list');
    if (!el) return;
    if (!products.length) {
      el.innerHTML = '<div class="vd-empty"><div class="vd-empty-icon">📦</div><p>Aucun produit encore. <a href="produit.html">Créer un produit →</a></p></div>';
      return;
    }
    el.innerHTML = products.slice(0, 5).map(function (p) {
      const stockCls = p.stock === 0 ? 'stock-out' : p.stock <= 3 ? 'stock-low' : 'stock-ok';
      const stockTxt = p.stock === 0 ? 'Épuisé' : p.stock <= 3 ? '⚡ ' + p.stock + ' restants' : '✓ En stock (' + p.stock + ')';
      const thumb = p.img
        ? '<img src="' + escapeHtml(p.img) + '" alt="">'
        : escapeHtml(p.emoji || '📦');
      return '<a class="vd-prod-card" href="mes-produit.html">' +
        '<div class="vd-prod-emoji">' + thumb + '</div>' +
        '<div class="vd-prod-body"><div class="vd-prod-name">' + escapeHtml(p.nom) + '</div>' +
        '<div class="vd-prod-meta">' + escapeHtml(p.cat) + '</div></div>' +
        '<div class="vd-prod-right"><div class="vd-prod-price">' + fmt(p.prix) + ' Gdes</div>' +
        '<div class="vd-prod-stock ' + stockCls + '">' + stockTxt + '</div></div></a>';
    }).join('');
  }

  function renderAchats(achats) {
    const el = document.getElementById('achats-list');
    if (!el) return;
    if (!achats.length) {
      el.innerHTML = '<div class="vd-empty"><div class="vd-empty-icon">🛍️</div><p>Aucun achat récent</p></div>';
      return;
    }
    el.innerHTML = achats.slice(0, 5).map(function (a) {
      return '<a class="vd-cmd-card" href="../client/historique-des-commandes.html">' +
        '<div class="vd-cmd-num" style="background:var(--teal-lt);color:var(--teal)">' + a.shortId + '</div>' +
        '<div class="vd-cmd-body"><div class="vd-cmd-client">Chez ' + escapeHtml(a.vendeur) + '</div>' +
        '<div class="vd-cmd-date">📅 ' + formatDateFr(a.date) + '</div></div>' +
        '<div class="vd-cmd-right"><div class="vd-cmd-total">' + fmt(a.total) +
        ' <span style="font-size:10px;font-weight:400;color:var(--faint)">Gdes</span></div>' +
        statusHtml(a.statut) + '</div></a>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pendingCount(orders) {
    return orders.filter(function (o) {
      return mapUiStatus(o.statut) === 'pending';
    }).length;
  }

  function bindSidebar() {
    const btn = document.getElementById('vd-menu-btn');
    const sb = document.getElementById('vd-sidebar');
    const mn = document.getElementById('vd-main');
    if (!btn || !sb || !mn) return;

    btn.addEventListener('click', function () {
      if (window.innerWidth <= 640) {
        sb.classList.toggle('open');
      } else {
        sidebarOpen = !sidebarOpen;
        sb.classList.toggle('hidden', !sidebarOpen);
        mn.classList.toggle('full', !sidebarOpen);
      }
    });

    document.addEventListener('click', function (e) {
      if (window.innerWidth <= 640 && !e.target.closest('#vd-sidebar') && !e.target.closest('#vd-menu-btn')) {
        sb.classList.remove('open');
      }
    });
  }

  function bindLogout() {
    const btn = document.getElementById('vd-logout');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!confirm('Se déconnecter ?')) return;
      try {
        const client = getClient();
        if (client && client.auth) await client.auth.signOut();
      } catch (_) {}
      localStorage.removeItem('vendza_user_data');
      localStorage.removeItem('vendza_auth_token');
      window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html';
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    bindSidebar();
    bindLogout();

    const user = await resolveAuthUser();
    if (!user || !user.id || !isVendorRole(user.userType)) {
      window.location.replace('../authentification/connexion.html');
      return;
    }

    const displayName = user.shopName
      || [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      || 'Boutique Vendza';
    const area = [user.departement, user.commune].filter(Boolean).join(' · ');

    const dashName = document.getElementById('dash-name');
    const dashSub = document.getElementById('dash-sub');
    const dashDate = document.getElementById('dash-date');
    const dashPlan = document.getElementById('dash-plan');
    const navAv = document.getElementById('vd-nav-av');

    if (dashName) dashName.textContent = displayName;
    if (dashSub) dashSub.textContent = user.description || (area ? 'Couverture : ' + area : 'Votre boutique Vendza');
    if (dashDate) {
      dashDate.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    const initial = displayName.charAt(0).toUpperCase();
    if (navAv) {
      if (user.avatarUrl) {
        navAv.innerHTML = '<img src="' + escapeHtml(user.avatarUrl) + '" alt="">';
      } else {
        navAv.textContent = initial;
      }
    }

    const client = getClient();
    let productsRaw = [];
    let ordersRaw = [];
    let buyerRaw = [];
    let planLabel = 'Plan Vendza';
    let rating = null;

    if (client) {
      productsRaw = await queryTable(client, 'products', user.id, 'vendor');
      ordersRaw = await queryTable(client, 'orders', user.id, 'vendor');
      buyerRaw = await queryTable(client, 'orders', user.id, 'buyer');
      planLabel = await fetchPlan(client, user.id);
      rating = await fetchRating(client, user.id);
    }

    const products = productsRaw.map(mapProduct);
    const orders = ordersRaw.map(function (r) { return mapOrder(r, 'vendor'); });
    const achats = buyerRaw.map(function (r) { return mapOrder(r, 'buyer'); });

    const totalRevenue = revenueFromOrders(orders);
    const revMonth = monthRevenue(orders);
    const pct = Math.min(100, Math.round((revMonth / GOAL_REVENUE) * 100));

    if (dashPlan) dashPlan.textContent = '⭐ ' + planLabel;
    const qaPlan = document.getElementById('qa-plan-sub');
    if (qaPlan) qaPlan.textContent = 'Plan actuel : ' + planLabel;

    const pending = pendingCount(orders);
    const qaCmd = document.getElementById('qa-cmd-sub');
    if (qaCmd) {
      qaCmd.textContent = pending > 0 ? pending + ' en attente' : 'Gérer les ventes';
    }

    setBadge('vd-badge-produits', products.length);
    setBadge('vd-badge-commandes', orders.length);

    const set = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('s-produits', String(products.length));
    set('s-commandes', String(orders.length));
    set('s-revenus', fmt(totalRevenue));
    set('s-note', rating != null ? String(rating) : '—');
    set('s-achats', String(achats.length));
    set('s-panier', String(readCartCount()));

    const revTotal = document.getElementById('rev-total');
    const revSub = document.getElementById('rev-sub');
    if (revTotal) revTotal.textContent = fmt(revMonth) + ' Gdes';
    if (revSub) revSub.textContent = 'Objectif : ' + fmt(GOAL_REVENUE) + ' Gdes · ' + pct + '% atteint';

    const trendProd = document.getElementById('trend-produits');
    if (trendProd && products.length > 0) {
      trendProd.hidden = false;
      trendProd.textContent = products.length === 1 ? '1 actif' : products.length + ' actifs';
    }

    const trendCmd = document.getElementById('trend-commandes');
    if (trendCmd && orders.length > 0) {
      trendCmd.hidden = false;
      trendCmd.textContent = pending > 0 ? pending + ' en attente' : '↑ activité';
    }

    buildWeekChart(orders);
    renderCommandes(orders);
    renderProduits(products);
    renderAchats(achats);
  });
})();
