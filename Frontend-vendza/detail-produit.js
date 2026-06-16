'use strict';

(function () {
  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.from(document.querySelectorAll(sel)); }

  function getClient() {
    return (typeof window !== 'undefined') ? (window.supabaseClient || null) : null;
  }

  let chatSubscription = null;
  let chatPollTimer = null;
  let chatMessageIds = new Set();
  const productGallery = { urls: [], productName: '', index: 0, bound: false };

  function normalizeStoragePath(value) {
    if (!value || typeof value !== 'string') return '';
    let path = value.trim();
    if (!path) return '';
    path = path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/images\//i, '');
    path = path.replace(/^\/?storage\/v1\/object\/public\/images\//i, '');
    path = path.replace(/^\/?object\/public\/images\//i, '');
    path = path.replace(/^images\//i, '');
    path = path.replace(/\\/g, '/');
    path = path.replace(/^\/+/, '');
    return path;
  }

  function resolveStoragePublicUrl(client, path) {
    if (!client || !path) return '';
    const clean = String(path).trim()
      .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/images\//i, '')
      .replace(/^images\//i, '')
      .replace(/^\/+/, '');
    const { data } = client.storage.from('images').getPublicUrl(clean);
    return (data && data.publicUrl) ? data.publicUrl : '';
  }

  function addUnique(arr, val) {
    if (!val || typeof val !== 'string') return;
    const clean = val.trim();
    if (!clean) return;
    if (!arr.includes(clean)) arr.push(clean);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isLikelyImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const v = url.trim().toLowerCase();
    if (v.startsWith('data:image/')) return true;
    if (v.includes('/storage/v1/object/public/images/')) return true;
    return /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(v);
  }

  function extractStoragePathFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let raw = url.trim();
    raw = raw.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/images\//i, '');
    raw = raw.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/sign\/images\/[^/]+\//i, '');
    raw = raw.replace(/^\/?storage\/v1\/object\/public\/images\//i, '');
    raw = raw.replace(/^\/?object\/public\/images\//i, '');
    return normalizeStoragePath(raw);
  }

  function resolveImageCandidates(client, product) {
    const candidates = [
      product?.image_url,
      product?.image,
      product?.image_path,
      product?.storage_path,
      product?.product_image_path
    ];
    const urls = [];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'string') continue;
      const raw = candidate.trim();
      if (!raw) continue;
      if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
        if (isLikelyImageUrl(raw)) addUnique(urls, raw);
        const storagePathFromUrl = extractStoragePathFromUrl(raw);
        if (storagePathFromUrl && client) {
          const { data } = client.storage.from('images').getPublicUrl(storagePathFromUrl);
          if (data && data.publicUrl) addUnique(urls, data.publicUrl);
        }
        continue;
      }
      const storagePath = normalizeStoragePath(raw);
      if (!storagePath || !client) continue;
      const { data } = client.storage.from('images').getPublicUrl(storagePath);
      if (data && data.publicUrl) addUnique(urls, data.publicUrl);
    }

    if (Array.isArray(product?.gallery)) {
      product.gallery.forEach(function (item) {
        if (!item || typeof item !== 'string') return;
        const raw = item.trim();
        if (!raw) return;
        if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
          if (isLikelyImageUrl(raw)) addUnique(urls, raw);
          const storagePathFromUrl = extractStoragePathFromUrl(raw);
          if (storagePathFromUrl && client) {
            const { data } = client.storage.from('images').getPublicUrl(storagePathFromUrl);
            if (data && data.publicUrl) addUnique(urls, data.publicUrl);
          }
          return;
        }
        const storagePath = normalizeStoragePath(raw);
        if (!storagePath || !client) return;
        const { data } = client.storage.from('images').getPublicUrl(storagePath);
        if (data && data.publicUrl) addUnique(urls, data.publicUrl);
      });
    }

    if (!urls.length && product?.vendor_id && product?.id && client) {
      const fallback = `${product.vendor_id}/${product.id}/cover.jpg`;
      const { data } = client.storage.from('images').getPublicUrl(fallback);
      if (data && data.publicUrl) addUnique(urls, data.publicUrl);
    }

    return urls;
  }

  function resolveImageUrl(client, product) {
    const urls = resolveImageCandidates(client, product);
    return urls[0] || '';
  }

  function formatPrice(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0 Gdes';
    return n.toLocaleString('fr-FR') + ' Gdes';
  }

  function setText(sel, value) {
    const el = q(sel);
    if (el) el.textContent = value;
  }

  function getVendorShopName(product) {
    if (window.VendzaVerified && typeof window.VendzaVerified.getShopName === 'function') {
      return window.VendzaVerified.getShopName(product);
    }
    const shop = [product?.shop_name, product?.store_name, product?.boutique, product?._shopName]
      .find(function (v) { return typeof v === 'string' && v.trim(); });
    if (shop) return String(shop).trim();
    return getVendorDisplayName(product);
  }

  function getVendorDisplayName(product) {
    const first = typeof product?.first_name === 'string' ? product.first_name.trim() : '';
    const last = typeof product?.last_name === 'string' ? product.last_name.trim() : '';
    const joined = [first, last].filter(Boolean).join(' ');
    const name = [
      product?.shop_name,
      product?.store_name,
      product?.boutique,
      product?._shopName,
      product?.vendor_name,
      product?.vendor,
      product?.seller_name,
      product?.full_name,
      product?.display_name,
      joined
    ].find(function (v) { return typeof v === 'string' && v.trim(); });
    return name ? String(name).trim() : 'Vendeur';
  }

  function getActiveGalleryIndex() {
    const main = q('#mainImage');
    if (!main) return 0;
    const src = main.getAttribute('src') || '';
    const idx = productGallery.urls.indexOf(src);
    return idx >= 0 ? idx : 0;
  }

  function updateLightboxCounter(index) {
    const el = q('#imgLightboxCounter');
    const n = productGallery.urls.length;
    if (!el) return;
    if (n <= 1) {
      el.textContent = '';
      el.style.display = 'none';
    } else {
      el.style.display = '';
      el.textContent = String(index + 1) + ' / ' + String(n);
    }
  }

  function updateLightboxNavState(index) {
    const prev = q('#imgLightboxPrev');
    const next = q('#imgLightboxNext');
    const n = productGallery.urls.length;
    const hideNav = n <= 1;
    if (prev) {
      prev.disabled = hideNav || index <= 0;
      prev.style.visibility = hideNav ? 'hidden' : '';
    }
    if (next) {
      next.disabled = hideNav || index >= n - 1;
      next.style.visibility = hideNav ? 'hidden' : '';
    }
  }

  function syncMainImageFromGallery(index) {
    const urls = productGallery.urls;
    if (!urls.length) return;
    const i = Math.max(0, Math.min(urls.length - 1, index));
    productGallery.index = i;
    const src = urls[i];
    const main = q('#mainImage');
    if (main && src) {
      main.src = src;
      main.alt = (productGallery.productName || 'Produit') + ' ' + (i + 1);
    }
    qa('.thumbnail').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-image') === src);
    });
    updateLightboxCounter(i);
    updateLightboxNavState(i);
  }

  function rebuildLightboxTrack() {
    const track = q('#imgLightboxTrack');
    if (!track) return;
    const name = productGallery.productName || 'Produit';
    const urls = productGallery.urls.filter(function (u) { return u && typeof u === 'string'; });
    productGallery.urls = urls;
    if (!urls.length) {
      track.innerHTML = '';
      return;
    }
    track.innerHTML = urls.map(function (src, i) {
      return '<div class="img-lightbox-slide"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(name) + ' ' + (i + 1) + '"></div>';
    }).join('');
  }

  function scrollLightboxTo(index, smooth) {
    const viewport = q('#imgLightboxViewport');
    if (!viewport || !productGallery.urls.length) return;
    const i = Math.max(0, Math.min(productGallery.urls.length - 1, index));
    const w = viewport.clientWidth || viewport.offsetWidth || 1;
    viewport.scrollTo({ left: w * i, behavior: smooth ? 'smooth' : 'auto' });
    syncMainImageFromGallery(i);
  }

  function openImageLightbox(startIndex) {
    const lb = q('#imgLightbox');
    if (!lb || !productGallery.urls.length) return;
    const idx = Math.max(0, Math.min(
      productGallery.urls.length - 1,
      startIndex != null ? startIndex : getActiveGalleryIndex()
    ));
    lb.hidden = false;
    document.body.classList.add('img-lightbox-open');
    requestAnimationFrame(function () {
      scrollLightboxTo(idx, false);
    });
    const closeBtn = q('#imgLightboxClose');
    if (closeBtn) closeBtn.focus();
  }

  function closeImageLightbox() {
    const lb = q('#imgLightbox');
    if (!lb) return;
    lb.hidden = true;
    document.body.classList.remove('img-lightbox-open');
  }

  function bindGalleryLightbox() {
    if (productGallery.bound) return;
    productGallery.bound = true;

    const wrap = q('#mainImgWrap');
    const expand = q('#btnExpandImg');
    const viewport = q('#imgLightboxViewport');
    const closeBtn = q('#imgLightboxClose');
    const prevBtn = q('#imgLightboxPrev');
    const nextBtn = q('#imgLightboxNext');
    const lb = q('#imgLightbox');

    function openFromMain(e) {
      if (e.target.closest('.btn-share') || e.target.closest('.img-badges')) return;
      e.preventDefault();
      openImageLightbox(getActiveGalleryIndex());
    }

    if (wrap) {
      wrap.addEventListener('click', openFromMain);
      wrap.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openImageLightbox(getActiveGalleryIndex());
        }
      });
    }
    if (expand) {
      expand.addEventListener('click', function (e) {
        e.stopPropagation();
        openImageLightbox(getActiveGalleryIndex());
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeImageLightbox);
    if (lb) {
      lb.addEventListener('click', function (e) {
        if (e.target === lb) closeImageLightbox();
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        scrollLightboxTo(productGallery.index - 1, true);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        scrollLightboxTo(productGallery.index + 1, true);
      });
    }
    if (viewport) {
      var scrollTimer = null;
      viewport.addEventListener('scroll', function () {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
          const w = viewport.clientWidth || 1;
          const idx = Math.round(viewport.scrollLeft / w);
          if (idx !== productGallery.index && idx >= 0 && idx < productGallery.urls.length) {
            syncMainImageFromGallery(idx);
          }
        }, 60);
      }, { passive: true });
    }
    document.addEventListener('keydown', function (e) {
      const lbEl = q('#imgLightbox');
      if (!lbEl || lbEl.hidden) return;
      if (e.key === 'Escape') closeImageLightbox();
      else if (e.key === 'ArrowLeft') scrollLightboxTo(productGallery.index - 1, true);
      else if (e.key === 'ArrowRight') scrollLightboxTo(productGallery.index + 1, true);
    });
  }

  function renderMainImage(imageUrl, productName, galleryUrls) {
    const main = q('#mainImage');
    if (!main) return;
    if (imageUrl) {
      main.src = imageUrl;
      main.alt = productName || 'Produit';
      main.onerror = function () {
        // Keep current thumbnail state; fallback handled by selected image candidates in initPage.
      };
    }

    const thumbsWrap = q('.thumbnail-images');
    if (!thumbsWrap) return;
    const gallery = [];
    addUnique(gallery, imageUrl);
    if (Array.isArray(galleryUrls)) {
      galleryUrls.forEach(function (src) { addUnique(gallery, src); });
    }
    thumbsWrap.innerHTML = '';

    gallery.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = (productName || 'Produit') + ' ' + (i + 1);
      img.className = 'thumbnail' + (i === 0 ? ' active' : '');
      img.setAttribute('data-image', src);
      thumbsWrap.appendChild(img);
    });

    qa('.thumbnail').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        qa('.thumbnail').forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        const src = this.getAttribute('data-image');
        if (src && main) main.src = src;
        const idx = productGallery.urls.indexOf(src);
        if (idx >= 0) productGallery.index = idx;
      });
    });

    productGallery.productName = productName || 'Produit';
    productGallery.urls = gallery.slice();
    rebuildLightboxTrack();
    bindGalleryLightbox();
    updateLightboxNavState(getActiveGalleryIndex());
    updateLightboxCounter(getActiveGalleryIndex());
  }

  function renderFeatures(features) {
    if (!Array.isArray(features)) return;
    const list = q('.product-features ul');
    if (!list) return;
    if (!features.length) return;

    list.innerHTML = '';
    features.forEach(function (f) {
      const li = document.createElement('li');
      li.innerHTML = '<i class="fas fa-check"></i> ' + String(f);
      list.appendChild(li);
    });
  }

  function renderDetailedDescription(product) {
    const pane = q('#description');
    if (!pane) return;

    const detailed = [
      product?.detailed_description,
      product?.long_description,
      product?.description_detail,
      product?.description
    ].find(function (v) { return typeof v === 'string' && v.trim(); }) || '';

    const safe = String(detailed || '').trim();
    pane.innerHTML = '<h3>Description detaillee</h3>' + (safe ? ('<p>' + safe + '</p>') : '<p></p>');
  }

  function renderSpecifications(product) {
    const pane = q('#specifications');
    if (!pane) return;

    const specs = [];
    if (product?.category) specs.push(['Categorie', product.category]);
    if (Number.isFinite(Number(product?.price))) specs.push(['Prix', formatPrice(product.price)]);
    if (Number.isFinite(Number(product?.old_price)) && Number(product.old_price) > 0) specs.push(['Ancien prix', formatPrice(product.old_price)]);
    if (Number.isFinite(Number(product?.stock))) specs.push(['Stock', String(product.stock)]);
    if (Array.isArray(product?.colors) && product.colors.length) specs.push(['Couleurs', product.colors.join(', ')]);
    if (Array.isArray(product?.capacities) && product.capacities.length) specs.push(['Capacites', product.capacities.join(', ')]);
    var shop = getVendorShopName(product);
    var shopCell = (window.VendzaVerified && typeof window.VendzaVerified.shopLineHtml === 'function')
      ? window.VendzaVerified.shopLineHtml(shop, !!product._vendorVerified, 14)
      : escapeHtml(shop);
    specs.push(['Boutique', shopCell, true]);

    const html = specs.length
      ? specs.map(function (row) {
          var val = row[2] ? row[1] : escapeHtml(row[1]);
          return '<div class="spec-item"><span class="spec-label">' + row[0] + '</span><span class="spec-value">' + val + '</span></div>';
        }).join('')
      : '<p></p>';

    pane.innerHTML = '<h3>Specifications techniques</h3><div class="specs-grid">' + html + '</div>';
  }

  function renderVendorProfileButton(product) {
    const actions = q('.vendeur-actions') || q('.product-actions');
    if (!actions || q('#viewVendorProfile')) return;

    const btn = document.createElement('button');
    btn.id = 'viewVendorProfile';
    btn.className = 'btn btn-outline';
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-store"></i> Profil';
    btn.addEventListener('click', function () {
      const vendorId = product && product.vendor_id ? String(product.vendor_id) : '';
      const vendorName = encodeURIComponent(getVendorShopName(product));
      const vendorParam = vendorId ? ('vendor_id=' + encodeURIComponent(vendorId) + '&') : '';
      var productParam = product && product.id ? ('&product_id=' + encodeURIComponent(String(product.id))) : '';
      var vendorQs = vendorParam + 'vendor_name=' + vendorName + productParam;
      window.location.href = window.VZ ? window.VZ.url('publicVendorProfile', vendorQs.replace(/^[?&]+/, '')) : 'client/profil-vendeur.html?' + vendorQs;
    });
    actions.appendChild(btn);

    const chatBtn = document.createElement('button');
    chatBtn.id = 'openVendorChat';
    chatBtn.className = 'btn btn-outline';
    chatBtn.type = 'button';
    chatBtn.innerHTML = '<i class="fas fa-comments"></i> Message <span id="chatUnreadBadge" class="chat-unread-badge" style="display:none;">0</span>';
    actions.appendChild(chatBtn);
  }

  async function fetchReviews(client, productId) {
    if (!client || !productId) return [];
    if (localStorage.getItem('vendza_disable_reviews') === '1') return [];
    const sources = ['reviews', 'product_reviews'];
    for (const table of sources) {
      try {
        const { data, error } = await client
          .from(table)
          .select('*')
          .eq('product_id', productId)
          .limit(20);
        if (error) {
          if (error.status === 404 || error.code === '42P01') {
            localStorage.setItem('vendza_disable_reviews', '1');
            return [];
          }
          continue;
        }
        if (Array.isArray(data)) {
          localStorage.removeItem('vendza_disable_reviews');
          return data;
        }
      } catch (_) {}
    }
    return [];
  }

  function renderReviews(reviews, product) {
    const pane = q('#reviews');
    if (!pane) return;

    const safeReviews = Array.isArray(reviews) ? reviews : [];
    const average = safeReviews.length
      ? safeReviews.reduce(function (acc, r) { return acc + Number(r.rating || 0); }, 0) / safeReviews.length
      : 0;
    const avgText = Number.isFinite(average) ? average.toFixed(1) : '0.0';

    const items = safeReviews.map(function (r) {
      const author = escapeHtml(r.author_name || r.user_name || r.user_email || r.email || 'Client');
      const text = escapeHtml(r.comment || r.content || '');
      const rating = Math.max(0, Math.min(5, Number(r.rating || 0)));
      const rounded = Math.round(rating);
      var stars = '';
      for (var i = 0; i < 5; i += 1) {
        stars += i < rounded ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
      }
      return '<div class="review-item"><div class="review-header"><div class="reviewer-info"><h4>' + author + '</h4><div class="review-stars">' + stars + '</div></div></div><p>' + text + '</p></div>';
    }).join('');

    const formHtml =
      '<div id="reviewForm" class="review-form inline">' +
      '  <div class="review-form-head"><h4>Donner votre avis</h4><span id="reviewFormNote" class="muted"></span></div>' +
      '  <div class="review-form-fields">' +
      '    <div id="reviewStars" class="review-stars-input" role="radiogroup" aria-label="Note du produit">' +
      '      <button type="button" data-value="1" aria-label="1 etoile"><i class="fas fa-star"></i></button>' +
      '      <button type="button" data-value="2" aria-label="2 etoiles"><i class="fas fa-star"></i></button>' +
      '      <button type="button" data-value="3" aria-label="3 etoiles"><i class="fas fa-star"></i></button>' +
      '      <button type="button" data-value="4" aria-label="4 etoiles"><i class="fas fa-star"></i></button>' +
      '      <button type="button" data-value="5" aria-label="5 etoiles"><i class="fas fa-star"></i></button>' +
      '    </div>' +
      '    <input type="hidden" id="reviewRating" value="">' +
      '    <div id="reviewCommentWrap" class="review-comment hidden">' +
      '      <label>Commentaire</label>' +
      '      <textarea id="reviewComment" rows="3" placeholder="Votre avis sur ce produit..."></textarea>' +
      '      <button type="button" class="btn btn-primary" id="reviewSubmit">Envoyer</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    const inlineHost = q('#productReviewInline');
    if (inlineHost) {
      inlineHost.innerHTML = formHtml;
    }

    pane.innerHTML =
      '<h3>Avis clients</h3>' +
      '<div class="reviews-summary"><div class="overall-rating"><div class="rating-number">' + avgText + '</div><div class="total-reviews">Base sur ' + safeReviews.length + ' avis</div></div></div>' +
      '<div class="reviews-list">' + (items || '<p></p>') + '</div>';

    bindReviewForm(product);
  }

  function setReviewNote(text, isError) {
    const note = q('#reviewFormNote');
    if (!note) return;
    note.textContent = text || '';
    note.classList.toggle('is-error', Boolean(isError));
  }

  async function bindReviewForm(product) {
    const form = q('#reviewForm');
    if (!form || !product || !product.id) return;
    const client = getClient();
    if (!client) return;

    const ratingEl = q('#reviewRating');
    const commentEl = q('#reviewComment');
    const submitBtn = q('#reviewSubmit');
    const starsWrap = q('#reviewStars');
    const commentWrap = q('#reviewCommentWrap');

    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      setReviewNote('Connectez-vous pour laisser un avis.', true);
      if (starsWrap) starsWrap.classList.add('is-disabled');
      if (commentEl) commentEl.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    setReviewNote('', false);
    if (submitBtn) submitBtn.disabled = false;

    if (starsWrap) {
      const stars = qa('#reviewStars button');
      stars.forEach(function (btn) {
        btn.addEventListener('click', function () {
          const val = Number(btn.getAttribute('data-value'));
          if (!val) return;
          if (ratingEl) ratingEl.value = String(val);
          stars.forEach(function (b) {
            const active = Number(b.getAttribute('data-value')) <= val;
            b.classList.toggle('active', active);
          });
          if (commentWrap) commentWrap.classList.remove('hidden');
          setReviewNote('', false);
        });
      });
    }

    if (!submitBtn) return;
    submitBtn.onclick = async function () {
      const rating = Number(ratingEl && ratingEl.value);
      if (!rating || rating < 1 || rating > 5) {
        setReviewNote('Choisissez une note entre 1 et 5.', true);
        return;
      }
      const comment = commentEl ? commentEl.value.trim() : '';
      setReviewNote('Envoi...', false);

      let authorName = '';
      let authorEmail = '';
      try {
        const profileResp = await client.from('users').select('*').eq('id', user.id).maybeSingle();
        const profile = profileResp && profileResp.data;
        authorName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
        authorEmail = profile?.email || user.email || '';
      } catch (_) {}

      var insertResult = window.VendzaReviews && window.VendzaReviews.insertReview
        ? await window.VendzaReviews.insertReview(client, {
          productId: product.id,
          userId: user.id,
          rating: rating,
          comment: comment,
          authorName: authorName,
          authorEmail: authorEmail,
          vendorId: product.vendor_id || null
        })
        : { ok: false };

      if (!insertResult.ok) {
        var errMsg = (insertResult.error && insertResult.error.message) ? String(insertResult.error.message) : '';
        setReviewNote(errMsg ? ('Échec : ' + errMsg.slice(0, 80)) : 'Échec de l\'envoi de l\'avis.', true);
        return;
      }

      setReviewNote('Merci pour votre avis.', false);
      if (commentEl) commentEl.value = '';
      if (ratingEl) ratingEl.value = '';

      const refreshed = await fetchReviews(client, product.id);
      renderReviews(refreshed, product);
      const ratingText = q('.rating-text');
      if (ratingText && Array.isArray(refreshed) && refreshed.length) {
        const avg = refreshed.reduce(function (acc, r) { return acc + Number(r.rating || 0); }, 0) / refreshed.length;
        ratingText.textContent = (Number.isFinite(avg) ? avg.toFixed(1) : '0.0') + '/5 (' + refreshed.length + ' avis)';
      }
    };
  }

  function renderShippingInfo(product) {
    const pane = q('#shipping');
    if (!pane) return;

    const blocks = [];
    if (product?.shipping_info) blocks.push(['Livraison', String(product.shipping_info)]);
    if (product?.delivery_info) blocks.push(['Details', String(product.delivery_info)]);
    if (product?.shipping_time) blocks.push(['Delai', String(product.shipping_time)]);
    if (product?.delivery_zone) blocks.push(['Zone', String(product.delivery_zone)]);
    if (product?.shipping_price != null && product?.shipping_price !== '') blocks.push(['Frais', formatPrice(product.shipping_price)]);

    const html = blocks.length
      ? blocks.map(function (b) { return '<div class="shipping-option"><div><h4>' + b[0] + '</h4><p>' + b[1] + '</p></div></div>'; }).join('')
      : '<p></p>';

    pane.innerHTML = '<h3>Informations de livraison</h3><div class="shipping-info">' + html + '</div>';
  }

  async function renderRelatedProducts(client, product) {
    const wrap = q('.related-products .products-grid');
    if (!wrap || !client) return;
    if (!product?.id) {
      wrap.innerHTML = '';
      return;
    }

    const { data, error } = await client.from('products').select('*').neq('id', product.id).limit(12);
    if (error || !Array.isArray(data)) {
      wrap.innerHTML = '';
      return;
    }

    const sameCategory = data.filter(function (x) { return product.category && x.category === product.category; });
    const list = (sameCategory.length ? sameCategory : data).slice(0, 3);
    if (!list.length) {
      wrap.innerHTML = '';
      return;
    }

    const vendorIds = list.map(function (x) { return x.vendor_id; }).filter(Boolean);
    const verifiedSet = (window.VendzaVerified && client)
      ? await window.VendzaVerified.fetchVerifiedSet(client, vendorIds)
      : {};

    wrap.innerHTML = '';
    for (var ri = 0; ri < list.length; ri += 1) {
      var p = list[ri];
      if (window.VendzaVerified && typeof window.VendzaVerified.enrichVendor === 'function') {
        await window.VendzaVerified.enrichVendor(client, p);
      }
      const imageUrl = resolveImageUrl(client, p);
      const shop = getVendorShopName(p);
      const verified = !!p._vendorVerified || !!(p.vendor_id && verifiedSet[String(p.vendor_id)]);
      const shopLine = (window.VendzaVerified && typeof window.VendzaVerified.shopLineHtml === 'function')
        ? window.VendzaVerified.shopLineHtml(shop, verified, 14)
        : escapeHtml(shop);
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML =
        '<img src="' + (imageUrl || '') + '" alt="' + escapeHtml(p.name || 'Produit') + '">' +
        '<h4>' + escapeHtml(p.name || 'Produit') + '</h4>' +
        '<p class="related-shop">' + shopLine + '</p>' +
        '<p class="price">' + formatPrice(p.price) + '</p>' +
        '<button class="btn btn-outline" type="button">Voir details</button>';
      card.querySelector('button').addEventListener('click', function () {
        localStorage.setItem('vendza_selected_product', JSON.stringify({
          id: p.id,
          name: p.name,
          price: p.price,
          old_price: p.old_price,
          description: p.description,
          image: imageUrl,
          image_url: p.image_url || null,
          image_path: p.image_path || p.storage_path || p.product_image_path || null,
          category: p.category,
          vendor_id: p.vendor_id,
          vendor_name: p.vendor_name || p.vendor || p.seller_name || p.shop_name || p.store_name || null,
          colors: Array.isArray(p.colors) ? p.colors : [],
          capacities: Array.isArray(p.capacities) ? p.capacities : [],
          features: Array.isArray(p.features) ? p.features : [],
          gallery: Array.isArray(p.gallery) ? p.gallery : []
        }));
        window.location.href = window.VZ ? window.VZ.url('product') : 'detail-produit.html';
      });
      wrap.appendChild(card);
    }
  }

  function renderCapacities(caps) {
    const wrap = q('.capacity-options');
    const group = wrap ? wrap.closest('.option-group') : null;
    if (!Array.isArray(caps) || !wrap || !caps.length) {
      if (group) group.style.display = 'none';
      return;
    }
    if (group) group.style.display = '';

    wrap.innerHTML = '';
    caps.forEach(function (c, i) {
      const btn = document.createElement('button');
      btn.className = 'capacity-option' + (i === 0 ? ' active' : '');
      btn.type = 'button';
      btn.setAttribute('data-capacity', String(c));
      btn.textContent = String(c) + (String(c).includes('GB') ? '' : ' GB');
      wrap.appendChild(btn);
    });
  }

  function renderColors(colors) {
    const wrap = q('.color-options');
    const group = wrap ? wrap.closest('.option-group') : null;
    if (!Array.isArray(colors) || !wrap || !colors.length) {
      if (group) group.style.display = 'none';
      return;
    }
    if (group) group.style.display = '';

    const palette = {
      noir: '#111827',
      blanc: '#ffffff',
      bleu: '#2563eb',
      vert: '#10b981',
      rouge: '#ef4444',
      gris: '#9ca3af'
    };

    wrap.innerHTML = '';
    colors.forEach(function (c, i) {
      const key = String(c).trim().toLowerCase();
      const color = palette[key] || '#6b7280';
      const btn = document.createElement('button');
      btn.className = 'color-option' + (i === 0 ? ' active' : '');
      btn.type = 'button';
      btn.title = String(c);
      btn.setAttribute('aria-label', String(c));
      btn.setAttribute('data-color', String(c));
      btn.style.backgroundColor = color;
      if (color === '#ffffff') btn.style.border = '1px solid #d1d5db';
      wrap.appendChild(btn);
    });
  }

  function bindTabsAndQty() {
    const qty = q('#quantity');
    const dec = q('#decreaseQty');
    const inc = q('#increaseQty');

    if (dec && qty) dec.addEventListener('click', function () {
      const n = Number(qty.value) || 1;
      qty.value = String(Math.max(1, n - 1));
    });
    if (inc && qty) inc.addEventListener('click', function () {
      const n = Number(qty.value) || 1;
      qty.value = String(Math.min(99, n + 1));
    });

    qa('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-tab');
        qa('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        qa('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        const pane = q('#' + id);
        if (pane) pane.classList.add('active');
      });
    });
  }

  function saveToCart(product, quantity) {
    if (window.VendzaCartGuard && window.VendzaCartGuard.isOwnProductSync(product)) {
      window.VendzaCartGuard.notifyBlocked();
      return false;
    }
    const cart = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
    const id = product.id || product.name || String(Date.now());
    const existing = cart.findIndex(function (x) { return String(x.id) === String(id); });
    if (existing >= 0) cart[existing].quantity = Number(cart[existing].quantity || 0) + quantity;
    else {
      cart.push({
        id: id,
        name: product.name || 'Produit',
        price: Number(product.price || 0),
        image: product.imageResolved || product.image_url || product.image || '',
        quantity: quantity,
        product_id: product.id || null,
        vendor_id: product.vendor_id || product.seller_id || product.owner_id || null,
        vendor_name: getVendorDisplayName(product),
        category: product.category || product.categorie || ''
      });
    }
    localStorage.setItem('vendza_cart', JSON.stringify(cart));
    return true;
  }

  async function applyOwnerPurchaseLock(product) {
    const guard = window.VendzaCartGuard;
    if (!guard || !product) return;
    const own = await guard.isOwnProductAsync(product);
    if (!own) return;
    const msg = 'Ce produit est le vôtre — vous ne pouvez pas l\'acheter.';
    ['#addToCart', '#buyNow'].forEach(function (sel) {
      const btn = q(sel);
      if (!btn) return;
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.title = msg;
    });
    const qty = q('#quantity');
    if (qty) qty.disabled = true;
    notify(msg);
  }

  function notify(msg) {
    const toast = q('#detailToast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(function () { toast.classList.remove('show'); }, 2200);
      return;
    }
    const n = document.createElement('div');
    n.textContent = msg;
    n.style.cssText = 'position:fixed;top:90px;right:20px;background:#2563eb;color:#fff;padding:10px 14px;border-radius:10px;z-index:9999;box-shadow:0 10px 24px rgba(0,0,0,.2);';
    document.body.appendChild(n);
    setTimeout(function () { n.remove(); }, 1800);
  }

  function syncNavCartCount() {
    try {
      const raw = localStorage.getItem('vendza_cart');
      const cart = raw ? JSON.parse(raw) : [];
      const n = Array.isArray(cart) ? cart.reduce(function (s, i) { return s + (Number(i && i.quantity) || 1); }, 0) : 0;
      const el = q('#nav-cart-count');
      if (el) el.textContent = String(n);
    } catch (_) {}
  }

  function updateStockBar(product) {
    const section = q('#stockSection');
    const fill = q('#stockFill');
    const hint = q('#stockHint');
    const sub = q('#stockLabelSub');
    const stock = Number(product && product.stock);
    if (!section) return;
    if (!Number.isFinite(stock) || stock < 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    if (sub) sub.textContent = 'Stock disponible';
    if (hint) {
      if (stock === 0) hint.textContent = 'Rupture de stock';
      else if (stock <= 5) hint.textContent = 'Plus que ' + stock + ' restant(s) !';
      else hint.textContent = 'En stock';
    }
    if (fill) fill.style.width = Math.min(100, Math.max(6, stock)) + '%';
  }

  function updateImgBadges(product, oldVal, curVal) {
    const sale = q('#badgeSale');
    const neu = q('#badgeNew');
    const discountEl = q('.discount');
    if (sale) {
      const show = Number.isFinite(oldVal) && oldVal > 0 && Number.isFinite(curVal) && oldVal > curVal;
      sale.style.display = show ? '' : 'none';
      if (show) {
        const t = discountEl ? discountEl.textContent.trim() : '';
        sale.textContent = t || 'Promo';
      }
    }
    if (neu && product) {
      const created = product.created_at ? new Date(product.created_at).getTime() : 0;
      const isNew = Boolean(created && (Date.now() - created < 14 * 24 * 60 * 60 * 1000));
      neu.style.display = isNew ? '' : 'none';
    }
  }

  function updatePriceSave(oldVal, curVal) {
    const el = q('#priceSaveNote');
    if (!el) return;
    if (Number.isFinite(oldVal) && oldVal > 0 && Number.isFinite(curVal) && oldVal > curVal) {
      el.style.display = '';
      el.textContent = 'Vous économisez ' + formatPrice(oldVal - curVal);
    } else {
      el.style.display = 'none';
    }
  }

  function updateVendorCardFace(product) {
    const shop = getVendorShopName(product);
    const verified = !!(product && product._vendorVerified);
    const vn = q('#vendorDisplayName');
    if (vn) {
      vn.classList.add('vendor-display-name');
      if (window.VendzaVerified && typeof window.VendzaVerified.applyShopLine === 'function') {
        window.VendzaVerified.applyShopLine(vn, shop, verified, 22);
      } else if (verified && window.VendzaVerified) {
        vn.innerHTML = escapeHtml(shop) + window.VendzaVerified.badgeHtml({ size: 14, inline: true });
      } else {
        vn.textContent = shop;
      }
    }
    const badgeEl = q('.vendeur-badge');
    if (badgeEl) badgeEl.style.display = verified ? 'none' : '';
    const ini = q('#vendorInitial');
    if (ini) {
      const letter = (shop && shop.trim().charAt(0)) || '?';
      ini.textContent = letter.toUpperCase();
    }
  }

  function bindColorCapacityDelegation() {
    qa('.product-options .color-options').forEach(function (wrap) {
      if (wrap.dataset.bound === '1') return;
      wrap.dataset.bound = '1';
      wrap.addEventListener('click', function (e) {
        const btn = e.target.closest('.color-option');
        if (!btn || !wrap.contains(btn)) return;
        wrap.querySelectorAll('.color-option').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
    qa('.product-options .capacity-options').forEach(function (wrap) {
      if (wrap.dataset.bound === '1') return;
      wrap.dataset.bound = '1';
      wrap.addEventListener('click', function (e) {
        const btn = e.target.closest('.capacity-option');
        if (!btn || !wrap.contains(btn)) return;
        wrap.querySelectorAll('.capacity-option').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }

  function bindDetailUiExtras(product) {
    const go = q('#goReviewsTab');
    if (go && !go.dataset.bound) {
      go.dataset.bound = '1';
      go.addEventListener('click', function () {
        qa('.tab-btn').forEach(function (b) {
          if (b.getAttribute('data-tab') === 'reviews') b.click();
        });
      });
    }
    const shareBtn = q('#btnShare');
    if (shareBtn && !shareBtn.dataset.bound) {
      shareBtn.dataset.bound = '1';
      shareBtn.addEventListener('click', function () {
        if (window.VendzaShare && typeof window.VendzaShare.shareProduct === 'function') {
          window.VendzaShare.shareProduct(product).then(function (result) {
            if (result && result.ok && result.method === 'clipboard') {
              notify('Lien copié dans le presse-papiers');
            } else if (result && result.ok) {
              notify('Produit partagé');
            }
          }).catch(function () {
            notify('Impossible de partager');
          });
          return;
        }
        notify('Partage indisponible');
      });
    }
    const wish = q('#wishlistBtn');
    if (wish && product && product.id && !wish.dataset.bound) {
      wish.dataset.bound = '1';
      function favIds() {
        try {
          const raw = localStorage.getItem('vendza_favorites');
          const arr = raw ? JSON.parse(raw) : [];
          return Array.isArray(arr) ? arr.map(String) : [];
        } catch (_) {
          return [];
        }
      }
      function setFavUi(saved) {
        wish.innerHTML = saved
          ? '<i class="fas fa-heart" aria-hidden="true"></i> Sauvegardé'
          : '<i class="far fa-heart" aria-hidden="true"></i> Sauvegarder';
      }
      setFavUi(favIds().indexOf(String(product.id)) !== -1);
      wish.addEventListener('click', function () {
        const ids = favIds();
        const id = String(product.id);
        var saved;
        if (ids.indexOf(id) !== -1) {
          const next = ids.filter(function (x) { return x !== id; });
          localStorage.setItem('vendza_favorites', JSON.stringify(next));
          saved = false;
        } else {
          ids.push(id);
          localStorage.setItem('vendza_favorites', JSON.stringify(ids));
          saved = true;
        }
        setFavUi(saved);
        notify(saved ? 'Ajouté aux favoris' : 'Retiré des favoris');
      });
    }
    const contact = q('#contactVendeurBtn');
    if (contact && !contact.dataset.bound) {
      contact.dataset.bound = '1';
      contact.addEventListener('click', function () {
        const open = q('#openVendorChat');
        if (open) open.click();
      });
    }
  }

  async function getSelectedProductFromDb(client, id) {
    if (!client || !id) return null;
    const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle();
    if (error) return null;
    return data || null;
  }

  async function getFallbackProductFromDb(client) {
    if (!client) return null;
    try {
      const latest = await client
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest && latest.data) return latest.data;
    } catch (_) {}
    const { data, error } = await client.from('products').select('*').limit(1);
    if (error || !Array.isArray(data) || !data.length) return null;
    return data[0];
  }

  function parseSelectedLocal() {
    try {
      return JSON.parse(localStorage.getItem('vendza_selected_product') || 'null');
    } catch (_) {
      return null;
    }
  }

  function parseProductIdFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get('id');
    } catch (_) {
      return null;
    }
  }

  async function initPage() {
    bindTabsAndQty();

    const client = getClient();
    const urlProductId = parseProductIdFromUrl();
    const selectedLocal = parseSelectedLocal();
    const productId = urlProductId || (selectedLocal && selectedLocal.id);
    let productFromDb = await getSelectedProductFromDb(client, productId);
    if (!productFromDb && !selectedLocal) {
      productFromDb = await getFallbackProductFromDb(client);
    }
    const product = Object.assign({}, selectedLocal || {}, productFromDb || {});

    if (!product || Object.keys(product).length === 0) return;

    const imageResolved = resolveImageUrl(client, product);
    const imageCandidates = resolveImageCandidates(client, product);
    product.imageResolved = imageResolved;
    if (window.VendzaShare && typeof window.VendzaShare.applyProductMeta === 'function') {
      window.VendzaShare.applyProductMeta(product);
    }

    setText('.product-title', product.name || 'Produit');
    setText('#breadcrumbCurrent', product.name || 'Détails du produit');
    const catEl = q('#productCategory');
    if (catEl) catEl.textContent = product.category ? String(product.category).toUpperCase() : '';

    const current = q('.current-price');
    if (current) current.textContent = formatPrice(product.price);

    const oldPriceEl = q('.old-price');
    const discountEl = q('.discount');
    const oldVal = Number(product.old_price);
    const curVal = Number(product.price);

    if (oldPriceEl) {
      if (Number.isFinite(oldVal) && oldVal > 0 && Number.isFinite(curVal) && oldVal > curVal) {
        oldPriceEl.textContent = formatPrice(oldVal);
        oldPriceEl.style.display = '';
        if (discountEl) {
          const pct = Math.round(((oldVal - curVal) / oldVal) * 100);
          discountEl.textContent = '-' + pct + '%';
          discountEl.style.display = '';
        }
      } else {
        oldPriceEl.style.display = 'none';
        if (discountEl) discountEl.style.display = 'none';
      }
    }

    updatePriceSave(oldVal, curVal);
    updateImgBadges(product, oldVal, curVal);
    updateStockBar(product);
    if (window.VendzaVerified && typeof window.VendzaVerified.enrichVendor === 'function' && client) {
      await window.VendzaVerified.enrichVendor(client, product);
    } else if (product.vendor_id && window.VendzaVerified && client) {
      const verifiedSet = await window.VendzaVerified.fetchVerifiedSet(client, [product.vendor_id]);
      product._vendorVerified = !!verifiedSet[String(product.vendor_id)];
    }
    updateVendorCardFace(product);

    const desc = q('.product-description p');
    if (desc) desc.textContent = product.description || 'Description non disponible.';

    renderMainImage(imageResolved, product.name || 'Produit', imageCandidates);
    const mainImage = q('#mainImage');
    if (mainImage && imageCandidates.length > 1) {
      let mainCandidateIndex = Math.max(0, imageCandidates.indexOf(mainImage.getAttribute('src') || imageResolved || ''));
      mainImage.onerror = function () {
        mainCandidateIndex += 1;
        if (mainCandidateIndex < imageCandidates.length) {
          mainImage.src = imageCandidates[mainCandidateIndex];
        }
      };
    }
    renderFeatures(product.features);
    renderCapacities(product.capacities);
    renderColors(product.colors);
    bindColorCapacityDelegation();
    renderDetailedDescription(product);
    renderSpecifications(product);
    renderVendorProfileButton(product);
    bindChatPanel(product);
    renderShippingInfo(product);
    const reviews = await fetchReviews(client, product.id);
    renderReviews(reviews, product);
    const ratingText = q('.rating-text');
    if (ratingText) {
      if (Array.isArray(reviews) && reviews.length) {
        const avg = reviews.reduce(function (acc, r) { return acc + Number(r.rating || 0); }, 0) / reviews.length;
        ratingText.textContent = (Number.isFinite(avg) ? avg.toFixed(1) : '0.0') + '/5 (' + reviews.length + ' avis)';
      } else {
        ratingText.textContent = 'Aucun avis';
      }
    }
    await renderRelatedProducts(client, product);

    if (window.VendzaCartGuard) {
      window.VendzaCartGuard._onBlocked = function (msg) { notify(msg); };
    }

    const addToCart = q('#addToCart');
    if (addToCart) {
      addToCart.addEventListener('click', async function () {
        const qty = Number((q('#quantity') && q('#quantity').value) || 1);
        const run = function () {
          if (!saveToCart(product, Math.max(1, qty))) return;
          notify('Produit ajoute au panier');
          syncNavCartCount();
        };
        const guard = window.VendzaCartGuard;
        if (guard && typeof guard.guardAddAsync === 'function') {
          await guard.guardAddAsync(product, run);
        } else {
          run();
        }
      });
    }

    const buyNow = q('#buyNow');
    if (buyNow) {
      buyNow.addEventListener('click', async function () {
        const qty = Number((q('#quantity') && q('#quantity').value) || 1);
        const run = function () {
          if (!saveToCart(product, Math.max(1, qty))) return;
          syncNavCartCount();
          window.location.href = window.VZ ? window.VZ.url('cart') : '/client/panier';
        };
        const guard = window.VendzaCartGuard;
        if (guard && typeof guard.guardAddAsync === 'function') {
          await guard.guardAddAsync(product, run);
        } else {
          run();
        }
      });
    }

    await applyOwnerPurchaseLock(product);
    bindDetailUiExtras(product);
    syncNavCartCount();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initPage();
  });

  function placeChatPanel() {
    const panel = q('#chatPanel');
    if (!panel) return;
    const actions = q('.product-actions');
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    if (isMobile && actions && panel.parentElement !== actions) {
      actions.appendChild(panel);
    } else if (!isMobile && panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function setChatStatus(message, isError) {
    const status = q('#chatStatus');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
  }

  function renderChatMessage(message, currentUserId) {
    const thread = q('#chatThread');
    if (!thread || !message) return;
    if (chatMessageIds.has(message.id)) return;
    chatMessageIds.add(message.id);

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + (message.sender_id === currentUserId ? 'me' : 'them');

    const api = window.VendzaMessaging;
    if (message.content) {
      if (api && api.isOrderMessage(message.content)) {
        const card = document.createElement('div');
        card.className = 'chat-order-card';
        card.innerHTML = api.formatOrderCardHtml(api.parseOrderMessage(message.content));
        bubble.appendChild(card);
      } else {
        const text = document.createElement('span');
        text.className = 'chat-text';
        text.textContent = message.content || '';
        bubble.appendChild(text);
      }
    }

    if (message.attachment_path) {
      const img = document.createElement('img');
      img.className = 'chat-image';
      img.alt = 'Image envoyee';
      const apiImg = window.VendzaMessaging;
      img.src = apiImg && apiImg.resolveImageUrl
        ? apiImg.resolveImageUrl(getClient(), message.attachment_path)
        : resolveStoragePublicUrl(getClient(), message.attachment_path);
      bubble.appendChild(img);
    }

    const time = document.createElement('span');
    time.className = 'chat-time';
    time.textContent = formatTime(message.created_at);
    bubble.appendChild(time);
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
  }

  async function ensureConversation(client, userId, vendorId, productId) {
    const api = window.VendzaMessaging;
    if (api && api.ensureConversation) {
      return api.ensureConversation(client, userId, vendorId, productId);
    }
    const { data, error } = await client
      .from('conversations')
      .upsert([{
        buyer_id: userId,
        vendor_id: vendorId,
        product_id: productId
      }], { onConflict: 'product_id,buyer_id,vendor_id' })
      .select()
      .single();
    if (error || !data) return null;
    return data.id;
  }

  async function loadMessages(client, conversationId, currentUserId) {
    const thread = q('#chatThread');
    if (!thread || !conversationId) return;
    const { data } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (!Array.isArray(data)) return;
    thread.innerHTML = '';
    chatMessageIds.clear();
    if (!data.length) {
      setChatStatus('Aucun message pour le moment.', false);
    } else {
      setChatStatus('', false);
    }
    data.forEach(function (m) { renderChatMessage(m, currentUserId); });
  }

  async function sendMessage(client, conversationId, senderId, content, attachmentPath) {
    const api = window.VendzaMessaging;
    if (api && api.sendMessage) {
      const res = await api.sendMessage(client, conversationId, senderId, content, attachmentPath);
      if (res && !res.ok) setChatStatus('Echec de l\'envoi du message.', true);
      return;
    }
    const trimmed = (content || '').trim();
    if (!trimmed && !attachmentPath) return;
    const { error } = await client
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: senderId,
        content: trimmed || '',
        attachment_path: attachmentPath || null
      }]);
    if (error) setChatStatus('Echec de l\'envoi du message.', true);
  }

  async function uploadAttachment(client, userId, conversationId, file) {
    const api = window.VendzaMessaging;
    if (api && api.uploadAttachment) {
      return api.uploadAttachment(client, userId, conversationId, file);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = userId + '/messages/' + conversationId + '/' + Date.now() + '-' + safeName;
    const { error } = await client.storage.from('images').upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  function stopRealtime() {
    if (!chatSubscription) return;
    chatSubscription.unsubscribe();
    chatSubscription = null;
  }

  function stopPolling() {
    if (!chatPollTimer) return;
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }

  function startRealtime(client, conversationId, currentUserId, onIncoming) {
    stopRealtime();
    if (!client || !conversationId) return;
    chatSubscription = client
      .channel('chat:' + conversationId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'conversation_id=eq.' + conversationId
      }, function (payload) {
        if (!payload || !payload.new) return;
        if (typeof onIncoming === 'function') {
          onIncoming(payload.new, currentUserId);
        }
      })
      .subscribe();
  }

  function bindChatPanel(product) {
    const panel = q('#chatPanel');
    if (!panel) return;
    const openBtn = q('#openVendorChat');
    const closeTargets = qa('[data-close="true"]');
    const input = q('#chatInput');
    const sendBtn = q('#chatSendBtn');
    const imageBtn = q('#chatImageBtn');
    const imageInput = q('#chatImageInput');
    const badge = q('#chatUnreadBadge');
    let unreadCount = 0;
    let activeConversationId = '';
    let activeUserId = '';

    function updateBadge() {
      if (!badge) return;
      if (unreadCount > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = String(unreadCount);
      } else {
        badge.style.display = 'none';
        badge.textContent = '0';
      }
    }

    function resetUnread() {
      unreadCount = 0;
      updateBadge();
    }

    function incrementUnread() {
      unreadCount += 1;
      updateBadge();
    }

    function startPolling(client, conversationId, userId) {
      stopPolling();
      if (!client || !conversationId || !userId) return;
      chatPollTimer = setInterval(async function () {
        if (document.visibilityState === 'hidden') return;
        await loadMessages(client, conversationId, userId);
      }, 1000);
    }

    placeChatPanel();
    window.addEventListener('resize', placeChatPanel);

    async function openAndLoad() {
      const client = getClient();
      if (!client) return;
      setChatStatus('Chargement de la conversation...', false);
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        window.location.href = window.VZ ? window.VZ.login('detail-produit.html' + (window.location.search || '')) : 'authentification/connexion.html?redirect=' + encodeURIComponent('detail-produit.html' + (window.location.search || ''));
        return;
      }
      if (!product || !product.vendor_id || !product.id) {
        setChatStatus('Produit indisponible pour la messagerie.', true);
        return;
      }
      if (user.id === product.vendor_id) {
        window.location.href = window.VZ ? window.VZ.url('vendorInbox') : 'vendeur/boite-de-reception-vendeur.html';
        return;
      }
      const convoId = await ensureConversation(client, user.id, product.vendor_id, product.id);
      if (!convoId) {
        setChatStatus('Impossible d\'ouvrir la conversation.', true);
        return;
      }
      panel.setAttribute('data-conversation-id', convoId);
      activeConversationId = convoId;
      activeUserId = user.id;
      document.body.classList.add('chat-open');
      panel.setAttribute('aria-hidden', 'false');
      resetUnread();
      await loadMessages(client, convoId, user.id);
      startRealtime(client, convoId, user.id, function (msg, currentId) {
        const panelOpen = document.body.classList.contains('chat-open');
        if (panelOpen) {
          renderChatMessage(msg, currentId);
        } else if (msg.sender_id !== currentId) {
          incrementUnread();
        }
      });
      startPolling(client, convoId, user.id);
    }

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        openAndLoad();
      });
    }
    closeTargets.forEach(function (el) {
      el.addEventListener('click', function () {
        document.body.classList.remove('chat-open');
        panel.setAttribute('aria-hidden', 'true');
        stopRealtime();
        stopPolling();
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.body.classList.remove('chat-open');
        panel.setAttribute('aria-hidden', 'true');
        stopRealtime();
        stopPolling();
      }
    });

    async function handleSend() {
      const client = getClient();
      if (!client) return;
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      const convoId = panel.getAttribute('data-conversation-id');
      if (!convoId) return;
      const text = input ? input.value : '';
      await sendMessage(client, convoId, user.id, text, null);
      if (input) input.value = '';
      await loadMessages(client, convoId, user.id);
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', handleSend);
    }
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSend();
        }
      });
    }

    if (imageBtn && imageInput) {
      imageBtn.addEventListener('click', function () {
        imageInput.click();
      });
      imageInput.addEventListener('change', async function (e) {
        const file = e.target && e.target.files && e.target.files[0];
        if (!file) return;
        const client = getClient();
        if (!client) return;
        const { data: { user } } = await client.auth.getUser();
        if (!user) return;
        const convoId = panel.getAttribute('data-conversation-id');
        if (!convoId) return;
        try {
          setChatStatus('Envoi de l\'image...', false);
          const path = await uploadAttachment(client, user.id, convoId, file);
          await sendMessage(client, convoId, user.id, '', path);
          setChatStatus('', false);
          await loadMessages(client, convoId, user.id);
        } catch (_) {
          setChatStatus('Echec du televersement.', true);
        } finally {
          imageInput.value = '';
        }
      });
    }

    // If auth/session refreshes while panel is open, keep polling aligned.
    document.addEventListener('visibilitychange', async function () {
      if (document.visibilityState !== 'visible') return;
      const client = getClient();
      if (!client || !activeConversationId || !activeUserId) return;
      await loadMessages(client, activeConversationId, activeUserId);
    });
  }
})();


