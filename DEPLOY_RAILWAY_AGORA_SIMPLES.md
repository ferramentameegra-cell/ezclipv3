# 🚀 Deploy no Railway - Guia Rápido

## ✅ Status Atual
- ✅ Código commitado e enviado para GitHub
- ✅ Commit: `3bf0429` - "feat: adiciona tela de loading para processo de trim/clip"
- ✅ Configurações Railway prontas (nixpacks.toml, railway.json, Dockerfile)

## 🎯 Método Recomendado: Via Dashboard Railway

### Passo 1: Acessar Railway
1. Acesse: https://railway.app
2. Faça login com sua conta GitHub

### Passo 2: Criar/Selecionar Projeto
**Se você já tem um projeto:**
- Abra o projeto existente
- Vá em **Settings** → **GitHub**
- Verifique se está conectado ao repositório: `ferramentameegra-cell/ezclipv3`
- Se estiver conectado, o deploy automático já deve ter iniciado! ✅

**Se você precisa criar um novo projeto:**
1. Clique em **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Escolha o repositório: `ferramentameegra-cell/ezclipv3`
4. Selecione a branch: `main`
5. O Railway detectará automaticamente:
   - Node.js 20 (do package.json)
   - FFmpeg (do nixpacks.toml)
   - Comando de start: `node src/index.js`

### Passo 3: Configurar Variáveis de Ambiente (se necessário)

No Railway Dashboard → **Settings** → **Variables**, adicione:

#### ⚠️ OBRIGATÓRIAS:
```
NODE_ENV=production
JWT_SECRET=<sua-chave-secreta-forte>
```

#### 📝 OPCIONAIS (mas recomendadas):
```
CORS_ORIGIN=*
LOG_LEVEL=info
```

**Para gerar JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Passo 4: Ativar Auto Deploy (Recomendado)
1. No projeto Railway, vá em **Settings**
2. Ative **"Auto Deploy"** para branch `main`
3. ✅ Agora todo push para `main` fará deploy automático!

### Passo 5: Verificar Deploy
1. No Railway Dashboard, veja os logs em tempo real
2. Após o deploy, você receberá uma URL como: `https://seu-projeto.railway.app`
3. Teste acessando:
   - `https://seu-projeto.railway.app/` - Frontend
   - `https://seu-projeto.railway.app/health` - Health check (se configurado)

## 🔧 Método Alternativo: Railway CLI (Manual)

Se preferir usar CLI:

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Fazer login (abrirá navegador)
railway login

# Inicializar projeto (se ainda não inicializado)
railway init

# Fazer deploy
railway up
```

## 📊 Verificar Logs

Se houver problemas:
1. No Railway Dashboard, clique em **"Deployments"**
2. Selecione o deployment mais recente
3. Veja os logs em tempo real

## ⚠️ Problemas Comuns

### Build falha
- Verifique se FFmpeg está instalado (✅ já configurado no nixpacks.toml)
- Verifique Node.js 20 (✅ já configurado)

### Erro de porta
- O Railway define `PORT` automaticamente
- O código já usa `process.env.PORT || 8080` ✅

### Erro de JWT_SECRET
- Adicione `JWT_SECRET` nas variáveis de ambiente do Railway

## 🎉 Pronto!

Seu projeto estará rodando no Railway e acessível pela URL fornecida.

**Último commit deployado:** `3bf0429` - "feat: adiciona tela de loading para processo de trim/clip"
