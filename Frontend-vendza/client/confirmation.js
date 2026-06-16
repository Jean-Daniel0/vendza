'use strict';

document.addEventListener('DOMContentLoaded', function () {
  var stream = null;
  var scanInterval = null;
  var currentOrder = null;
  var detectedData = null;
  var authUser = null;

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function pickFirst(row, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var v = row[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }

  function isOwner(row, uid) {
    var buyer = pickFirst(row, ['user_id', 'buyer_id', 'client_id', 'customer_id']);
    return buyer && String(buyer) === String(uid);
  }

  function isVendor(row, uid) {
    var vendor = pickFirst(row, ['vendor_id', 'seller_id', 'owner_id']);
    return vendor && String(vendor) === String(uid);
  }

  function isMissingColumnError(err) {
    var msg = String((err && err.message) || '').toLowerCase();
    return (msg.indexOf("could not find the '") >= 0 && msg.indexOf('column') >= 0) ||
      (msg.indexOf('column "') >= 0 && msg.indexOf('does not exist') >= 0);
  }

  function fmtMoney(n) {
    var num = Number(n);
    if (!Number.isFinite(num)) num = 0;
    return 'HTG ' + num.toLocaleString('fr-FR');
  }

  function formatDisplayId(id) {
    if (!id) return '—';
    var s = String(id).replace(/-/g, '').toUpperCase();
    if (s.length >= 8) return 'CMD-' + s.slice(0, 8);
    return String(id).slice(0, 20);
  }

  function switchState(state) {
    ['scan', 'detected', 'success', 'error'].forEach(function (s) {
      var el = document.getElementById('state-' + s);
      if (el) el.style.display = s === state ? 'block' : 'none';
    });
  }

  function showError(title, sub) {
    var t = document.getElementById('error-title');
    var s = document.getElementById('error-sub');
    if (t) t.textContent = title || 'Erreur';
    if (s) s.textContent = sub || '';
    switchState('error');
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function launchConfetti() {
    var wrap = document.getElementById('confetti-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    var colors = ['#2563eb', '#0d9488', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6'];
    for (var i = 0; i < 60; i += 1) {
      var el = document.createElement('di' + 'v');
      el.className = 'confetti-piece';
      el.style.cssText =
        'left:' + (Math.random() * 100) + '%;' +
        'background:' + colors[Math.floor(Math.random() * colors.length)] + ';' +
        'animation-duration:' + (1.5 + Math.random() * 2) + 's;';
      wrap.appendChild(el);
    }
    setTimeout(function () { wrap.innerHTML = ''; }, 4000);
  }

  function parseScanText(text) {
    if (window.VendzaQR && typeof window.VendzaQR.parseQrPayload === 'function') {
      var parsed = window.VendzaQR.parseQrPayload(text);
      if (parsed && parsed.orderId) return parsed;
    }
    var raw = String(text || '').trim();
    try {
      var url = new URL(raw);
      var id = url.searchParams.get('id');
      if (id) return { format: 'url', orderId: id, token: '', payload: raw };
    } catch (_) {}
    if (raw.length >= 8) return { format: 'legacy', orderId: raw, token: '', payload: raw };
    return null;
  }

  async function maybeFindOrderByEq(client, column, value) {
    try {
      var resp = await client.from('orders').select('*').eq(column, value).maybeSingle();
      if (resp.error) {
        if (isMissingColumnError(resp.error)) return null;
        return { error: resp.error };
      }
      return resp.data || null;
    } catch (err) {
      if (isMissingColumnError(err)) return null;
      return { error: err };
    }
  }

  async function getOrderFromScan(client, scanData) {
    var byId = await maybeFindOrderByEq(client, 'id', scanData.orderId);
    if (byId && !byId.error) return byId;
    if (byId && byId.error) throw byId.error;

    if (scanData.payload) {
      var byPayload = await maybeFindOrderByEq(client, 'qr_code', scanData.payload);
      if (byPayload && !byPayload.error) return byPayload;
      if (byPayload && byPayload.error) throw byPayload.error;
    }

    if (scanData.token) {
      var byToken = await maybeFindOrderByEq(client, 'qr_token', scanData.token);
      if (byToken && !byToken.error) return byToken;
      if (byToken && byToken.error) throw byToken.error;
    }

    return null;
  }

  function fillDetected(row) {
    var d = new Date(row.created_at || row.date || Date.now());
    document.getElementById('det-id').textContent = formatDisplayId(row.id);
    document.getElementById('det-date').textContent = d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    document.getElementById('det-vendeur').textContent =
      pickFirst(row, ['vendor_name', 'vendor', 'seller_name']) || 'Vendeur';
    document.getElementById('det-total').textContent = fmtMoney(
      row.total_amount ?? row.total ?? row.amount ?? 0
    );
    document.getElementById('det-statut').textContent = row.is_validated ? '✓ Livrée' : '✓ Payée';
  }

  async function processQR(data) {
    var client = getClient();
    if (!client || !authUser) {
      showError('Connexion requise', 'Veuillez vous connecter.');
      return;
    }

    var scanData = parseScanText(data);
    if (!scanData || !scanData.orderId) {
      showError('QR Code invalide', 'Ce QR code ne correspond à aucune commande Vendza.');
      return;
    }

    try {
      var row = await getOrderFromScan(client, scanData);
      if (!row) {
        showError('Commande introuvable', 'Aucune commande ne correspond à ce QR code.');
        return;
      }

      if (!isOwner(row, authUser.id)) {
        showError('Accès refusé', 'Cette commande ne vous appartient pas.');
        return;
      }

      if (scanData.format === 'vendza') {
        var expectedToken = row.qr_token || row.validation_code || '';
        var expectedPayload = row.qr_payload || row.qr_code || '';
        var tokenOk = expectedToken && String(expectedToken) === String(scanData.token || '');
        var payloadOk = expectedPayload && String(expectedPayload) === String(scanData.payload || '');
        if (!tokenOk && !payloadOk) {
          showError('QR invalide', 'Ce QR code ne correspond pas à votre commande.');
          return;
        }
      }

      currentOrder = row;
      detectedData = scanData;
      fillDetected(row);
      switchState('detected');
    } catch (err) {
      showError('Erreur', (err && err.message) || 'Lecture impossible');
    }
  }

  async function updateOrderAsDelivered(client, rowId) {
    var payload = {
      client_confirmed: true,
      buyer_confirmed: true,
      reception_confirmed: true,
      client_confirmed_at: new Date().toISOString(),
      is_validated: true,
      status: 'livree',
      validated_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      date_livraison: new Date().toISOString()
    };

    for (var i = 0; i < 14; i += 1) {
      var resp = await client.from('orders').update(payload).eq('id', rowId);
      if (!resp.error) return { ok: true };
      if (isMissingColumnError(resp.error)) {
        var msg = String(resp.error.message || '');
        var miss = msg.match(/Could not find the '([^']+)' column/i);
        if (miss && miss[1] && Object.prototype.hasOwnProperty.call(payload, miss[1])) {
          delete payload[miss[1]];
          continue;
        }
        var miss2 = msg.match(/column \"([^\"]+)\" does not exist/i);
        if (miss2 && miss2[1] && Object.prototype.hasOwnProperty.call(payload, miss2[1])) {
          delete payload[miss2[1]];
          continue;
        }
      }
      return { ok: false, error: resp.error };
    }
    return { ok: false, error: new Error('Mise à jour impossible') };
  }

  async function validateOrder() {
    if (!currentOrder || !detectedData) return;
    var client = getClient();
    if (!client) return showToast('Supabase indisponible');

    var btn = document.getElementById('btn-validate');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Validation en cours…';
    }

    try {
      var out = await updateOrderAsDelivered(client, currentOrder.id);
      if (!out.ok) throw out.error || new Error('Mise à jour impossible');

      currentOrder.client_confirmed = true;
      currentOrder.reception_confirmed = true;
      currentOrder.status = 'livree';

      if (window.VendzaVendorWallet) {
        await window.VendzaVendorWallet.notifyVendorDeliveryConfirmed(client, authUser.id, currentOrder);
        var credit = await window.VendzaVendorWallet.creditVendorForOrder(client, currentOrder);
        if (credit && credit.ok && !credit.already) {
          showToast('Vendeur notifie et credite (' + fmtMoney(credit.amount || window.VendzaVendorWallet.orderAmount(currentOrder)) + ')');
        } else if (credit && credit.already) {
          showToast('Livraison confirmee (deja creditee)');
        }
      }

      document.getElementById('success-id').textContent = formatDisplayId(currentOrder.id);
      switchState('success');
      launchConfetti();
    } catch (err) {
      showError('Erreur réseau', (err && err.message) || 'Impossible de valider.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✅ Confirmer la réception';
      }
    }
  }

  function stopCamera() {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
  }

  async function startCamera() {
    var btn = document.getElementById('btn-start');
    if (btn) {
      btn.textContent = '⏳ Activation…';
      btn.disabled = true;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      var video = document.getElementById('video');
      video.srcObject = stream;
      await video.play();

      var camStatus = document.getElementById('cam-status');
      if (camStatus) {
        camStatus.className = 'scanner-status status-active';
        camStatus.textContent = '🟢 Active';
      }
      document.getElementById('scan-msg-text').textContent = 'Caméra active — pointez sur un QR code';
      if (btn) btn.style.display = 'none';

      scanInterval = setInterval(scanFrame, 300);
      showToast('📷 Caméra activée');
    } catch (err) {
      if (btn) {
        btn.textContent = '📷 Démarrer la caméra';
        btn.disabled = false;
      }
      showToast('❌ Accès caméra refusé — utilisez la saisie manuelle');
      document.getElementById('scan-msg-text').textContent =
        'Accès caméra impossible — utilisez la saisie manuelle ci-dessous';
    }
  }

  function scanFrame() {
    var video = document.getElementById('video');
    var canvas = document.getElementById('canvas-hidden');
    if (!video || !canvas || typeof jsQR !== 'function') return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data) {
      stopCamera();
      processQR(code.data);
    }
  }

  function resetToScan() {
    currentOrder = null;
    detectedData = null;
    var manual = document.getElementById('manual-id');
    if (manual) manual.value = '';

    var btn = document.getElementById('btn-start');
    if (btn) {
      btn.style.display = '';
      btn.textContent = '📷 Démarrer la caméra';
      btn.disabled = false;
    }
    var camStatus = document.getElementById('cam-status');
    if (camStatus) {
      camStatus.className = 'scanner-status status-waiting';
      camStatus.textContent = '⏳ En attente';
    }
    document.getElementById('scan-msg-text').textContent =
      'Appuyez sur « Démarrer » pour activer la caméra';

    switchState('scan');
    stopCamera();
  }

  function manualValidate() {
    var id = (document.getElementById('manual-id').value || '').trim();
    if (!id) {
      showToast('⚠️ Entrez un ID de commande');
      return;
    }
    processQR(id);
  }

  document.getElementById('btn-start').addEventListener('click', startCamera);
  document.getElementById('btn-validate').addEventListener('click', validateOrder);
  document.getElementById('btn-rescan').addEventListener('click', resetToScan);
  document.getElementById('btn-retry').addEventListener('click', resetToScan);
  document.getElementById('btn-manual').addEventListener('click', manualValidate);
  window.addEventListener('beforeunload', stopCamera);

  (async function init() {
    var client = getClient();
    if (!client || !client.auth) {
      showError('Supabase indisponible', 'Configuration manquante.');
      return;
    }

    try {
      var authResp = await client.auth.getUser();
      authUser = authResp && authResp.data && authResp.data.user;
      if (!authUser) {
        window.location.href = window.VZ ? window.VZ.login('client/confirmation.html' + window.location.search) : '../authentification/connexion.html?redirect=' + encodeURIComponent('client/confirmation.html' + window.location.search);
        return;
      }

      var urlOrderId = new URLSearchParams(window.location.search).get('id');
      if (urlOrderId) {
        await processQR('confirmation.html?id=' + encodeURIComponent(urlOrderId));
        return;
      }

      switchState('scan');
    } catch (err) {
      showError('Erreur', (err && err.message) || 'Initialisation impossible');
    }
  })();
});
