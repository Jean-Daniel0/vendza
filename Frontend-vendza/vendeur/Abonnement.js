'use strict';

(function () {
  var PRIX = {
    local: { mensuel: 350, annuel: 280 },
    national: { mensuel: 499, annuel: 399 }
  };

  var DEPTS = [
    'Ouest', 'Nord', 'Sud', 'Artibonite', 'Centre', 'Nord-Est', 'Nord-Ouest',
    'Nippes', 'Sud-Est', "Grand'Anse"
  ];

  var annuel = false;
  var currentPlan = null;
  var selectedDepts = [];
  var selectedPayment = 'simulation';
  var modalStep = 1;

  function getClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function planCodeFromLabel(label) {
    if (label === 'Pro Local') return 'pro-350';
    if (label === 'Pro National') return 'elite-499';
    return 'free';
  }

  function planLabelFromCode(code) {
    if (code === 'pro-350') return 'Pro Local';
    if (code === 'elite-499') return 'Pro National';
    return 'Gratuit';
  }

  function isActiveProCode(code, status, expiresAt) {
    if (code !== 'pro-350' && code !== 'elite-499') return false;
    if (status && String(status).toLowerCase() !== 'active') return false;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return false;
    return true;
  }

  function readLocalSubscription() {
    try {
      var raw = localStorage.getItem('vendza_vendor_subscription');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function computeBenefits(code) {
    if (code === 'pro-350') {
      return { verifiedBadge: true, ranking: 'boosted', extraDepartments: 5, coverage: 'locale+5' };
    }
    if (code === 'elite-499') {
      return { verifiedBadge: true, ranking: 'premium', extraDepartments: 10, coverage: 'nationale' };
    }
    return { verifiedBadge: false, ranking: 'standard', extraDepartments: 0, coverage: 'de base', logisticTrips: 1 };
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function updateCartBadge() {
    var dot = document.getElementById('nav-cart-count');
    if (!dot) return;
    try {
      var cart = JSON.parse(localStorage.getItem('vendza_cart') || '[]');
      var n = Array.isArray(cart) ? cart.reduce(function (s, i) { return s + (Number(i.quantity) || 1); }, 0) : 0;
      dot.textContent = String(n);
    } catch (_) {
      dot.textContent = '0';
    }
  }

  function toggleBilling() {
    annuel = !annuel;
    var sw = document.getElementById('billing-switch');
    if (sw) sw.classList.toggle('on', annuel);

    var mode = annuel ? 'annuel' : 'mensuel';
    var pl = document.getElementById('price-local');
    var pn = document.getElementById('price-national');
    if (pl) pl.textContent = PRIX.local[mode].toLocaleString('fr-FR');
    if (pn) pn.textContent = PRIX.national[mode].toLocaleString('fr-FR');

    var subLocal = document.getElementById('sub-local');
    var subNational = document.getElementById('sub-national');
    if (subLocal) {
      subLocal.textContent = annuel
        ? PRIX.local.annuel + ' Gdes/mois · Facturé en une fois'
        : "Couverture régionale — jusqu'à 5 dép.";
    }
    if (subNational) {
      subNational.textContent = annuel
        ? PRIX.national.annuel + ' Gdes/mois · Facturé en une fois'
        : 'Couverture nationale — 10 départements';
    }

    var localAnnual = PRIX.local.annuel * 12;
    var nationalAnnual = PRIX.national.annuel * 12;
    var localSaving = PRIX.local.mensuel * 12 - localAnnual;
    var nationalSaving = PRIX.national.mensuel * 12 - nationalAnnual;

    var el;
    el = document.getElementById('local-total-calc');
    if (el) el.textContent = localAnnual.toLocaleString('fr-FR') + ' Gdes';
    el = document.getElementById('local-annual-total');
    if (el) el.textContent = localAnnual.toLocaleString('fr-FR') + ' Gdes';
    el = document.getElementById('national-total-calc');
    if (el) el.textContent = nationalAnnual.toLocaleString('fr-FR') + ' Gdes';
    el = document.getElementById('national-annual-total');
    if (el) el.textContent = nationalAnnual.toLocaleString('fr-FR') + ' Gdes';

    var saveLocal = document.querySelector('#annual-local .ab-saving');
    var saveNational = document.querySelector('#annual-national .ab-saving');
    if (saveLocal) saveLocal.textContent = '✓ Vous économisez ' + localSaving.toLocaleString('fr-FR') + ' Gdes/an';
    if (saveNational) saveNational.textContent = '✓ Vous économisez ' + nationalSaving.toLocaleString('fr-FR') + ' Gdes/an';

    var boxLocal = document.getElementById('annual-local');
    var boxNational = document.getElementById('annual-national');
    if (boxLocal) boxLocal.style.display = annuel ? 'flex' : 'none';
    if (boxNational) boxNational.style.display = annuel ? 'flex' : 'none';

    showToast(annuel ? 'Facturation annuelle (-20 %)' : 'Facturation mensuelle');
  }

  async function requireVendorAuth() {
    var client = getClient();
    if (!client || !client.auth) {
      showToast('Connexion requise pour gérer votre abonnement');
      window.location.href = window.VZ ? window.VZ.login('vendeur/Abonnement.html') : '../authentification/connexion.html?redirect=' + encodeURIComponent('vendeur/abonnement.html');
      return null;
    }
    try {
      var auth = await client.auth.getUser();
      var user = auth && auth.data && auth.data.user;
      if (!user || !user.id) {
        showToast('Connectez-vous en tant que vendeur');
        window.location.href = window.VZ ? window.VZ.login('vendeur/Abonnement.html') : '../authentification/connexion.html?redirect=' + encodeURIComponent('vendeur/abonnement.html');
        return null;
      }
      return user;
    } catch (_) {
      return null;
    }
  }

  function applyPlanHighlight(code) {
    document.querySelectorAll('.plan-card').forEach(function (c) {
      c.classList.remove('is-current');
    });
    if (code === 'free') {
      var g = document.querySelector('.plan-card.gratuit');
      if (g) g.classList.add('is-current');
    } else if (code === 'pro-350') {
      var l = document.querySelector('.plan-card.local');
      if (l) l.classList.add('is-current');
    } else if (code === 'elite-499') {
      var n = document.querySelector('.plan-card.national');
      if (n) n.classList.add('is-current');
    }
  }

  function showCurrentPlanBanner(code, billing, departments) {
    var wrap = document.querySelector('.plans-wrap');
    if (!wrap) return;
    var existing = document.getElementById('abo-current-banner');
    if (existing) existing.remove();
    if (!code || code === 'free') return;

    var el = document.createElement('div');
    el.id = 'abo-current-banner';
    el.className = 'abo-current-banner';
    var deptTxt = Array.isArray(departments) && departments.length
      ? ' · ' + departments.length + ' département(s) couverts'
      : '';
    el.innerHTML =
      '<strong>✓ Votre plan actuel :</strong> ' + planLabelFromCode(code) +
      (billing === 'annuel' ? ' (facturation annuelle)' : ' (mensuel)') + deptTxt;
    wrap.parentNode.insertBefore(el, wrap);
  }

  async function loadCurrentSubscription() {
    var code = 'free';
    var billing = 'mensuel';
    var departments = [];
    var status = 'cancelled';
    var expiresAt = null;

    var local = readLocalSubscription();
    if (local) {
      code = local.plan || local.plan_code || 'free';
      billing = local.billing || 'mensuel';
      departments = local.departments || [];
      status = local.status || (code === 'free' ? 'cancelled' : 'active');
      expiresAt = local.expiresAt || local.expires_at || null;
    }

    var client = getClient();
    if (client && client.auth) {
      try {
        var auth = await client.auth.getUser();
        var user = auth && auth.data && auth.data.user;
        if (user) {
          var resp = await client.from('vendor_subscriptions')
            .select('plan_code,status,billing,departments,expires_at,started_at,benefits')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!resp.error && resp.data) {
            code = resp.data.plan_code || code;
            status = resp.data.status || status;
            billing = resp.data.billing || billing;
            departments = resp.data.departments || departments;
            expiresAt = resp.data.expires_at || expiresAt;
            if (resp.data.benefits && typeof resp.data.benefits === 'object') {
              localStorage.setItem('vendza_vendor_subscription', JSON.stringify({
                user_id: user.id,
                plan: code,
                plan_code: code,
                planLabel: planLabelFromCode(code),
                billing: billing,
                departments: departments,
                status: status,
                expiresAt: expiresAt,
                expires_at: expiresAt,
                benefits: resp.data.benefits,
                activatedAt: resp.data.started_at ? new Date(resp.data.started_at).getTime() : Date.now()
              }));
            }
          }
        }
      } catch (_) {}
    }

    if (!isActiveProCode(code, status, expiresAt)) code = 'free';
    applyPlanHighlight(code);
    showCurrentPlanBanner(code, billing, departments);

    if (billing === 'annuel' && !annuel) toggleBilling();
  }

  async function choisirPlan(plan) {
    if (plan === 'Gratuit') {
      var userFree = await requireVendorAuth();
      if (!userFree) return;
      saveSubscription('Gratuit', [], 'mensuel', 'simulation', 0).then(function () {
        showToast('✓ Vous êtes sur le plan gratuit');
        loadCurrentSubscription();
      });
      return;
    }
    var user = await requireVendorAuth();
    if (!user) return;
    currentPlan = plan;
    selectedDepts = [];
    selectedPayment = 'simulation';
    openModal();
    goStep(1);
  }

  function openModal() {
    var maxDepts = currentPlan === 'Pro Local' ? 5 : 10;
    var prix = currentPlan === 'Pro Local'
      ? PRIX.local[annuel ? 'annuel' : 'mensuel']
      : PRIX.national[annuel ? 'annuel' : 'mensuel'];
    var isLocal = currentPlan === 'Pro Local';

    var pmIcon = document.getElementById('pm-icon');
    if (pmIcon) {
      pmIcon.className = 'pm-icon ' + (isLocal ? 'local' : 'national');
      pmIcon.textContent = isLocal ? '🗺️' : '🌍';
    }
    var pmName = document.getElementById('pm-name');
    if (pmName) pmName.textContent = currentPlan;
    var pmPrice = document.getElementById('pm-price');
    if (pmPrice) pmPrice.textContent = prix.toLocaleString('fr-FR') + ' Gdes/' + (annuel ? 'mois · annuel' : 'mois');
    var pmBadge = document.getElementById('pm-badge');
    if (pmBadge) {
      pmBadge.className = 'pm-badge ' + (isLocal ? 'local' : 'national');
      pmBadge.textContent = isLocal ? '5 dép.' : '10 dép.';
    }
    var deptMax = document.getElementById('dept-max');
    if (deptMax) deptMax.textContent = String(maxDepts);
    var deptCount = document.getElementById('dept-selected-count');
    if (deptCount) deptCount.textContent = '0';

    var grid = document.getElementById('dept-grid');
    if (grid) {
      grid.innerHTML = DEPTS.map(function (d) {
        var key = d.replace(/'/g, '');
        return (
          '<div class="dept-chip" id="dchip-' + key + '" data-dept="' + d.replace(/"/g, '&quot;') + '">' +
          '<div class="dept-check" id="dcheck-' + key + '"></div>' +
          '<span class="dept-name">' + d + '</span></div>'
        );
      }).join('');
      grid.querySelectorAll('.dept-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          toggleDept(chip.getAttribute('data-dept'));
        });
      });
    }

    var overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('open');
  }

  function closeModal() {
    var overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function toggleDept(dept) {
    if (!dept) return;
    var maxDepts = currentPlan === 'Pro Local' ? 5 : 10;
    var key = dept.replace(/'/g, '');
    var chip = document.getElementById('dchip-' + key);
    var check = document.getElementById('dcheck-' + key);
    if (!chip || !check) return;

    if (selectedDepts.indexOf(dept) >= 0) {
      selectedDepts = selectedDepts.filter(function (d) { return d !== dept; });
      chip.classList.remove('selected');
      check.textContent = '';
    } else {
      if (selectedDepts.length >= maxDepts) {
        showToast('⚠️ Maximum ' + maxDepts + ' départements pour ce plan');
        return;
      }
      selectedDepts.push(dept);
      chip.classList.add('selected');
      check.textContent = '✓';
    }

    var countEl = document.getElementById('dept-selected-count');
    if (countEl) countEl.textContent = String(selectedDepts.length);
    var btn = document.getElementById('btn-next-1');
    if (btn) btn.disabled = selectedDepts.length === 0;
  }

  function goStep(step) {
    modalStep = step;
    ['1', '2', '3', 'success'].forEach(function (s) {
      var el = document.getElementById('modal-step-' + s);
      if (el) el.style.display = String(s) === String(step) ? 'block' : 'none';
    });

    [1, 2, 3].forEach(function (i) {
      var el = document.getElementById('mstep-' + i);
      var line = document.getElementById('mline-' + i);
      if (!el) return;
      el.classList.remove('active', 'done');
      var num = el.querySelector('.mstep-num');
      if (i < step) {
        el.classList.add('done');
        if (num) num.textContent = '✓';
      } else if (i === step) {
        el.classList.add('active');
        if (num) num.textContent = String(i);
      } else if (num) {
        num.textContent = String(i);
      }
      if (line) line.classList.toggle('done', i < step);
    });

    if (step === 2) buildRecap();
  }

  function buildRecap() {
    var isLocal = currentPlan === 'Pro Local';
    var prixObj = isLocal ? PRIX.local : PRIX.national;
    var prixUnit = prixObj[annuel ? 'annuel' : 'mensuel'];
    var total = annuel ? prixUnit * 12 : prixUnit;
    var economie = annuel ? prixObj.mensuel * 12 - total : 0;

    var el;
    el = document.getElementById('recap-plan');
    if (el) el.textContent = currentPlan;
    el = document.getElementById('recap-billing');
    if (el) el.textContent = annuel ? 'Annuelle (12 mois)' : 'Mensuelle';
    el = document.getElementById('recap-prix-unit');
    if (el) el.textContent = prixUnit.toLocaleString('fr-FR') + ' Gdes/mois';
    el = document.getElementById('recap-total');
    if (el) el.textContent = total.toLocaleString('fr-FR') + ' Gdes';

    var recapDepts = document.getElementById('recap-depts');
    if (recapDepts) {
      recapDepts.innerHTML = selectedDepts.map(function (d) {
        return '<span>' + d + '</span>';
      }).join('');
    }

    var promoLine = document.getElementById('recap-promo-line');
    if (promoLine) {
      if (annuel && economie > 0) {
        promoLine.style.display = 'flex';
        var promo = document.getElementById('recap-promo');
        if (promo) promo.textContent = '- ' + economie.toLocaleString('fr-FR') + ' Gdes';
      } else {
        promoLine.style.display = 'none';
      }
    }
  }

  function selectPayment(el, method) {
    selectedPayment = method;
    document.querySelectorAll('.pm-method').forEach(function (m) {
      m.classList.remove('selected');
    });
    if (el) el.classList.add('selected');
  }

  async function upsertAdaptive(client, table, row, conflictKey) {
    var payload = Object.assign({}, row);
    var opts = {};
    if (conflictKey) opts.onConflict = conflictKey;
    for (var attempt = 0; attempt < 12; attempt += 1) {
      var resp = await client.from(table).upsert([payload], opts);
      if (!resp.error) return { ok: true };
      var msg = String(resp.error.message || '');
      var miss = msg.match(/Could not find the '([^']+)' column/i);
      if (miss && miss[1] && Object.prototype.hasOwnProperty.call(payload, miss[1])) {
        delete payload[miss[1]];
        continue;
      }
      return { ok: false, error: resp.error };
    }
    return { ok: false };
  }

  async function syncVendorPublicFlags(client, userId, code, departments, benefits) {
    if (!client || !client.from || !userId) return;
    var isPro = code === 'pro-350' || code === 'elite-499';
    var vendorRow = {
      id: userId,
      user_id: userId,
      plan_code: code,
      is_pro: isPro,
      is_verified: isPro,
      verified: isPro,
      coverage_departments: Array.isArray(departments) ? departments : []
    };
    await upsertAdaptive(client, 'vendors', vendorRow, 'id');
    try {
      await client.from('users').update({
        plan_code: code,
        is_pro: isPro,
        is_verified: isPro
      }).eq('id', userId);
    } catch (_) {}
  }

  async function saveSubscription(planLabel, departments, billing, paymentMethod, totalPaid) {
    var code = planCodeFromLabel(planLabel);
    var activatedAt = Date.now();
    var durationDays = code === 'free' ? 0 : (billing === 'annuel' ? 365 : 30);
    var expiresAt = durationDays > 0 ? activatedAt + durationDays * 24 * 60 * 60 * 1000 : null;
    var benefits = computeBenefits(code);
    var status = code === 'free' ? 'cancelled' : 'active';

    var client = getClient();
    var userId = null;
    if (client && client.auth) {
      try {
        var auth = await client.auth.getUser();
        userId = auth && auth.data && auth.data.user && auth.data.user.id;
      } catch (_) {}
    }

    localStorage.setItem('vendza_vendor_subscription', JSON.stringify({
      user_id: userId,
      plan: code,
      plan_code: code,
      planLabel: planLabel,
      billing: billing,
      departments: departments,
      paymentMethod: paymentMethod,
      totalPaid: totalPaid,
      status: status,
      activatedAt: activatedAt,
      durationDays: durationDays,
      expiresAt: expiresAt,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      benefits: benefits
    }));

    if (!client || !client.from || !userId) return { ok: false, reason: 'auth' };

    var row = {
      user_id: userId,
      plan_code: code,
      status: status,
      billing: billing,
      departments: departments,
      benefits: benefits,
      payment_method: paymentMethod,
      total_paid: totalPaid,
      started_at: new Date(activatedAt).toISOString(),
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      updated_at: new Date().toISOString()
    };

    var saved = await upsertAdaptive(client, 'vendor_subscriptions', row, 'user_id');
    if (!saved.ok) {
      var minimal = {
        user_id: userId,
        plan_code: code,
        status: status,
        started_at: row.started_at,
        expires_at: row.expires_at,
        updated_at: row.updated_at
      };
      saved = await upsertAdaptive(client, 'vendor_subscriptions', minimal, 'user_id');
    }

    await syncVendorPublicFlags(client, userId, code, departments, benefits);
    return saved;
  }

  async function confirmerPaiement() {
    if (selectedPayment === 'moncash') {
      showToast('MonCash sera disponible bientôt — choisissez « Mode test » ou « Espèces »');
      return;
    }

    var user = await requireVendorAuth();
    if (!user) return;

    var btn = document.getElementById('btn-pay');
    if (btn) {
      btn.textContent = '⏳ Activation en cours…';
      btn.disabled = true;
    }

    var isLocal = currentPlan === 'Pro Local';
    var prix = (isLocal ? PRIX.local : PRIX.national)[annuel ? 'annuel' : 'mensuel'];
    var total = annuel ? prix * 12 : prix;
    var billing = annuel ? 'annuel' : 'mensuel';

    var result = await saveSubscription(currentPlan, selectedDepts.slice(), billing, selectedPayment, total);
    if (result && result.ok === false && result.reason === 'auth') {
      showToast('Connexion requise');
      if (btn) { btn.disabled = false; btn.textContent = "✅ Confirmer l'abonnement"; }
      return;
    }

    await loadCurrentSubscription();

    await new Promise(function (r) { setTimeout(r, 900); });

    var msSub = document.getElementById('ms-sub-text');
    if (msSub) {
      msSub.textContent =
        'Plan ' + currentPlan + ' activé pour ' + selectedDepts.length + ' département(s). Total : ' +
        total.toLocaleString('fr-FR') + ' Gdes.';
    }

    goStep('success');

    if (btn) {
      btn.textContent = "✅ Confirmer l'abonnement";
      btn.disabled = false;
    }
  }

  function toggleCompare() {
    var table = document.getElementById('compare-table');
    var btn = document.getElementById('compare-btn-txt');
    if (!table || !btn) return;
    table.classList.toggle('open');
    btn.textContent = table.classList.contains('open')
      ? '📊 Masquer le comparatif'
      : '📊 Voir le comparatif détaillé';
  }

  function toggleFaq(el) {
    var item = el && el.parentElement;
    if (!item) return;
    var isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('open'); });
    if (!isOpen) item.classList.add('open');
  }

  function bindUi() {
    var billingBtn = document.getElementById('billing-switch');
    if (billingBtn) billingBtn.addEventListener('click', toggleBilling);

    document.querySelectorAll('[data-choose-plan]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        choisirPlan(btn.getAttribute('data-choose-plan'));
      });
    });

    var compareBtn = document.getElementById('compare-toggle');
    if (compareBtn) compareBtn.addEventListener('click', toggleCompare);

    document.querySelectorAll('.faq-q').forEach(function (q) {
      q.addEventListener('click', function () { toggleFaq(q); });
    });

    var overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }

    var btnNext1 = document.getElementById('btn-next-1');
    if (btnNext1) btnNext1.addEventListener('click', function () { goStep(2); });

    document.querySelectorAll('[data-go-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        goStep(parseInt(btn.getAttribute('data-go-step'), 10));
      });
    });

    document.querySelectorAll('.pm-method').forEach(function (el) {
      el.addEventListener('click', function () {
        selectPayment(el, el.getAttribute('data-payment'));
      });
    });

    var btnPay = document.getElementById('btn-pay');
    if (btnPay) btnPay.addEventListener('click', confirmerPaiement);

    var btnClose = document.getElementById('btn-close-modal');
    if (btnClose) btnClose.addEventListener('click', closeModal);
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateCartBadge();
    bindUi();
    loadCurrentSubscription();
  });

  window.VendzaAbonnement = {
    toggleBilling: toggleBilling,
    choisirPlan: choisirPlan,
    closeModal: closeModal,
    goStep: goStep,
    toggleCompare: toggleCompare
  };
})();
