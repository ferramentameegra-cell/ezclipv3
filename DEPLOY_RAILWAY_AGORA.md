# 🚀 Deploy no Railway - Passo a Passo

## ✅ Código já está no GitHub!

O código foi commitado e enviado para: `https://github.com/ferramentameegra-cell/ezclipv3`

## 📋 Passos para Deploy no Railway

### 1. Acesse o Railway Dashboard
Abra: **https://railway.app**

### 2. Faça Login
- Clique em "Login" ou "Get Started"
- Escolha "Login with GitHub"
- Autorize o Railway a acessar seus repositórios

### 3. Criar Novo Projeto
- Clique no botão **"New Project"** (canto superior direito)
- Selecione **"Deploy from GitHub repo"**

### 4. Selecionar Repositório
- Na lista de repositórios, encontre: **`ferramentameegra-cell/ezclipv3`**
- Clique nele

### 5. Configurar Deploy Automático
- O Railway detectará automaticamente que é um projeto Node.js
- Aguarde o build inicial (pode levar 2-5 minutos)
- O Railway irá:
  - Instalar Node.js 20 (conforme `package.json` e `nixpacks.toml`)
  - Instalar FFmpeg (conforme `nixpacks.toml`)
  - Executar `npm ci`
  - Executar `npm run build`
  - Iniciar o servidor com `node index.js`

### 6. Obter a URL do Projeto
Após o deploy completar:
- Na página do projeto, procure a seção **"Domains"** ou **"Networking"**
- Você verá uma URL como: `https://ezclipv3-production-xxxx.up.railway.app`
- **Copie essa URL!**

### 7. Verificar se Está Funcionando
Acesse no navegador:
- **URL principal**: `https://sua-url.railway.app/`
- **Health check**: `https://sua-url.railway.app/health`

Você deve ver:
- Na URL principal: Interface do EZ Clips AI V2
- No health check: `{"status":"ok",...}`

### 8. (Opcional) Configurar Deploy Automático
Para que todo push no GitHub faça deploy automático:
- No projeto Railway, vá em **"Settings"**
- Ative **"Auto Deploy"**
- Selecione a branch **`main`**
- ✅ Pronto! Todo push para `main` fará deploy automático

## 🔧 Variáveis de Ambiente (Opcional)

Se precisar configurar variáveis de ambiente:
- No projeto Railway, vá em **"Variables"**
- Adicione as variáveis necessárias:
  - `NODE_ENV=production`
  - `CORS_ORIGIN=*` (ou sua URL específica)
  - Variáveis R2 (se usar Cloudflare R2)

## ✅ Pronto!

Seu projeto estará rodando no Railway e acessível pela URL fornecida.

## 🆘 Problemas Comuns

### Build falha
- Verifique os logs no Railway Dashboard
- Certifique-se de que `package.json` tem `engines.node: "20"`

### Porta não encontrada
- O Railway define `PORT` automaticamente
- O código já usa `process.env.PORT || 3000` ✅

### FFmpeg não encontrado
- O `nixpacks.toml` já configura FFmpeg ✅



