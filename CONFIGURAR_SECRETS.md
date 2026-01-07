# 🔐 Configurar Secrets para Deploy Automático

O deploy automático via GitHub Actions está configurado! Agora você precisa configurar os secrets no GitHub.

## 📋 Secrets Necessários

### 1. RAILWAY_TOKEN

1. Acesse: https://railway.app/account/tokens
2. Clique em **"New Token"**
3. Dê um nome (ex: "GitHub Actions Deploy")
4. Copie o token gerado
5. No GitHub, acesse: https://github.com/ferramentameegra-cell/ezclipv3/settings/secrets/actions
6. Clique em **"New repository secret"**
7. Name: `RAILWAY_TOKEN`
8. Value: (cole o token do Railway)
9. Clique em **"Add secret"**

### 2. RAILWAY_PROJECT_ID (Opcional, mas recomendado)

1. Acesse seu projeto no Railway: https://railway.app
2. Vá em **Settings** do projeto
3. Copie o **"Project ID"**
4. No GitHub, adicione novo secret:
   - Name: `RAILWAY_PROJECT_ID`
   - Value: (cole o Project ID)

## ✅ Verificar Deploy

Após configurar os secrets:

1. Acesse: https://github.com/ferramentameegra-cell/ezclipv3/actions
2. Você verá o workflow "Auto Deploy to Railway"
3. Faça um push para `main` ou clique em "Run workflow"
4. O deploy será executado automaticamente

## 🚀 Status Atual

- ✅ Token do GitHub atualizado
- ✅ Histórico limpo (sem tokens expostos)
- ✅ Workflows configurados
- ✅ Código enviado para GitHub
- ⏳ Aguardando configuração de secrets do Railway

## 🔗 Links Úteis

- **GitHub Secrets**: https://github.com/ferramentameegra-cell/ezclipv3/settings/secrets/actions
- **Railway Tokens**: https://railway.app/account/tokens
- **GitHub Actions**: https://github.com/ferramentameegra-cell/ezclipv3/actions
- **Railway Dashboard**: https://railway.app



