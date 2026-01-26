# AUDITORIA DE INICIALIZAÇÃO - APP.JS

## FUNÇÕES DE INICIALIZAÇÃO IDENTIFICADAS

### ✅ FUNÇÕES SENDO CHAMADAS (linha 252-255)
1. `setupYouTubeInput()` - linha 1664
   - Adiciona listeners para input de YouTube
   - Verifica termos de uso
   - Habilita/desabilita botão processar

2. `setupUploadDragDrop()` - linha 1966
   - Configura drag and drop para upload
   - Adiciona listeners para eventos de drag

3. `setupTrimControls()` - linha 2611
   - Função vazia (apenas placeholder)
   - Timeline é inicializada em `setupTrimControlsForVideo()`

4. `loadNiches()` - linha 3201
   - Carrega nichos da API
   - Cria cards dinamicamente com addEventListener

### ⚠️ FUNÇÕES QUE PODEM NÃO ESTAR SENDO CHAMADAS

1. `initializeCaptionsEditor()` - linha 2536
   - Chamada quando necessário (não na inicialização)
   - ✅ Correto - só inicializa quando vídeo está pronto

2. `setupTrimControlsForVideo()` - linha 2620
   - Chamada quando vídeo é carregado
   - ✅ Correto - só inicializa quando vídeo está disponível

### 🔍 BOTÕES COM ONCLICK NO HTML (DEVEM FUNCIONAR AUTOMATICAMENTE)

Todos os botões com `onclick` no HTML devem funcionar se as funções estão no escopo global:

- ✅ `switchTab()` - linha 281
- ✅ `scrollToTool()` - linha 429
- ✅ `switchInputTab()` - linha 1792
- ✅ `handleYouTubeSubmit()` - linha 2010
- ✅ `handleUploadSubmit()` - linha 1849
- ✅ `continueToConfigurations()` - linha 3493
- ✅ `confirmConfigurations()` - linha 3536
- ✅ `selectDuration()` - linha 2914
- ✅ `saveTrimInterval()` - linha 2438
- ✅ `continueToHeadline()` - linha 3592
- ✅ `continueToGenerate()` - linha 3661
- ✅ `goBackToHeadline()` - linha 3681
- ✅ `proceedToGenerate()` - linha 3692
- ✅ `editStep()` - linha 3146
- ✅ `handleLogin()` - linha 1035
- ✅ `handleRegister()` - linha 1150
- ✅ `switchAuthView()` - linha 1400
- ✅ `downloadSeries()` - linha 4267
- ✅ `openTikTokStudio()` - linha 4305
- ✅ `closeTermsModal()` - linha 1598
- ✅ `closeLoginRequiredModal()` - linha 1453
- ✅ `openLoginFromModal()` - linha 1465
- ✅ `showCreditsPurchaseModal()` - linha 718
- ✅ `logout()` - linha 1484
- ✅ `purchasePlan()` - linha 802
- ✅ `closeCreditsModal()` - linha 792

### 🔍 ELEMENTOS CRIADOS DINAMICAMENTE (PRECISAM DE REBIND)

1. **Cards de Nicho** (linha 3207-3212)
   - ✅ Usa `addEventListener` após criar elemento
   - ✅ Binding correto

2. **Cards de Retenção** (linha 3250-3258)
   - ✅ Usa `addEventListener` após criar elemento
   - ✅ Binding correto

3. **Modal de Créditos** (linha 730-767)
   - ⚠️ Usa `onclick` dentro de innerHTML
   - ✅ Funciona porque função está no escopo global
   - ⚠️ Modal é removido e recriado - pode precisar rebind

4. **Botões de Duração** (linha 2924)
   - ⚠️ Usa `querySelectorAll('.duration-option')` mas não adiciona listeners
   - ⚠️ Botões têm `onclick` no HTML - deve funcionar

### ⚠️ PROBLEMAS POTENCIAIS IDENTIFICADOS

1. **Botões de Duração** (60s/120s)
   - HTML tem `onclick="selectDuration(60)"` - deve funcionar
   - Mas há código em linha 2924 que tenta fazer querySelector
   - Verificar se não está sobrescrevendo

2. **Modal de Créditos**
   - Criado dinamicamente com innerHTML
   - Botão de fechar tem onclick inline - deve funcionar
   - Cards de planos têm onclick inline - deve funcionar

3. **Botão Gerar**
   - Linha 3074 faz querySelector mas não adiciona listener
   - HTML tem `onclick="proceedToGenerate()"` - deve funcionar

## CONCLUSÃO

A maioria dos bindings está correta:
- ✅ Botões com onclick no HTML devem funcionar (funções no escopo global)
- ✅ Elementos dinâmicos usam addEventListener corretamente
- ✅ Funções de inicialização estão sendo chamadas

**PROBLEMA PROVÁVEL**: Se os botões não estão funcionando, pode ser:
1. Funções não estão no escopo global (mas estão)
2. Erros JavaScript impedindo execução
3. Elementos sendo recriados sem rebind
4. Algum código removendo listeners
