# VERIFICAÇÃO DE BINDING DOS BOTÕES

## BOTÕES PRINCIPAIS DA UI

### 1. NAVEGAÇÃO
- **Botão "Início"** (linha 34 index.html)
  - `onclick="switchTab('home')"`
  - ✅ Função existe: `switchTab()` linha 275 app.js
  
- **Botão "Entrar"** (linha 35 index.html)
  - `onclick="switchTab('login')"`
  - ✅ Função existe: `switchTab()` linha 275 app.js

### 2. HERO SECTION
- **Botão "Começar Agora"** (linha 74 index.html)
  - `onclick="scrollToTool()"`
  - ✅ Função existe: `scrollToTool()` linha 422 app.js

### 3. YOUTUBE/UPLOAD
- **Tab "YouTube"** (linha 298 index.html)
  - `onclick="switchInputTab('youtube')"`
  - ✅ Função existe: `switchInputTab()` linha 1785 app.js

- **Tab "Upload"** (linha 304 index.html)
  - `onclick="switchInputTab('upload')"`
  - ✅ Função existe: `switchInputTab()` linha 1785 app.js

- **Botão "Processar" (YouTube)** (linha 359 index.html)
  - `onclick="handleYouTubeSubmit()"`
  - ⚠️ **FUNÇÃO NÃO ENCONTRADA** - Precisa verificar

- **Botão "Enviar Vídeo" (Upload)** (linha 505 index.html)
  - `onclick="handleUploadSubmit()"`
  - ⚠️ **FUNÇÃO NÃO ENCONTRADA** - Precisa verificar

- **Botão "Continuar para Configurações"** (linha 375, 528 index.html)
  - `onclick="continueToConfigurations()"`
  - ✅ Função existe: `continueToConfigurations()` linha 3486 app.js

### 4. CONFIGURAÇÕES
- **Botão "Confirmar Configurações"** (linha 470 index.html)
  - `onclick="confirmConfigurations()"`
  - ✅ Função existe: `confirmConfigurations()` linha 3532 app.js

### 5. TRIM/INTERVALO
- **Botão "60s" / "120s"** (linha 585-586 index.html)
  - `onclick="selectDuration(60)"` / `onclick="selectDuration(120)"`
  - ✅ Função existe: `selectDuration()` linha 2914 app.js

- **Botão "Salvar Intervalo"** (linha 594 index.html)
  - `onclick="saveTrimInterval()"`
  - ✅ Função existe: `saveTrimInterval()` linha 2438 app.js

### 6. NICHO
- **Cards de Nicho** (criados dinamicamente linha 3207 app.js)
  - `card.addEventListener('click', () => selectNiche(niche.id, card))`
  - ✅ Binding correto via addEventListener após innerHTML

### 7. RETENÇÃO
- **Cards de Retenção** (criados dinamicamente linha 3250 app.js)
  - `card.addEventListener('click', () => selectRetentionVideo(video.id, card))`
  - ✅ Binding correto via addEventListener após innerHTML

### 8. HEADLINE
- **Botão "Continuar para Gerar Clipes"** (linha 754 index.html)
  - `onclick="continueToGenerate()"`
  - ✅ Função existe: `continueToGenerate()` linha 3654 app.js

### 9. GERAÇÃO
- **Botão "Gerar Clipes Agora"** (linha 818 index.html)
  - `onclick="proceedToGenerate()"`
  - ✅ Função existe: `proceedToGenerate()` linha 3685 app.js

- **Botão "Voltar"** (linha 815 index.html)
  - `onclick="goBackToHeadline()"`
  - ✅ Função existe: `goBackToHeadline()` linha 3674 app.js

- **Botões "Editar"** (linha 777, 791, 798, 805 index.html)
  - `onclick="editStep('trim')"` / `onclick="editStep('captions')"` / etc
  - ✅ Função existe: `editStep()` linha 3146 app.js

### 10. AUTHENTICATION
- **Formulário Login** (linha 872 index.html)
  - `onsubmit="handleLogin(event)"`
  - ✅ Função existe: `handleLogin()` linha 1028 app.js

- **Formulário Register** (linha 922 index.html)
  - `onsubmit="handleRegister(event)"`
  - ✅ Função existe: `handleRegister()` linha 1143 app.js

- **Botão "Criar nova conta"** (linha 911 index.html)
  - `onclick="switchAuthView('register')"`
  - ✅ Função existe: `switchAuthView()` linha 1393 app.js

- **Botão "Já tenho uma conta"** (linha 974 index.html)
  - `onclick="switchAuthView('login')"`
  - ✅ Função existe: `switchAuthView()` linha 1393 app.js

### 11. MODAIS
- **Botão "Download ZIP"** (linha 1003 index.html)
  - `onclick="downloadSeries()"`
  - ⚠️ **FUNÇÃO NÃO ENCONTRADA** - Precisa verificar

- **Botão "Abrir TikTok Studio"** (linha 1004 index.html)
  - `onclick="openTikTokStudio()"`
  - ✅ Função existe: `openTikTokStudio()` linha 4305 app.js

- **Botão "Fechar" (Terms)** (linha 1087 index.html)
  - `onclick="closeTermsModal()"`
  - ✅ Função existe: `closeTermsModal()` linha 1591 app.js

- **Botão "Fechar" (Login Required)** (linha 1118, 1121 index.html)
  - `onclick="closeLoginRequiredModal()"` / `onclick="openLoginFromModal()"`
  - ✅ Funções existem: `closeLoginRequiredModal()` linha 1446, `openLoginFromModal()` linha 1458 app.js

### 12. CRÉDITOS
- **Botão "Comprar Créditos"** (linha 47 index.html)
  - `onclick="showCreditsPurchaseModal()"`
  - ⚠️ **FUNÇÃO NÃO ENCONTRADA** - Precisa verificar

- **Botão "Sair"** (linha 48 index.html)
  - `onclick="logout()"`
  - ⚠️ **FUNÇÃO NÃO ENCONTRADA** - Precisa verificar

- **Cards de Planos** (criados dinamicamente linha 746 app.js)
  - `onclick="purchasePlan('${plan.id}')"` dentro de innerHTML
  - ✅ Função existe: `purchasePlan()` linha 795 app.js
  - ⚠️ **PROBLEMA POTENCIAL**: innerHTML com onclick pode não funcionar se modal for recriado

## PROBLEMAS IDENTIFICADOS

### 1. FUNÇÕES ENCONTRADAS ✅
- `handleYouTubeSubmit()` - ✅ Existe linha 2003 app.js
- `handleUploadSubmit()` - ✅ Existe linha 1842 app.js
- `downloadSeries()` - ✅ Existe linha 4267 app.js
- `showCreditsPurchaseModal()` - ✅ Existe linha 711 app.js
- `logout()` - ✅ Existe linha 1477 app.js

### 2. INNERHTML COM ONCLICK
- **Modal de Créditos** (linha 746 app.js): `onclick="purchasePlan('${plan.id}')"` dentro de innerHTML
  - ✅ Função existe, mas pode falhar se modal for recriado sem rebind

### 3. BINDING DINÂMICO
- **Cards de Nicho** (linha 3211 app.js): ✅ Correto - usa addEventListener após innerHTML
- **Cards de Retenção** (linha 3257 app.js): ✅ Correto - usa addEventListener após innerHTML

## AÇÕES NECESSÁRIAS

1. Verificar se `handleYouTubeSubmit` e `handleUploadSubmit` existem com outro nome
2. Verificar se `downloadSeries` existe com outro nome
3. Verificar se `showCreditsPurchaseModal` existe com outro nome
4. Verificar se `logout` existe ou se deve usar `logoutOld`
5. Garantir que modal de créditos rebind onclick após innerHTML
