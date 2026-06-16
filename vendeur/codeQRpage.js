'use strict';

document.addEventListener('DOMContentLoaded', async function () {
  var qrRoot = document.getElementById('qrcode');
  var qrMeta = document.getElementById('qrmeta');
  var validateBtn = document.getElementById('validateBtn');
  var params = new URLSearchParams(window.location.search || '');
  var orderId = params.get('id') || '';
  var client = window.supabaseClient || window.supabase || null;

  if (!orderId) {
    if (qrMeta) qrMeta.textContent = 'Commande introuvable.';
    if (validateBtn) validateBtn.disabled = true;
    return;
  }
  if (!client) {
    if (qrMeta) qrMeta.textContent = 'Supabase indisponible.';
    if (validateBtn) validateBtn.disabled = true;
    return;
  }

  function isTypeOrColumnError(err) {
    var msg = String((err && err.message) || '').toLowerCase();
    return (
      msg.indexOf('invalid input syntax') >= 0 ||
      msg.indexOf('operator does not exist') >= 0 ||
      (msg.indexOf("could not find the '") >= 0 && msg.indexOf('column') >= 0)
    );
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function ensureQrLib() {
    if (window.QRCode) return true;
    var sources = [
      'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js',
      'https://unpkg.com/qrcode@1.5.4/build/qrcode.min.js'
    ];
    for (var i = 0; i < sources.length; i += 1) {
      try {
        await loadScript(sources[i]);
        if (window.QRCode) return true;
      } catch (_) {}
    }
    return false;
  }

  async function getOrder() {
    var resp = await client.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!resp.error && resp.data) return resp.data || null;
    if (resp.error && !isTypeOrColumnError(resp.error)) throw resp.error;

    var byQr = await client.from('orders').select('*').eq('qr_code', orderId).maybeSingle();
    if (!byQr.error) return byQr.data || null;
    if (byQr.error && !isTypeOrColumnError(byQr.error)) throw byQr.error;
    return null;
  }

  async function drawQr(payload) {
    if (!qrRoot) return;
    qrRoot.innerHTML = '';
    if (!payload) {
      qrRoot.innerHTML = '<div class="muted">Payload QR vide.</div>';
      return;
    }
    if (!window.QRCode) {
      qrRoot.innerHTML = '<div class="muted">Bibliotheque QR manquante.</div>';
      return;
    }
    var options = {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    };
    try {
      if (typeof window.QRCode.toCanvas === 'function') {
        var canvas = document.createElement('canvas');
        qrRoot.appendChild(canvas);
        await window.QRCode.toCanvas(canvas, payload, options);
        return;
      }
      if (typeof window.QRCode.toDataURL === 'function') {
        var dataUrl = await window.QRCode.toDataURL(payload, options);
        var img = document.createElement('img');
        img.src = dataUrl;
        img.alt = 'QR commande';
        qrRoot.appendChild(img);
        return;
      }
      qrRoot.innerHTML = '<div class="muted">Aucun moteur QR disponible.</div>';
    } catch (e) {
      qrRoot.innerHTML = '<div class="muted">Erreur generation QR.</div>';
      throw e;
    }
  }

  try {
    var authResp = await client.auth.getUser();
    var authUser = authResp && authResp.data && authResp.data.user;
    if (!authUser) throw new Error('Veuillez vous connecter');
    var order = await getOrder();
    if (!order) throw new Error('Commande non trouvee');
    var vendorId = order.vendor_id || order.seller_id || order.owner_id || order.user_id || '';
    if (vendorId && String(vendorId) !== String(authUser.id)) {
      throw new Error('Commande non autorisee pour ce vendeur');
    }
    var qrData = await window.VendzaQR.ensureOrderQr(client, order, vendorId);
    if (!qrData) throw new Error('Impossible de generer le QR');
    var hasQrLib = await ensureQrLib();
    if (!hasQrLib) throw new Error('Bibliotheque QR manquante');
    await drawQr(qrData.payload);
    if (qrMeta) qrMeta.textContent = 'Commande #' + qrData.orderId + ' • QR unique actif';
  } catch (err) {
    if (qrMeta) qrMeta.textContent = 'Erreur QR: ' + ((err && err.message) || 'inconnue');
  }

  if (validateBtn) {
    validateBtn.addEventListener('click', async function () {
      try {
        var result = await client.from('orders').update({ is_validated: true }).eq('id', orderId);
        if (result.error && isTypeOrColumnError(result.error)) {
          var row = await getOrder();
          if (row && row.id) {
            result = await client.from('orders').update({ is_validated: true }).eq('id', row.id);
          }
        }
        if (result.error) throw result.error;
        alert('Commande validee !');
      } catch (err) {
        alert('Erreur : ' + ((err && err.message) || 'inconnue'));
      }
    });
  }
});


