# 🚀 Deploy no Railway - Guia Rápido

## ✅ Pré-requisitos

1. Conta no Railway: https://railway.app
2. Repositório no GitHub (já configurado)
3. Variáveis de ambiente configuradas

## 📋 Passo a Passo

### 1. Acesse o Railway
- Vá para: https://railway.app
- Faça login com sua conta GitHub

### 2. Criar Novo Projeto
- Clique em **"New Project"**
- Selecione **"Deploy from GitHub repo"**
- Escolha o repositório: `ferramentameegra-cell/ezclipv3` (ou seu repositório)

### 3. Configurar Variáveis de Ambiente

No Railway Dashboard, vá em **"Variables"** e adicione:

#### ⚠️ OBRIGATÓRIAS (Produção)
```
NODE_ENV=production
JWT_SECRET=<gerar-uma-chave-secreta-forte>
```

#### 📝 OPCIONAIS (mas recomendadas)
```
CORS_ORIGIN=https://seu-dominio.railway.app
LOG_LEVEL=info
REDIS_URL=<url-do-redis-se-tiver>
```

#### 🔧 Para gerar JWT_SECRET seguro:
```bash
# No terminal local:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Configurar Auto Deploy (Opcional)
- No projeto Railway, vá em **"Settings"**
- Ative **"Auto Deploy"** para branch `main`
- Agora todo push para `main` fará deploy automático

### 5. Verificar Deploy
- Após o deploy, você receberá uma URL como: `https://seu-projeto.railway.app`
- Teste os endpoints:
  - `https://seu-projeto.railway.app/health` - Deve retornar `{"status":"ok"}`
  - `https://seu-projeto.railway.app/` - Frontend

## 🔍 Verificar Logs

Se houver problemas:
1. No Railway Dashboard, clique em **"Deployments"**
2. Selecione o deployment mais recente
3. Veja os logs em tempo real

## ⚠️ Problemas Comuns

### Erro: "JWT_SECRET deve ser definido em produção"
- **Solução**: Adicione a variável `JWT_SECRET` no Railway Dashboard

### Erro: FFmpeg não encontrado
- **Solução**: O `nixpacks.toml` já configura FFmpeg automaticamente ✅

### Erro: Porta não encontrada
- **Solução**: O Railway define `PORT` automaticamente ✅

### Build falha
- Verifique os logs no Railway
- Certifique-se de que `package.json` tem `"engines": { "node": ">=20.0.0" }` ✅

## 📊 Monitoramento

- **Logs**: Railway Dashboard > Deployments > Logs
- **Métricas**: Railway Dashboard > Metrics
- **Health Check**: `https://seu-projeto.railway.app/health`

## 🎉 Pronto!

Seu projeto estará rodando no Railway e acessível pela URL fornecida.

**Lembre-se:**
- A URL do Railway muda a cada deploy, a menos que você configure um domínio customizado
- Configure `CORS_ORIGIN` se tiver um frontend separado
- Em produção, sempre use `JWT_SECRET` forte e único
