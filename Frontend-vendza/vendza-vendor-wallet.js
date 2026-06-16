'use strict';

(function (global) {
  function pickFirst(row, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var v = row && row[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }

  function orderAmount(row) {
    if (global.VendzaOrderPrices) {
      return global.VendzaOrderPrices.orderTotal(row, global.VendzaOrderPrices.parseOrderItems(row));
    }
    return Number(row.total_amount ?? row.total ?? row.amount ?? row.price ?? 0) || 0;
  }

  function fmtAmount(n) {
    if (global.VendzaOrderPrices) return global.VendzaOrderPrices.fmtMoney(n);
    return Number(n || 0).toLocaleString('fr-FR') + ' Gdes';
  }

  async function notifyVendorDeliveryConfirmed(client, buyerId, orderRow) {
    if (!client || !buyerId || !orderRow) return;
    var vendorId = pickFirst(orderRow, ['vendor_id', 'seller_id', 'owner_id']);
    var productId = pickFirst(orderRow, ['product_id']);
    if (!vendorId || !productId) return;

    try {
      var convoId = null;
      var convoResp = await client.from('conversations')
        .select('id')
        .eq('product_id', productId)
        .eq('buyer_id', buyerId)
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (convoResp && convoResp.data && convoResp.data.id) convoId = convoResp.data.id;
      else {
        var createConvo = await client.from('conversations')
          .insert([{ product_id: productId, buyer_id: buyerId, vendor_id: vendorId }])
          .select('id')
          .single();
        if (createConvo && createConvo.data && createConvo.data.id) convoId = createConvo.data.id;
      }
      if (!convoId) return;

      var productName = pickFirst(orderRow, ['product_name', 'title', 'item_name']) || 'Produit';
      var amt = orderAmount(orderRow);
      var pieces = [
        'Livraison confirmee par le client',
        'Produit: ' + productName,
        'Montant: ' + fmtAmount(amt),
        'Commande: ' + String(orderRow.id || '').slice(0, 8)
      ];
      await client.from('messages').insert([{
        conversation_id: convoId,
        sender_id: buyerId,
        content: pieces.join(' | ')
      }]);
    } catch (_) {}
  }

  async function creditVendorForOrder(client, orderRow) {
    if (!client || !orderRow || !orderRow.id) return { ok: false, error: 'missing_order' };

    try {
      var rpc = await client.rpc('credit_vendor_for_delivered_order', { p_order_id: orderRow.id });
      if (!rpc.error && rpc.data) {
        if (typeof rpc.data === 'object' && rpc.data.ok) return rpc.data;
        if (rpc.data === true) return { ok: true };
      }
    } catch (_) {}

    var vendorId = pickFirst(orderRow, ['vendor_id', 'seller_id', 'owner_id']);
    var amount = orderAmount(orderRow);
    if (!vendorId || amount <= 0) return { ok: false, error: 'invalid_vendor_or_amount' };

    if (orderRow.vendor_credited === true) return { ok: true, already: true };

    if (!orderRow.client_confirmed && !orderRow.reception_confirmed && !orderRow.buyer_confirmed) {
      return { ok: false, error: 'delivery_not_confirmed' };
    }

    try {
      var existing = await client.from('vendor_wallets').select('*').eq('vendor_id', vendorId).maybeSingle();
      var balance = 0;
      if (existing && existing.data) balance = Number(existing.data.balance || 0);
      var newBalance = balance + amount;

      if (existing && existing.data) {
        await client.from('vendor_wallets').update({ balance: newBalance }).eq('vendor_id', vendorId);
      } else {
        await client.from('vendor_wallets').insert([{ vendor_id: vendorId, balance: newBalance }]);
      }

      await client.from('vendor_wallet_transactions').insert([{
        vendor_id: vendorId,
        order_id: orderRow.id,
        amount: amount,
        type: 'credit_livraison',
        description: 'Credit livraison confirmee'
      }]);

      await client.from('orders').update({ vendor_credited: true }).eq('id', orderRow.id);
      return { ok: true, amount: amount, balance: newBalance };
    } catch (err) {
      return { ok: false, error: (err && err.message) || 'wallet_failed' };
    }
  }

  global.VendzaVendorWallet = {
    notifyVendorDeliveryConfirmed: notifyVendorDeliveryConfirmed,
    creditVendorForOrder: creditVendorForOrder,
    orderAmount: orderAmount
  };
})(typeof window !== 'undefined' ? window : global);
