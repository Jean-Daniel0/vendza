// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    // Client Supabase initialisé dans supabaseclient.js
    const supabase = (typeof window !== 'undefined')
        ? (window.supabaseClient || window.supabase || null)
        : null;
    // Préselection via URL ?userType=vendeur
    const params = new URLSearchParams(window.location.search);
    const presetType = params.get('userType');
    if (presetType) {
        const radio = document.querySelector(`input[name="userType"][value="${presetType}"]`);
        if (radio) radio.checked = true;
    }

    var pwdStrengthScore = 0;

    function redirectAfterSignup(userType, delayMs) {
        var info = null;
        try { info = JSON.parse(localStorage.getItem('vendza_user_data') || 'null'); } catch (_) {}
        if (!info) info = { userType: userType || 'client' };
        if (window.VendzaAuthRedirect && typeof window.VendzaAuthRedirect.goAfterAuth === 'function') {
            window.VendzaAuthRedirect.goAfterAuth(info, info.email || '', userType, delayMs);
            return;
        }
        delayMs = delayMs == null ? 700 : delayMs;
        window.setTimeout(function() {
            window.location.href = window.VZ ? window.VZ.url('home') : '../index.html';
        }, delayMs);
    }

    function redirectToHome(delayMs) {
        redirectAfterSignup('client', delayMs);
    }

    function setAccountType(type) {
        var t = type === 'vendeur' ? 'vendeur' : 'client';
        var clientCard = document.getElementById('type-client');
        var vendeurCard = document.getElementById('type-vendeur');
        var clientRadio = document.getElementById('ut-client');
        var vendeurRadio = document.getElementById('ut-vendeur');
        var vendeurSection = document.getElementById('vendeur-section');
        if (clientCard) clientCard.classList.toggle('active', t === 'client');
        if (vendeurCard) vendeurCard.classList.toggle('active', t === 'vendeur');
        if (clientRadio) clientRadio.checked = t === 'client';
        if (vendeurRadio) vendeurRadio.checked = t === 'vendeur';
        var legacy = document.querySelector('input[name="userType"][value="' + t + '"]');
        if (legacy) legacy.checked = true;
        if (vendeurSection) vendeurSection.classList.toggle('show', t === 'vendeur');
        updateSignupFormState();
    }

    function syncCustomCheck(id) {
        var chk = document.getElementById(id);
        var box = document.getElementById('cc-' + id);
        if (chk && box) box.textContent = chk.checked ? '✓' : '';
    }

    function updateSignupFormState() {
        var btn = document.getElementById('btn-register');
        if (!btn) return;
        var firstName = (document.getElementById('firstName').value || '').trim();
        var lastName = (document.getElementById('lastName').value || '').trim();
        var email = (document.getElementById('email').value || '').trim();
        var phone = (document.getElementById('phone').value || '').trim();
        var departement = document.getElementById('departement').value;
        var commune = document.getElementById('commune').value;
        var password = document.getElementById('password').value;
        var confirmPassword = document.getElementById('confirmPassword').value;
        var terms = document.getElementById('terms').checked;
        var valid = firstName && lastName && email && phone && departement && commune
            && password && password === confirmPassword && pwdStrengthScore >= 1 && terms;
        btn.disabled = !valid;
    }

    function checkPwdBars() {
        var pwd = document.getElementById('password').value;
        var bars = [
            document.getElementById('pb1'),
            document.getElementById('pb2'),
            document.getElementById('pb3'),
            document.getElementById('pb4')
        ];
        var label = document.getElementById('strengthText');
        if (!bars[0]) return;
        bars.forEach(function(b) { if (b) b.className = 'pwd-bar'; });
        if (!pwd) {
            pwdStrengthScore = 0;
            if (label) { label.className = 'pwd-label'; label.textContent = 'Entrez un mot de passe'; }
            checkMatchHint();
            updateSignupFormState();
            return;
        }
        var score = 0;
        if (pwd.length >= 8) score += 1;
        if (pwd.length >= 12) score += 1;
        if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
        if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;
        pwdStrengthScore = score;
        var levels = ['weak', 'fair', 'good', 'strong'];
        var labels = ['Trop faible', 'Faible', 'Bon', 'Fort'];
        var cls = levels[Math.max(0, score - 1)] || 'weak';
        for (var i = 0; i < score; i += 1) {
            if (bars[i]) bars[i].className = 'pwd-bar ' + cls;
        }
        if (label) {
            label.className = 'pwd-label ' + (score > 0 ? cls : '');
            label.textContent = score > 0 ? labels[Math.max(0, score - 1)] : 'Entrez un mot de passe';
        }
        checkMatchHint();
        updateSignupFormState();
    }

    function checkMatchHint() {
        var pwd = document.getElementById('password').value;
        var conf = document.getElementById('confirmPassword').value;
        var el = document.getElementById('pwd-match');
        if (!el) return;
        if (!conf) { el.textContent = ''; return; }
        if (pwd === conf) {
            el.className = 'pwd-match ok';
            el.textContent = '✓ Les mots de passe correspondent';
        } else {
            el.className = 'pwd-match err';
            el.textContent = '✕ Les mots de passe ne correspondent pas';
        }
    }

    function bindInscriptionV2Ui() {
        var clientCard = document.getElementById('type-client');
        var vendeurCard = document.getElementById('type-vendeur');
        if (clientCard) {
            clientCard.addEventListener('click', function() { setAccountType('client'); });
            clientCard.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAccountType('client'); }
            });
        }
        if (vendeurCard) {
            vendeurCard.addEventListener('click', function() { setAccountType('vendeur'); });
            vendeurCard.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAccountType('vendeur'); }
            });
        }

        var toggleConfirm = document.getElementById('toggleConfirmPassword');
        var confirmInput = document.getElementById('confirmPassword');
        if (toggleConfirm && confirmInput) {
            toggleConfirm.addEventListener('click', function() {
                confirmInput.type = confirmInput.type === 'password' ? 'text' : 'password';
                toggleConfirm.textContent = confirmInput.type === 'password' ? '👁️' : '🙈';
            });
        }

        ['terms', 'newsletter'].forEach(function(id) {
            var row = document.getElementById(id === 'terms' ? 'termsRow' : 'newsRow');
            var chk = document.getElementById(id);
            if (!row || !chk) return;
            row.addEventListener('click', function(e) {
                if (e.target === chk || (e.target && e.target.classList && e.target.classList.contains('terms-link'))) return;
                if (e.target.tagName === 'A') return;
                e.preventDefault();
                chk.checked = !chk.checked;
                syncCustomCheck(id);
                updateSignupFormState();
            });
            chk.addEventListener('change', function() {
                syncCustomCheck(id);
                updateSignupFormState();
            });
        });
        syncCustomCheck('terms');
        syncCustomCheck('newsletter');

        ['firstName', 'lastName', 'email', 'phone'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', updateSignupFormState);
        });
        var initialType = document.querySelector('input[name="userType"]:checked');
        setAccountType(initialType ? initialType.value : 'vendeur');
    }

    // Sélecteurs Département/Commune
    const departementSelect = document.getElementById('departement');
    const communeSelect = document.getElementById('commune');

    // Donneeees Haïti (departements -> communes)
    const DATA = {
        'Artibonite': [
            'Desdunes','Dessalines','Grande-Saline','Petite-Rivière-de-l’Artibonite',
            'Ennery','L’Estère','Gonaïves',
            'Anse-Rouge','Gros-Morne','Terre-Neuve',
            'Marmelade','Saint-Michel-de-l’Attalaye',
            'La Chapelle','Saint-Marc','Verrettes','Montrouis','Liancourt'
        ],
        'Centre': [
            'Cerca-la-Source','Thomassique',
            'Cerca-Carvajal','Hinche','Massade','Thomonde',
            'Boucan-Carré','Mirebalais','Saut-d’Eau'
        ],
        'Grand’Anse': [
            'Anse-d’Ainault','Dame-Marie','Les Irois',
            'Beaumont','Corail','Pestel','Roseaux',
            'Abricots','Bonbon','Chambellan','Jérémie','Moron'
        ],
        'Nippes': [
            'Anse-à-Veau','Petit-Trou-de-Nippes','L’Asile','Arnaud','Plaisance-du-Sud',
            'Baradères','Grand-Boucan',
            'Miragoâne','Petite-Rivière-de-Nippes','Fonds-des-Nègres','Paillant'
        ],
        'Nord': [
            'Acul-du-Nord','Milot','Plaine-du-Nord',
            'Borgne','Port-Margot',
            'Cap-Haïtien','Limonade','Quartier-Morin',
            'Bahon','Grande-Rivière-du-Nord',
            'Bas-Limbé','Limbé',
            'Pilate','Plaisance',
            'Dondon','La Victoire','Pignon','Ranquitte','Saint-Raphaël'
        ],
        'Nord-Est': [
            'Fort-Liberté','Perches','Ferrier',
            'Capotille','Mont-Organisé','Ouanaminthe',
            'Caracol','Sainte-Suzanne','Terrier-Rouge','Trou-du-Nord',
            'Carice','Mombin-Crochu','Vallières'
        ],
        'Nord-Ouest': [
            'Baie-de-Henne','Bombardopolis','Jean-Rabel','Môle-Saint-Nicolas',
            'Bassin-Bleu','Chansolme','La Tortue','Port-de-Paix',
            'Anse-à-Foleur','Saint-Louis-du-Nord'
        ],
        'Ouest': [
            'Arcahaie','Cabaret',
            'Cornillon','Croix-des-Bouquets','Fonds-Verrettes','Ganthier','Thomazeau',
            'Anse-à-Galets','Pointe-à-Rai­­quette',
            'Grand-Goâve','Léogâne','Petit-Goâve',
            'Carrefour','Delmas','Gressier','Kenscoff','Pétion-Ville','Tabarre','Cité-Soleil','Port-au-Prince'
        ],
        'Sud': [
            'Aquin','Cavaillon','Saint-Louis-du-Sud',
            'Camp-Perrin','Les Cayes','Chantal','Île-à-Vache','Maniche','Torbeck',
            'Les Anglais','Chardonnières','Tiburon',
            'Côteaux','Port-Piment','Roche-à-Bateaux',
            'Arniquet','Port-Salut','Saint-Jean-du-Sud'
        ],
        'Sud-Est': [
            'Bainet','Côtes-de-Fer',
            'Anse-à-Pitre','Belle-Anse','Grand-Gosier','Thiotte',
            'Cayes-Jacmel','Jacmel','La Vallée','Marigot'
        ]
    };

    // Peupler la liste des départements si vide
    if (departementSelect && departementSelect.options.length <= 1) {
        Object.keys(DATA).forEach(dep => {
            const opt = document.createElement('option');
            opt.value = dep;
            opt.textContent = dep;
            departementSelect.appendChild(opt);
        });
    }

    // Changement de département -> communes
    if (departementSelect && communeSelect) {
        departementSelect.addEventListener('change', function() {
            communeSelect.innerHTML = '<option value="">Sélectionnez une commune</option>';
            const dep = this.value;
            if (dep && DATA[dep]) {
                DATA[dep].forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    communeSelect.appendChild(opt);
                });
                communeSelect.disabled = false;
            } else {
                communeSelect.disabled = true;
            }
            updateSignupFormState();
        });
    }

    bindInscriptionV2Ui();
    if (communeSelect) communeSelect.addEventListener('change', updateSignupFormState);
    if (departementSelect) departementSelect.addEventListener('change', updateSignupFormState);
    
    // Gestion de l'affichage/masquage du mot de passe
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Changer l'icône
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }
    
    // Gestion de la force du mot de passe
    const passwordInput2 = document.getElementById('password');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (passwordInput2) {
        passwordInput2.addEventListener('input', function() {
            if (document.getElementById('pb1')) {
                checkPwdBars();
                return;
            }
            const password = this.value;
            const strength = calculatePasswordStrength(password);
            updatePasswordStrength(strength);
            updateSignupFormState();
        });
    }

    var confirmPasswordInput = document.getElementById('confirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            checkMatchHint();
            updateSignupFormState();
        });
    }
    
    // Gestion du formulaire d'inscription
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSignup();
        });
    }
    
    // Gestion des liens des conditions d'utilisation
    const termsLinks = document.querySelectorAll('.terms-link');
    const termsModal = document.getElementById('termsModal');
    const closeTermsModal = document.getElementById('closeTermsModal');
    
    termsLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            if (termsModal) {
                termsModal.classList.add('active');
                termsModal.classList.add('open');
            }
        });
    });
    
    if (closeTermsModal && termsModal) {
        closeTermsModal.addEventListener('click', function() {
            termsModal.classList.remove('active');
            termsModal.classList.remove('open');
        });
    }
    
    // Fermer le modal en cliquant à l'extérieur
    if (termsModal) {
        termsModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
                this.classList.remove('open');
            }
        });
    }
    
    // Gestion des boutons de connexion sociale
    const googleLoginBtn = document.getElementById('googleLogin');
    if (googleLoginBtn) {
        googleLoginBtn.onclick = async () => {
            try {
                if (!supabase || !supabase.auth) {
                    showNotification('Supabase non disponible', 'error');
                    return;
                }
                
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin + '/authentification/inscription.html'
                    }
                });

                if (error) {
                    console.error('Erreur Google:', error.message);
                    showNotification('Erreur lors de l\'inscription avec Google: ' + error.message, 'error');
                }
            } catch (err) {
                console.error('Erreur inscription Google:', err);
                showNotification('Erreur lors de l\'inscription avec Google', 'error');
            }
        };
    }

    const facebookLoginBtn = document.getElementById('facebookLogin');
    if (facebookLoginBtn) {
        facebookLoginBtn.onclick = async () => {
            try {
                if (!supabase || !supabase.auth) {
                    showNotification('Supabase non disponible', 'error');
                    return;
                }
                
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'facebook',
                    options: {
                        redirectTo: window.location.origin + '/authentification/inscription.html'
                    }
                });

                if (error) {
                    console.error('Erreur Facebook:', error.message);
                    showNotification('Erreur lors de l\'inscription avec Facebook: ' + error.message, 'error');
                }
            } catch (err) {
                console.error('Erreur inscription Facebook:', err);
                showNotification('Erreur lors de l\'inscription avec Facebook', 'error');
            }
        };
    }
    
    // Gestion du sélecteur de type d'utilisateur
    const userTypeOptions = document.querySelectorAll('input[name="userType"]');
    userTypeOptions.forEach(option => {
        option.addEventListener('change', function() {
            setAccountType(this.value);
            updateUserTypeSelection(this.value);
        });
    });
    
    // Fonction de calcul de la force du mot de passe
    function calculatePasswordStrength(password) {
        let score = 0;
        
        if (password.length >= 8) score += 1;
        if (password.match(/[a-z]/)) score += 1;
        if (password.match(/[A-Z]/)) score += 1;
        if (password.match(/[0-9]/)) score += 1;
        if (password.match(/[^a-zA-Z0-9]/)) score += 1;
        
        if (score <= 2) return 'weak';
        if (score <= 3) return 'medium';
        return 'strong';
    }
    
    // Fonction de mise à jour de l'affichage de la force du mot de passe
    function updatePasswordStrength(strength) {
        if (!strengthFill || !strengthText) return;
        
        // Retirer toutes les classes de force
        strengthFill.classList.remove('weak', 'medium', 'strong');
        
        // Ajouter la classe appropriée
        strengthFill.classList.add(strength);
        
        // Mettre à jour le texte
        const strengthMessages = {
            'weak': 'Mot de passe faible',
            'medium': 'Mot de passe moyen',
            'strong': 'Mot de passe fort'
        };
        
        strengthText.textContent = strengthMessages[strength];
    }
    
    // Fonction de gestion de l'inscription
    function handleSignup() {
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const userType = document.querySelector('input[name="userType"]:checked')?.value;
        const departement = document.getElementById('departement').value;
        const commune = document.getElementById('commune').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const terms = document.getElementById('terms').checked;
        const newsletter = document.getElementById('newsletter').checked;
        
        // Validation des champs
        if (!firstName || !lastName || !email || !phone || !userType || !departement || !commune || !password || !confirmPassword) {
            showNotification('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showNotification('Veuillez entrer une adresse email valide', 'error');
            return;
        }
        
        if (!isValidPhone(phone)) {
            showNotification('Veuillez entrer un numéro de téléphone valide', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('Les mots de passe ne correspondent pas', 'error');
            return;
        }
        
        if (password.length < 8) {
            showNotification('Le mot de passe doit contenir au moins 8 caractères', 'error');
            return;
        }
        
        if (!terms) {
            showNotification('Vous devez accepter les conditions d\'utilisation', 'error');
            return;
        }
        
        // Afficher le loader
        const signupBtn = document.querySelector('.signup-btn');
        const btnText = signupBtn ? signupBtn.querySelector('.btn-text') : null;
        const btnLoader = signupBtn ? signupBtn.querySelector('.btn-loader') : null;
        const shopName = (document.getElementById('shopName') && document.getElementById('shopName').value || '').trim();
        
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline-block';
        if (signupBtn) signupBtn.disabled = true;
        
        // Inscription via Supabase
        (async () => {
            const signupFallback = () => {
                const mockId = 'u-' + Math.floor(Math.random() * 1000000);
                const info = {
                    id: mockId,
                    email: email,
                    firstName: firstName,
                    lastName: lastName,
                    fullName: `${firstName} ${lastName}`.trim(),
                    phone: phone,
                    userType: userType,
                    departement: departement,
                    commune: commune,
                    newsletter: newsletter,
                    shopName: shopName || null,
                    createdAt: new Date().toISOString(),
                    isDemo: true
                };
                localStorage.setItem('vendza_user_data', JSON.stringify(info));
                localStorage.setItem('vendza_auth_token', 'demo-token-' + mockId);
                
                // Also store this user locally so they can log in using connexion.js
                try {
                    const localUsers = JSON.parse(localStorage.getItem('vendza_local_accounts') || '[]');
                    localUsers.push({ email, password, info });
                    localStorage.setItem('vendza_local_accounts', JSON.stringify(localUsers));
                } catch (e) {}

                showNotification('✓ Inscription réussie ! (Mode Démo activé en local)', 'success');
                redirectAfterSignup(userType, 1000);
            };

            try {
                if (!supabase || !supabase.auth) {
                    console.warn('Supabase non disponible, passage en mode Démo local...');
                    signupFallback();
                    return;
                }
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            userType: userType,
                            user_type: userType,
                            first_name: firstName,
                            last_name: lastName,
                            phone: phone,
                            departement: departement,
                            commune: commune,
                            shop_name: shopName || null,
                            boutique: shopName || null
                        }
                    }
                });
                if (error) {
                    console.warn('Erreur Supabase lors de l\'inscription, utilisation du fallback local :', error.message);
                    signupFallback();
                    return;
                }

                // Créer l'entrée utilisateur complémentaire dans la table `users`
                try {
                    const authUser = data && data.user;
                    if (authUser && authUser.id) {
                        const { error: insertError } = await supabase.from('users').insert([
                            {
                                id: authUser.id,
                                full_name: `${firstName} ${lastName}`.trim(),
                                first_name: firstName,
                                last_name: lastName,
                                email: email,
                                phone_number: phone,
                                user_type: userType,
                                departement: departement,
                                commune: commune,
                                newsletter: newsletter,
                                shop_name: shopName || null
                            }
                        ]);
                        if (insertError) {
                            console.warn('Insertion users échouée:', insertError.message);
                        }
                        if (userType === 'vendeur' && shopName) {
                            try {
                                await supabase.from('vendors').upsert({
                                    id: authUser.id,
                                    email: email,
                                    name: shopName
                                }, { onConflict: 'id' });
                            } catch (vendorErr) {
                                console.warn('Création vendeur ignorée:', vendorErr);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Création profil users ignorée:', e && e.message ? e.message : e);
                }

                const userData = { id: data && data.user ? data.user.id : '', firstName, lastName, email, phone, userType, departement, commune, newsletter, shopName: shopName };
                localStorage.setItem('vendza_user_data', JSON.stringify(userData));

                showNotification('Inscription réussie ! Veuillez confirmer votre compte par e-mail si nécessaire.', 'success');
                redirectAfterSignup(userType);
            } catch (err) {
                console.warn('Exception attrapée en inscription, activation du fallback local :', err);
                signupFallback();
            } finally {
                if (btnText) btnText.style.display = '';
                if (btnLoader) btnLoader.style.display = 'none';
                if (signupBtn) signupBtn.disabled = false;
                updateSignupFormState();
            }
        })();
    }
    
    // -------------------- Gérer le retour OAuth --------------------
    async function handleOAuthSignup(session) {
        try {
            if (!supabase || !supabase.auth) {
                console.warn('Supabase auth non disponible dans handleOAuthSignup');
                return;
            }
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Récupérer le type d'utilisateur depuis l'URL ou localStorage
            const params = new URLSearchParams(window.location.search);
            const userType = params.get('userType') || 
                           document.querySelector('input[name="userType"]:checked')?.value || 
                           'client';

            // Vérifier si l'utilisateur existe déjà
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
                        first_name: (fullName.split(' ')[0] || ''),
                        last_name: (fullName.split(' ').slice(1).join(' ') || ''),
                        email: user.email,
                        user_type: userType,
                        newsletter: false
                    }]);

                if (insertError) {
                    console.warn('Erreur création utilisateur OAuth:', insertError);
                } else {
                    userData = {
                        id: user.id,
                        full_name: fullName,
                        email: user.email,
                        user_type: userType
                    };
                }
            }

            // Récupérer l'avatar depuis Google ou Supabase Storage
            let avatarUrl = null;
            if (user.user_metadata?.avatar_url) {
                avatarUrl = user.user_metadata.avatar_url;
            }

            const userInfo = {
                id: user.id,
                email: user.email,
                firstName: userData?.full_name?.split(' ')[0] || '',
                lastName: userData?.full_name?.split(' ').slice(1).join(' ') || '',
                fullName: userData?.full_name || user.user_metadata?.full_name || '',
                phone: userData?.phone_number || '',
                userType: userData?.user_type || userType,
                departement: userData?.departement || '',
                commune: userData?.commune || '',
                newsletter: userData?.newsletter || false,
                avatarUrl: avatarUrl,
                createdAt: user.created_at
            };

            localStorage.setItem('vendza_user_data', JSON.stringify(userInfo));
            localStorage.setItem('vendza_auth_token', session.access_token);

            showNotification('Inscription réussie avec Google !', 'success');
            redirectToHome();
        } catch (error) {
            console.error('Erreur handleOAuthSignup:', error);
            showNotification('Erreur lors de l\'inscription OAuth', 'error');
        }
    }

    // Configurer onAuthStateChange si Supabase est disponible
    if (supabase && supabase.auth && typeof supabase.auth.onAuthStateChange === 'function') {
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                handleOAuthSignup(session);
            }
        });
    } else {
        console.warn('Supabase auth non disponible pour onAuthStateChange');
    }
    
    // Fonction de mise à jour de la sélection du type d'utilisateur
    function updateUserTypeSelection(userType) {
        console.log('Type d\'utilisateur sélectionné:', userType);
        
        // Ici vous pouvez ajouter une logique spécifique selon le type sélectionné
        if (userType === 'vendeur') {
            showNotification('Vous allez créer un compte vendeur', 'info');
        } else {
            showNotification('Vous allez créer un compte client', 'info');
        }
    }
    
    // Fonction de validation d'email
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Fonction de validation de téléphone
    function isValidPhone(phone) {
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{8,}$/;
        return phoneRegex.test(phone);
    }
    
    // Fonction d'affichage des notifications
    function showNotification(message, type = 'info') {
        const notificationsContainer = document.getElementById('notifications');
        if (!notificationsContainer) return;
        
        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Définir les couleurs selon le type (utilisant votre palette)
        let bgColor, borderColor, iconColor;
        switch(type) {
            case 'success':
                bgColor = '#10b981'; // Vert principal
                borderColor = '#059669'; // Vert secondaire
                iconColor = '#34d399'; // Vert clair
                break;
            case 'error':
                bgColor = '#ef4444'; // Rouge pour les erreurs
                borderColor = '#dc2626';
                iconColor = '#fca5a5';
                break;
            case 'info':
            default:
                bgColor = '#2563eb'; // Bleu principal
                borderColor = '#1d4ed8'; // Bleu secondaire
                iconColor = '#3b82f6'; // Bleu clair
                break;
        }
        
        // Créer le contenu de la notification
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" style="color: ${iconColor};"></i>
            <span>${message}</span>
        `;
        
        // Appliquer les styles
        notification.style.cssText = `
            background: ${bgColor};
            border-left: 4px solid ${borderColor};
            color: white;
            padding: 1rem 1.5rem;
            margin-bottom: 1rem;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            max-width: 300px;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            z-index: 1001;
        `;
        
        // Ajouter au DOM
        notificationsContainer.appendChild(notification);
        
        // Animation d'entrée
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Supprimer après 4 secondes
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
    
    // Animation d'entrée des éléments
    function animateElements() {
        const elements = document.querySelectorAll('.form-group, .user-type-selector, .form-options, .signup-btn, .divider, .social-signup, .signup-footer');
        
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }
    
    // Gestion des erreurs
    window.addEventListener('error', function(e) {
        console.error('Erreur JavaScript:', e.error);
        showNotification('Une erreur est survenue', 'error');
    });
    
    // Initialisation
    animateElements();
    
    // Console log pour debug
    console.log('Page d\'inscription Vendza chargée avec succès !');
    
    // Performance monitoring
    if ('performance' in window) {
        window.addEventListener('load', function() {
            setTimeout(function() {
                const perfData = performance.getEntriesByType('navigation')[0];
                console.log('Temps de chargement de la page d\'inscription:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
            }, 0);
        });
    }
});








