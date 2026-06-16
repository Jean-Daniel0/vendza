// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    const isAboutV2 = document.body.classList.contains('page-a-propos');

    function syncNavCartCount() {
        try {
            const raw = localStorage.getItem('vendza_cart');
            const cart = raw ? JSON.parse(raw) : [];
            const n = Array.isArray(cart) ? cart.reduce(function (s, i) { return s + (Number(i && i.quantity) || 1); }, 0) : 0;
            const el = document.getElementById('nav-cart-count');
            if (el) el.textContent = String(n);
        } catch (e) {}
    }
    syncNavCartCount();
    window.addEventListener('storage', function (e) {
        if (e.key === 'vendza_cart') syncNavCartCount();
    });

    if (isAboutV2) {
        document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(function (el) {
            var ro = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) entry.target.classList.add('visible');
                });
            }, { threshold: 0.12 });
            ro.observe(el);
        });
        document.querySelectorAll('.valeurs-grid, .services-grid, .chiffres-grid, .equipe-grid').forEach(function (grid) {
            Array.from(grid.children).forEach(function (child, i) {
                child.style.transitionDelay = (i * 0.1) + 's';
            });
        });
        var form = document.getElementById('contactFormApropos');
        var sendBtn = form ? form.querySelector('.btn-send') : null;
        if (form && sendBtn) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var email = (document.getElementById('cfEmail') && document.getElementById('cfEmail').value) || '';
                var subj = (document.getElementById('cfSubject') && document.getElementById('cfSubject').value) || 'Contact Vendza';
                var body = (document.getElementById('cfBody') && document.getElementById('cfBody').value) || '';
                var name = (document.getElementById('cfName') && document.getElementById('cfName').value) || '';
                var mailto = 'mailto:vendza@gmail.com?subject=' + encodeURIComponent(subj) +
                    '&body=' + encodeURIComponent((name ? 'Nom: ' + name + '\n\n' : '') + body);
                window.location.href = mailto;
                var t = sendBtn.textContent;
                sendBtn.textContent = '✓ Ouverture du courriel…';
                sendBtn.style.background = 'linear-gradient(90deg,#16a34a,#0d9488)';
                setTimeout(function () {
                    sendBtn.textContent = t;
                    sendBtn.style.background = '';
                }, 2500);
            });
        }
    }
    
    // Navigation mobile
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
    
    // Fermer le menu mobile en cliquant sur un lien
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (hamburger) hamburger.classList.remove('active');
            if (navMenu) navMenu.classList.remove('active');
        });
    });
    
    // Animation au scroll pour les cartes
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observer les cartes et éléments (ancienne page uniquement)
    if (!isAboutV2) {
        const cards = document.querySelectorAll('.card, .feature, .team-member, .contact-item');
        cards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(card);
        });

        const textElements = document.querySelectorAll('.story h2, .story p, .features h2, .team h2, .contact-section h2');
        textElements.forEach(element => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            observer.observe(element);
        });

        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const hero = document.querySelector('.hero');
            if (hero) {
                const rate = scrolled * -0.5;
                hero.style.transform = `translateY(${rate}px)`;
            }
        });

        const icons = document.querySelectorAll('.card i, .feature i, .contact-item i');
        icons.forEach(icon => {
            icon.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.2) rotate(5deg)';
                this.style.transition = 'transform 0.3s ease';
            });

            icon.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1) rotate(0deg)';
            });
        });

        const allCards = document.querySelectorAll('.card, .feature, .team-member');
        allCards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-10px) scale(1.02)';
                this.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)';
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
            });
        });
    }
    
    // Animation du compteur pour les statistiques (si ajoutées plus tard)
    function animateCounter(element, target, duration = 2000) {
        let start = 0;
        const increment = target / (duration / 16);
        
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(start);
            }
        }, 16);
    }
    
    // Smooth scroll pour les liens internes
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Effet de typewriter pour le titre principal (optionnel)
    function typeWriter(element, text, speed = 100) {
        let i = 0;
        element.innerHTML = '';
        
        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }
    
    // Appliquer l'effet typewriter au titre principal si désiré
    const mainTitle = document.querySelector('.hero-content h1');
    if (mainTitle) {
        const originalText = mainTitle.textContent;
        // typeWriter(mainTitle, originalText, 80);
    }
    
    // Animation des liens sociaux au hover
    const socialLinks = document.querySelectorAll('.social-links a');
    socialLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.1)';
            this.style.transition = 'transform 0.3s ease';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Effet de ripple pour les boutons (si ajoutés plus tard)
    function createRipple(event) {
        const button = event.currentTarget;
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    // Appliquer l'effet ripple aux boutons
    const buttons = document.querySelectorAll('button, .btn');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
    
    // Lazy loading des images (si ajoutées plus tard)
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
    
    // Gestion du thème sombre/clair (optionnel)
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }
    
    // Charger le thème sauvegardé
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    
    // Animation de chargement de la page
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
    });
    
    // Console log pour debug
    console.log('Page "À propos" chargée avec succès !');
    
    // Gestion des erreurs
    window.addEventListener('error', function(e) {
        console.error('Erreur JavaScript:', e.error);
    });
    
    // Performance monitoring
    if ('performance' in window) {
        window.addEventListener('load', function() {
            setTimeout(function() {
                const perfData = performance.getEntriesByType('navigation')[0];
                console.log('Temps de chargement:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
            }, 0);
        });
    }
});
