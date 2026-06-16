'use strict';

(function () {
  var PRO_CODES = {
    'pro-350': true,
    'elite-499': true,
    'pro local': true,
    'pro national': true,
    'pro_local': true,
    'pro_national': true
  };

  /** Image fournie : Frontend-vendza/images/6270515.png */
  var BADGE_IMAGE_FILE = '6270515.png';

  function resolveBadgeImageUrl() {
    try {
      var path = String((window.location && window.location.pathname) || '').replace(/\\/g, '/');
      if (/\/(client|vendeur|authentification)\//i.test(path)) {
        return '../images/' + BADGE_IMAGE_FILE;
      }
      return 'images/' + BADGE_IMAGE_FILE;
    } catch (_) {
      return 'images/' + BADGE_IMAGE_FILE;
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Affichage carte produit : « Par NomBoutique » */
  function formatParShopName(shopName) {
    var raw = String(shopName || 'Vendeur').trim() || 'Vendeur';
    if (/^par\s+/i.test(raw)) return raw;
    return 'Par ' + raw;
  }

  function isProPlanCode(code) {
    var k = String(code || '').toLowerCase().trim();
    if (!k || k === 'free') return false;
    if (PRO_CODES[k]) return true;
    return k.indexOf('pro') >= 0 || k.indexOf('elite') >= 0;
  }

  function getShopName(source) {
    if (!source) return 'Vendeur';
    var shop = source.shopName || source.shop_name || source.store_name || source.boutique;
    if (shop && String(shop).trim()) return String(shop).trim();
    var person = [
      source.vendor_name,
      source.vendorName,
      source.vendor,
      source.seller_name,
      source.full_name,
      source.display_name,
      source.nom,
      source.name
    ];
    var i;
    for (i = 0; i < person.length; i += 1) {
      if (person[i] && String(person[i]).trim()) return String(person[i]).trim();
    }
    if (source.first_name || source.last_name) {
      var joined = [source.first_name, source.last_name].filter(Boolean).join(' ').trim();
      if (joined) return joined;
    }
    return 'Vendeur';
  }

  function badgeHtml(opts) {
    opts = opts || {};
    var size = Number(opts.size) > 0 ? Number(opts.size) : 16;
    var cls = 'vendza-verified' + (opts.inline ? ' vendza-verified--inline' : '');
    var src = escapeHtml(resolveBadgeImageUrl());
    return (
      '<span class="' + cls + '" role="img" aria-label="Vendeur vérifié" title="Vendeur vérifié" ' +
      'style="--vz-badge-size:' + size + 'px">' +
      '<img class="vz-badge-img" src="' + src + '" width="' + size + '" height="' + size + '" alt="" decoding="async" loading="lazy"/>' +
      '</span>'
    );
  }

  function shopLineHtml(shopName, verified, size) {
    var shop = escapeHtml(formatParShopName(shopName));
    var badge = verified ? badgeHtml({ size: size || 16, inline: true }) : '';
    return (
      '<span class="p-card-shop-line">' +
      '<span class="p-card-shop-name">' + shop + '</span>' +
      badge +
      '</span>'
    );
  }

  function applyShopLine(el, shopName, verified, size) {
    if (!el) return;
    el.innerHTML = shopLineHtml(shopName, verified, size);
  }

  async function fetchVendorShopFromDb(client, vendorId) {
    if (!client || !vendorId || !client.from) return null;
    var tables = [
      { table: 'vendors', key: 'id' },
      { table: 'vendors', key: 'user_id' },
      { table: 'users', key: 'id' },
      { table: 'profiles', key: 'id' }
    ];
    var i;
    for (i = 0; i < tables.length; i += 1) {
      try {
        var resp = await client.from(tables[i].table).select('*').eq(tables[i].key, vendorId).maybeSingle();
        if (!resp.error && resp.data) return resp.data;
      } catch (_) {}
    }
    return null;
  }

  async function enrichVendor(client, product) {
    if (!product) return product;
    var vid = product.vendor_id || product.seller_id || product.owner_id;
    if (!vid) return product;

    if (!product.shop_name && !product.store_name && !product.boutique && client) {
      var row = await fetchVendorShopFromDb(client, vid);
      if (row) {
        product.shop_name = product.shop_name || row.shop_name || row.store_name || row.boutique;
        product.store_name = product.store_name || row.store_name;
        product.vendor_name = product.vendor_name || row.vendor_name || row.name;
      }
    }

    product._shopName = getShopName(product);

    if (client && client.from) {
      try {
        var subResp = window.VendzaSubscription
          ? await window.VendzaSubscription.querySubscription(client, vid)
          : await client.from('vendor_subscriptions').select('plan_code,status').eq('user_id', vid).maybeSingle();
        if (!subResp.error && subResp.data) {
          product._planCode = window.VendzaSubscription
            ? window.VendzaSubscription.planCodeFromRow(subResp.data)
            : (subResp.data.plan_code || 'free');
          product._vendorVerified = String(subResp.data.status || 'active').toLowerCase() === 'active' &&
            isProPlanCode(product._planCode);
        }
      } catch (_) {}
      if (product._vendorVerified == null) {
        var set = await fetchVerifiedSet(client, [vid]);
        product._vendorVerified = !!set[String(vid)];
      }
    }

    return product;
  }

  function parseDepartmentsArray(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
    if (typeof raw === 'string') {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      } catch (_) {}
      if (raw.trim()) return [raw.trim()];
    }
    return [];
  }

  function countCoverageDepartments(profil) {
    if (!profil) return 0;
    var seen = {};
    if (profil.dept) seen[String(profil.dept).trim()] = true;
    parseDepartmentsArray(profil.coverageDepartments).forEach(function (d) {
      if (d) seen[String(d).trim()] = true;
    });
    return Object.keys(seen).filter(Boolean).length;
  }

  function formatCoverageLabel(profil) {
    if (!profil) return '';
    var code = String(profil.planCode || '').toLowerCase();
    if (code === 'elite-499') return 'Couverture nationale';
    if (!isProPlanCode(code)) return '';
    var n = countCoverageDepartments(profil);
    if (n <= 0 && profil.dept) n = 1;
    if (n <= 0) return '';
    return n + ' département' + (n > 1 ? 's' : '') + ' couvert' + (n > 1 ? 's' : '');
  }

  async function expandVendorIdSet(client, ids) {
    var expanded = {};
    (ids || []).forEach(function (id) {
      if (id) expanded[String(id)] = true;
    });
    if (!client || !client.from) return Object.keys(expanded);
    var list = Object.keys(expanded);
    if (!list.length) return list;
    try {
      var byIdUsers = await client.from('users').select('id,user_id').in('id', list);
      if (byIdUsers.data) {
        byIdUsers.data.forEach(function (row) {
          if (row.id) expanded[String(row.id)] = true;
          if (row.user_id) expanded[String(row.user_id)] = true;
        });
      }
      var byUserUsers = await client.from('users').select('id,user_id').in('user_id', list);
      if (byUserUsers.data) {
        byUserUsers.data.forEach(function (row) {
          if (row.id) expanded[String(row.id)] = true;
          if (row.user_id) expanded[String(row.user_id)] = true;
        });
      }
    } catch (_) {}
    try {
      var byId = await client.from('vendors').select('id,user_id').in('id', list);
      if (byId.data) {
        byId.data.forEach(function (row) {
          if (row.id) expanded[String(row.id)] = true;
          if (row.user_id) expanded[String(row.user_id)] = true;
        });
      }
      var byUser = await client.from('vendors').select('id,user_id').in('user_id', list);
      if (byUser.data) {
        byUser.data.forEach(function (row) {
          if (row.id) expanded[String(row.id)] = true;
          if (row.user_id) expanded[String(row.user_id)] = true;
        });
      }
    } catch (_) {}
    return Object.keys(expanded);
  }

  async function propagateVerifiedAliases(client, set) {
    if (!client || !client.from || !set) return;
    var active = Object.keys(set).filter(function (k) { return set[k]; });
    if (!active.length) return;
    try {
      var byUserUsers = await client.from('users').select('id,user_id').in('user_id', active);
      if (byUserUsers.data) {
        byUserUsers.data.forEach(function (row) {
          if (row.id && set[String(row.user_id)]) set[String(row.id)] = true;
        });
      }
      var byIdUsers = await client.from('users').select('id,user_id').in('id', active);
      if (byIdUsers.data) {
        byIdUsers.data.forEach(function (row) {
          if (row.user_id && set[String(row.id)]) set[String(row.user_id)] = true;
        });
      }
    } catch (_) {}
    try {
      var byUser = await client.from('vendors').select('id,user_id').in('user_id', active);
      if (byUser.data) {
        byUser.data.forEach(function (row) {
          if (row.id && set[String(row.user_id)]) set[String(row.id)] = true;
        });
      }
      var byId = await client.from('vendors').select('id,user_id').in('id', active);
      if (byId.data) {
        byId.data.forEach(function (row) {
          if (row.user_id && set[String(row.id)]) set[String(row.user_id)] = true;
        });
      }
    } catch (_) {}
  }

  async function fetchVerifiedSet(client, vendorIds) {
    var set = {};
    var ids = await expandVendorIdSet(client, Array.from(new Set((vendorIds || []).filter(Boolean).map(String))));
    if (!ids.length) return set;
    if (!client || !client.from) return set;

    var queries = [
      function () {
        return client.from('vendor_subscriptions')
          .select('user_id,plan_code,status,expires_at')
          .in('user_id', ids);
      }
    ];

    var q;
    for (q = 0; q < queries.length; q += 1) {
      try {
        var resp = await queries[q]();
        if (resp.error || !Array.isArray(resp.data)) continue;
        resp.data.forEach(function (row) {
          var id = row.user_id || row.vendor_id;
          var status = String(row.status || 'active').toLowerCase();
          var code = row.plan_code || '';
          if (!id || status !== 'active' || !isProPlanCode(code)) return;
          if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return;
          set[String(id)] = true;
        });
      } catch (_) {}
    }

    var profileQueries = [
      function () {
        return client.from('users').select('id,user_id,plan_code,subscription_plan,is_pro,is_verified,verified').in('id', ids);
      },
      function () {
        return client.from('users').select('id,user_id,plan_code,subscription_plan,is_pro,is_verified,verified').in('user_id', ids);
      },
      function () {
        return client.from('profiles').select('id,plan_code,subscription_plan,is_pro,is_verified,verified').in('id', ids);
      },
      function () {
        return client.from('vendors').select('id,user_id,plan_code,subscription_plan,is_pro,is_verified,verified').in('id', ids);
      },
      function () {
        return client.from('vendors').select('id,user_id,plan_code,subscription_plan,is_pro,is_verified,verified').in('user_id', ids);
      }
    ];

    function markProRow(row) {
      var id = row.id || row.user_id;
      if (!id) return;
      var code = row.plan_code || row.subscription_plan || '';
      if (row.is_pro === true || row.is_verified === true || row.verified === true) {
        set[String(id)] = true;
        return;
      }
      if (isProPlanCode(code)) set[String(id)] = true;
    }

    for (q = 0; q < profileQueries.length; q += 1) {
      try {
        var profResp = await profileQueries[q]();
        if (profResp.error || !Array.isArray(profResp.data)) continue;
        profResp.data.forEach(markProRow);
      } catch (_) {}
    }

    await propagateVerifiedAliases(client, set);

    return set;
  }

  window.VendzaVerified = {
    isProPlanCode: isProPlanCode,
    formatParShopName: formatParShopName,
    getShopName: getShopName,
    badgeHtml: badgeHtml,
    shopLineHtml: shopLineHtml,
    applyShopLine: applyShopLine,
    enrichVendor: enrichVendor,
    fetchVerifiedSet: fetchVerifiedSet,
    resolveBadgeImageUrl: resolveBadgeImageUrl,
    parseDepartmentsArray: parseDepartmentsArray,
    countCoverageDepartments: countCoverageDepartments,
    formatCoverageLabel: formatCoverageLabel,
    BADGE_IMAGE_FILE: BADGE_IMAGE_FILE
  };
})();
