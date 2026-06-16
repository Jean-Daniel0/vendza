'use strict';

(function () {
  var SUBSCRIPTION_FIELDS = ['plan_code', 'status', 'expires_at', 'departments', 'billing', 'benefits'];

  function pickSubscriptionFields(fields) {
    return (fields || SUBSCRIPTION_FIELDS).join(',');
  }

  async function querySubscription(client, userId, fields) {
    if (!client || !client.from || !userId) return { data: null, error: null };
    var list = (fields || SUBSCRIPTION_FIELDS).slice();
    for (var attempt = 0; attempt < 12 && list.length; attempt += 1) {
      try {
        var resp = await client
          .from('vendor_subscriptions')
          .select(pickSubscriptionFields(list))
          .eq('user_id', userId)
          .maybeSingle();
        if (!resp.error) return resp;
        var msg = String((resp.error && resp.error.message) || '');
        var miss = msg.match(/Could not find the '([^']+)' column/i);
        if (miss && miss[1]) {
          list = list.filter(function (f) { return f !== miss[1]; });
          continue;
        }
        return resp;
      } catch (err) {
        return { data: null, error: err };
      }
    }
    return { data: null, error: null };
  }

  function planCodeFromRow(row) {
    if (!row) return 'free';
    return row.plan_code || row.plan || 'free';
  }

  window.VendzaSubscription = {
    querySubscription: querySubscription,
    planCodeFromRow: planCodeFromRow,
    SUBSCRIPTION_FIELDS: SUBSCRIPTION_FIELDS
  };
})();
