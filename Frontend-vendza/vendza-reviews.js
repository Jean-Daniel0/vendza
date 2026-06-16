'use strict';

(function () {
  function buildReviewRows(productId, userId, rating, comment, authorName, authorEmail, vendorId) {
    var base = {
      product_id: productId,
      rating: rating,
      comment: comment || '',
      content: comment || '',
      review_text: comment || '',
      author_name: authorName || null,
      user_name: authorName || null,
      reviewer_name: authorName || null,
      user_email: authorEmail || null,
      email: authorEmail || null
    };
    if (vendorId) base.vendor_id = vendorId;

    return [
      Object.assign({ user_id: userId }, base),
      Object.assign({ buyer_id: userId }, base),
      Object.assign({ client_id: userId }, base),
      Object.assign({ customer_id: userId }, base)
    ];
  }

  async function insertReview(client, opts) {
    if (!client || !client.from || !opts || !opts.productId || !opts.userId) {
      return { ok: false, error: { message: 'missing_params' } };
    }

    var rows = buildReviewRows(
      opts.productId,
      opts.userId,
      opts.rating,
      opts.comment,
      opts.authorName,
      opts.authorEmail,
      opts.vendorId
    );

    var lastError = null;
    var i;
    var j;
    for (i = 0; i < rows.length; i += 1) {
      var body = Object.assign({}, rows[i]);
      for (j = 0; j < 14; j += 1) {
        try {
          var resp = await client.from('reviews').insert([body]).select('id').maybeSingle();
          if (!resp.error) return { ok: true, data: resp.data };
          lastError = resp.error;
          var msg = String(resp.error.message || '');
          var miss = msg.match(/Could not find the '([^']+)' column/i);
          if (miss && miss[1] && Object.prototype.hasOwnProperty.call(body, miss[1])) {
            delete body[miss[1]];
            continue;
          }
          if (/duplicate key|unique constraint|already reviewed/i.test(msg)) {
            return { ok: false, error: { message: 'Vous avez déjà laissé un avis sur ce produit.' } };
          }
          if (/row-level security|permission denied|JWT/i.test(msg)) {
            return { ok: false, error: { message: 'Connectez-vous pour laisser un avis.' } };
          }
          break;
        } catch (err) {
          lastError = err;
          break;
        }
      }
    }

    return { ok: false, error: lastError };
  }

  window.VendzaReviews = {
    insertReview: insertReview
  };
})();
