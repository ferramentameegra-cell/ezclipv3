/**
 * SCRIPT ULTRA AGRESSIVO PARA FORÇAR CLIQUES FUNCIONAREM
 * Remove TODOS os bloqueios e força execução de cliques
 * EXECUTA PRIMEIRO para não ser bloqueado por outros scripts
 */

(function() {
    'use strict';
    
    console.log('[FIX-INTERACTIONS] 🚀 Iniciando correção ULTRA AGRESSIVA...');
    
    // Executar IMEDIATAMENTE, antes de qualquer outro script
    function forceEnableAllClicks() {
        try {
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
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        el.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -99999 !important; position: fixed !important; top: -99999px !important; left: -99999px !important; width: 0 !important; height: 0 !important; opacity: 0 !important; visibility: hidden !important;';
                    });
                } catch (e) {
                    // Ignorar erros
                }
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
                try {
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
                                             (el.id.includes('modal') && el.classList.contains('hidden')) ||
                                             el.classList.contains('modal-backdrop') ||
                                             (el.classList.contains('modal') && el.classList.contains('hidden'));
                            
                            if (!isOverlay) {
                                // FORÇAR pointer-events
                                el.style.setProperty('pointer-events', 'auto', 'important');
                                
                                // FORÇAR cursor
                                if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('data-tab')) {
                                    el.style.setProperty('cursor', 'pointer', 'important');
                                }
                                
                                // Garantir que não está com z-index negativo
                                const zIndex = parseInt(computed.zIndex) || 0;
                                if (zIndex < 0) {
                                    el.style.setProperty('z-index', 'auto', 'important');
                                }
                                
                                fixedCount++;
                            }
                        }
                    });
                } catch (e) {
                    // Ignorar erros
                }
            });
            
            // 5. REMOVER elementos com z-index alto que estão invisíveis
            try {
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
            } catch (e) {
                // Ignorar erros
            }
            
            if (fixedCount > 0) {
                console.log(`[FIX-INTERACTIONS] ✅ ${fixedCount} elemento(s) corrigido(s)`);
            }
        } catch (e) {
            console.error('[FIX-INTERACTIONS] Erro na correção:', e);
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
    
    // Executar IMEDIATAMENTE, mesmo antes do DOM estar pronto
    if (document.body) {
        init();
    } else {
        // Aguardar body estar disponível
        const observer = new MutationObserver(function(mutations) {
            if (document.body) {
                observer.disconnect();
                init();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    
    // Função auxiliar para executar clique
    function executeClick(target, originalEvent) {
        try {
            console.log('[FIX-INTERACTIONS] 🎯 Executando clique em:', target.tagName, target.id || target.className || target.textContent?.substring(0, 30));
            
            // 1. Tentar onclick inline primeiro
            const onclickAttr = target.getAttribute('onclick');
            if (onclickAttr) {
                console.log('[FIX-INTERACTIONS] 📝 Executando onclick inline:', onclickAttr);
                const func = new Function('event', onclickAttr);
                func(originalEvent || new MouseEvent('click', { bubbles: true, cancelable: true }));
                return true;
            }
            
            // 2. Se tem data-tab, chamar switchTab
            const dataTab = target.getAttribute('data-tab');
            if (dataTab) {
                console.log('[FIX-INTERACTIONS] 📑 Chamando switchTab:', dataTab);
                if (typeof window.switchTab === 'function') {
                    window.switchTab(dataTab);
                    return true;
                } else if (typeof switchTab === 'function') {
                    switchTab(dataTab);
                    return true;
                } else {
                    console.error('[FIX-INTERACTIONS] ❌ switchTab não encontrado!');
                }
            }
            
            // 3. Tentar click() nativo
            if (target.tagName === 'BUTTON' || target.tagName === 'A') {
                console.log('[FIX-INTERACTIONS] 🖱️ Disparando click() nativo');
                target.click();
                return true;
            }
            
            // 4. Disparar evento manualmente
            console.log('[FIX-INTERACTIONS] ⚡ Disparando evento manual');
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                detail: 1
            });
            target.dispatchEvent(clickEvent);
            return true;
        } catch (err) {
            console.error('[FIX-INTERACTIONS] ❌ Erro ao executar clique:', err);
            return false;
        }
    }
    
    // Listener ULTRA AGRESSIVO - captura TODOS os cliques e FORÇA execução
    // Usar capture phase com PRIORIDADE MÁXIMA
    document.addEventListener('click', function(e) {
        const target = e.target;
        const computed = window.getComputedStyle(target);
        
        console.log('[FIX-INTERACTIONS] 🖱️ Clique detectado em:', target.tagName, target.id || target.className || target.textContent?.substring(0, 30));
        
        // Verificar elemento no ponto do clique
        try {
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
                    setTimeout(() => executeClick(target, e), 5);
                    e.stopImmediatePropagation(); // Impedir outros listeners
                    e.preventDefault(); // Impedir comportamento padrão que pode bloquear
                    return false;
                }
            }
        } catch (err) {
            console.warn('[FIX-INTERACTIONS] Erro ao verificar sobreposição:', err);
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
                console.warn('[FIX-INTERACTIONS] 🚨 Clique bloqueado (pointer-events: none), corrigindo:', target);
                target.style.setProperty('pointer-events', 'auto', 'important');
                
                const parent = target.closest('button, a');
                if (parent) {
                    parent.style.setProperty('pointer-events', 'auto', 'important');
                }
                
                // Re-disparar clique
                setTimeout(() => {
                    if (executeClick(target, e)) {
                        e.stopImmediatePropagation();
                        e.preventDefault();
                    }
                }, 5);
                return false;
            }
        }
        
        // SEMPRE tentar executar onclick inline se existir, mesmo que pointer-events esteja ok
        // Isso garante que o clique será executado mesmo se outros listeners bloquearem
        const onclickAttr = target.getAttribute('onclick');
        const dataTab = target.getAttribute('data-tab');
        
        if (onclickAttr || dataTab) {
            // Marcar para evitar execução duplicada
            if (!target.dataset.clickExecuted) {
                target.dataset.clickExecuted = 'true';
                setTimeout(() => {
                    executeClick(target, e);
                    setTimeout(() => delete target.dataset.clickExecuted, 100);
                }, 0);
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
            executeClick(target, e);
        }
    }, false); // Bubble phase como backup
    
    // BLOQUEAR scroll automático
    const originalScrollTo = window.scrollTo;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    
    // Sobrescrever window.scrollTo para bloquear scroll automático
    window.scrollTo = function(...args) {
        // Permitir apenas scroll manual (sem behavior: 'smooth' ou quando chamado pelo usuário)
        const hasSmooth = args.some(arg => arg && typeof arg === 'object' && arg.behavior === 'smooth');
        if (hasSmooth) {
            console.log('[FIX-INTERACTIONS] 🚫 Scroll automático bloqueado:', args);
            return; // Bloquear scroll automático
        }
        // Permitir scroll instantâneo se necessário
        return originalScrollTo.apply(this, args);
    };
    
    // Sobrescrever scrollIntoView para bloquear scroll automático
    Element.prototype.scrollIntoView = function(...args) {
        const hasSmooth = args.some(arg => arg && typeof arg === 'object' && arg.behavior === 'smooth');
        if (hasSmooth) {
            console.log('[FIX-INTERACTIONS] 🚫 scrollIntoView automático bloqueado:', this);
            return; // Bloquear scroll automático
        }
        // Permitir scroll instantâneo se necessário
        return originalScrollIntoView.apply(this, args);
    };
    
    console.log('[FIX-INTERACTIONS] ✅ Correção ULTRA AGRESSIVA ativada');
    console.log('[FIX-INTERACTIONS] 🚫 Scroll automático bloqueado');
})();
