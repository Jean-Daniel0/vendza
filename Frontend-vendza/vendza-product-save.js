'use strict';

(function (global) {
  function missingColumn(error) {
    var msg = String((error && error.message) || '');
    var miss = msg.match(/Could not find the '([^']+)' column/i);
    return miss && miss[1] ? miss[1] : '';
  }

  function stripMissingColumn(error, payload) {
    var col = missingColumn(error);
    if (!col || !Object.prototype.hasOwnProperty.call(payload, col)) return false;
    delete payload[col];
    return true;
  }

  async function saveProductRow(client, options) {
    if (!client || !options) return { data: null, error: new Error('Client Supabase manquant') };
    var row = Object.assign({}, options.row || {});
    var editId = options.editId || '';
    var vendorId = options.vendorId || '';
    var lastError = null;

    for (var attempt = 0; attempt < 24; attempt += 1) {
      try {
        var resp;
        if (editId) {
          var q = client.from('products').update(row).eq('id', editId);
          if (vendorId) q = q.eq('vendor_id', vendorId);
          resp = await q.select().single();
        } else {
          var ins = Object.assign({}, row);
          if (vendorId) ins.vendor_id = vendorId;
          resp = await client.from('products').insert([ins]).select().single();
        }
        if (!resp.error && resp.data) return { data: resp.data, error: null };
        if (resp.error && stripMissingColumn(resp.error, row)) {
          lastError = resp.error;
          continue;
        }
        return { data: null, error: resp.error || lastError };
      } catch (err) {
        return { data: null, error: err };
      }
    }
    return { data: null, error: lastError || new Error('Sauvegarde produit impossible') };
  }

  global.VendzaProductSave = {
    saveProductRow: saveProductRow,
    stripMissingColumn: stripMissingColumn
  };
})(typeof window !== 'undefined' ? window : globalThis);
