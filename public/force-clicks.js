// Script de FORÇA BRUTA para garantir cliques funcionem
(function() {
    console.log('[FORCE-CLICKS] 🚀 Iniciando correção FORÇADA...');
    
    function forceEnableClicks() {
        // 1. FORÇAR auth-section a não existir visualmente
        const authSection = document.getElementById('auth-section');
        if (authSection) {
            const computed = window.getComputedStyle(authSection);
            if (computed.display === 'none' || authSection.classList.contains('hidden')) {
                authSection.removeAttribute('style');
                authSection.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important; position: fixed !important; top: -9999px !important; left: -9999px !important; width: 0 !important; height: 0 !important;';
            }
        }
        
        // 2. FORÇAR main a ser clicável
        const main = document.querySelector('main');
        if (main) {
            main.style.pointerEvents = 'auto';
            main.style.zIndex = '1';
        }
        
        // 3. FORÇAR body a ser clicável
        document.body.style.pointerEvents = 'auto';
        
        // 4. FORÇAR todos os elementos interativos
        document.querySelectorAll('button, a, input, select, textarea, [onclick], [data-tab]').forEach(el => {
            if (!el.disabled && el.offsetParent !== null) {
                el.style.pointerEvents = 'auto';
                if (el.tagName === 'BUTTON' || el.tagName === 'A') {
                    el.style.cursor = 'pointer';
                }
            }
        });
        
        // 5. Remover overlays invisíveis
        document.querySelectorAll('.modal.hidden, .loading-overlay.hidden, #auth-section.hidden').forEach(el => {
            el.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important;';
        });
    }
    
    // Executar imediatamente e continuamente
    forceEnableClicks();
    setInterval(forceEnableClicks, 500);
    
    // Listener de emergência
    document.addEventListener('click', function(e) {
        const target = e.target;
        if (target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.onclick)) {
            const style = window.getComputedStyle(target);
            if (style.pointerEvents === 'none') {
                console.warn('[FORCE-CLICKS] ⚠️ Clique bloqueado detectado, corrigindo...', target);
                target.style.pointerEvents = 'auto';
                // Tentar clicar novamente
                setTimeout(() => target.click(), 10);
            }
        }
    }, true);
    
    console.log('[FORCE-CLICKS] ✅ Correção FORÇADA ativada');
})();
