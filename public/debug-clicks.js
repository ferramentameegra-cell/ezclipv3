/**
 * SCRIPT DE DIAGNÓSTICO DE CLIQUES
 * Execute no console do navegador para identificar problemas
 * 
 * Uso: Copie e cole no console do navegador (F12)
 */

(function() {
    console.log('🔍 DIAGNÓSTICO DE CLIQUES - Iniciando...\n');
    
    // 1. Verificar overlays bloqueando
    console.log('1️⃣ Verificando overlays...');
    const overlays = document.querySelectorAll('#loading-overlay, .modal, #auth-section');
    overlays.forEach(el => {
        const computed = window.getComputedStyle(el);
        const isHidden = el.classList.contains('hidden') || computed.display === 'none';
        const zIndex = computed.zIndex;
        const pointerEvents = computed.pointerEvents;
        
        if (!isHidden && parseInt(zIndex) > 100 && pointerEvents === 'auto') {
            console.warn(`⚠️ Overlay visível bloqueando:`, {
                id: el.id,
                zIndex: zIndex,
                pointerEvents: pointerEvents,
                display: computed.display
            });
        } else if (isHidden && parseInt(zIndex) > 0) {
            console.warn(`⚠️ Overlay hidden mas com z-index alto:`, {
                id: el.id,
                zIndex: zIndex,
                display: computed.display
            });
        }
    });
    
    // 2. Verificar elementos interativos bloqueados
    console.log('\n2️⃣ Verificando elementos interativos...');
    const interactive = document.querySelectorAll('button:not([disabled]), a:not([disabled]), [onclick], [data-tab]');
    let blockedCount = 0;
    interactive.forEach(el => {
        const computed = window.getComputedStyle(el);
        const isVisible = computed.display !== 'none' && 
                         computed.visibility !== 'hidden' &&
                         parseFloat(computed.opacity) > 0 &&
                         el.offsetParent !== null;
        
        if (isVisible && computed.pointerEvents === 'none') {
            blockedCount++;
            console.warn(`⚠️ Elemento interativo bloqueado:`, {
                tag: el.tagName,
                id: el.id,
                className: el.className,
                pointerEvents: computed.pointerEvents,
                zIndex: computed.zIndex
            });
        }
    });
    
    if (blockedCount === 0) {
        console.log('✅ Nenhum elemento interativo bloqueado encontrado');
    } else {
        console.warn(`⚠️ Total de elementos bloqueados: ${blockedCount}`);
    }
    
    // 3. Verificar elementos sobrepostos
    console.log('\n3️⃣ Verificando sobreposições...');
    const highZIndex = Array.from(document.querySelectorAll('*')).filter(el => {
        const computed = window.getComputedStyle(el);
        const zIndex = parseInt(computed.zIndex) || 0;
        return zIndex > 1000;
    });
    
    highZIndex.forEach(el => {
        const computed = window.getComputedStyle(el);
        const isVisible = computed.display !== 'none' && 
                         computed.visibility !== 'hidden' &&
                         parseFloat(computed.opacity) > 0;
        
        if (isVisible && computed.pointerEvents === 'auto') {
            console.log(`📍 Elemento com z-index alto:`, {
                id: el.id,
                className: el.className,
                zIndex: computed.zIndex,
                pointerEvents: computed.pointerEvents
            });
        }
    });
    
    // 4. Verificar body e main
    console.log('\n4️⃣ Verificando body e main...');
    const bodyComputed = window.getComputedStyle(document.body);
    const main = document.querySelector('main');
    const mainComputed = main ? window.getComputedStyle(main) : null;
    
    console.log('Body:', {
        pointerEvents: bodyComputed.pointerEvents,
        overflow: bodyComputed.overflow,
        display: bodyComputed.display
    });
    
    if (mainComputed) {
        console.log('Main:', {
            pointerEvents: mainComputed.pointerEvents,
            zIndex: mainComputed.zIndex,
            display: mainComputed.display,
            visibility: mainComputed.visibility
        });
    }
    
    // 5. Teste de clique
    console.log('\n5️⃣ Testando clique em botão...');
    const testButton = document.querySelector('button:not([disabled])');
    if (testButton) {
        const rect = testButton.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Verificar se há elemento sobreposto no centro do botão
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        if (elementAtPoint !== testButton && !testButton.contains(elementAtPoint)) {
            console.warn(`⚠️ Elemento sobreposto no botão:`, {
                button: testButton.tagName + (testButton.id ? '#' + testButton.id : ''),
                overlaidBy: elementAtPoint.tagName + (elementAtPoint.id ? '#' + elementAtPoint.id : ''),
                overlaidByClass: elementAtPoint.className
            });
        } else {
            console.log('✅ Nenhum elemento sobreposto no botão de teste');
        }
    }
    
    console.log('\n✅ Diagnóstico concluído!');
    console.log('💡 Dica: Se encontrar problemas, execute: window.fixAllClicks()');
    
    // Função global para corrigir tudo
    window.fixAllClicks = function() {
        console.log('🔧 Corrigindo todos os problemas...');
        
        // Corrigir overlays hidden
        document.querySelectorAll('#loading-overlay.hidden, .modal.hidden, #auth-section.hidden').forEach(el => {
            el.style.cssText = 'display: none !important; pointer-events: none !important; z-index: -9999 !important; position: fixed !important; top: -9999px !important; left: -9999px !important; width: 0 !important; height: 0 !important;';
        });
        
        // Corrigir elementos interativos
        document.querySelectorAll('button:not([disabled]), a:not([disabled]), [onclick], [data-tab]').forEach(el => {
            const computed = window.getComputedStyle(el);
            if (computed.display !== 'none' && computed.visibility !== 'hidden' && parseFloat(computed.opacity) > 0) {
                el.style.pointerEvents = 'auto';
                if (el.tagName === 'BUTTON' || el.tagName === 'A') {
                    el.style.cursor = 'pointer';
                }
            }
        });
        
        // Garantir body e main
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = '';
        const main = document.querySelector('main');
        if (main) {
            main.style.pointerEvents = 'auto';
            main.style.zIndex = '1';
        }
        
        console.log('✅ Correções aplicadas!');
    };
})();
