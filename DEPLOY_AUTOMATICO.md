# 🚀 Deploy Automático no Railway

## ⚠️ Problema Atual

O token do GitHub fornecido não tem a permissão `workflow` necessária para modificar arquivos `.github/workflows/`.

## ✅ Solução Recomendada: Deploy via Railway Dashboard

A forma mais simples é conectar o repositório GitHub diretamente no Railway:

### Passo 1: Criar Projeto no Railway
1. Acesse: https://railway.app
2. Faça login com sua conta GitHub
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Escolha o repositório: `ferramentameegra-cell/ezclipv3`
6. O Railway detectará automaticamente e fará o deploy

### Passo 2: Configurar Deploy Automático
1. No projeto Railway, vá em "Settings"
2. Ative "Auto Deploy" 
3. Selecione a branch `main`
4. ✅ Pronto! Todo push para `main` fará deploy automático

## 🔧 Solução Alternativa: Atualizar Token GitHub

Se preferir usar GitHub Actions, você precisa:

### 1. Criar Novo Token com Permissão Workflow
1. Acesse: https://github.com/settings/tokens/new
2. Nome: "Railway Auto Deploy"
3. Permissões necessárias:
   - ✅ `repo` (acesso completo)
   - ✅ `workflow` (modificar workflows)
4. Gere o token
5. Atualize o remote:

```bash
git remote set-url origin https://NOVO_TOKEN@github.com/ferramentameegra-cell/ezclipv3.git
```

### 2. Configurar Secrets no GitHub
1. Acesse: https://github.com/ferramentameegra-cell/ezclipv3/settings/secrets/actions
2. Adicione:
   - `RAILWAY_TOKEN` - Token do Railway
   - `RAILWAY_PROJECT_ID` - ID do projeto Railway

### 3. Fazer Push
```bash
git push origin main
```

## 📋 Configurar Secrets do Railway

No Railway Dashboard, adicione as variáveis de ambiente:

- `NODE_ENV=production`
- `PORT` (definido automaticamente)
- `R2_ACCOUNT_ID` (opcional)
- `R2_ACCESS_KEY_ID` (opcional)
- `R2_SECRET_ACCESS_KEY` (opcional)
- `R2_BUCKET_NAME` (opcional)
- `R2_ENDPOINT` (opcional)

## 🎯 Status Atual

✅ Workflows do GitHub Actions criados
✅ Arquivos de configuração Railway prontos
⏳ Aguardando configuração de token ou conexão Railway-GitHub

## 🔗 Links Úteis

- Railway Dashboard: https://railway.app
- GitHub Actions: https://github.com/ferramentameegra-cell/ezclipv3/actions
- Railway Tokens: https://railway.app/account/tokens
- GitHub Tokens: https://github.com/settings/tokens


