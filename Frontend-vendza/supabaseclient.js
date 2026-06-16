'use strict';

(function () {
    if (typeof window === 'undefined') return;

    // Vérifier que le CDN Supabase est bien chargé
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error(
            '❌ Supabase CDN non chargé. Vérifiez que le script supabase.min.js est inclus AVANT supabaseclient.js'
        );
        return;
    }

    // Config attendue depuis config.js
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
        console.error(
            '❌ Variables Supabase absentes. Chargez config.js AVANT supabaseclient.js'
        );
        window.supabaseClient = null;
        return;
    }

    const supabaseUrl = SUPABASE_URL;
    const supabaseKey = SUPABASE_ANON_KEY;

    try {
        // NE PAS écraser window.supabase (fourni par le CDN)
        const client = window.supabase.createClient(supabaseUrl, supabaseKey);

        // Exposer uniquement le client applicatif
        window.supabaseClient = client;

        console.log('✅ Supabase client initialisé (supabaseClient)');
    } catch (err) {
        console.error('❌ Erreur lors de la création du client Supabase :', err);
        window.supabaseClient = null;
    }
})();
