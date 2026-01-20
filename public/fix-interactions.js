/**
 * SCRIPT AGRESSIVO PARA FORÇAR CLIQUES FUNCIONAREM
 * Remove TODOS os bloqueios possíveis
 */

(function() {
    console.log('[FIX-INTERACTIONS] 🚀 Iniciando correção AGRESSIVA de interações...');
    
    function forceEnableAllClicks() {
        // 1. FORÇAR body e html
        if (document.body) {
            document.body.style.setProperty('pointer-events', 'auto', 'important');
            document.body.style.setProperty('overflow', '', 'important');
            document.body.style.setProperty('position', 'relative', 'important');
        }
        if (document.documentElement) {
            document.documentElement.style.setProperty('pointer-events', 'auto', 'important');
            document.documentElement.style.setProperty('overflow', '', 'important');
        }
        
        // 2. FORÇAR main
        const main = document.querySelector('main');
        if (main) {
            main.style.setProperty('pointer-events', 'auto', 'important');
            main.style.setProperty('z-index', '1', 'important');
            main.style.setProperty('position', 'relative', 'important');
            main.style.setProperty('display', 'block', 'important');
        }
        
        // 3. REMOVER COMPLETAMENTE overlays hidden
        const hiddenSelectors = [
            '#loading-overlay.hidden',
            '.modal.hidden',
            '#auth-section.hidden',
            '#success-modal.hidden',
            '#terms-modal.hidden',
            '#login-required-modal.hidden',
            '[id*="overlay"].hidden',
            '[class*="overlay"].hidden'
        ];
        
        hiddenSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -99999 !important; position: fixed !important; top: -99999px !important; left: -99999px !important; width: 0 !important; height: 0 !important; opacity: 0 !important; visibility: hidden !important;';
                el.removeAttribute('style');
                el.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -99999 !important; position: fixed !important; top: -99999px !important; left: -99999px !important; width: 0 !important; height: 0 !important;';
            });
        });
        
        // 4. FORÇAR todos os elementos interativos
        const interactiveSelectors = [
            'button:not([disabled])',
            'a:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[onclick]',
            '[data-tab]',
            'label',
            '[role="button"]'
        ];
        
        let fixedCount = 0;
        interactiveSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const computed = window.getComputedStyle(el);
                const isVisible = computed.display !== 'none' && 
                                computed.visibility !== 'hidden' &&
                                parseFloat(computed.opacity) > 0 &&
                                el.offsetParent !== null;
                
                if (isVisible && !el.disabled) {
                    // Verificar se não é overlay
                    const isOverlay = el.id.includes('overlay') ||
                                     el.id.includes('loading') ||
                                     el.id.includes('modal') ||
                                     el.classList.contains('modal-backdrop') ||
                                     (el.classList.contains('modal') && !el.classList.contains('hidden'));
                    
                    if (!isOverlay) {
                        // FORÇAR pointer-events
                        if (computed.pointerEvents === 'none') {
                            el.style.setProperty('pointer-events', 'auto', 'important');
                            fixedCount++;
                        }
                        
                        // FORÇAR cursor
                        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('data-tab')) {
                            el.style.setProperty('cursor', 'pointer', 'important');
                        }
                        
                        // Garantir que não está com z-index negativo
                        const zIndex = parseInt(computed.zIndex) || 0;
                        if (zIndex < 0) {
                            el.style.setProperty('z-index', 'auto', 'important');
                        }
                    }
                }
            });
        });
        
        // 5. REMOVER elementos com z-index alto que estão invisíveis
        document.querySelectorAll('*').forEach(el => {
            const computed = window.getComputedStyle(el);
            const zIndex = parseInt(computed.zIndex) || 0;
            const display = computed.display;
            const visibility = computed.visibility;
            const opacity = parseFloat(computed.opacity) || 1;
            
            if (zIndex > 100 && 
                (display === 'none' || visibility === 'hidden' || opacity === 0 || el.classList.contains('hidden')) &&
                (el.id.includes('overlay') || el.id.includes('loading') || el.id.includes('modal') || el.id.includes('auth-section'))) {
                el.style.setProperty('pointer-events', 'none', 'important');
                el.style.setProperty('z-index', '-99999', 'important');
                el.style.setProperty('display', 'none', 'important');
            }
        });
        
        if (fixedCount > 0) {
            console.log(`[FIX-INTERACTIONS] ✅ ${fixedCount} elemento(s) corrigido(s)`);
        }
    }
    
    // Executar imediatamente e repetidamente
    function init() {
        forceEnableAllClicks();
        
        // Executar várias vezes para garantir
        setTimeout(forceEnableAllClicks, 50);
        setTimeout(forceEnableAllClicks, 100);
        setTimeout(forceEnableAllClicks, 200);
        setTimeout(forceEnableAllClicks, 500);
        setTimeout(forceEnableAllClicks, 1000);
        setTimeout(forceEnableAllClicks, 2000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Listener ULTRA AGRESSIVO - captura TODOS os cliques
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        // Se o clique não está funcionando, forçar
        const computed = window.getComputedStyle(target);
        
        // Verificar elemento no ponto do clique
        const rect = target.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        
        // Se há elemento sobreposto
        if (elementAtPoint && elementAtPoint !== target && !target.contains(elementAtPoint)) {
            const overlayComputed = window.getComputedStyle(elementAtPoint);
            const isOverlayHidden = overlayComputed.display === 'none' ||
                                   overlayComputed.visibility === 'hidden' ||
                                   parseFloat(overlayComputed.opacity) === 0 ||
                                   elementAtPoint.classList.contains('hidden') ||
                                   elementAtPoint.id.includes('overlay') ||
                                   elementAtPoint.id.includes('loading') ||
                                   (elementAtPoint.classList.contains('modal') && elementAtPoint.classList.contains('hidden'));
            
            if (isOverlayHidden) {
                console.warn('[FIX-INTERACTIONS] 🚨 Overlay bloqueando, removendo FORÇADAMENTE:', elementAtPoint);
                elementAtPoint.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -99999 !important; position: fixed !important; top: -99999px !important; left: -99999px !important; width: 0 !important; height: 0 !important;';
                
                // Forçar clique no target original
                setTimeout(() => {
                    if (target.onclick) {
                        try {
                            if (typeof target.onclick === 'function') {
                                target.onclick(e);
                            } else {
                                eval(target.onclick);
                            }
                        } catch (err) {
                            console.error('[FIX-INTERACTIONS] Erro:', err);
                        }
                    } else if (target.getAttribute('data-tab')) {
                        const tabName = target.getAttribute('data-tab');
                        if (typeof window.switchTab === 'function') {
                            window.switchTab(tabName);
                        }
                    } else if (target.tagName === 'BUTTON' || target.tagName === 'A') {
                        // Criar novo evento e disparar
                        const newEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        target.dispatchEvent(newEvent);
                    }
                }, 5);
                return;
            }
        }
        
        // Se pointer-events está none, corrigir e re-disparar
        if (computed.pointerEvents === 'none') {
            const isInteractive = target.tagName === 'BUTTON' ||
                                 target.tagName === 'A' ||
                                 target.onclick ||
                                 target.getAttribute('data-tab') ||
                                 target.closest('button') ||
                                 target.closest('a');
            
            if (isInteractive) {
                console.warn('[FIX-INTERACTIONS] 🚨 Clique bloqueado, corrigindo:', target);
                target.style.setProperty('pointer-events', 'auto', 'important');
                
                const parent = target.closest('button, a');
                if (parent) {
                    parent.style.setProperty('pointer-events', 'auto', 'important');
                }
                
                // Re-disparar clique
                setTimeout(() => {
                    if (target.onclick) {
                        try {
                            if (typeof target.onclick === 'function') {
                                target.onclick(e);
                            } else {
                                eval(target.onclick);
                            }
                        } catch (err) {
                            console.error('[FIX-INTERACTIONS] Erro:', err);
                        }
                    } else if (target.getAttribute('data-tab')) {
                        const tabName = target.getAttribute('data-tab');
                        console.log('[FIX-INTERACTIONS] Tentando trocar tab:', tabName);
                        if (typeof window.switchTab === 'function') {
                            window.switchTab(tabName);
                        } else if (typeof switchTab === 'function') {
                            switchTab(tabName);
                        } else {
                            console.error('[FIX-INTERACTIONS] Função switchTab não encontrada!');
                        }
                    } else {
                        const newEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        target.dispatchEvent(newEvent);
                    }
                }, 5);
            }
        }
    }, true); // Capture phase - pega ANTES de qualquer coisa
    
    // Listener adicional no bubble phase como backup
    document.addEventListener('click', function(e) {
        const target = e.target;
        const computed = window.getComputedStyle(target);
        
        // Se chegou aqui e pointer-events é none, algo está muito errado
        if (computed.pointerEvents === 'none' && 
            (target.tagName === 'BUTTON' || target.tagName === 'A' || target.onclick)) {
            console.error('[FIX-INTERACTIONS] ❌ Clique ainda bloqueado após correção!', target);
            target.style.setProperty('pointer-events', 'auto', 'important');
        }
    }, false); // Bubble phase como backup
    
    console.log('[FIX-INTERACTIONS] ✅ Correção AGRESSIVA ativada');
})();
