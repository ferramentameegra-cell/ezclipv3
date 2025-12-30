# 🚀 Deploy no Railway - Guia Rápido

## Status Atual
✅ Código commitado e no GitHub: `fc7479e`
✅ Configuração Nixpacks pronta
✅ FFmpeg configurado
✅ Node.js 20 configurado

## Método 1: Auto Deploy via GitHub (Recomendado)

### Se você já tem projeto no Railway conectado ao GitHub:
1. **Acesse:** https://railway.app
2. **Abra seu projeto**
3. **Vá em Settings** → **GitHub**
4. **Verifique se está conectado** ao repositório: `ferramentameegra-cell/ezclipv3`
5. **Ative "Auto Deploy"** se ainda não estiver ativo
6. ✅ **Pronto!** O Railway detectará automaticamente o novo commit e fará deploy

### Se ainda não conectou:
1. **Acesse:** https://railway.app
2. **Clique em "New Project"**
3. **Selecione "Deploy from GitHub repo"**
4. **Escolha:** `ferramentameegra-cell/ezclipv3`
5. **Selecione branch:** `main`
6. **Railway detectará automaticamente:**
   - Node.js 20 (do package.json)
   - FFmpeg (do nixpacks.toml)
   - Comando de start: `node index.js`
7. ✅ **Deploy iniciará automaticamente!**

## Método 2: Deploy Manual via Railway CLI

### Instalar Railway CLI:
```bash
npm install -g @railway/cli
```

### Fazer login:
```bash
railway login
```

### Inicializar projeto:
```bash
railway init
```

### Fazer deploy:
```bash
railway up
```

## Método 3: Via GitHub Actions (Se configurado)

Se você configurou os secrets no GitHub:
- `RAILWAY_TOKEN`
- `RAILWAY_PROJECT_ID`

O workflow `.github/workflows/auto-deploy.yml` fará deploy automaticamente a cada push.

### Para configurar os secrets:
1. **Acesse:** https://github.com/ferramentameegra-cell/ezclipv3/settings/secrets/actions
2. **Adicione:**
   - `RAILWAY_TOKEN` (obtenha em: https://railway.app/account/tokens)
   - `RAILWAY_PROJECT_ID` (obtenha no dashboard do Railway)

## ⚙️ Configurações Importantes

### Variáveis de Ambiente (se necessário):
No Railway Dashboard → Settings → Variables, você pode adicionar:
- `PORT` (geralmente automático)
- `NODE_ENV=production`
- `CORS_ORIGIN` (se necessário)

### Verificar Deploy:
1. **Acesse o dashboard do Railway**
2. **Veja os logs** em tempo real
3. **Verifique o status** do deploy
4. **Acesse a URL** fornecida pelo Railway

## 🔍 Troubleshooting

### Se o deploy falhar:
1. **Verifique os logs** no Railway Dashboard
2. **Confirme que FFmpeg está instalado** (já configurado no nixpacks.toml)
3. **Verifique Node.js 20** (já configurado)
4. **Confirme que todas as dependências estão no package.json** ✅

### Se o vídeo não processar:
- FFmpeg precisa estar instalado (✅ já no nixpacks.toml)
- Verifique os logs para erros específicos

## 📊 Status do Projeto

- **Repositório:** https://github.com/ferramentameegra-cell/ezclipv3
- **Último commit:** `fc7479e` - "feat: implementa download, trim e geração automática de clips"
- **Branch:** `main`
- **Node.js:** 20
- **FFmpeg:** Configurado
- **Dependências:** Todas instaladas

## ✅ Próximos Passos

1. **Conecte o repositório no Railway** (Método 1 - mais fácil)
2. **Aguarde o deploy** (2-5 minutos)
3. **Acesse a URL** fornecida pelo Railway
4. **Teste a aplicação!**

---

**Nota:** O método mais simples é conectar o GitHub diretamente no Railway. O deploy será automático a cada push!

