'use strict';

(function () {
  var AVATAR_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#dc2626', '#d97706', '#16a34a'];
  var inboxCache = [];
  var currentTab = 'all';
  var activeConversation = null;
  var currentUserId = '';
  var realtimeChannel = null;
  var pollTimer = null;

  function q(sel) { return document.querySelector(sel); }

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function getSeenKey(userId) {
    return 'vendza_client_inbox_last_seen_' + String(userId || '');
  }

  function markInboxSeen(userId) {
    if (!userId) return;
    localStorage.setItem(getSeenKey(userId), new Date().toISOString());
  }

  function readSeenAt(userId) {
    try {
      return new Date(localStorage.getItem(getSeenKey(userId)) || 0).getTime();
    } catch (_) {
      return 0;
    }
  }

  function colorForId(id) {
    var s = String(id || '0');
    var n = 0;
    for (var i = 0; i < s.length; i += 1) n += s.charCodeAt(i);
    return AVATAR_COLORS[n % AVATAR_COLORS.length];
  }

  function initials(name) {
    var parts = String(name || 'V').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'V';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function formatTime(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      var now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch (_) {
      return '';
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    var t = q('#msg-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function setStatus(text, isError) {
    var el = q('#chatStatus');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', Boolean(isError));
  }

  function getMsgApi() {
    return window.VendzaMessaging || null;
  }

  function resolveImageUrl(client, path) {
    var api = getMsgApi();
    if (api) return api.resolveImageUrl(client, path);
    if (!client || !path) return '';
    var clean = String(path).replace(/^images\//i, '').replace(/^\/+/, '');
    var res = client.storage.from('images').getPublicUrl(clean);
    return (res && res.data && res.data.publicUrl) || '';
  }

  function isOrderMessage(content) {
    var api = getMsgApi();
    if (api) return api.isOrderMessage(content);
    return /Livraison confirmee|Nouvelle commande|Commande partag/i.test(String(content || ''));
  }

  function isMobileInbox() {
    return window.innerWidth <= 900;
  }

  function showMobileList() {
    var sidebar = q('#sidebar');
    var chatArea = q('#chat-area');
    var backBtn = q('#btn-back-inbox');
    if (sidebar) sidebar.classList.add('mobile-open');
    if (chatArea) chatArea.classList.add('chat-hidden');
    if (backBtn) backBtn.hidden = true;
  }

  function showMobileChat() {
    var sidebar = q('#sidebar');
    var chatArea = q('#chat-area');
    var backBtn = q('#btn-back-inbox');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (chatArea) chatArea.classList.remove('chat-hidden');
    if (backBtn && isMobileInbox()) backBtn.hidden = false;
  }

  function vendorDisplayName(vendor) {
    if (!vendor) return 'Vendeur';
    return vendor.shop_name || vendor.business_name || vendor.name || vendor.store_name || 'Vendeur';
  }

  async function fetchLastMessages(client, conversationIds) {
    var map = {};
    if (!conversationIds.length) return map;
    try {
      var resp = await client
        .from('messages')
        .select('conversation_id, content, created_at, sender_id')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (resp.data) {
        resp.data.forEach(function (m) {
          if (!map[m.conversation_id]) map[m.conversation_id] = m;
        });
      }
    } catch (_) {}
    return map;
  }

  async function fetchInbox(client, buyerId) {
    var resp = await client
      .from('conversations')
      .select('id, product_id, buyer_id, vendor_id, last_message_at')
      .eq('buyer_id', buyerId)
      .order('last_message_at', { ascending: false });

    var conversations = resp.data;
    if (!Array.isArray(conversations) || !conversations.length) return [];

    var productIds = [];
    var vendorIds = [];
    conversations.forEach(function (c) {
      if (c.product_id) productIds.push(c.product_id);
      if (c.vendor_id) vendorIds.push(c.vendor_id);
    });
    productIds = productIds.filter(function (v, i, a) { return a.indexOf(v) === i; });
    vendorIds = vendorIds.filter(function (v, i, a) { return a.indexOf(v) === i; });

    var products = [];
    var vendors = [];
    if (productIds.length) {
      var p = await client.from('products').select('id, name').in('id', productIds);
      products = p.data || [];
    }
    if (vendorIds.length) {
      try {
        var u1 = await client.from('users').select('id, user_id, shop_name, business_name, name, store_name, full_name, user_type').in('id', vendorIds);
        vendors = u1.data || [];
      } catch (_) {}
      if (!vendors.length) {
        try {
          var u2 = await client.from('users').select('id, user_id, shop_name, business_name, name, store_name, full_name, user_type').in('user_id', vendorIds);
          vendors = u2.data || [];
        } catch (_) {}
      }
      if (!vendors.length) {
        try {
          var p1 = await client.from('profiles').select('id, shop_name, full_name').in('id', vendorIds);
          vendors = (p1.data || []).map(row => ({
            id: row.id,
            user_id: row.id,
            shop_name: row.shop_name,
            name: row.full_name
          }));
        } catch (_) {}
      }
      if (!vendors.length) {
        try {
          var v1 = await client.from('vendors').select('id, user_id, shop_name, business_name, name, store_name').in('id', vendorIds);
          vendors = v1.data || [];
        } catch (_) {}
        if (!vendors.length) {
          try {
            var v2 = await client.from('vendors').select('id, user_id, shop_name, business_name, name, store_name').in('user_id', vendorIds);
            vendors = v2.data || [];
          } catch (_) {}
        }
      }
    }

    var productMap = {};
    products.forEach(function (p) { productMap[p.id] = p; });
    var vendorMap = {};
    vendors.forEach(function (v) {
      vendorMap[v.id] = v;
      if (v.user_id) vendorMap[v.user_id] = v;
    });

    var lastMap = await fetchLastMessages(client, conversations.map(function (c) { return c.id; }));
    var seenAt = readSeenAt(buyerId);

    return conversations.map(function (c) {
      var product = productMap[c.product_id] || {};
      var vendor = vendorMap[c.vendor_id] || {};
      var vendorName = vendorDisplayName(vendor);
      var last = lastMap[c.id];
      var lastAt = (last && last.created_at) || c.last_message_at;
      var unread = lastAt && new Date(lastAt).getTime() > seenAt && last && last.sender_id !== buyerId;
      return {
        id: c.id,
        product_id: c.product_id,
        buyer_id: c.buyer_id,
        vendor_id: c.vendor_id,
        product_name: product.name || 'Produit',
        partner_name: vendorName,
        last_message_at: lastAt,
        last_preview: (last && last.content) ? String(last.content).slice(0, 80) : 'Ouvrir la conversation',
        unread: unread ? 1 : 0,
        is_order: last && isOrderMessage(last.content),
        color: colorForId(c.vendor_id || c.id),
        initiale: initials(vendorName)
      };
    });
  }

  function filterInbox(list) {
    var term = (q('#search-conv') && q('#search-conv').value || '').toLowerCase();
    return list.filter(function (item) {
      if (currentTab === 'unread' && !item.unread) return false;
      if (currentTab === 'commandes' && !item.is_order) return false;
      if (term && item.partner_name.toLowerCase().indexOf(term) < 0 && item.product_name.toLowerCase().indexOf(term) < 0) return false;
      return true;
    });
  }

  function updateCounts() {
    var all = inboxCache.length;
    var unread = inboxCache.filter(function (c) { return c.unread > 0; }).length;
    var elAll = q('#tc-all');
    var elUnread = q('#tc-unread');
    var navBadge = q('#nav-unread');
    if (elAll) elAll.textContent = String(all);
    if (elUnread) elUnread.textContent = String(unread);
    if (navBadge) {
      if (unread > 0) {
        navBadge.textContent = String(unread);
        navBadge.hidden = false;
      } else {
        navBadge.hidden = true;
      }
    }
  }

  function renderConvList() {
    var listEl = q('#conv-list');
    if (!listEl) return;
    var data = filterInbox(inboxCache);
    updateCounts();

    if (!data.length) {
      listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--faint);font-size:13px;">Aucune conversation.</div>';
      return;
    }

    listEl.innerHTML = data.map(function (c) {
      return (
        '<div class="conv-item' + (c.unread ? ' unread' : '') + (activeConversation && activeConversation.id === c.id ? ' active' : '') + '" data-id="' + c.id + '">' +
        '<div class="conv-avatar" style="background:' + c.color + '">' + escapeHtml(c.initiale) + '</div>' +
        '<div class="conv-body">' +
        '<div class="conv-top"><span class="conv-name">' + escapeHtml(c.partner_name) + '</span><span class="conv-time">' + formatTime(c.last_message_at) + '</span></div>' +
        '<div class="conv-bottom"><span class="conv-preview">' + escapeHtml(c.last_preview) + '</span>' +
        (c.unread ? '<div class="conv-unread-dot">' + c.unread + '</div>' : '') +
        '</div>' +
        '<span class="conv-product-chip">📦 ' + escapeHtml(c.product_name) + '</span>' +
        '</div></div>'
      );
    }).join('');

    listEl.querySelectorAll('.conv-item').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-id');
        var item = inboxCache.find(function (x) { return x.id === id; });
        if (item) openConversation(item);
      });
    });
  }

  function showChatPanels(show) {
    var empty = q('#chat-empty');
    var header = q('#chat-header');
    var messages = q('#messages');
    var input = q('#input-zone');
    if (empty) empty.hidden = show;
    if (header) header.hidden = !show;
    if (messages) messages.hidden = !show;
    if (input) input.hidden = !show;
  }

  async function openConversation(item) {
    activeConversation = item;
    item.unread = 0;
    renderConvList();

    q('#ch-name').textContent = item.partner_name;
    q('#ch-status').textContent = 'Vendeur · ' + (item.product_name || 'Produit');
    q('#ch-product').textContent = '📦 ' + (item.product_name || 'Produit');
    var av = q('#ch-avatar');
    if (av) {
      av.style.background = item.color;
      av.textContent = item.initiale;
    }

    var productLink = q('#btn-open-product');
    if (productLink && item.product_id) {
      productLink.href = '../detail-produit.html?id=' + encodeURIComponent(item.product_id);
      productLink.hidden = false;
    }

    showChatPanels(true);
    setStatus('Chargement…', false);

    var client = getClient();
    if (!client) return;
    await loadMessages(client, item.id, currentUserId);
    startRealtime(client, item.id);
    startPolling(client, item.id);
    markInboxSeen(currentUserId);

    if (isMobileInbox()) showMobileChat();
  }

  function renderMessages(client, rows, userId) {
    var el = q('#messages');
    if (!el) return;
    el.innerHTML = '';

    if (!rows.length) {
      el.innerHTML = '<div class="date-sep"><span>Aucun message</span></div>';
      setStatus('', false);
      return;
    }

    var html = '<div class="date-sep"><span>Conversation</span></div>';
    rows.forEach(function (m, i) {
      var isMe = m.sender_id === userId;
      var prev = rows[i - 1];
      var showAv = !isMe && (!prev || prev.sender_id !== m.sender_id);
      html += '<div class="msg ' + (isMe ? 'me' : 'them') + '">';
      if (!isMe && showAv && activeConversation) {
        html += '<div class="msg-av" style="background:' + activeConversation.color + '">' + escapeHtml(activeConversation.initiale) + '</div>';
      } else if (!isMe) {
        html += '<div style="width:28px;flex-shrink:0;"></div>';
      }
      html += '<div class="bubble">';
      if (m.attachment_path) {
        var url = resolveImageUrl(client, m.attachment_path);
        html += '<div class="bubble-img"><img src="' + escapeHtml(url) + '" alt="image"/></div>';
      }
      if (m.content) {
        var api = getMsgApi();
        if (api && api.isOrderMessage(m.content)) {
          html += api.formatOrderCardHtml(api.parseOrderMessage(m.content));
        } else {
          html += escapeHtml(m.content);
        }
      }
      html += '<span class="bubble-time">' + formatTime(m.created_at) + '</span>';
      html += '</div></div>';
    });

    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
    setStatus('', false);
  }

  async function loadMessages(client, conversationId, userId) {
    var resp = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);
    renderMessages(client, resp.data || [], userId);
  }

  async function sendMessage(client, conversationId, senderId, content, attachmentPath) {
    var api = getMsgApi();
    if (api) {
      var res = await api.sendMessage(client, conversationId, senderId, content, attachmentPath);
      if (res && !res.ok) setStatus('Échec de l\'envoi.', true);
      return;
    }
    var trimmed = (content || '').trim();
    if (!trimmed && !attachmentPath) return;
    await client.from('messages').insert([{
      conversation_id: conversationId,
      sender_id: senderId,
      content: trimmed || '',
      attachment_path: attachmentPath || null
    }]);
  }

  async function uploadAttachment(client, userId, conversationId, file) {
    var api = getMsgApi();
    if (api) return api.uploadAttachment(client, userId, conversationId, file);
    var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = userId + '/messages/' + conversationId + '/' + Date.now() + '-' + safeName;
    var up = await client.storage.from('images').upload(path, file, { upsert: true });
    if (up.error) throw up.error;
    return path;
  }

  function startRealtime(client, conversationId) {
    if (realtimeChannel) realtimeChannel.unsubscribe();
    if (!conversationId) return;
    realtimeChannel = client
      .channel('client-inbox:' + conversationId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'conversation_id=eq.' + conversationId
      }, function () {
        loadMessages(client, conversationId, currentUserId);
      })
      .subscribe();
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function startPolling(client, conversationId) {
    stopPolling();
    pollTimer = setInterval(function () {
      if (!activeConversation || activeConversation.id !== conversationId) return;
      if (document.visibilityState === 'hidden') return;
      loadMessages(client, conversationId, currentUserId);
    }, 2000);
  }

  async function refreshInbox() {
    var client = getClient();
    if (!client) {
      setStatus('Supabase indisponible.', true);
      return;
    }
    var auth = await client.auth.getUser();
    var user = auth && auth.data && auth.data.user;
    if (!user) {
      var redirect = encodeURIComponent('client/mes-messages.html' + (window.location.search || ''));
      window.location.href = window.VZ ? window.VZ.login('client/mes-messages.html') : '../authentification/connexion.html?redirect=' + redirect;
      return;
    }
    currentUserId = user.id;
    inboxCache = await fetchInbox(client, user.id);
    renderConvList();
    if (!inboxCache.length) setStatus('Aucune conversation pour le moment.', false);
  }

  async function handleSend() {
    var client = getClient();
    if (!client || !activeConversation) return;
    var input = q('#msg-input');
    var text = input ? input.value.trim() : '';
    if (!text) return;
    await sendMessage(client, activeConversation.id, currentUserId, text, null);
    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }
    q('#btn-send').disabled = true;
    await loadMessages(client, activeConversation.id, currentUserId);
    await refreshInbox();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var tabs = q('#sidebar-tabs');
    if (tabs) {
      tabs.querySelectorAll('.stab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          tabs.querySelectorAll('.stab').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          currentTab = btn.getAttribute('data-tab') || 'all';
          renderConvList();
        });
      });
    }

    var search = q('#search-conv');
    if (search) search.addEventListener('input', renderConvList);

    var input = q('#msg-input');
    var sendBtn = q('#btn-send');
    if (input && sendBtn) {
      input.addEventListener('input', function () {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        sendBtn.disabled = !input.value.trim();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }
    if (sendBtn) sendBtn.addEventListener('click', handleSend);

    var imgBtn = q('#btn-pick-image');
    var imgInput = q('#img-input');
    if (imgBtn && imgInput) {
      imgBtn.addEventListener('click', function () { imgInput.click(); });
      imgInput.addEventListener('change', async function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file || !activeConversation) return;
        var client = getClient();
        try {
          setStatus('Envoi image…', false);
          var path = await uploadAttachment(client, currentUserId, activeConversation.id, file);
          await sendMessage(client, activeConversation.id, currentUserId, '', path);
          await loadMessages(client, activeConversation.id, currentUserId);
          showToast('Image envoyée');
        } catch (_) {
          setStatus('Échec envoi image.', true);
        }
        imgInput.value = '';
      });
    }

    var refreshBtn = q('#btn-refresh-chat');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        if (activeConversation) {
          var client = getClient();
          if (client) loadMessages(client, activeConversation.id, currentUserId);
        } else {
          refreshInbox();
        }
      });
    }

    var backBtn = q('#btn-back-inbox');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        activeConversation = null;
        showChatPanels(false);
        showMobileList();
        if (realtimeChannel) realtimeChannel.unsubscribe();
        stopPolling();
        renderConvList();
      });
    }

    if (isMobileInbox()) showMobileList();
    window.addEventListener('resize', function () {
      if (!activeConversation && isMobileInbox()) showMobileList();
    });

    refreshInbox().then(function () {
      var params = new URLSearchParams(window.location.search);
      var cid = params.get('conversation') || params.get('c');
      if (!cid) return;
      var item = inboxCache.find(function (x) { return x.id === cid; });
      if (item) openConversation(item);
    });

    window.addEventListener('beforeunload', function () {
      if (realtimeChannel) realtimeChannel.unsubscribe();
      stopPolling();
    });
  });
})();
