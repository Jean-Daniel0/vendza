'use strict';

(function () {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveImageUrl(client, path) {
    if (!client || !path) return '';
    var clean = String(path).replace(/^images\//i, '').replace(/^\/+/, '');
    var res = client.storage.from('images').getPublicUrl(clean);
    return (res && res.data && res.data.publicUrl) || '';
  }

  function isOrderMessage(content) {
    return /Nouvelle commande|Commande partagée|Commande partagee|Livraison confirmee|Livraison confirmée/i.test(String(content || ''));
  }

  function parseOrderMessage(content) {
    if (!isOrderMessage(content)) return null;
    var parts = String(content || '').split('|').map(function (p) { return p.trim(); });
    var data = { title: 'Commande', product: '', amount: '', status: '', id: '' };
    parts.forEach(function (part) {
      if (/^Produit:/i.test(part)) data.product = part.replace(/^Produit:\s*/i, '');
      else if (/^Montant:/i.test(part)) data.amount = part.replace(/^Montant:\s*/i, '');
      else if (/^Statut:/i.test(part)) data.status = part.replace(/^Statut:\s*/i, '');
      else if (/^ID:/i.test(part)) data.id = part.replace(/^ID:\s*/i, '');
      else if (/^Quantite:/i.test(part)) data.qty = part.replace(/^Quantite:\s*/i, '');
      else if (/^Client:/i.test(part)) data.client = part.replace(/^Client:\s*/i, '');
      else if (/Nouvelle commande|Commande partag/i.test(part)) data.title = part;
    });
    return data;
  }

  function formatOrderCardHtml(orderData) {
    if (!orderData) return '';
    return (
      '<div class="order-card">' +
      '<div class="oc-emoji">📦</div>' +
      '<div><div class="oc-name">' + escapeHtml(orderData.product || orderData.title || 'Commande') + '</div>' +
      (orderData.amount ? '<div class="oc-price">' + escapeHtml(orderData.amount) + '</div>' : '') +
      (orderData.status ? '<div style="font-size:10px;color:var(--muted);margin-top:2px;">' + escapeHtml(orderData.status) + '</div>' : '') +
      '</div></div>'
    );
  }

  async function ensureConversation(client, buyerId, vendorId, productId) {
    if (!client || !buyerId || !vendorId || !productId) return null;
    try {
      var existing = await client
        .from('conversations')
        .select('id')
        .eq('buyer_id', buyerId)
        .eq('vendor_id', vendorId)
        .eq('product_id', productId)
        .maybeSingle();
      if (!existing.error && existing.data && existing.data.id) return existing.data.id;
    } catch (_) {}

    try {
      var upsert = await client
        .from('conversations')
        .upsert([{
          buyer_id: buyerId,
          vendor_id: vendorId,
          product_id: productId,
          last_message_at: new Date().toISOString()
        }], { onConflict: 'product_id,buyer_id,vendor_id' })
        .select('id')
        .single();
      if (!upsert.error && upsert.data && upsert.data.id) return upsert.data.id;
    } catch (_) {}

    try {
      var ins = await client
        .from('conversations')
        .insert([{
          buyer_id: buyerId,
          vendor_id: vendorId,
          product_id: productId,
          last_message_at: new Date().toISOString()
        }])
        .select('id')
        .single();
      if (!ins.error && ins.data && ins.data.id) return ins.data.id;
    } catch (_) {}

    return null;
  }

  async function touchConversation(client, conversationId) {
    if (!client || !conversationId) return;
    try {
      await client
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (_) {}
  }

  async function sendMessage(client, conversationId, senderId, content, attachmentPath) {
    var trimmed = String(content || '').trim();
    if (!client || !conversationId || !senderId) return { ok: false };
    if (!trimmed && !attachmentPath) return { ok: false };

    var row = {
      conversation_id: conversationId,
      sender_id: senderId,
      content: trimmed || '',
      attachment_path: attachmentPath || null
    };

    var resp = await client.from('messages').insert([row]);
    if (resp.error) return { ok: false, error: resp.error };

    await touchConversation(client, conversationId);
    return { ok: true };
  }

  async function uploadAttachment(client, userId, conversationId, file) {
    var safeName = String(file.name || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = userId + '/messages/' + conversationId + '/' + Date.now() + '-' + safeName;
    var up = await client.storage.from('images').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg'
    });
    if (up.error) throw up.error;
    return path;
  }

  function buildOrderNotificationText(opts) {
    opts = opts || {};
    var pieces = [opts.title || 'Nouvelle commande'];
    if (opts.product) pieces.push('Produit: ' + opts.product);
    if (opts.qty) pieces.push('Quantite: ' + opts.qty);
    if (opts.amount) pieces.push('Montant: ' + opts.amount);
    if (opts.client) pieces.push('Client: ' + opts.client);
    if (opts.commune) pieces.push('Commune: ' + opts.commune);
    if (opts.departement) pieces.push('Departement: ' + opts.departement);
    if (opts.status) pieces.push('Statut: ' + opts.status);
    if (opts.orderId) pieces.push('ID: ' + String(opts.orderId).slice(0, 8));
    return pieces.join(' | ');
  }

  async function notifyVendorNewOrder(client, opts) {
    if (!client || !opts || !opts.buyerId || !opts.vendorId || !opts.productId) return;
    var convoId = await ensureConversation(client, opts.buyerId, opts.vendorId, opts.productId);
    if (!convoId) return;
    var text = buildOrderNotificationText(opts);
    await sendMessage(client, convoId, opts.buyerId, text, null);
  }

  window.VendzaMessaging = {
    escapeHtml: escapeHtml,
    resolveImageUrl: resolveImageUrl,
    isOrderMessage: isOrderMessage,
    parseOrderMessage: parseOrderMessage,
    formatOrderCardHtml: formatOrderCardHtml,
    ensureConversation: ensureConversation,
    sendMessage: sendMessage,
    uploadAttachment: uploadAttachment,
    notifyVendorNewOrder: notifyVendorNewOrder,
    buildOrderNotificationText: buildOrderNotificationText
  };
})();
