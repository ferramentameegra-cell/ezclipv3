// Script de diagnóstico e correção de cliques
(function() {
    console.log('[FIX-CLICKS] 🔍 Iniciando diagnóstico...');
    
    // Função para verificar e corrigir elementos bloqueados
    function fixClickableElements() {
        // 1. FORÇAR auth-section a não bloquear (SEMPRE)
        const authSection = document.getElementById('auth-section');
        if (authSection) {
            const computedStyle = window.getComputedStyle(authSection);
            const isVisible = computedStyle.display !== 'none' && 
                            computedStyle.visibility !== 'hidden' &&
                            computedStyle.opacity !== '0';
            
            // Se não está visível, FORÇAR a não bloquear
            if (!isVisible) {
                authSection.style.cssText = `
                    display: none !important;
                    pointer-events: none !important;
                    z-index: -9999 !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    position: fixed !important;
                    top: -9999px !important;
                    left: -9999px !important;
                    width: 0 !important;
                    height: 0 !important;
                `;
                authSection.classList.add('hidden');
                console.log('[FIX-CLICKS] ✅ Auth-section FORÇADA a não bloquear');
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
        
        // 3. FORÇAR que main está acessível (SEMPRE)
        const main = document.querySelector('main');
        if (main) {
            main.style.cssText += `
                pointer-events: auto !important;
                position: relative !important;
                z-index: 1 !important;
            `;
            console.log('[FIX-CLICKS] ✅ Main FORÇADO como interativo');
        }
        
        // 3.5. FORÇAR que body está acessível
        document.body.style.pointerEvents = 'auto';
        document.body.style.position = 'relative';
        
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
        
        // 5. Verificar TODOS os elementos fixos/absolutos que podem estar bloqueando
        const allFixedElements = document.querySelectorAll('*');
        allFixedElements.forEach(el => {
            // Pular elementos que devem ter pointer-events: none (como overlays de timeline)
            if (el.classList.contains('timeline-selected') || 
                el.classList.contains('timeline-playhead') ||
                el.classList.contains('handle-timecode')) {
                return;
            }
            
            const computedStyle = window.getComputedStyle(el);
            const position = computedStyle.position;
            const zIndex = parseInt(computedStyle.zIndex) || 0;
            const display = computedStyle.display;
            const visibility = computedStyle.visibility;
            const opacity = parseFloat(computedStyle.opacity) || 1;
            
            // Se elemento está fixo/absoluto com z-index alto mas não está visível
            if ((position === 'fixed' || position === 'absolute') && 
                zIndex > 100 && 
                (display === 'none' || visibility === 'hidden' || opacity === 0)) {
                el.style.pointerEvents = 'none';
                el.style.zIndex = '-1';
                console.log(`[FIX-CLICKS] ✅ Elemento sobreposto corrigido:`, el.id || el.className || el.tagName);
            }
        });
        
        // 6. FORÇAR que todos os modais escondidos não bloqueiem
        document.querySelectorAll('.modal.hidden, .loading-overlay.hidden').forEach(modal => {
            modal.style.cssText += `
                display: none !important;
                pointer-events: none !important;
                z-index: -9999 !important;
            `;
        });
    }
    
    // Executar imediatamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixClickableElements);
    } else {
        fixClickableElements();
    }
    
    // Executar novamente após delays para garantir (mais frequente)
    setTimeout(fixClickableElements, 50);
    setTimeout(fixClickableElements, 100);
    setTimeout(fixClickableElements, 300);
    setTimeout(fixClickableElements, 500);
    setTimeout(fixClickableElements, 1000);
    setTimeout(fixClickableElements, 2000);
    
    // Executar continuamente a cada 2 segundos (até 10 segundos)
    let intervalCount = 0;
    const intervalId = setInterval(() => {
        fixClickableElements();
        intervalCount++;
        if (intervalCount >= 5) {
            clearInterval(intervalId);
        }
    }, 2000);
    
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
