# 🚀 Deploy no Railway - Guia Rápido

## ✅ Pré-requisitos

1. **Código commitado no Git**
   ```bash
   git status
   git add .
   git commit -m "Implementação sistema de retenção por nicho"
   git push origin main
   ```

2. **Railway CLI instalado** (opcional, para deploy manual)
   ```bash
   npm install -g @railway/cli
   ```

## 🎯 Opção 1: Deploy Automático (Recomendado)

O deploy será feito **automaticamente** quando você fizer push para a branch `main`.

### Passos:

1. **Commit e push das mudanças:**
   ```bash
   git add .
   git commit -m "Sistema de retenção por nicho implementado"
   git push origin main
   ```

2. **Verificar deploy no GitHub Actions:**
   - Acesse: https://github.com/seu-usuario/seu-repo/actions
   - Procure pelo workflow "Railway Deploy"
   - Aguarde a conclusão (verde = sucesso)

3. **Verificar no Railway:**
   - Acesse: https://railway.app
   - Selecione seu projeto
   - Verifique o deployment mais recente

## 🎯 Opção 2: Deploy Manual via Railway Dashboard

1. **Acesse o Railway:**
   - https://railway.app
   - Faça login

2. **Selecione o projeto:**
   - Clique no projeto EZ Clip

3. **Faça o deploy:**
   - Clique em "Deployments"
   - Clique em "Redeploy" no deployment mais recente
   - OU clique em "Settings" > "Source" > "Redeploy"

## 🎯 Opção 3: Deploy Manual via CLI

```bash
# 1. Login no Railway
railway login

# 2. Link ao projeto (se ainda não linkou)
railway link

# 3. Deploy
railway up
```

## ⚙️ Variáveis de Ambiente Necessárias

Certifique-se de que estas variáveis estão configuradas no Railway:

### Obrigatórias:
- `NODE_ENV=production`
- `JWT_SECRET` (secreto JWT)
- `SUPABASE_URL` (URL do Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (chave de serviço do Supabase)

### Opcionais (mas recomendadas):
- `YTDLP_COOKIES` (cookies do YouTube para downloads)
- `YTDLP_USER_AGENT` (User-Agent customizado)
- `REDIS_URL` (URL do Redis, se usar)
- `STRIPE_SECRET_KEY` (se usar Stripe)
- `OPENAI_API_KEY` (se usar OpenAI)

### Para o novo sistema de retenção:
- `RETENTION_LIBRARY_DIR` (opcional, padrão: `/tmp/retention_library`)

## 📋 Verificar Deploy

### 1. Logs do Railway:
```bash
# Via CLI
railway logs

# Ou no dashboard:
# Railway > Projeto > Deployments > Ver Logs
```

### 2. Verificar se a aplicação está rodando:
- Acesse a URL do projeto no Railway
- Verifique se o servidor responde

### 3. Verificar build:
- Railway > Deployments > Build Logs
- Procure por erros de instalação

## 🔍 Troubleshooting

### Erro: "Build failed"
1. Verifique os logs do build no Railway
2. Verifique se `nixpacks.toml` está correto
3. Verifique se todas as dependências estão no `package.json`

### Erro: "Application crashed"
1. Verifique os logs de runtime
2. Verifique se todas as variáveis de ambiente estão configuradas
3. Verifique se o `Procfile` está correto

### Erro: "yt-dlp not found"
1. Verifique se `nixpacks.toml` está instalando yt-dlp corretamente
2. Verifique os logs do build

### Erro: "FFmpeg not found"
1. Verifique se `nixpacks.toml` inclui `ffmpeg` no `nixPkgs`

## 📝 Checklist de Deploy

- [ ] Código commitado e enviado para GitHub
- [ ] Variáveis de ambiente configuradas no Railway
- [ ] `nixpacks.toml` está correto
- [ ] `Procfile` está correto
- [ ] `package.json` tem todas as dependências
- [ ] Deploy iniciado (automático ou manual)
- [ ] Logs verificados (sem erros)
- [ ] Aplicação respondendo corretamente

## 🎉 Após o Deploy

1. **Teste a aplicação:**
   - Acesse a URL do Railway
   - Teste funcionalidades principais

2. **Monitore logs:**
   - Railway > Logs
   - Procure por erros ou warnings

3. **Verifique sistema de retenção:**
   - Teste geração de vídeo com nicho
   - Verifique se vídeos de retenção são baixados corretamente

## 📚 Arquivos Importantes

- `nixpacks.toml` - Configuração do build
- `Procfile` - Comando de start
- `railway.json` - Configuração do Railway
- `.github/workflows/railway-deploy.yml` - Deploy automático

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs no Railway
2. Verifique os logs do GitHub Actions (se usar deploy automático)
3. Verifique se todas as variáveis de ambiente estão configuradas
