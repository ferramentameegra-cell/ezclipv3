/**
 * SCRIPT SIMPLIFICADO PARA GARANTIR INTERAÇÕES FUNCIONEM
 * Remove bloqueios desnecessários sem interferir excessivamente
 */

(function() {
    console.log('[FIX-INTERACTIONS] 🔧 Iniciando correção de interações...');
    
    function ensureInteractionsWork() {
        // 1. Garantir que body e html não bloqueiem scroll
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        
        // 2. Remover bloqueios de auth-section quando escondida
        const authSection = document.getElementById('auth-section');
        if (authSection && (authSection.classList.contains('hidden') || window.getComputedStyle(authSection).display === 'none')) {
            authSection.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -1 !important;';
        }
        
        // 3. Remover bloqueios de loading-overlay quando escondido
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay && (loadingOverlay.classList.contains('hidden') || window.getComputedStyle(loadingOverlay).display === 'none')) {
            loadingOverlay.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -1 !important;';
        }
        
        // 4. Garantir que main está acessível
        const main = document.querySelector('main');
        if (main) {
            const computed = window.getComputedStyle(main);
            if (computed.display === 'none') {
                main.style.display = 'block';
            }
            if (computed.pointerEvents === 'none' && !main.classList.contains('disabled')) {
                main.style.pointerEvents = 'auto';
            }
        }
        
        // 5. Remover pointer-events: none de elementos interativos que não deveriam ter
               document.querySelectorAll('button:not([disabled]), a:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [onclick], [data-tab]').forEach(el => {
            const computed = window.getComputedStyle(el);
            const isVisible = computed.display !== 'none' && 
                            computed.visibility !== 'hidden' &&
                            computed.opacity !== '0' &&
                            el.offsetParent !== null;
            
            if (isVisible && computed.pointerEvents === 'none') {
                // Verificar se não é um overlay que deveria ter pointer-events: none
                if (!el.classList.contains('overlay') && 
                    !el.classList.contains('modal-backdrop') &&
                    !el.id.includes('overlay')) {
                    el.style.pointerEvents = 'auto';
                }
            }
        });
    }
    
    // Executar uma vez após DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureInteractionsWork);
    } else {
        ensureInteractionsWork();
    }
    
    // Executar novamente após um pequeno delay para garantir
    setTimeout(ensureInteractionsWork, 100);
    setTimeout(ensureInteractionsWork, 500);
    
    console.log('[FIX-INTERACTIONS] ✅ Correção de interações ativada');
})();
