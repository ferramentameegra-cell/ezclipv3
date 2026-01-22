/**
 * SCRIPT DEFINITIVO PARA GARANTIR CLIQUES E SCROLL
 * Versão 5.0.0 - Solução Simples e Eficaz
 * Remove interceptação de Event.prototype que pode causar problemas
 */

(function() {
    'use strict';
    
    console.log('[FIX-INTERACTIONS] 🚀 Iniciando correção DEFINITIVA de cliques...');
    
    let isRunning = false;
    
    // ============================================
    // FUNÇÃO PRINCIPAL: FORÇAR TODOS OS ELEMENTOS INTERATIVOS
    // ============================================
    function forceAllInteractive() {
        if (isRunning) return;
        isRunning = true;
        
        try {
            // 1. FORÇAR HTML E BODY
            if (document.documentElement) {
                document.documentElement.style.setProperty('pointer-events', 'auto', 'important');
                document.documentElement.style.setProperty('overflow', 'auto', 'important');
                document.documentElement.style.setProperty('overflow-x', 'auto', 'important');
                document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
            }
            
            if (document.body) {
                document.body.style.setProperty('pointer-events', 'auto', 'important');
                document.body.style.setProperty('overflow', 'auto', 'important');
                document.body.style.setProperty('overflow-x', 'auto', 'important');
                document.body.style.setProperty('overflow-y', 'auto', 'important');
            }
            
            // 2. REMOVER OVERLAYS OCULTOS COMPLETAMENTE
            const hiddenOverlays = document.querySelectorAll(
                '#loading-overlay.hidden, ' +
                '.loading-overlay.hidden, ' +
                '.modal.hidden, ' +
                '#auth-section.hidden, ' +
                '#success-modal.hidden, ' +
                '#terms-modal.hidden, ' +
                '#login-required-modal.hidden, ' +
                '[id*="overlay"].hidden, ' +
                '[class*="overlay"].hidden'
            );
            
            hiddenOverlays.forEach(el => {
                el.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -99999 !important; position: fixed !important; top: -99999px !important; left: -99999px !important; width: 0 !important; height: 0 !important; opacity: 0 !important; visibility: hidden !important;';
            });
            
            // 3. FORÇAR TODOS OS ELEMENTOS INTERATIVOS
            const allInteractive = document.querySelectorAll(
                'button:not([disabled]), ' +
                'a:not([disabled]), ' +
                'input:not([disabled]):not([type="hidden"]), ' +
                'select:not([disabled]), ' +
                'textarea:not([disabled]), ' +
                '[onclick], ' +
                '[data-tab], ' +
                '[data-step-card], ' +
                'label, ' +
                '[role="button"], ' +
                '[role="link"]'
            );
            
            allInteractive.forEach(el => {
                try {
                    const computed = window.getComputedStyle(el);
                    const isVisible = computed.display !== 'none' && 
                                    computed.visibility !== 'hidden' &&
                                    parseFloat(computed.opacity || 1) > 0;
                    
                    if (isVisible && !el.disabled) {
                        // Verificar se não é overlay
                        const id = el.id || '';
                        const classes = el.className || '';
                        const isOverlay = id.includes('overlay') ||
                                         id.includes('backdrop') ||
                                         classes.includes('overlay') ||
                                         classes.includes('backdrop') ||
                                         (classes.includes('modal') && classes.includes('hidden'));
                        
                        if (!isOverlay) {
                            // FORÇAR pointer-events SEMPRE
                            el.style.setProperty('pointer-events', 'auto', 'important');
                            
                            // FORÇAR cursor pointer
                            if (el.tagName === 'BUTTON' || 
                                el.tagName === 'A' || 
                                el.onclick || 
                                el.getAttribute('data-tab') || 
                                el.getAttribute('data-step-card')) {
                                el.style.setProperty('cursor', 'pointer', 'important');
                            }
                        }
                    }
                } catch (e) {
                    // Ignorar erros individuais
                }
            });
            
            // 4. FORÇAR MAIN E WRAPPERS
            const main = document.querySelector('main');
            if (main) {
                main.style.setProperty('pointer-events', 'auto', 'important');
                main.style.setProperty('position', 'relative', 'important');
                main.style.setProperty('z-index', '1', 'important');
            }
            
            const mainWrapper = document.querySelector('.main-wrapper');
            if (mainWrapper) {
                mainWrapper.style.setProperty('pointer-events', 'auto', 'important');
            }
            
        } catch (e) {
            console.error('[FIX-INTERACTIONS] Erro:', e);
        } finally {
            isRunning = false;
        }
    }
    
    // ============================================
    // LISTENER DE CLIQUE: RE-DISPARCAR SE BLOQUEADO
    // ============================================
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        // Verificar se o clique foi bloqueado
        const computed = window.getComputedStyle(target);
        
        if (computed.pointerEvents === 'none') {
            // Elemento tem pointer-events: none - corrigir e re-disparar
            const isInteractive = target.tagName === 'BUTTON' ||
                                 target.tagName === 'A' ||
                                 target.onclick ||
                                 target.getAttribute('data-tab') ||
                                 target.getAttribute('data-step-card') ||
                                 target.closest('button') ||
                                 target.closest('a') ||
                                 target.closest('[data-tab]') ||
                                 target.closest('[data-step-card]');
            
            if (isInteractive) {
                // Corrigir pointer-events
                target.style.setProperty('pointer-events', 'auto', 'important');
                
                // Re-disparar clique após um pequeno delay
                setTimeout(() => {
                    if (target && !target.disabled) {
                        target.click();
                    }
                }, 10);
            }
        }
        
        // Verificar se há overlay bloqueando
        const x = e.clientX;
        const y = e.clientY;
        if (x !== undefined && y !== undefined) {
            const elementAtPoint = document.elementFromPoint(x, y);
            if (elementAtPoint) {
                const id = elementAtPoint.id || '';
                const classes = elementAtPoint.className || '';
                const isBlocking = (id.includes('overlay') || id.includes('backdrop') || 
                                  classes.includes('overlay') || classes.includes('backdrop')) &&
                                  (classes.includes('hidden') || window.getComputedStyle(elementAtPoint).display === 'none');
                
                if (isBlocking) {
                    // Remover overlay bloqueante
                    elementAtPoint.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -99999 !important; position: fixed !important; top: -99999px !important; left: -99999px !important; width: 0 !important; height: 0 !important;';
                    
                    // Re-disparar clique no elemento abaixo
                    setTimeout(() => {
                        const realTarget = document.elementFromPoint(x, y);
                        if (realTarget && realTarget !== elementAtPoint) {
                            realTarget.click();
                        }
                    }, 10);
                }
            }
        }
    }, true); // CAPTURE PHASE
    
    // ============================================
    // LISTENER DE SCROLL: GARANTIR QUE NUNCA SEJA BLOQUEADO
    // ============================================
    document.addEventListener('wheel', function() {
        if (document.body) {
            document.body.style.setProperty('overflow', 'auto', 'important');
            document.body.style.setProperty('overflow-y', 'auto', 'important');
        }
        if (document.documentElement) {
            document.documentElement.style.setProperty('overflow', 'auto', 'important');
            document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
        }
    }, true);
    
    // ============================================
    // MUTATION OBSERVER: CORRIGIR ELEMENTOS NOVOS
    // ============================================
    const observer = new MutationObserver(function(mutations) {
        let shouldFix = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                shouldFix = true;
            }
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldFix = true;
            }
        });
        
        if (shouldFix) {
            setTimeout(forceAllInteractive, 50);
        }
    });
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    function init() {
        // FORÇAR showMainContent() para garantir que main está visível
        if (typeof showMainContent === 'function') {
            showMainContent();
        }
        
        // Executar imediatamente
        forceAllInteractive();
        
        // Executar múltiplas vezes para garantir
        setTimeout(() => {
            if (typeof showMainContent === 'function') showMainContent();
            forceAllInteractive();
        }, 100);
        setTimeout(() => {
            if (typeof showMainContent === 'function') showMainContent();
            forceAllInteractive();
        }, 500);
        setTimeout(() => {
            if (typeof showMainContent === 'function') showMainContent();
            forceAllInteractive();
        }, 1000);
        setTimeout(() => {
            if (typeof showMainContent === 'function') showMainContent();
            forceAllInteractive();
        }, 2000);
        
        // Observar mudanças no DOM
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
        
        // Executar continuamente usando requestAnimationFrame
        function continuousFix() {
            // Garantir que main está sempre visível e interativo
            const main = document.querySelector('main');
            if (main) {
                const computed = window.getComputedStyle(main);
                if (computed.display === 'none' || computed.pointerEvents === 'none') {
                    if (typeof showMainContent === 'function') {
                        showMainContent();
                    } else {
                        main.style.setProperty('display', 'block', 'important');
                        main.style.setProperty('pointer-events', 'auto', 'important');
                    }
                }
            }
            forceAllInteractive();
            requestAnimationFrame(continuousFix);
        }
        requestAnimationFrame(continuousFix);
        
        console.log('[FIX-INTERACTIONS] ✅ Correção DEFINITIVA ativada');
    }
    
    // Iniciar quando possível
    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
    
    // Executar após window.load também
    window.addEventListener('load', () => {
        setTimeout(forceAllInteractive, 100);
    });
    
})();
