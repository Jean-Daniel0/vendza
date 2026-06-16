'use strict';

(function () {
  function randomHex(bytes) {
    var arr = new Uint8Array(bytes);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 256);
    }
    var out = '';
    for (var j = 0; j < arr.length; j += 1) {
      out += arr[j].toString(16).padStart(2, '0');
    }
    return out;
  }

  function generateQrToken() {
    return randomHex(16);
  }

  function buildQrPayload(orderId, vendorId, token) {
    return 'vendza:order:' + String(orderId || '') + ':vendor:' + String(vendorId || '') + ':token:' + String(token || '');
  }

  function parseQrPayload(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;

    if (raw.indexOf('vendza:order:') === 0) {
      var m = raw.match(/^vendza:order:([^:]+):vendor:([^:]*):token:([a-f0-9]+)$/i);
      if (m) {
        return {
          format: 'vendza',
          orderId: m[1],
          vendorId: m[2] || '',
          token: m[3],
          payload: raw
        };
      }
    }

    if (raw.indexOf('order:') === 0) {
      return { format: 'legacy', orderId: raw.split(':')[1], vendorId: '', token: '', payload: raw };
    }

    if (/^[0-9]+$/.test(raw)) {
      return { format: 'legacy', orderId: raw, vendorId: '', token: '', payload: raw };
    }

    return null;
  }

  async function tryUpdateOrderWithPatch(client, orderId, patch) {
    try {
      var resp = await client.from('orders').update(patch).eq('id', orderId).select('*').maybeSingle();
      if (!resp.error) return { ok: true, data: resp.data || null };
      return { ok: false, error: resp.error };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  async function persistOrderQr(client, orderId, token, payload) {
    var patches = [
      { qr_token: token, qr_payload: payload, qr_code: payload },
      { qr_token: token, qr_code: payload },
      { qr_payload: payload, qr_code: payload },
      { validation_code: token, qr_code: payload },
      { qr_code: payload }
    ];

    for (var i = 0; i < patches.length; i += 1) {
      var result = await tryUpdateOrderWithPatch(client, orderId, patches[i]);
      if (result.ok) return result.data;
      var msg = (result.error && result.error.message) ? String(result.error.message).toLowerCase() : '';
      var missingColumn =
        (msg.indexOf('column') >= 0 && msg.indexOf('does not exist') >= 0) ||
        (msg.indexOf('could not find the') >= 0 && msg.indexOf('column') >= 0);
      if (!missingColumn) throw result.error;
    }
    return null;
  }

  async function ensureOrderQr(client, orderRow, vendorIdOverride) {
    if (!client || !orderRow || !orderRow.id) return null;
    var row = orderRow;
    var parsedExisting = parseQrPayload(row.qr_payload || row.qr_code || '');
    var existingToken = row.qr_token || row.validation_code || (parsedExisting && parsedExisting.token) || '';
    var vendorId = vendorIdOverride || row.vendor_id || row.seller_id || row.owner_id || row.user_id || (parsedExisting && parsedExisting.vendorId) || '';
    var token = existingToken || generateQrToken();
    var payload = buildQrPayload(row.id, vendorId, token);

    var needsUpdate = !existingToken || !parsedExisting || parsedExisting.orderId !== String(row.id);
    if (needsUpdate) {
      row = await persistOrderQr(client, row.id, token, payload) || row;
    }

    return {
      orderId: String(row.id),
      vendorId: String(vendorId || ''),
      token: String(token),
      payload: payload
    };
  }

  window.VendzaQR = {
    generateQrToken: generateQrToken,
    buildQrPayload: buildQrPayload,
    parseQrPayload: parseQrPayload,
    persistOrderQr: persistOrderQr,
    ensureOrderQr: ensureOrderQr
  };
})();
