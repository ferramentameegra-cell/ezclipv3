/**
 * SCRIPT PARA GARANTIR INTERAÇÕES FUNCIONEM
 * Remove bloqueios desnecessários e garante cliques funcionem
 * Versão melhorada com detecção de sobreposições
 */

(function() {
    console.log('[FIX-INTERACTIONS] 🔧 Iniciando correção de interações...');
    
    function ensureInteractionsWork() {
        // 1. Garantir que body e html não bloqueiem scroll ou cliques
        if (document.body) {
            document.body.style.overflow = '';
            document.body.style.pointerEvents = 'auto';
        }
        if (document.documentElement) {
            document.documentElement.style.overflow = '';
            document.documentElement.style.pointerEvents = 'auto';
        }
        
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
                loadingOverlay.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important; position: fixed !important; top: -9999px !important; left: -9999px !important; width: 0 !important; height: 0 !important;';
            }
        }
        
        // 4. Remover bloqueios de TODOS os modais quando escondidos
        document.querySelectorAll('.modal.hidden, #success-modal.hidden, #terms-modal.hidden, #login-required-modal.hidden').forEach(modal => {
            modal.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important; position: fixed !important; top: -9999px !important; left: -9999px !important; width: 0 !important; height: 0 !important;';
        });
        
        // 5. Garantir que main está acessível e clicável
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
        
        // 6. Remover pointer-events: none de TODOS os elementos interativos visíveis
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
                                 (el.classList.contains('modal') && !el.classList.contains('hidden'));
                
                if (!isOverlay && computed.pointerEvents === 'none') {
                    el.style.pointerEvents = 'auto';
                }
                
                // Garantir cursor pointer em elementos clicáveis
                if ((el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button') && computed.cursor === 'default') {
                    el.style.cursor = 'pointer';
                }
            }
        });
        
        // 7. Verificar se há elementos com z-index alto bloqueando (mas que não deveriam estar visíveis)
        document.querySelectorAll('*').forEach(el => {
            const computed = window.getComputedStyle(el);
            const zIndex = parseInt(computed.zIndex) || 0;
            const display = computed.display;
            const visibility = computed.visibility;
            const opacity = parseFloat(computed.opacity) || 1;
            const pointerEvents = computed.pointerEvents;
            
            // Se elemento tem z-index alto mas está invisível e com pointer-events: auto, corrigir
            if (zIndex > 1000 && 
                (display === 'none' || visibility === 'hidden' || opacity === 0 || el.classList.contains('hidden')) &&
                pointerEvents === 'auto' &&
                (el.id.includes('overlay') || el.id.includes('loading') || el.id.includes('modal') || el.id.includes('auth-section'))) {
                el.style.pointerEvents = 'none';
                el.style.zIndex = '-9999';
                el.style.cssText += 'position: fixed !important; top: -9999px !important; left: -9999px !important; width: 0 !important; height: 0 !important;';
            }
        });
    }
    
    // Executar após DOM estar completamente carregado
    function init() {
        ensureInteractionsWork();
        
        // Executar em intervalos para garantir (menos frequente para não interferir)
        setTimeout(ensureInteractionsWork, 100);
        setTimeout(ensureInteractionsWork, 500);
        setTimeout(ensureInteractionsWork, 1000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM já carregado, executar após um pequeno delay para garantir que tudo está pronto
        setTimeout(init, 50);
    }
    
    // Listener global para detectar e corrigir cliques bloqueados em tempo real
    document.addEventListener('click', function(e) {
        const target = e.target;
        const computed = window.getComputedStyle(target);
        
        // Verificar se há elemento sobreposto bloqueando
        const rect = target.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        
        // Se o elemento no ponto do clique não é o target ou um filho dele
        if (elementAtPoint && 
            elementAtPoint !== target && 
            !target.contains(elementAtPoint) &&
            (target.tagName === 'BUTTON' || target.tagName === 'A' || target.onclick || target.getAttribute('data-tab'))) {
            
            const overlayComputed = window.getComputedStyle(elementAtPoint);
            // Se o elemento sobreposto é um overlay invisível, remover bloqueio
            if (overlayComputed.display === 'none' || 
                overlayComputed.visibility === 'hidden' ||
                parseFloat(overlayComputed.opacity) === 0 ||
                elementAtPoint.classList.contains('hidden') ||
                elementAtPoint.id.includes('overlay') ||
                elementAtPoint.id.includes('loading') ||
                (elementAtPoint.classList.contains('modal') && elementAtPoint.classList.contains('hidden'))) {
                
                console.warn('[FIX-INTERACTIONS] ⚠️ Overlay invisível bloqueando clique, removendo...', elementAtPoint);
                elementAtPoint.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important; position: fixed !important; top: -9999px !important; left: -9999px !important; width: 0 !important; height: 0 !important;';
                
                // Tentar clicar novamente após remover bloqueio
                setTimeout(() => {
                    if (target.onclick) {
                        try {
                            target.onclick();
                        } catch (err) {
                            console.error('[FIX-INTERACTIONS] Erro ao executar onclick:', err);
                        }
                    } else if (target.getAttribute('data-tab')) {
                        const tabName = target.getAttribute('data-tab');
                        if (typeof switchTab === 'function') {
                            switchTab(tabName);
                        }
                    } else if (target.tagName === 'BUTTON' || target.tagName === 'A') {
                        try {
                            target.click();
                        } catch (err) {
                            console.error('[FIX-INTERACTIONS] Erro ao clicar:', err);
                        }
                    }
                }, 10);
                return;
            }
        }
        
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
                    try {
                        target.onclick();
                    } catch (err) {
                        console.error('[FIX-INTERACTIONS] Erro ao executar onclick:', err);
                    }
                } else if (target.getAttribute('data-tab')) {
                    const tabName = target.getAttribute('data-tab');
                    if (typeof switchTab === 'function') {
                        switchTab(tabName);
                    }
                } else if (target.tagName === 'BUTTON' || target.tagName === 'A') {
                    try {
                        target.click();
                    } catch (err) {
                        console.error('[FIX-INTERACTIONS] Erro ao clicar:', err);
                    }
                }
            }, 10);
        }
    }, true); // Use capture phase para pegar antes de qualquer bloqueio
    
    console.log('[FIX-INTERACTIONS] ✅ Correção de interações ativada com listener de cliques');
})();
