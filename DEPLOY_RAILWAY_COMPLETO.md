# 🚀 Deploy Completo no Railway - Layout Vertical 9:16

## ✅ Status do Deploy

**Último Commit:** `42e4a21` - docs: Adicionar guia de deploy no Railway  
**Branch:** `main`  
**Repositório:** `github.com/ferramentameegra-cell/ezclipv3.git`  
**Status:** ✅ Tudo commitado e enviado para GitHub

## 📋 Funcionalidades Deployadas

### ✅ FORMATO FIXO 9:16
- **Sempre 1080x1920 vertical** para todos os vídeos gerados
- **Formato forçado** independente do parâmetro recebido
- **Log de confirmação:** `[COMPOSER] ⚠️ Formato forçado para 9:16 (1080x1920)`

### ✅ LAYOUT VERTICAL
```
┌─────────────────┐
│ Vídeo Principal │ ← Topo (y=0), centralizado horizontalmente
│  1080x1440      │   75% da altura total
├─────────────────┤
│    Headline     │ ← Centro vertical (y=(h-text_h)/2)
│                 │   Centralizada horizontalmente
├─────────────────┤
│ Vídeo Retenção  │ ← Inferior (y=H-240px)
│   1080x240      │   12.5% da altura total, centralizado
└─────────────────┘
   1080x1920 (9:16)
```

### ✅ SEM TARJAS PRETAS
- **Background fixo como layer 0** (base)
- **Vídeo sobreposto sem padding preto**
- **Background visível** nas áreas vazias automaticamente
- **Overlay direto** sobre o background

### ✅ BACKGROUND FIXO
- **Imagem:** `assets/backgrounds/ezclip-background.png`
- **Aplicado automaticamente** em TODOS os vídeos gerados
- **Redimensionado para 1080x1920** sem distorção
- **Suporte para desenvolvimento e produção** (Railway)

## 🚀 Como Fazer Deploy no Railway

### Opção 1: Deploy Automático (Recomendado)

Se o Railway estiver conectado ao GitHub, o deploy foi **acionado automaticamente** com o último push.

**Verificar:**
1. Acesse: https://railway.app
2. Vá para seu projeto
3. Aba "Deployments"
4. Verifique se o último deploy está em andamento ou concluído

### Opção 2: Deploy via GitHub Actions

1. Acesse: https://github.com/ferramentameegra-cell/ezclipv3/actions
2. Selecione "Auto Deploy to Railway"
3. Clique em "Run workflow" → "Run workflow"

**Requisito:** `RAILWAY_TOKEN` configurado em GitHub Secrets

### Opção 3: Deploy Manual via CLI

```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Fazer login
railway login

# 3. Linkar ao projeto
railway link

# 4. Fazer deploy
railway up
```

## 🔍 Verificações Pós-Deploy

Após o deploy, verifique nos logs:

### 1. Formato 9:16
```
[COMPOSER] ⚠️ Formato forçado para 9:16 (1080x1920) - formato recebido: X foi ignorado
[COMPOSER] Layout vertical 9:16: 1080x1920
```

### 2. Background Fixo
```
[COMPOSER] ✅ Background fixo encontrado: /caminho/para/ezclip-background.png
[COMPOSER] Background fixo aplicado como layer 0
[COMPOSER] Background fixo adicionado como input 1: /caminho/para/ezclip-background.png
```

### 3. Layout Vertical
```
[COMPOSER] Vídeo principal: 1080x1440 (topo)
[COMPOSER] Vídeo principal posicionado no topo (y=0), centralizado horizontalmente
[COMPOSER] Vídeo de retenção posicionado na parte inferior (y=1680), centralizado horizontalmente
[COMPOSER] Headline posicionada no centro vertical (y=(h-text_h)/2), centralizada horizontalmente
```

### 4. Sem Tarjas Pretas
- Não deve aparecer: `pad=...color=000000` (padding preto)
- Deve aparecer: `overlay=(W-w)/2:0` (overlay direto)

## 📁 Estrutura de Arquivos no Railway

Certifique-se de que o background está acessível:

**Em Produção (Railway):**
- `/tmp/assets/backgrounds/ezclip-background.png`
- Ou configure `FIXED_BACKGROUND_PATH` como variável de ambiente

**O código procura em:**
1. `/tmp/assets/backgrounds/ezclip-background.png` (produção)
2. `/tmp/assets/backgrounds/ezclip-background.jpg` (produção)
3. `assets/backgrounds/ezclip-background.png` (desenvolvimento)
4. `process.env.FIXED_BACKGROUND_PATH` (variável de ambiente)

## 🔧 Variáveis de Ambiente Necessárias

Configure no Railway:

- `NODE_ENV=production`
- `PORT=8080` (ou porta configurada)
- `FIXED_BACKGROUND_PATH` (opcional, se background em local diferente)
- Outras variáveis do projeto (Redis, etc.)

## 📊 Teste Após Deploy

1. **Gere um vídeo** na plataforma
2. **Verifique o formato:** Deve ser 1080x1920 (9:16)
3. **Verifique o layout:**
   - Vídeo no topo ✅
   - Headline no centro ✅
   - Vídeo de retenção na parte inferior ✅
4. **Verifique o background:**
   - Deve aparecer nas áreas vazias ✅
   - Sem tarjas pretas ✅

## 🎯 Resumo

✅ **Formato:** Sempre 9:16 (1080x1920)  
✅ **Layout:** Vertical com elementos posicionados corretamente  
✅ **Background:** Fixo aplicado automaticamente  
✅ **Tarjas Pretas:** Removidas completamente  
✅ **Deploy:** Pronto para Railway

---

**Status:** 🟢 Pronto para produção
