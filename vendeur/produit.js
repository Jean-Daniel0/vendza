'use strict';

(function () {
  var COMMUNES = {
    Ouest: ['Port-au-Prince', 'Pétionville', 'Delmas', 'Croix-des-Bouquets', 'Léogâne', 'Carrefour'],
    Nord: ['Cap-Haïtien', 'Limbé', 'Plaisance', 'Grande-Rivière du Nord'],
    Sud: ['Les Cayes', 'Jacmel', 'Saint-Louis du Sud', 'Aquin'],
    Artibonite: ['Gonaïves', 'Saint-Marc', 'Gros-Morne', 'Dessalines'],
    Centre: ['Hinche', 'Mirebalais', 'Lascahobas'],
    'Nord-Est': ['Fort-Liberté', 'Ouanaminthe', 'Trou-du-Nord'],
    'Nord-Ouest': ['Port-de-Paix', 'Saint-Louis du Nord', 'Môle Saint-Nicolas'],
    Nippes: ['Miragoâne', 'Petit-Goâve', 'Grand-Goâve'],
    'Sud-Est': ['Jacmel', 'Bainet', 'Belle-Anse'],
    "Grand'Anse": ['Jérémie', 'Moron', "Anse-d'Hainault"]
  };

  var tags = [];
  var status = 'pub';
  var mainImageFile = null;
  var mainPreviewUrl = '';
  var galleryFiles = [null, null, null, null, null];
  var galleryPreview = [null, null, null, null, null];
  var editProductId = '';
  var currentUserId = '';

  function byId(id) { return document.getElementById(id); }

  function getClient() { return window.supabaseClient || window.supabase || null; }

  function showToast(msg) {
    var t = byId('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function isImageFile(file) {
    return !!(file && file.type && String(file.type).toLowerCase().indexOf('image/') === 0);
  }

  function getExt(file) {
    if (!file || !file.name) return 'jpg';
    var ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    return ext || 'jpg';
  }

  var CHECKS = [
    { id: 'nom', label: 'Nom', fn: function () { return (byId('f-nom').value || '').trim().length >= 3; } },
    { id: 'cat', label: 'Catégorie', fn: function () { return byId('f-cat').value !== ''; } },
    { id: 'desc', label: 'Description', fn: function () { return (byId('f-desc').value || '').trim().length >= 10; } },
    { id: 'prix', label: 'Prix', fn: function () { return parseFloat(byId('f-prix').value) > 0; } },
    { id: 'stock', label: 'Stock', fn: function () { return parseInt(byId('f-stock').value, 10) >= 0; } },
    { id: 'img', label: 'Image', fn: function () { return !!(mainImageFile || mainPreviewUrl); } },
    { id: 'dept', label: 'Département', fn: function () { var el = byId('f-dept'); return !!(el && el.value); } },
    { id: 'commune', label: 'Commune', fn: function () { var el = byId('f-commune'); return !!(el && el.value); } }
  ];

  function updateCC(id, max) {
    var el = byId('f-' + id);
    var cc = byId('cc-' + id);
    if (!el || !cc) return;
    var len = el.value.length;
    cc.textContent = len + '/' + max;
    cc.className = 'char-count' + (len > max * 0.9 ? (len >= max ? ' over' : ' warn') : '');
  }

  function updateCompletion() {
    var done = CHECKS.filter(function (c) { return c.fn(); });
    var pct = Math.round((done.length / CHECKS.length) * 100);
    if (byId('comp-pct')) byId('comp-pct').textContent = pct + '%';
    if (byId('comp-fill')) byId('comp-fill').style.width = pct + '%';
    if (byId('comp-items')) {
      byId('comp-items').innerHTML = CHECKS.map(function (c) {
        var ok = c.fn();
        return '<div class="comp-item ' + (ok ? 'comp-done' : 'comp-todo') + '">' + (ok ? '✓' : '○') + ' ' + c.label + '</div>';
      }).join('');
    }
    var btn = byId('btn-publish');
    if (btn) btn.disabled = pct < 70;
  }

  function updatePricePreview() {
    var prix = parseFloat(byId('f-prix').value) || 0;
    var old = parseFloat(byId('f-old').value) || 0;
    var wrap = byId('price-preview-wrap');
    if (!wrap) return;
    if (prix > 0) {
      wrap.style.display = 'block';
      byId('pp-val').textContent = prix.toLocaleString('fr-FR') + ' Gdes';
      if (old > prix) {
        var pct = Math.round((1 - prix / old) * 100);
        byId('pp-badge').innerHTML = '<span class="discount-badge">-' + pct + '%</span>';
      } else byId('pp-badge').innerHTML = '';
    } else wrap.style.display = 'none';
  }

  function setStock(n, el) {
    byId('f-stock').value = String(n);
    document.querySelectorAll('.stock-pill').forEach(function (p) { p.classList.remove('active'); });
    if (el) el.classList.add('active');
    updateCompletion();
  }

  function updateCommunes(selectVal) {
    var dept = byId('f-dept').value;
    var sel = byId('f-commune');
    var opts = COMMUNES[dept] || [];
    sel.innerHTML = '<option value="">Commune…</option>' + opts.map(function (c) {
      return '<option' + (c === selectVal ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
  }

  function renderMainUpload() {
    var zone = byId('main-upload-zone');
    if (!zone) return;
    if (mainPreviewUrl) {
      zone.classList.add('has-img');
      zone.innerHTML = '<img src="' + mainPreviewUrl + '" alt=""><button type="button" class="remove-img" id="btn-remove-main-inner">✕</button>';
      var rm = byId('btn-remove-main-inner');
      if (rm) rm.addEventListener('click', function (e) { e.stopPropagation(); removeMain(); });
    } else {
      zone.classList.remove('has-img');
      zone.innerHTML = '<div class="up-icon">🖼️</div><div class="up-label">Cliquer pour ajouter une photo</div><div class="up-sub">JPG, PNG, WEBP · Max 5 Mo</div><input type="file" id="main-file-input" accept="image/*">';
      var inp = byId('main-file-input');
      if (inp) inp.addEventListener('change', previewMain);
    }
    if (byId('btn-remove-main')) byId('btn-remove-main').style.display = mainPreviewUrl ? 'block' : 'none';
  }

  function previewMain(e) {
    var file = e.target.files && e.target.files[0];
    if (!file || !isImageFile(file)) { showToast('Image invalide'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Max 5 Mo'); return; }
    mainImageFile = file;
    var reader = new FileReader();
    reader.onload = function (r) {
      mainPreviewUrl = r.target.result;
      renderMainUpload();
      updateCompletion();
    };
    reader.readAsDataURL(file);
  }

  function removeMain() {
    mainImageFile = null;
    mainPreviewUrl = '';
    renderMainUpload();
    updateCompletion();
  }

  function buildGallery() {
    var g = byId('gallery-grid');
    if (!g) return;
    g.innerHTML = galleryFiles.map(function (f, i) {
      var prev = galleryPreview[i];
      if (f || prev) {
        return '<div class="gallery-slot has-img" id="gslot-' + i + '"><img src="' + (prev || '') + '" alt=""><button type="button" class="remove-img" data-gi="' + i + '">✕</button></div>';
      }
      return '<div class="gallery-slot" id="gslot-' + i + '"><span style="font-size:1.4rem;color:var(--faint)">+</span><input type="file" accept="image/*" data-gi="' + i + '"></div>';
    }).join('');
    g.querySelectorAll('input[type=file]').forEach(function (inp) {
      inp.addEventListener('change', function (ev) { previewGallery(ev, Number(inp.getAttribute('data-gi'))); });
    });
    g.querySelectorAll('.remove-img[data-gi]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        removeGallery(Number(btn.getAttribute('data-gi')));
      });
    });
  }

  function previewGallery(e, i) {
    var file = e.target.files && e.target.files[0];
    if (!file || !isImageFile(file)) return;
    galleryFiles[i] = file;
    var reader = new FileReader();
    reader.onload = function (r) {
      galleryPreview[i] = r.target.result;
      buildGallery();
    };
    reader.readAsDataURL(file);
  }

  function removeGallery(i) {
    galleryFiles[i] = null;
    galleryPreview[i] = null;
    buildGallery();
  }

  function renderTags() {
    var wrap = byId('tags-wrap');
    var input = byId('tags-input');
    if (!wrap || !input) return;
    wrap.innerHTML = tags.map(function (t) {
      return '<div class="tag-chip">' + t + '<button type="button" data-tag="' + t + '">×</button></div>';
    }).join('');
    wrap.appendChild(input);
    wrap.querySelectorAll('button[data-tag]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tags = tags.filter(function (x) { return x !== btn.getAttribute('data-tag'); });
        renderTags();
      });
    });
  }

  function addTag(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var val = e.target.value.trim();
    if (!val || tags.indexOf(val) >= 0 || tags.length >= 8) return;
    tags.push(val);
    renderTags();
    e.target.value = '';
  }

  function getSelectedColors() {
    return Array.from(document.querySelectorAll('.color-chip.active')).map(function (el) {
      return el.textContent.trim();
    }).filter(Boolean);
  }

  function getSelectedSizes() {
    return Array.from(document.querySelectorAll('.size-chip.active')).map(function (el) {
      return el.textContent.trim();
    });
  }

  function getCaracs() {
    return Array.from(document.querySelectorAll('#carac-rows input')).map(function (inp) {
      return inp.value.trim();
    }).filter(Boolean);
  }

  function goStep(n) {
    var sections = ['section-1', 'section-2', 'section-3', 'section-4', 'section-5'];
    var target = byId(sections[n - 1]);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    for (var i = 1; i <= 5; i += 1) {
      var el = byId('step-' + i);
      if (!el) continue;
      el.classList.remove('active', 'done');
      if (i < n) el.classList.add('done');
      else if (i === n) el.classList.add('active');
      if (i < 5) {
        var conn = byId('conn-' + i);
        if (conn) conn.classList.toggle('done', i < n);
      }
    }
  }

  function setStatus(s) {
    status = s;
    var pub = byId('opt-pub');
    var draft = byId('opt-draft');
    if (pub) pub.className = 'status-opt' + (s === 'pub' ? ' active-pub' : '');
    if (draft) draft.className = 'status-opt' + (s === 'draft' ? ' active-draft' : '');
  }

  function buildPayload() {
    return {
      name: (byId('f-nom').value || '').trim(),
      category: byId('f-cat').value,
      description: (byId('f-desc').value || '').trim(),
      price: parseFloat(byId('f-prix').value) || 0,
      old_price: parseFloat(byId('f-old').value) || null,
      stock: parseInt(byId('f-stock').value, 10) || 0,
      colors: getSelectedColors(),
      sizes: getSelectedSizes(),
      capacities: (byId('f-caps').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      features: getCaracs(),
      keywords: tags.slice(),
      departement: byId('f-dept').value,
      commune: byId('f-commune').value,
      delivery_time: byId('f-delai').value,
      status: status === 'draft' ? 'draft' : 'published'
    };
  }

  async function uploadCover(file, productId) {
    var client = getClient();
    if (!client || !file || !productId || !currentUserId) return null;
    var path = currentUserId + '/' + productId + '/cover.' + getExt(file);
    var up = await client.storage.from('images').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (up.error) throw up.error;
    var pub = client.storage.from('images').getPublicUrl(path);
    return (pub && pub.data && pub.data.publicUrl) || '';
  }

  async function uploadGallery(file, productId, index) {
    var client = getClient();
    if (!client || !file || !productId) return null;
    var path = currentUserId + '/' + productId + '/gallery-' + (index + 1) + '.' + getExt(file);
    var up = await client.storage.from('images').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (up.error) return null;
    return client.storage.from('images').getPublicUrl(path).data.publicUrl;
  }

  async function requireVendor() {
    var client = getClient();
    if (!client) { window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html'; return false; }
    var auth = await client.auth.getUser();
    var user = auth && auth.data && auth.data.user;
    if (!user) { window.location.href = window.VZ ? window.VZ.url('login') : '../authentification/connexion.html'; return false; }
    currentUserId = user.id;
    return true;
  }

  function applyEditProduct(product) {
    if (!product) return;
    if (byId('f-nom')) byId('f-nom').value = product.name || '';
    if (byId('f-cat')) byId('f-cat').value = product.category || '';
    if (byId('f-desc')) byId('f-desc').value = product.description || '';
    if (byId('f-prix')) byId('f-prix').value = product.price != null ? String(product.price) : '';
    if (byId('f-old')) byId('f-old').value = product.old_price != null ? String(product.old_price) : '';
    if (byId('f-stock')) byId('f-stock').value = product.stock != null ? String(product.stock) : '0';
    if (byId('f-caps')) byId('f-caps').value = (Array.isArray(product.capacities) ? product.capacities : []).join(', ');
    if (byId('f-delai')) byId('f-delai').value = product.delivery_time || product.delai_livraison || '';

    tags = Array.isArray(product.tags) ? product.tags.slice() : (Array.isArray(product.keywords) ? product.keywords.slice() : []);
    renderTags();

    mainPreviewUrl = (product.image_url || product.image || '').toString();
    mainImageFile = null;
    var gallery = Array.isArray(product.gallery) ? product.gallery : [];
    gallery.forEach(function (url, i) {
      if (i < 5 && url) galleryPreview[i] = url;
    });
    buildGallery();
    renderMainUpload();

    var dept = product.departement || product.department || '';
    var commune = product.commune || '';
    if (byId('f-dept') && dept) {
      byId('f-dept').value = dept;
      updateCommunes(commune);
    }

    var colors = Array.isArray(product.colors) ? product.colors : [];
    document.querySelectorAll('.color-chip').forEach(function (chip) {
      if (chip.classList.contains('color-add')) return;
      var label = chip.textContent.trim();
      chip.classList.toggle('active', colors.indexOf(label) >= 0);
    });

    var sizes = Array.isArray(product.sizes) ? product.sizes : [];
    document.querySelectorAll('.size-chip').forEach(function (chip) {
      chip.classList.toggle('active', sizes.indexOf(chip.textContent.trim()) >= 0);
    });

    var features = Array.isArray(product.features) ? product.features : [];
    var caracRows = byId('carac-rows');
    if (caracRows) {
      caracRows.innerHTML = '';
      features.forEach(function (feat) {
        window.addCarac();
        var inputs = caracRows.querySelectorAll('input');
        if (inputs.length) inputs[inputs.length - 1].value = feat;
      });
    }

    var st = String(product.status || '').toLowerCase();
    if (st === 'draft') setStatus('draft');
    else setStatus('pub');

    updateCC('nom', 80);
    updateCC('desc', 500);
    updatePricePreview();
    updateCompletion();
  }

  async function loadProductForEdit(id) {
    var client = getClient();
    if (!client || !id || !currentUserId) return;
    var resp = await client.from('products').select('*').eq('id', id).eq('vendor_id', currentUserId).maybeSingle();
    if (resp.error || !resp.data) {
      showToast('Produit introuvable');
      setTimeout(function () { window.location.href = window.VZ ? window.VZ.url('vendorProducts') : 'mes-produit.html'; }, 1400);
      return;
    }
    applyEditProduct(resp.data);
  }

  async function saveProduct(isDraft) {
    if (isDraft) setStatus('draft');
    var payload = buildPayload();
    if (!payload.name) { showToast('Nom requis'); return; }
    if (!isDraft && CHECKS.filter(function (c) { return c.fn(); }).length < Math.ceil(CHECKS.length * 0.7)) {
      showToast('Complétez au moins 70 % du formulaire');
      return;
    }
    if (!mainImageFile && !mainPreviewUrl && !editProductId) {
      showToast('Ajoutez une image principale');
      goStep(3);
      return;
    }
    if (!isDraft) {
      if (!payload.departement) {
        showToast('Choisissez un département');
        goStep(5);
        return;
      }
      if (!payload.commune) {
        showToast('Choisissez une commune');
        goStep(5);
        return;
      }
    }

    var client = getClient();
    var btn = byId('btn-publish');
    if (btn) btn.disabled = true;
    showToast(isDraft ? 'Enregistrement brouillon…' : 'Publication…');

    var row = {
      name: payload.name,
      description: payload.description,
      category: payload.category,
      price: payload.price,
      old_price: payload.old_price,
      stock: payload.stock,
      colors: payload.colors,
      sizes: payload.sizes,
      capacities: payload.capacities,
      features: payload.features,
      tags: payload.keywords,
      departement: payload.departement,
      department: payload.departement,
      dept: payload.departement,
      commune: payload.commune,
      city: payload.commune,
      delivery_time: payload.delivery_time,
      status: payload.status
    };

    var saveFn = window.VendzaProductSave && window.VendzaProductSave.saveProductRow;
    var saved = saveFn
      ? await saveFn(client, { row: row, editId: editProductId, vendorId: currentUserId })
      : null;
    var data = saved && saved.data;
    var error = saved && saved.error;
    if (!saveFn) {
      if (editProductId) {
        var upd = await client.from('products').update(row).eq('id', editProductId).eq('vendor_id', currentUserId).select().single();
        data = upd.data;
        error = upd.error;
      } else {
        row.vendor_id = currentUserId;
        var ins = await client.from('products').insert([row]).select().single();
        data = ins.data;
        error = ins.error;
      }
    }

    if (error) {
      if (btn) btn.disabled = false;
      showToast('Erreur : ' + (error.message || 'sauvegarde'));
      return;
    }

    var productId = data.id;
    if (mainImageFile && productId) {
      try {
        var coverUrl = await uploadCover(mainImageFile, productId);
        if (coverUrl) {
          await client.from('products').update({ image_url: coverUrl, image: coverUrl }).eq('id', productId);
        }
      } catch (err) {
        showToast('Produit enregistré, image principale en échec');
      }
    }

    var galleryUrls = [];
    for (var gi = 0; gi < galleryFiles.length; gi += 1) {
      if (galleryFiles[gi]) {
        var url = await uploadGallery(galleryFiles[gi], productId, gi);
        if (url) galleryUrls.push(url);
      }
    }
    if (galleryUrls.length) {
      await client.from('products').update({ gallery: galleryUrls }).eq('id', productId);
    }

    if (!isDraft && productId && window.VendzaSitemap && window.VendzaSitemap.notifyProductPublished) {
      window.VendzaSitemap.notifyProductPublished(productId).catch(function () {});
    }

    showToast(isDraft ? '💾 Brouillon enregistré' : '🚀 Produit publié !');
    setTimeout(function () { window.location.href = window.VZ ? window.VZ.url('vendorProducts') : 'mes-produit.html'; }, 1200);
  }

  function openPreview() {
    byId('prev-nom').textContent = (byId('f-nom').value || 'Nom du produit');
    byId('prev-cat').textContent = byId('f-cat').value || '—';
    byId('prev-desc').textContent = byId('f-desc').value || '—';
    var prix = parseFloat(byId('f-prix').value) || 0;
    byId('prev-prix').textContent = prix.toLocaleString('fr-FR') + ' Gdes';
    byId('prev-stock').textContent = 'Stock : ' + (byId('f-stock').value || '0')
      + ' · Zone : ' + ([byId('f-dept').value, byId('f-commune').value].filter(Boolean).join(', ') || '—');
    var pi = byId('prev-img');
    pi.innerHTML = mainPreviewUrl ? '<img src="' + mainPreviewUrl + '" alt="">' : '👗';
    byId('preview-modal').classList.add('open');
  }

  function closePreview() { byId('preview-modal').classList.remove('open'); }

  function updateCartBadge() {
    try {
      var cart = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
      var n = Array.isArray(cart) ? cart.reduce(function (s, i) { return s + (Number(i.quantity) || 1); }, 0) : 0;
      var el = byId('cart-count');
      if (el) el.textContent = String(n);
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!(await requireVendor())) return;
    updateCartBadge();
    buildGallery();
    renderMainUpload();
    renderTags();
    updateCompletion();

    var params = new URLSearchParams(window.location.search || '');
    editProductId = params.get('edit') || '';

    document.querySelectorAll('.stock-pill').forEach(function (pill) {
      pill.addEventListener('click', function () { setStock(Number(pill.textContent.replace('+', '')) || 0, pill); });
    });
    byId('f-dept').addEventListener('change', function () { updateCommunes(); updateCompletion(); });
    byId('tags-input').addEventListener('keydown', addTag);
    var btnPublish = byId('btn-publish');
    var btnDraft = document.querySelector('.btn-draft');
    if (btnPublish) btnPublish.addEventListener('click', function () { saveProduct(false); });
    if (btnDraft) btnDraft.addEventListener('click', function () { saveProduct(true); });

    var mainZone = byId('main-upload-zone');
    if (mainZone) {
      mainZone.addEventListener('click', function () {
        var inp = byId('main-file-input');
        if (inp) inp.click();
      });
    }

    var btnClosePrev = byId('btn-close-preview');
    var prevModal = byId('preview-modal');
    if (btnClosePrev) btnClosePrev.addEventListener('click', closePreview);
    if (prevModal) {
      prevModal.addEventListener('click', function (ev) {
        if (ev.target === prevModal) closePreview();
      });
    }

    var btnAddCarac = byId('btn-add-carac');
    if (btnAddCarac) btnAddCarac.addEventListener('click', window.addCarac);

    var btnCustomColor = byId('btn-custom-color');
    if (btnCustomColor) {
      btnCustomColor.addEventListener('click', function () {
        var name = prompt('Nom de la couleur :');
        if (!name) return;
        var chip = document.createElement('div');
        chip.className = 'color-chip active';
        chip.innerHTML = '<div class="color-dot" style="background:#94a3b8"></div>' + name;
        chip.addEventListener('click', function () { chip.classList.toggle('active'); });
        btnCustomColor.parentNode.insertBefore(chip, btnCustomColor);
      });
    }

    for (var s = 1; s <= 5; s += 1) {
      (function (n) {
        var step = byId('step-' + n);
        if (step) step.addEventListener('click', function () { goStep(n); });
      })(s);
    }

    document.querySelectorAll('.color-chip').forEach(function (chip) {
      if (chip.classList.contains('color-add')) return;
      chip.addEventListener('click', function () { chip.classList.toggle('active'); });
    });
    document.querySelectorAll('.size-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { chip.classList.toggle('active'); });
    });

    var optPub = byId('opt-pub');
    var optDraft = byId('opt-draft');
    var btnRmMain = byId('btn-remove-main');
    if (optPub) optPub.addEventListener('click', function () { setStatus('pub'); });
    if (optDraft) optDraft.addEventListener('click', function () { setStatus('draft'); });
    if (btnRmMain) btnRmMain.addEventListener('click', removeMain);

    ['f-nom', 'f-desc'].forEach(function (id) {
      var el = byId(id);
      if (el) el.addEventListener('input', function () {
        updateCC(id.replace('f-', ''), id === 'f-nom' ? 80 : 500);
        updateCompletion();
      });
    });
    ['f-cat', 'f-prix', 'f-stock', 'f-dept', 'f-commune'].forEach(function (id) {
      var el = byId(id);
      if (el) el.addEventListener('change', updateCompletion);
    });
    byId('f-prix').addEventListener('input', updatePricePreview);
    byId('f-old').addEventListener('input', updatePricePreview);

    if (editProductId) {
      var titleEl = document.querySelector('.page-title');
      if (titleEl) titleEl.textContent = 'Modifier un produit';
      if (btnPublish) btnPublish.textContent = '💾 Mettre à jour';
      await loadProductForEdit(editProductId);
    }
  });

  window.goStep = goStep;
  window.openPreview = openPreview;
  window.closePreview = closePreview;
  window.addCarac = function () {
    var row = document.createElement('div');
    row.className = 'carac-row';
    row.innerHTML = '<input type="text" placeholder="Ex: Matière — Polyester 95%"><button type="button" class="btn-remove-carac">✕</button>';
    row.querySelector('.btn-remove-carac').addEventListener('click', function () { row.remove(); });
    byId('carac-rows').appendChild(row);
  };
})();
