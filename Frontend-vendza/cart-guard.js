/**
 * Empêche un vendeur d'ajouter / acheter ses propres produits.
 */
(function (global) {
  var MSG = 'Vous ne pouvez pas acheter vos propres produits.';

  function readStoredUser() {
    try {
      var raw = global.localStorage.getItem('vendza_user_data');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getBuyerIdSync() {
    var u = readStoredUser();
    return u && u.id ? String(u.id) : null;
  }

  function getProductVendorId(product) {
    if (!product) return null;
    var v = product.vendor_id || product.vendorId || product.seller_id || product.owner_id;
    return v != null && String(v).trim() ? String(v) : null;
  }

  function isOwnProductSync(product, buyerId) {
    var bid = buyerId || getBuyerIdSync();
    if (!bid || !product) return false;
    var vid = getProductVendorId(product);
    if (!vid) return false;
    return String(vid) === String(bid);
  }

  function getClient() {
    return global.supabaseClient || global.supabase || null;
  }

  async function getBuyerIdAsync() {
    var client = getClient();
    if (client && client.auth && typeof client.auth.getUser === 'function') {
      try {
        var resp = await client.auth.getUser();
        var user = resp && resp.data && resp.data.user;
        if (user && user.id) return String(user.id);
      } catch (_) {}
    }
    return getBuyerIdSync();
  }

  async function isOwnProductAsync(product) {
    var buyerId = await getBuyerIdAsync();
    if (!buyerId || !product) return false;
    var vid = getProductVendorId(product);
    if (!vid) return false;
    if (String(vid) === String(buyerId)) return true;

    var client = getClient();
    if (!client || typeof client.from !== 'function') return false;
    try {
      var respUser = await client.from('users').select('id,user_id').or('id.eq.' + vid + ',user_id.eq.' + vid).maybeSingle();
      var rowUser = respUser && respUser.data;
      if (rowUser) {
        if (rowUser.user_id && String(rowUser.user_id) === buyerId) return true;
        if (rowUser.id && String(rowUser.id) === buyerId) return true;
      }
    } catch (_) {}
    try {
      var resp = await client.from('vendors').select('id,user_id').or('id.eq.' + vid + ',user_id.eq.' + vid).maybeSingle();
      var row = resp && resp.data;
      if (row) {
        if (row.user_id && String(row.user_id) === buyerId) return true;
        if (row.id && String(row.id) === buyerId) return true;
      }
    } catch (_) {}
    return false;
  }

  function notifyBlocked(message) {
    var msg = message || MSG;
    if (typeof global.VendzaCartGuard._onBlocked === 'function') {
      global.VendzaCartGuard._onBlocked(msg);
      return;
    }
    if (typeof global.alert === 'function') global.alert(msg);
  }

  function guardAdd(product, onSuccess) {
    if (isOwnProductSync(product)) {
      notifyBlocked();
      return false;
    }
    if (typeof onSuccess === 'function') onSuccess();
    return true;
  }

  async function guardAddAsync(product, onSuccess) {
    if (await isOwnProductAsync(product)) {
      notifyBlocked();
      return false;
    }
    if (typeof onSuccess === 'function') onSuccess();
    return true;
  }

  function filterCart(cart, buyerId) {
    var bid = buyerId || getBuyerIdSync();
    if (!bid || !Array.isArray(cart)) return Array.isArray(cart) ? cart : [];
    return cart.filter(function (item) {
      return !isOwnProductSync(item, bid);
    });
  }

  function purgeOwnProductsFromCart(buyerId) {
    try {
      var raw = global.localStorage.getItem('vendza_cart');
      var cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart)) return 0;
      var filtered = filterCart(cart, buyerId);
      var removed = cart.length - filtered.length;
      if (removed > 0) {
        global.localStorage.setItem('vendza_cart', JSON.stringify(filtered));
      }
      return removed;
    } catch (_) {
      return 0;
    }
  }

  global.VendzaCartGuard = {
    MSG: MSG,
    getBuyerIdSync: getBuyerIdSync,
    getBuyerIdAsync: getBuyerIdAsync,
    getProductVendorId: getProductVendorId,
    isOwnProductSync: isOwnProductSync,
    isOwnProductAsync: isOwnProductAsync,
    guardAdd: guardAdd,
    guardAddAsync: guardAddAsync,
    filterCart: filterCart,
    purgeOwnProductsFromCart: purgeOwnProductsFromCart,
    notifyBlocked: notifyBlocked,
    _onBlocked: null
  };
})(typeof window !== 'undefined' ? window : globalThis);
