// Script de diagnóstico e correção de cliques
(function() {
    console.log('[FIX-CLICKS] 🔍 Iniciando diagnóstico...');
    
    // Função para verificar e corrigir elementos bloqueados
    function fixClickableElements() {
        // 1. Garantir que auth-section não bloqueie
        const authSection = document.getElementById('auth-section');
        if (authSection) {
            const isHidden = authSection.classList.contains('hidden') || 
                           authSection.style.display === 'none' ||
                           window.getComputedStyle(authSection).display === 'none';
            
            if (isHidden) {
                authSection.style.display = 'none';
                authSection.style.pointerEvents = 'none';
                authSection.style.zIndex = '-1';
                authSection.style.visibility = 'hidden';
                authSection.style.opacity = '0';
                authSection.style.position = 'fixed';
                authSection.style.top = '-9999px';
                authSection.style.left = '-9999px';
                console.log('[FIX-CLICKS] ✅ Auth-section escondida e bloqueio removido');
            }
        }
        
        // 2. Garantir que loading-overlay não bloqueie quando escondido
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            const isHidden = loadingOverlay.classList.contains('hidden') || 
                           window.getComputedStyle(loadingOverlay).display === 'none';
            
            if (isHidden) {
                loadingOverlay.style.display = 'none';
                loadingOverlay.style.pointerEvents = 'none';
                loadingOverlay.style.zIndex = '-1';
                console.log('[FIX-CLICKS] ✅ Loading-overlay escondido e bloqueio removido');
            }
        }
        
        // 3. Garantir que main está acessível
        const main = document.querySelector('main');
        if (main) {
            main.style.pointerEvents = 'auto';
            main.style.position = 'relative';
            main.style.zIndex = '1';
            console.log('[FIX-CLICKS] ✅ Main configurado como interativo');
        }
        
        // 4. Corrigir todos os elementos interativos
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [onclick], [data-tab]');
        let fixedCount = 0;
        
        interactiveElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            const isVisible = computedStyle.display !== 'none' && 
                            computedStyle.visibility !== 'hidden' &&
                            computedStyle.opacity !== '0';
            
            if (isVisible && !el.disabled) {
                // Verificar se está bloqueado
                if (computedStyle.pointerEvents === 'none') {
                    el.style.pointerEvents = 'auto';
                    fixedCount++;
                }
                
                // Garantir cursor pointer em elementos clicáveis
                if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick) {
                    el.style.cursor = 'pointer';
                }
            }
        });
        
        console.log(`[FIX-CLICKS] ✅ ${fixedCount} elementos interativos corrigidos`);
        
        // 5. Verificar se há elementos sobrepostos bloqueando
        const allFixedElements = document.querySelectorAll('[style*="position: fixed"], [style*="position: absolute"]');
        allFixedElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            const zIndex = parseInt(computedStyle.zIndex) || 0;
            
            // Se elemento está fixo/absoluto com z-index alto mas não deveria estar visível
            if (zIndex > 100 && (computedStyle.display === 'none' || computedStyle.visibility === 'hidden')) {
                el.style.pointerEvents = 'none';
                el.style.zIndex = '-1';
                console.log(`[FIX-CLICKS] ✅ Elemento sobreposto corrigido:`, el.id || el.className);
            }
        });
    }
    
    // Executar imediatamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixClickableElements);
    } else {
        fixClickableElements();
    }
    
    // Executar novamente após um delay para garantir
    setTimeout(fixClickableElements, 100);
    setTimeout(fixClickableElements, 500);
    setTimeout(fixClickableElements, 1000);
    
    // Adicionar listener global para detectar cliques bloqueados
    document.addEventListener('click', function(e) {
        const target = e.target;
        const computedStyle = window.getComputedStyle(target);
        
        // Se clique foi em elemento que deveria ser clicável mas não funcionou
        if ((target.tagName === 'BUTTON' || target.tagName === 'A' || target.onclick) && 
            computedStyle.pointerEvents === 'none') {
            console.warn('[FIX-CLICKS] ⚠️ Clique bloqueado detectado em:', target);
            target.style.pointerEvents = 'auto';
        }
    }, true); // Use capture phase
    
    console.log('[FIX-CLICKS] ✅ Diagnóstico e correção ativados');
})();
