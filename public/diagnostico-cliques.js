/**
 * SCRIPT DE DIAGNÓSTICO DE CLIQUES
 * Execute no console do navegador para identificar problemas
 */

(function() {
    console.log('🔍 DIAGNÓSTICO DE CLIQUES INICIADO...\n');
    
    // 1. Verificar overlays invisíveis
    console.log('1️⃣ VERIFICANDO OVERLAYS INVISÍVEIS:');
    const overlays = document.querySelectorAll('#loading-overlay, .modal, #auth-section');
    overlays.forEach(overlay => {
        const style = window.getComputedStyle(overlay);
        const rect = overlay.getBoundingClientRect();
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0' &&
                         rect.width > 0 && 
                         rect.height > 0;
        
        if (isVisible && (style.position === 'fixed' || style.position === 'absolute')) {
            console.warn(`⚠️ Overlay visível pode estar bloqueando:`, overlay.id || overlay.className);
            console.log(`   - z-index: ${style.zIndex}`);
            console.log(`   - pointer-events: ${style.pointerEvents}`);
            console.log(`   - position: ${style.position}`);
        }
    });
    
    // 2. Verificar elementos com pointer-events: none
    console.log('\n2️⃣ VERIFICANDO ELEMENTOS COM pointer-events: none:');
    const allElements = document.querySelectorAll('*');
    let blockedCount = 0;
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.pointerEvents === 'none') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 100 && rect.height > 100) {
                blockedCount++;
                if (blockedCount <= 5) {
                    console.warn(`⚠️ Elemento grande bloqueado:`, el.tagName, el.id || el.className);
                }
            }
        }
    });
    if (blockedCount > 5) {
        console.warn(`⚠️ Total de ${blockedCount} elementos com pointer-events: none`);
    }
    
    // 3. Verificar z-index altos
    console.log('\n3️⃣ VERIFICANDO ELEMENTOS COM z-index ALTO:');
    const highZIndex = [];
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex);
        if (zIndex > 1000 && (style.position === 'fixed' || style.position === 'absolute')) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) {
                highZIndex.push({
                    element: el,
                    zIndex: zIndex,
                    id: el.id,
                    className: el.className
                });
            }
        }
    });
    highZIndex.sort((a, b) => b.zIndex - a.zIndex);
    highZIndex.slice(0, 5).forEach(item => {
        console.warn(`⚠️ z-index muito alto:`, item.zIndex, item.id || item.className);
    });
    
    // 4. Verificar se botões têm onclick
    console.log('\n4️⃣ VERIFICANDO BINDING DE BOTÕES:');
    const buttons = document.querySelectorAll('button, a.btn, .btn-primary, .btn-secondary');
    let unboundCount = 0;
    buttons.forEach(btn => {
        const hasOnclick = btn.onclick !== null;
        const hasOnclickAttr = btn.hasAttribute('onclick');
        const hasEventListener = btn.getAttribute('data-has-listener') === 'true';
        
        if (!hasOnclick && !hasOnclickAttr && !hasEventListener) {
            unboundCount++;
            if (unboundCount <= 5) {
                console.warn(`⚠️ Botão sem binding:`, btn.textContent.substring(0, 30), btn.id || btn.className);
            }
        }
    });
    if (unboundCount > 5) {
        console.warn(`⚠️ Total de ${unboundCount} botões sem binding`);
    }
    
    // 5. Verificar erros JavaScript
    console.log('\n5️⃣ VERIFICANDO ERROS JAVASCRIPT:');
    const originalError = console.error;
    let errorCount = 0;
    console.error = function(...args) {
        errorCount++;
        originalError.apply(console, args);
    };
    
    // 6. Testar clique em elemento específico
    console.log('\n6️⃣ TESTE DE CLIQUE:');
    const testButton = document.querySelector('button[onclick="scrollToTool()"]');
    if (testButton) {
        console.log('✅ Botão "Começar Agora" encontrado');
        console.log('   - onclick:', testButton.onclick ? '✅ Definido' : '❌ Não definido');
        console.log('   - onclick attr:', testButton.getAttribute('onclick'));
        
        // Tentar clicar programaticamente
        try {
            testButton.click();
            console.log('   - click() executado com sucesso');
        } catch (e) {
            console.error('   - Erro ao executar click():', e);
        }
    } else {
        console.warn('❌ Botão "Começar Agora" não encontrado');
    }
    
    // 7. Verificar body e html
    console.log('\n7️⃣ VERIFICANDO BODY E HTML:');
    const bodyStyle = window.getComputedStyle(document.body);
    const htmlStyle = window.getComputedStyle(document.documentElement);
    console.log('body:');
    console.log('   - pointer-events:', bodyStyle.pointerEvents);
    console.log('   - overflow:', bodyStyle.overflow);
    console.log('   - position:', bodyStyle.position);
    console.log('html:');
    console.log('   - pointer-events:', htmlStyle.pointerEvents);
    console.log('   - overflow:', htmlStyle.overflow);
    
    // 8. Sugestões
    console.log('\n📋 SUGESTÕES:');
    console.log('1. Execute: document.body.style.pointerEvents = "auto"');
    console.log('2. Execute: document.documentElement.style.pointerEvents = "auto"');
    console.log('3. Execute: bindUI() (se a função existir)');
    console.log('4. Verifique o console para erros JavaScript');
    console.log('5. Verifique se há overlays visíveis bloqueando');
    
    console.log('\n✅ DIAGNÓSTICO CONCLUÍDO');
})();
