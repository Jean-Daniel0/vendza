'use strict';

(function (global) {
  function parsePriceToNumber(v) {
    if (v == null) return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    var str = String(v).replace(/[^0-9.,]/g, '').replace(',', '.');
    var n = parseFloat(str);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtMoney(n) {
    var num = Number(n);
    if (!Number.isFinite(num)) num = 0;
    return num.toLocaleString('fr-FR') + ' Gdes';
  }

  function pickFirst(row, keys) {
    if (!row) return '';
    for (var i = 0; i < keys.length; i += 1) {
      var v = row[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }

  function parseOrderItems(row) {
    if (!row) return [];
    var raw = row.items || row.order_items || row.cart_items || row.line_items;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (_) { raw = null; }
    }
    if (Array.isArray(raw) && raw.length) {
      return raw.map(function (it) {
        var qte = Math.max(1, parseInt(it.quantity || it.qte || it.qty || 1, 10) || 1);
        var prix = parsePriceToNumber(it.unit_price ?? it.price ?? it.prix ?? 0);
        if (!prix && it.total) prix = parsePriceToNumber(it.total) / qte;
        return {
          nom: String(it.name || it.nom || it.product_name || it.title || 'Produit'),
          qte: qte,
          prix: prix
        };
      });
    }
    var name = pickFirst(row, ['product_name', 'title', 'item_name', 'description']) || 'Produit';
    var qte = Math.max(1, parseInt(row.quantity || row.qty || 1, 10) || 1);
    var unit = parsePriceToNumber(row.unit_price ?? row.price ?? row.prix ?? 0);
    var total = parsePriceToNumber(row.total_amount ?? row.total ?? row.amount ?? 0);
    if (!unit && total > 0) unit = total / qte;
    return [{ nom: name, qte: qte, prix: unit }];
  }

  function orderTotal(row, items) {
    var total = parsePriceToNumber(
      row && (row.total_amount ?? row.total ?? row.amount ?? row.price)
    );
    if (!total && items && items.length) {
      total = items.reduce(function (s, p) { return s + (Number(p.prix) || 0) * (Number(p.qte) || 1); }, 0);
    }
    return total;
  }

  async function enrichFromProduct(client, row, items) {
    if (!client || !row || !items || !items.length) return items || [];
    var needs = items.some(function (p) { return !p.prix || p.prix <= 0; });
    if (!needs) return items;
    var productId = row.product_id || row.productId;
    if (!productId) return items;
    try {
      var resp = await client.from('products').select('price, name').eq('id', productId).maybeSingle();
      if (resp.error || !resp.data) return items;
      var price = parsePriceToNumber(resp.data.price);
      if (!price) return items;
      return items.map(function (p) {
        return {
          nom: p.nom || resp.data.name || 'Produit',
          qte: p.qte,
          prix: p.prix > 0 ? p.prix : price
        };
      });
    } catch (_) {
      return items;
    }
  }

  async function resolveOrderPricing(client, row) {
    var items = parseOrderItems(row);
    items = await enrichFromProduct(client, row, items);
    var total = orderTotal(row, items);
    return { items: items, total: total };
  }

  global.VendzaOrderPrices = {
    parsePriceToNumber: parsePriceToNumber,
    fmtMoney: fmtMoney,
    pickFirst: pickFirst,
    parseOrderItems: parseOrderItems,
    orderTotal: orderTotal,
    enrichFromProduct: enrichFromProduct,
    resolveOrderPricing: resolveOrderPricing
  };
})(typeof window !== 'undefined' ? window : global);
