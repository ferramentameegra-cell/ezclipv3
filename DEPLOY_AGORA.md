# 🚀 Deploy no Railway - AGORA

## ⚡ Opção 1: Deploy via Dashboard (MAIS FÁCIL)

### Passo 1: Acesse o Railway
👉 **https://railway.app**
- Faça login com GitHub

### Passo 2: Criar/Conectar Projeto
- Clique em **"New Project"**
- Selecione **"Deploy from GitHub repo"**
- Escolha seu repositório

### Passo 3: Configurar Variáveis OBRIGATÓRIAS
No Railway Dashboard → **Variables** → Adicione:

```bash
NODE_ENV=production
JWT_SECRET=<gerar-chave-secreta>
```

**Para gerar JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Passo 4: Aguardar Deploy
- Railway fará build automaticamente
- Aguarde 2-5 minutos
- URL será gerada automaticamente

### Passo 5: Testar
- Acesse: `https://seu-projeto.railway.app/health`
- Deve retornar: `{"status":"ok"}`

---

## ⚡ Opção 2: Deploy via CLI (RÁPIDO)

### Se já tem Railway CLI configurado:

```bash
# 1. Fazer commit das mudanças (se necessário)
git add .
git commit -m "feat: adicionar camada de segurança"
git push origin main

# 2. Deploy via CLI
railway up
```

### Se NÃO tem Railway CLI:

```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Inicializar projeto (se primeira vez)
railway init

# 4. Configurar variáveis
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# 5. Deploy
railway up
```

---

## ⚠️ IMPORTANTE: Variáveis de Ambiente

**OBRIGATÓRIAS em produção:**
- `NODE_ENV=production`
- `JWT_SECRET=<chave-secreta-forte>`

**OPCIONAIS (mas recomendadas):**
- `CORS_ORIGIN=https://seu-dominio.railway.app`
- `LOG_LEVEL=info`
- `REDIS_URL=<se-tiver-redis>`

---

## 🔍 Verificar Logs

Se houver problemas:
```bash
railway logs
```

Ou no Dashboard:
- Railway Dashboard → Deployments → Logs

---

## ✅ Checklist Pós-Deploy

- [ ] Health check funciona: `/health`
- [ ] Frontend carrega: `/`
- [ ] Login funciona: `/api/auth/login`
- [ ] Sem erros nos logs
- [ ] Variáveis de ambiente configuradas

---

## 🆘 Problemas Comuns

**Erro: "JWT_SECRET deve ser definido"**
→ Adicione `JWT_SECRET` nas variáveis do Railway

**Build falha**
→ Verifique logs: `railway logs`

**Porta não encontrada**
→ Railway define `PORT` automaticamente ✅

**FFmpeg não encontrado**
→ `nixpacks.toml` já configura ✅
