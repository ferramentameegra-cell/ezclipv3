# 🚀 Instruções de Deploy Automático

## ✅ Status do Projeto

- ✅ Código completo commitado no GitHub
- ✅ Configurações Railway prontas
- ✅ Workflow GitHub Actions criado (localmente)

## 🎯 Como Fazer Deploy Automático

### Opção 1: Railway Dashboard (RECOMENDADO) ⭐

**A forma mais simples - não precisa de GitHub Actions:**

1. Acesse: https://railway.app
2. Faça login com sua conta GitHub
3. Clique em **"New Project"**
4. Selecione **"Deploy from GitHub repo"**
5. Escolha: `ferramentameegra-cell/ezclipv3`
6. Railway fará o deploy automaticamente
7. Nas configurações, ative **"Auto Deploy"** para branch `main`

✅ **Pronto!** Todo push para `main` fará deploy automático.

### Opção 2: GitHub Actions

Se preferir usar GitHub Actions:

1. Adicione o workflow manualmente via interface do GitHub:
   - Caminho: `.github/workflows/auto-deploy.yml`
   - Conteúdo está no arquivo local com mesmo nome

2. Configure secrets em:
   - https://github.com/ferramentameegra-cell/ezclipv3/settings/secrets/actions
   - Adicione: `RAILWAY_TOKEN` e `RAILWAY_PROJECT_ID`

## 📋 Variáveis de Ambiente (Railway)

Configure no Railway Dashboard:
- `NODE_ENV=production`
- `PORT` (automático)
- Variáveis R2 (opcional)

## 🔗 Links

- Railway: https://railway.app
- Repo: https://github.com/ferramentameegra-cell/ezclipv3


