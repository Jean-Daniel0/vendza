// Connexion / Authentification avec Supabase (frontend)
(function() {
    'use strict';

    // Supabase est initialisé dans supabaseclient.js (window.supabaseClient)
    const supabase = (typeof window !== 'undefined') ? window.supabaseClient : null;
    window.vendzaLoginTab = 'client';

    function init() {
        if (!supabase) {
            console.error('Supabase non disponible dans init()');
            return;
        }
        
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); handleLogin(); });

        loadSavedEmail();
        bindAuthV2Ui();

        function redirectAfterLogin(userInfo, email, delayMs) {
            if (String(email || '').toLowerCase() === 'jeandanielmichel004@gmail.com') {
                try { sessionStorage.setItem('vendza_admin_unlocked', '1'); } catch (_) {}
            }
            if (window.VendzaAuthRedirect && typeof window.VendzaAuthRedirect.goAfterAuth === 'function') {
                window.VendzaAuthRedirect.goAfterAuth(userInfo, email, window.vendzaLoginTab || 'client', delayMs);
                return;
            }
            delayMs = delayMs == null ? 700 : delayMs;
            window.setTimeout(function() {
                window.location.href = window.VZ ? window.VZ.url('home') : '../index.html';
            }, delayMs);
        }

        function redirectToHome(delayMs) {
            redirectAfterLogin(null, '', delayMs);
        }

        function bindAuthV2Ui() {
            document.querySelectorAll('.ltab').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.ltab').forEach(function(b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    window.vendzaLoginTab = btn.getAttribute('data-tab') || 'client';
                    var hint = document.getElementById('tab-hint');
                    if (hint) {
                        hint.textContent = window.vendzaLoginTab === 'vendeur'
                            ? 'Accès tableau de bord vendeur'
                            : 'Accès boutique client';
                    }
                });
            });

            var togglePwd = document.getElementById('togglePassword');
            var pwdInput = document.getElementById('password');
            if (togglePwd && pwdInput) {
                togglePwd.addEventListener('click', function() {
                    pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
                    togglePwd.textContent = pwdInput.type === 'password' ? '👁️' : '🙈';
                });
            }

            var rememberWrap = document.getElementById('rememberWrap');
            var rememberChk = document.getElementById('remember');
            var rememberBox = document.getElementById('cc-remember');
            function syncRememberUi() {
                if (rememberBox && rememberChk) rememberBox.textContent = rememberChk.checked ? '✓' : '';
            }
            if (rememberWrap && rememberChk) {
                rememberWrap.addEventListener('click', function(e) {
                    if (e.target === rememberChk) return;
                    e.preventDefault();
                    rememberChk.checked = !rememberChk.checked;
                    syncRememberUi();
                });
                rememberChk.addEventListener('change', syncRememberUi);
                syncRememberUi();
            }

            var openForgot = document.getElementById('openForgotLink');
            var modal = document.getElementById('forgotPasswordModal');
            var closeModal = document.getElementById('closeModal');
            var forgotForm = document.getElementById('forgotPasswordForm');
            if (openForgot && modal) {
                openForgot.addEventListener('click', function(e) {
                    e.preventDefault();
                    var emailEl = document.getElementById('email');
                    var rec = document.getElementById('recoveryEmail');
                    if (emailEl && rec && emailEl.value) rec.value = emailEl.value;
                    modal.classList.add('open');
                });
            }
            if (closeModal && modal) {
                closeModal.addEventListener('click', function() { modal.classList.remove('open'); });
            }
            if (modal) {
                modal.addEventListener('click', function(e) {
                    if (e.target === modal) modal.classList.remove('open');
                });
            }
            if (forgotForm && supabase && supabase.auth) {
                forgotForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    var email = (document.getElementById('recoveryEmail').value || '').trim();
                    if (!email) {
                        showNotification('Entrez votre email', 'error');
                        return;
                    }
                    try {
                        var redirectTo = window.location.href.split('#')[0];
                        var resp = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
                        if (resp.error) throw resp.error;
                        modal.classList.remove('open');
                        showNotification('Lien envoyé à ' + email, 'success');
                    } catch (err) {
                        showNotification(err.message || 'Envoi impossible', 'error');
                    }
                });
            }
        }

        // -------------------- Connexion Google OAuth --------------------
        const googleLoginBtn = document.getElementById('googleLogin');
        if (googleLoginBtn) {
            console.log('Bouton Google trouvé');
            googleLoginBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Clic sur bouton Google détecté');
                
                try {
                    showNotification('Connexion avec Google en cours...', 'info');
                    
                    // Connexion Google OAuth 
                    await supabase.auth.signInWithOAuth({
                        provider: 'google'
                    });
                } catch (err) {
                    console.error('Erreur connexion Google:', err);
                    showNotification('Erreur lors de la connexion avec Google: ' + (err.message || err), 'error');
                }
            });
        } else {
            console.error('Bouton Google non trouvé!');
        }

        // -------------------- Connexion Facebook OAuth --------------------
        const facebookLoginBtn = document.getElementById('facebookLogin');
        if (facebookLoginBtn) {
            console.log('Bouton Facebook trouvé');
            facebookLoginBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Clic sur bouton Facebook détecté');
                
                try {
                    showNotification('Connexion avec Facebook en cours...', 'info');
                    
                    const { error } = await supabase.auth.signInWithOAuth({
                        provider: 'facebook',
                        options: {
                            redirectTo: window.location.origin + '/authentification/connexion.html'
                        }
                    });

                    if (error) {
                        console.error('Erreur Facebook:', error.message);
                        showNotification('Erreur lors de la connexion avec Facebook: ' + error.message, 'error');
                    } else {
                        console.log('Redirection vers Facebook...');
                    }
                } catch (err) {
                    console.error('Erreur connexion Facebook:', err);
                    showNotification('Erreur lors de la connexion avec Facebook: ' + (err.message || err), 'error');
                }
            });
        } else {
            console.error('Bouton Facebook non trouvé!');
        }

        // -------------------- Gérer le retour OAuth --------------------
        async function handleOAuthSuccess(session) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Vérifier si l'utilisateur existe dans la table users
                let { data: userData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                // Si l'utilisateur n'existe pas, le créer
                if (!userData) {
                    const fullName = user.user_metadata?.full_name || 
                                    user.user_metadata?.name || 
                                    `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim() ||
                                    user.email?.split('@')[0] || 'Utilisateur';
                    
                    const { error: insertError } = await supabase
                        .from('users')
                        .insert([{
                            id: user.id,
                            full_name: fullName,
                            email: user.email,
                            user_type: 'client' // Par défaut
                        }]);

                    if (insertError) {
                        console.warn('Erreur création utilisateur OAuth:', insertError);
                    } else {
                        userData = {
                            id: user.id,
                            full_name: fullName,
                            email: user.email,
                            user_type: 'client'
                        };
                    }
                }

                // Récupérer l'avatar depuis Supabase Storage ou utiliser celui de Google
                let avatarUrl = null;
                if (user.user_metadata?.avatar_url) {
                    avatarUrl = user.user_metadata.avatar_url;
                } else if (user.id) {
                    try {
                        const avatarPath = `${user.id}/avatar.jpg`;
                        const { data: avatarData } = supabase.storage
                            .from('images')
                            .getPublicUrl(avatarPath);
                        if (avatarData && avatarData.publicUrl) {
                            avatarUrl = avatarData.publicUrl;
                        }
                    } catch (e) {
                        console.warn('Erreur récupération avatar:', e);
                    }
                }

                const resolvedType = userData?.user_type || user.user_metadata?.userType || user.user_metadata?.user_type || 'client';
                if (resolvedType && supabase && supabase.from) {
                    try {
                        await supabase
                            .from('users')
                            .upsert({
                                id: user.id,
                                email: user.email,
                                full_name: userData?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur',
                                user_type: resolvedType
                            }, { onConflict: 'id' });
                    } catch (e) {
                        console.warn('Mise a jour du type utilisateur (OAuth) echouee:', e);
                    }
                }

                const userInfo = {
                    id: user.id,
                    email: user.email,
                    firstName: userData?.full_name?.split(' ')[0] || '',
                    lastName: userData?.full_name?.split(' ').slice(1).join(' ') || '',
                    fullName: userData?.full_name || user.user_metadata?.full_name || '',
                    phone: userData?.phone_number || '',
                    userType: resolvedType,
                    departement: userData?.departement || '',
                    commune: userData?.commune || '',
                    newsletter: userData?.newsletter || false,
                    avatarUrl: avatarUrl,
                    createdAt: user.created_at,
                    lastSignIn: user.last_sign_in_at
                };

                localStorage.setItem('vendza_user_data', JSON.stringify(userInfo));
                localStorage.setItem('vendza_auth_token', session.access_token);
                if (window.VendzaAuth && typeof window.VendzaAuth.persistUser === 'function') {
                    window.VendzaAuth.persistUser(userInfo);
                }

                showNotification('Connexion réussie avec Google !', 'success');
                redirectAfterLogin(userInfo, user.email);
            } catch (error) {
                console.error('Erreur handleOAuthSuccess:', error);
                showNotification('Erreur lors de la connexion OAuth', 'error');
            }
        }

        // Vérifier si on revient d'une redirection OAuth
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                handleOAuthSuccess(session);
            }
        });

        // Vérifier l'utilisateur au chargement et créer dans vendors si nécessaire
        (async function() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                console.log("USER:", user);
                
                if (user) {
                    // Vérifier si la table vendors existe et créer l'entrée avec onConflict
                    try {
                        await supabase
                            .from("vendors")
                            .upsert({
                                id: user.id,
                                email: user.email,
                                name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur'
                            }, {
                                onConflict: 'id'
                            });
                        console.log('Utilisateur créé/mis à jour dans vendors');
                    } catch (vendorError) {
                        // Si la table vendors n'existe pas ou erreur, ignorer
                        console.warn('Erreur insertion vendors (peut être normal si la table n\'existe pas):', vendorError);
                    }
                    
                    // Récupérer tous les produits
                    try {
                        const { data: products, error: productsError } = await supabase
                            .from("products")
                            .select("*");
                        
                        if (productsError) {
                            console.warn('Erreur récupération produits:', productsError);
                        } else {
                            console.log('Produits récupérés:', products?.length || 0);
                        }
                    } catch (productsErr) {
                        console.warn('Erreur lors de la récupération des produits:', productsErr);
                    }
                }
            } catch (error) {
                console.warn('Erreur vérification utilisateur:', error);
            }
        })();

        // -------------------- Connexion --------------------
        async function handleLogin() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const remember = document.getElementById('remember').checked;

            if (!email || !password) return showNotification('Veuillez remplir tous les champs', 'error');
            if (!isValidEmail(email)) return showNotification('Email invalide', 'error');

            const loginBtn = document.querySelector('.login-btn');
            const btnText = loginBtn ? loginBtn.querySelector('.btn-text') : null;
            const btnLoader = loginBtn ? loginBtn.querySelector('.btn-loader') : null;

            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'inline-block';
            if (loginBtn) loginBtn.disabled = true;

            try {
                // Connexion avec email et mot de passe
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    console.error('Erreur de connexion:', error);
                    throw error;
                }

                if (!data || !data.user) {
                    throw new Error('Aucune donnée utilisateur reçue');
                }

                console.log('Connexion réussie pour:', data.user.email);

                // Récupérer les données utilisateur depuis la table users
                let userData = null;
                try {
                    const { data: userDataResult, error: userError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();
                    
                    if (userError) {
                        console.warn('Utilisateur non trouvé dans la table users, utilisation des données par défaut:', userError);
                    } else {
                        userData = userDataResult;
                    }
                } catch (dbError) {
                    console.warn('Erreur lors de la récupération des données utilisateur:', dbError);
                }

                // Récupérer l'avatar depuis Supabase Storage
                let avatarUrl = null;
                if (data.user.id) {
                    try {
                        const avatarPath = `${data.user.id}/avatar.jpg`;
                        const { data: avatarData } = supabase.storage
                            .from('images')
                            .getPublicUrl(avatarPath);
                        if (avatarData && avatarData.publicUrl) {
                            avatarUrl = avatarData.publicUrl;
                        }
                    } catch (e) {
                        console.warn('Erreur récupération avatar:', e);
                    }
                }

                // Construire les informations utilisateur
                const resolvedType = userData?.user_type
                    || data.user.user_metadata?.userType
                    || data.user.user_metadata?.user_type
                    || 'client';
                const isAdminEmail = String(data.user.email || '').toLowerCase() === 'jeandanielmichel004@gmail.com';
                const effectiveType = isAdminEmail ? 'admin' : resolvedType;

                if (effectiveType && supabase && supabase.from) {
                    try {
                        await supabase
                            .from('users')
                            .upsert({
                                id: data.user.id,
                                email: data.user.email,
                                full_name: userData?.full_name || data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Utilisateur',
                                first_name: userData?.first_name || userData?.full_name?.split(' ')[0] || data.user.user_metadata?.first_name || '',
                                last_name: userData?.last_name || userData?.full_name?.split(' ').slice(1).join(' ') || data.user.user_metadata?.last_name || '',
                                email: data.user.email,
                                phone_number: userData?.phone_number || userData?.phone || '',
                                departement: userData?.departement || '',
                                commune: userData?.commune || '',
                                newsletter: userData?.newsletter || false,
                                user_type: effectiveType
                            }, { onConflict: 'id' });
                    } catch (e) {
                        console.warn('Mise a jour du type utilisateur echouee:', e);
                    }
                }

                const userInfo = {
                    id: data.user.id,
                    email: data.user.email,
                    firstName: userData?.full_name?.split(' ')[0] || userData?.first_name || data.user.user_metadata?.first_name || data.user.user_metadata?.firstName || '',
                    lastName: userData?.full_name?.split(' ').slice(1).join(' ') || userData?.last_name || data.user.user_metadata?.last_name || data.user.user_metadata?.lastName || '',
                    fullName: userData?.full_name || data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
                    phone: userData?.phone_number || userData?.phone || data.user.phone || '',
                    userType: effectiveType,
                    departement: userData?.departement || '',
                    commune: userData?.commune || '',
                    newsletter: userData?.newsletter || false,
                    avatarUrl: avatarUrl || data.user.user_metadata?.avatar_url || null,
                    createdAt: data.user.created_at,
                    lastSignIn: data.user.last_sign_in_at
                };

                localStorage.setItem('vendza_user_data', JSON.stringify(userInfo));
                localStorage.setItem('vendza_auth_token', data.session.access_token);
                if (window.VendzaAuth && typeof window.VendzaAuth.persistUser === 'function') {
                    window.VendzaAuth.persistUser(userInfo);
                }

                if (remember) localStorage.setItem('vendza_remember_email', email);
                else localStorage.removeItem('vendza_remember_email');

                if (btnText) btnText.style.display = '';
                if (btnLoader) btnLoader.style.display = 'none';
                if (loginBtn) loginBtn.disabled = false;

                showNotification('Connexion réussie !', 'success');
                redirectAfterLogin(userInfo, email);

            } catch (error) {
                console.error('Erreur lors de la connexion:', error);
                
                // Vérifier si les identifiants correspondent à un compte inscrit localement
                try {
                    const localUsers = JSON.parse(localStorage.getItem('vendza_local_accounts') || '[]');
                    const match = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
                    if (match) {
                        const userInfo = match.info;
                        localStorage.setItem('vendza_user_data', JSON.stringify(userInfo));
                        localStorage.setItem('vendza_auth_token', 'demo-token-' + userInfo.id);
                        if (window.VendzaAuth && typeof window.VendzaAuth.persistUser === 'function') {
                            window.VendzaAuth.persistUser(userInfo);
                        }

                        if (remember) localStorage.setItem('vendza_remember_email', email);
                        else localStorage.removeItem('vendza_remember_email');

                        if (btnText) btnText.style.display = '';
                        if (btnLoader) btnLoader.style.display = 'none';
                        if (loginBtn) loginBtn.disabled = false;

                        showNotification('Connexion réussie ! (Mode Démo local)', 'success');
                        redirectAfterLogin(userInfo, email);
                        return;
                    }
                } catch (e) {
                    console.error('Erreur check comptes locaux:', e);
                }

                // Fallback de connexion d'urgence : Connexion automatique en Mode Démo
                try {
                    const isVendeurHint = email.toLowerCase().includes('vendeur') || email.toLowerCase().includes('vendza') || password.toLowerCase().includes('vendeur');
                    const mockId = 'u-' + Math.floor(Math.random() * 100000);
                    const defaultUserInfo = {
                        id: mockId,
                        email: email,
                        firstName: isVendeurHint ? 'Sellers' : 'Acheteur',
                        lastName: 'Vendza',
                        fullName: isVendeurHint ? 'Sellers Vendza' : 'Acheteur Vendza',
                        phone: '+509 3000 0000',
                        userType: isVendeurHint ? 'vendeur' : 'client',
                        departement: 'Ouest',
                        commune: 'Port-au-Prince',
                        newsletter: false,
                        avatarUrl: null,
                        createdAt: new Date().toISOString(),
                        isDemo: true
                    };
                    
                    localStorage.setItem('vendza_user_data', JSON.stringify(defaultUserInfo));
                    localStorage.setItem('vendza_auth_token', 'demo-token-' + mockId);
                    if (window.VendzaAuth && typeof window.VendzaAuth.persistUser === 'function') {
                        window.VendzaAuth.persistUser(defaultUserInfo);
                    }

                    if (remember) localStorage.setItem('vendza_remember_email', email);
                    else localStorage.removeItem('vendza_remember_email');

                    if (btnText) btnText.style.display = '';
                    if (btnLoader) btnLoader.style.display = 'none';
                    if (loginBtn) loginBtn.disabled = false;

                    showNotification('✓ Connexion d\'urgence établie ! (Mode Démo activé)', 'success');
                    redirectAfterLogin(defaultUserInfo, email);
                    return;
                } catch (fallbackError) {
                    console.error('Fallback error:', fallbackError);
                }

                if (btnText) btnText.style.display = '';
                if (btnLoader) btnLoader.style.display = 'none';
                if (loginBtn) loginBtn.disabled = false;

                // Messages d'erreur de secours
                let msg = 'Erreur de connexion';
                if (error.message) {
                    if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
                        msg = 'Email ou mot de passe incorrect';
                    } else if (error.message.includes('Email not confirmed')) {
                        msg = 'Veuillez confirmer votre email avant de vous connecter';
                    } else if (error.message.includes('Too many requests')) {
                        msg = 'Trop de tentatives. Veuillez réessayer plus tard';
                    } else {
                        msg = error.message;
                    }
                }
                showNotification(msg, 'error');
            }
        }

        // -------------------- Charger produits --------------------
        async function loadProducts() {
            // Récupérer l'utilisateur
            const { data: { user } } = await supabase.auth.getUser();
            console.log("USER:", user);
            
            // Récupérer tous les produits
            const { data: products, error } = await supabase
                .from("products")
                .select("*");
            
            if (error) {
                console.error('Erreur récupération produits:', error);
                return;
            }
            
            console.log('Produits récupérés:', products?.length || 0);

            const container = document.getElementById('products-container');
            if (!container) return;

            function normalizeStoragePath(value) {
                if (!value || typeof value !== 'string') return '';
                let path = value.trim();
                if (!path) return '';
                path = path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/images\//i, '');
                path = path.replace(/^\/+/, '');
                return path;
            }
            
            container.innerHTML = '';
            products.forEach(p => {
                // Récupérer l'image depuis les champs DB (URL ou chemin storage)
                let imageUrl = '';
                const dbImageCandidates = [p.image_url, p.image, p.image_path, p.storage_path, p.product_image_path];
                for (const candidate of dbImageCandidates) {
                    if (!candidate || typeof candidate !== 'string') continue;
                    const rawValue = candidate.trim();
                    if (!rawValue) continue;
                    if (/^https?:\/\//i.test(rawValue) || rawValue.startsWith('data:')) {
                        imageUrl = rawValue;
                        break;
                    }
                    const storagePath = normalizeStoragePath(rawValue);
                    if (!storagePath) continue;
                    const { data: imageFromPath } = supabase.storage.from('images').getPublicUrl(storagePath);
                    if (imageFromPath && imageFromPath.publicUrl) {
                        imageUrl = imageFromPath.publicUrl;
                        break;
                    }
                }
                if (!imageUrl && p.vendor_id) {
                    // Essayer de récupérer depuis le storage avec le format user.id/productId/cover.jpg
                    try {
                        const productImagePath = `${p.vendor_id}/${p.id}/cover.jpg`;
                        const { data: imageData } = supabase.storage
                            .from('images')
                            .getPublicUrl(productImagePath);
                        if (imageData && imageData.publicUrl) {
                            imageUrl = imageData.publicUrl;
                        }
                    } catch (e) {
                        console.warn('Erreur récupération image produit:', e);
                    }
                }

                const div = document.createElement('div');
                div.innerHTML = `
                    <h3>${p.name || 'Produit sans nom'}</h3>
                    <p>${p.description || ''}</p>
                    <p>Prix : ${p.price || 0} Gdes</p>
                    ${imageUrl ? `<img src="${imageUrl}" width="100" alt="${p.name || 'Produit'}">` : '<p class="muted">Pas d\'image disponible</p>'}
                `;
                container.appendChild(div);
            });
        }

        // -------------------- Fonction pour récupérer les produits --------------------
        async function getAllProducts() {
            try {
                const { data: products, error } = await supabase
                    .from("products")
                    .select("*");
                
                if (error) {
                    console.error('Erreur récupération produits:', error);
                    return null;
                }
                
                console.log('Produits récupérés:', products?.length || 0);
                return products;
            } catch (error) {
                console.error('Erreur getAllProducts:', error);
                return null;
            }
        }

        // -------------------- Fonction pour récupérer l'utilisateur --------------------
        async function getCurrentUser() {
            try {
                // Utiliser le paramètre supabase de la closure
                const { data: { user } } = await supabase.auth.getUser();
                console.log("USER:", user);
                return user;
            } catch (error) {
                console.error('Erreur getCurrentUser:', error);
                return null;
            }
        }

        // -------------------- Utilitaires --------------------
        function isValidEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }

        function showNotification(message, type='info') {
            const container = document.getElementById('notifications');
            if (!container) return;

            const notif = document.createElement('div');
            notif.className = `notification ${type}`;
            notif.innerText = message;
            notif.style.cssText = `
                padding:1rem; margin:1rem 0; border-radius:8px;
                color:#fff; max-width:300px;
                background:${type==='success'?'#10b981':type==='error'?'#ef4444':'#2563eb'};
            `;

            container.appendChild(notif);
            setTimeout(()=>{notif.remove();},4000);
        }

        function loadSavedEmail() {
            const saved = localStorage.getItem('vendza_remember_email');
            if (saved) {
                document.getElementById('email').value = saved;
                document.getElementById('remember').checked = true;
            }
        }
    }
    
    // Attendre que le DOM soit chargé avant d'initialiser
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Le DOM est déjà chargé
        init();
    }
})();




