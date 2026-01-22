/**
 * SCRIPT PARA GARANTIR CLIQUES E SCROLL FUNCIONAREM
 * Remove bloqueios e garante interações funcionem
 * Versão simplificada e não-invasiva
 */

(function() {
    'use strict';
    
    console.log('[FIX-INTERACTIONS] 🚀 Iniciando correção de interações...');
    
    // Executar correção de elementos
    function forceEnableAllClicks() {
        try {
            // 1. FORÇAR body e html - REMOVER BLOQUEIOS
            if (document.body) {
                document.body.style.setProperty('pointer-events', 'auto', 'important');
                document.body.style.setProperty('overflow', '', 'important');
                document.body.style.setProperty('overflow-x', '', 'important');
                document.body.style.setProperty('overflow-y', '', 'important');
            }
            if (document.documentElement) {
                document.documentElement.style.setProperty('pointer-events', 'auto', 'important');
                document.documentElement.style.setProperty('overflow', '', 'important');
                document.documentElement.style.setProperty('overflow-x', '', 'important');
                document.documentElement.style.setProperty('overflow-y', '', 'important');
            }
            
            // 2. FORÇAR main
            const main = document.querySelector('main');
            if (main) {
                main.style.setProperty('pointer-events', 'auto', 'important');
                main.style.setProperty('z-index', '1', 'important');
                main.style.setProperty('position', 'relative', 'important');
                main.style.setProperty('display', 'block', 'important');
            }
            
            // 3. REMOVER overlays hidden
            const hiddenSelectors = [
                '#loading-overlay.hidden',
                '.modal.hidden',
                '#auth-section.hidden',
                '#success-modal.hidden',
                '#terms-modal.hidden',
                '#login-required-modal.hidden'
            ];
            
            hiddenSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        el.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -99999 !important; position: fixed !important; top: -99999px !important; left: -99999px !important; width: 0 !important; height: 0 !important;';
                    });
                } catch (e) {
                    // Ignorar erros
                }
            });
            
            // 4. FORÇAR elementos interativos
            const interactiveSelectors = [
                'button:not([disabled])',
                'a:not([disabled])',
                'input:not([disabled]):not([type="hidden"])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                '[onclick]',
                '[data-tab]'
            ];
            
            interactiveSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        const computed = window.getComputedStyle(el);
                        const isVisible = computed.display !== 'none' && 
                                        computed.visibility !== 'hidden' &&
                                        parseFloat(computed.opacity) > 0;
                        
                        if (isVisible && !el.disabled) {
                            // Verificar se não é overlay
                            const isOverlay = el.id.includes('overlay') ||
                                             el.id.includes('loading') ||
                                             (el.id.includes('modal') && el.classList.contains('hidden'));
                            
                            if (!isOverlay) {
                                // FORÇAR pointer-events apenas se estiver none
                                if (computed.pointerEvents === 'none') {
                                    el.style.setProperty('pointer-events', 'auto', 'important');
                                }
                                
                                // FORÇAR cursor
                                if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('data-tab')) {
                                    el.style.setProperty('cursor', 'pointer', 'important');
                                }
                            }
                        }
                    });
                } catch (e) {
                    // Ignorar erros
                }
            });
        } catch (e) {
            console.error('[FIX-INTERACTIONS] Erro na correção:', e);
        }
    }
    
    // Executar imediatamente
    function init() {
        forceEnableAllClicks();
        setTimeout(forceEnableAllClicks, 100);
        setTimeout(forceEnableAllClicks, 500);
        setTimeout(forceEnableAllClicks, 1000);
    }
    
    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
    
    // Listener simples apenas para corrigir pointer-events quando necessário
    document.addEventListener('click', function(e) {
        const target = e.target;
        const computed = window.getComputedStyle(target);
        
        // Apenas corrigir se pointer-events está none e é um elemento interativo
        if (computed.pointerEvents === 'none') {
            const isInteractive = target.tagName === 'BUTTON' ||
                                 target.tagName === 'A' ||
                                 target.onclick ||
                                 target.getAttribute('data-tab') ||
                                 target.closest('button') ||
                                 target.closest('a');
            
            if (isInteractive) {
                target.style.setProperty('pointer-events', 'auto', 'important');
                const parent = target.closest('button, a');
                if (parent) {
                    parent.style.setProperty('pointer-events', 'auto', 'important');
                }
            }
        }
    }, false); // Bubble phase apenas
    
    // Executar correção periodicamente (menos frequente)
    setInterval(() => {
        forceEnableAllClicks();
    }, 10000); // A cada 10 segundos
    
    console.log('[FIX-INTERACTIONS] ✅ Correção ativada (versão simplificada)');
})();
