# 🚀 Deploy no Railway - PASSO A PASSO

## ✅ Seu código já está no GitHub!
- **Repositório:** https://github.com/ferramentameegra-cell/ezclipv3
- **Último commit:** `fc7479e` ✅
- **Branch:** `main` ✅

## 📋 PASSO A PASSO (5 minutos)

### 1. Acesse o Railway
👉 **https://railway.app**

### 2. Faça Login
- Use sua conta GitHub (recomendado)

### 3. Crie Novo Projeto
- Clique em **"New Project"**
- Selecione **"Deploy from GitHub repo"**

### 4. Conecte o Repositório
- Procure por: `ferramentameegra-cell/ezclipv3`
- Ou cole: `ferramentameegra-cell/ezclipv3`
- Selecione o repositório

### 5. Configure o Deploy
- **Branch:** `main` (já selecionado)
- **Root Directory:** (deixe vazio)
- O Railway detectará automaticamente:
  - ✅ Node.js 20 (do package.json)
  - ✅ FFmpeg (do nixpacks.toml)
  - ✅ Comando: `node index.js`

### 6. Aguarde o Deploy
- ⏱️ 2-5 minutos
- Veja os logs em tempo real
- Status aparecerá como "Building" → "Deploying" → "Running"

### 7. Obtenha a URL
- Após o deploy, o Railway fornecerá uma URL
- Exemplo: `https://ezv2-production.up.railway.app`
- Clique em "Generate Domain" se necessário

### 8. Teste!
- Acesse a URL
- Faça hard refresh: `Ctrl/Cmd + Shift + R`
- Teste a aplicação!

## 🔄 Auto Deploy (Opcional)

Após conectar, o Railway fará deploy **automaticamente** a cada push no GitHub!

## ⚙️ Se já tem projeto no Railway

1. **Abra seu projeto existente**
2. **Vá em Settings** → **GitHub**
3. **Conecte o repositório:** `ferramentameegra-cell/ezclipv3`
4. **Ative "Auto Deploy"**
5. ✅ **Pronto!** O deploy iniciará automaticamente

## 🔍 Verificar Deploy

### Logs em Tempo Real:
- No dashboard do Railway
- Veja a aba "Deployments"
- Clique no deployment para ver logs

### Verificar se está funcionando:
- Acesse: `https://sua-url.railway.app/health`
- Deve retornar: `{"status":"ok",...}`

## ❌ Se algo der errado

### Verifique os logs:
1. Dashboard → Seu Projeto → Deployments
2. Clique no deployment mais recente
3. Veja os logs de erro

### Problemas comuns:
- **FFmpeg não encontrado:** ✅ Já configurado no nixpacks.toml
- **Node.js errado:** ✅ Já configurado para versão 20
- **Porta:** Railway define automaticamente via `process.env.PORT`

## 📊 Status Atual do Projeto

```
✅ Código no GitHub
✅ Node.js 20 configurado
✅ FFmpeg configurado
✅ Dependências instaladas
✅ nixpacks.toml pronto
✅ package.json correto
```

## 🎯 Próximo Passo

**Acesse agora:** https://railway.app

E siga os passos acima! 🚀

---

**Tempo estimado:** 5 minutos
**Dificuldade:** ⭐ (Muito fácil)

