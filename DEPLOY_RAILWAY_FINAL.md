# 🚀 Deploy no Railway - Guia Rápido

## ✅ Código Enviado para GitHub!

O código foi commitado e está disponível em:
**https://github.com/ferramentameegra-cell/ezclipv3**

## 📋 Passos para Deploy

### 1. Acesse o Railway Dashboard
👉 **https://railway.app**

### 2. Faça Login
- Clique em **"Login"** ou **"Get Started"**
- Escolha **"Login with GitHub"**
- Autorize o Railway a acessar seus repositórios

### 3. Criar Novo Projeto (ou usar existente)
Se você já tem um projeto:
- Abra o projeto existente
- Vá em **"Settings"** → **"Connect GitHub Repo"**
- Selecione: `ferramentameegra-cell/ezclipv3`

Se for criar novo:
- Clique em **"New Project"**
- Selecione **"Deploy from GitHub repo"**
- Escolha: `ferramentameegra-cell/ezclipv3`

### 4. Aguardar Build
O Railway irá:
- ✅ Detectar Node.js 20 (conforme `package.json` e `nixpacks.toml`)
- ✅ Instalar FFmpeg (conforme `nixpacks.toml`)
- ✅ Executar `npm ci`
- ✅ Executar `npm run build`
- ✅ Iniciar com `node index.js`

**Tempo estimado: 2-5 minutos**

### 5. Obter URL do Projeto
Após o build completar:
- Na página do projeto, procure **"Domains"** ou **"Networking"**
- Você verá uma URL como: `https://ezclipv3-production-xxxx.up.railway.app`
- **Copie essa URL!**

### 6. Verificar Funcionamento
Acesse no navegador:

**URL Principal:**
```
https://sua-url.railway.app/
```
Deve mostrar a interface com abas (Início, Login, Cursos)

**Health Check:**
```
https://sua-url.railway.app/health
```
Deve retornar: `{"status":"ok",...}`

**API Status:**
```
https://sua-url.railway.app/
```
Deve retornar: `{"status":"EZ Clips AI V2 - Retention Engine online 🚀",...}`

### 7. (Opcional) Configurar Deploy Automático
Para que todo push no GitHub faça deploy automaticamente:

1. No projeto Railway, vá em **"Settings"**
2. Ative **"Auto Deploy"**
3. Selecione a branch **`main`**
4. ✅ Pronto! Todo push para `main` fará deploy automático

## 🔧 Variáveis de Ambiente (Opcional)

Se precisar configurar variáveis:
- No projeto Railway, vá em **"Variables"**
- Adicione as variáveis necessárias:

```
NODE_ENV=production
CORS_ORIGIN=*
MAX_JSON_SIZE=50mb
MAX_URL_SIZE=50mb
STATIC_MAX_AGE=1d
```

## ✅ Funcionalidades Disponíveis

Após o deploy, você terá acesso a:

1. **Aba Início**: Ferramenta EZ Clips AI completa
   - Processamento de vídeos do YouTube
   - Trim tool com cálculo em tempo real
   - Seleção de nichos e vídeos de retenção
   - Geração de séries virais

2. **Aba Login**: Sistema de autenticação
   - Login de usuários
   - Registro de novas contas
   - Sessões de usuário

3. **Aba Cursos**: Plataforma de cursos
   - Grid de cursos disponíveis
   - Filtros por categoria
   - Sistema de compra (requer login)

## 🆘 Problemas Comuns

### Build falha com erro de Node.js
- Verifique se `package.json` tem `"engines": { "node": ">=20.0.0" }`
- Verifique se `nixpacks.toml` tem `NIXPACKS_NODE_VERSION = "20"`

### Porta não encontrada
- O Railway define `PORT` automaticamente
- O código já usa `process.env.PORT || 3000` ✅

### FFmpeg não encontrado
- O `nixpacks.toml` já configura FFmpeg ✅

### Erro 404 nas rotas
- Verifique se o servidor está rodando
- Verifique os logs no Railway Dashboard

## 📊 Monitoramento

Para ver logs em tempo real:
- No projeto Railway, clique em **"Deployments"**
- Selecione o deployment mais recente
- Veja os logs em tempo real

## 🎉 Pronto!

Seu projeto estará rodando no Railway e acessível pela URL fornecida.

**Lembre-se:** A URL do Railway muda a cada deploy, a menos que você configure um domínio customizado.

