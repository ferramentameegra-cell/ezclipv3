/**
 * SCRIPT PARA GARANTIR INTERAÇÕES FUNCIONEM
 * Remove bloqueios desnecessários e garante cliques funcionem
 */

(function() {
    console.log('[FIX-INTERACTIONS] 🔧 Iniciando correção de interações...');
    
    function ensureInteractionsWork() {
        // 1. Garantir que body e html não bloqueiem scroll ou cliques
        document.body.style.overflow = '';
        document.body.style.pointerEvents = 'auto';
        document.documentElement.style.overflow = '';
        document.documentElement.style.pointerEvents = 'auto';
        
        // 2. Remover bloqueios de auth-section quando escondida
        const authSection = document.getElementById('auth-section');
        if (authSection) {
            const computed = window.getComputedStyle(authSection);
            if (computed.display === 'none' || authSection.classList.contains('hidden')) {
                authSection.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important; position: fixed !important; top: -9999px !important; left: -9999px !important; width: 0 !important; height: 0 !important;';
            }
        }
        
        // 3. Remover bloqueios de loading-overlay quando escondido
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            const computed = window.getComputedStyle(loadingOverlay);
            if (computed.display === 'none' || loadingOverlay.classList.contains('hidden')) {
                loadingOverlay.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important;';
            }
        }
        
        // 4. Garantir que main está acessível e clicável
        const main = document.querySelector('main');
        if (main) {
            const computed = window.getComputedStyle(main);
            if (computed.display === 'none') {
                main.style.display = 'block';
            }
            main.style.pointerEvents = 'auto';
            main.style.zIndex = '1';
            main.style.position = 'relative';
        }
        
        // 5. Remover pointer-events: none de TODOS os elementos interativos visíveis
        const interactiveSelectors = 'button:not([disabled]), a:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [onclick], [data-tab], label, [role="button"]';
        document.querySelectorAll(interactiveSelectors).forEach(el => {
            const computed = window.getComputedStyle(el);
            const isVisible = computed.display !== 'none' && 
                            computed.visibility !== 'hidden' &&
                            parseFloat(computed.opacity) > 0 &&
                            el.offsetParent !== null;
            
            if (isVisible && !el.disabled) {
                // Verificar se não é um overlay que deveria ter pointer-events: none
                const isOverlay = el.classList.contains('overlay') || 
                                 el.classList.contains('modal-backdrop') ||
                                 el.id.includes('overlay') ||
                                 el.id.includes('loading') ||
                                 (el.classList.contains('modal') && el.classList.contains('hidden'));
                
                if (!isOverlay && computed.pointerEvents === 'none') {
                    el.style.pointerEvents = 'auto';
                    console.log('[FIX-INTERACTIONS] ✅ Corrigido pointer-events em:', el.tagName, el.id || el.className);
                }
                
                // Garantir cursor pointer em elementos clicáveis
                if ((el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button') && computed.cursor === 'default') {
                    el.style.cursor = 'pointer';
                }
            }
        });
        
        // 6. Remover overlays invisíveis que possam estar bloqueando
        document.querySelectorAll('.modal.hidden, .overlay.hidden, .loading-overlay.hidden, [class*="overlay"].hidden').forEach(el => {
            el.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important;';
        });
    }
    
    // Executar imediatamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureInteractionsWork);
    } else {
        ensureInteractionsWork();
    }
    
    // Executar em intervalos para garantir
    setTimeout(ensureInteractionsWork, 50);
    setTimeout(ensureInteractionsWork, 100);
    setTimeout(ensureInteractionsWork, 300);
    setTimeout(ensureInteractionsWork, 500);
    setTimeout(ensureInteractionsWork, 1000);
    
    // Listener global para detectar e corrigir cliques bloqueados em tempo real
    document.addEventListener('click', function(e) {
        const target = e.target;
        const computed = window.getComputedStyle(target);
        
        // Se clique foi em elemento que deveria ser clicável mas pointer-events está none
        if (computed.pointerEvents === 'none' && 
            (target.tagName === 'BUTTON' || 
             target.tagName === 'A' || 
             target.onclick || 
             target.getAttribute('data-tab') ||
             target.closest('button') ||
             target.closest('a'))) {
            
            console.warn('[FIX-INTERACTIONS] ⚠️ Clique bloqueado detectado, corrigindo...', target);
            
            // Corrigir o elemento
            target.style.pointerEvents = 'auto';
            
            // Se for um elemento dentro de button/a, corrigir o pai também
            const parent = target.closest('button, a');
            if (parent) {
                parent.style.pointerEvents = 'auto';
            }
            
            // Tentar disparar o clique novamente após correção
            setTimeout(() => {
                if (target.onclick) {
                    target.onclick();
                } else if (target.getAttribute('data-tab')) {
                    const tabName = target.getAttribute('data-tab');
                    if (typeof switchTab === 'function') {
                        switchTab(tabName);
                    }
                } else if (target.tagName === 'BUTTON' || target.tagName === 'A') {
                    target.click();
                }
            }, 10);
        }
    }, true); // Use capture phase para pegar antes de qualquer bloqueio
    
    console.log('[FIX-INTERACTIONS] ✅ Correção de interações ativada com listener de cliques');
})();
