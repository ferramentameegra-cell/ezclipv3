# Deploy no Railway - Instruções

## Status
✅ Código commitado e enviado para GitHub
✅ Workflow de deploy configurado
✅ Correções aplicadas:
   - Rolagem automática melhorada (só rola se elemento não estiver visível)
   - Clicáveis garantidos (pointer-events corrigidos)
   - Smooth scroll global adicionado

## Deploy Automático

O deploy será feito automaticamente via GitHub Actions quando houver push para `main`.

### Verificar Deploy

1. Acesse: https://github.com/ferramentameegra-cell/ezclipv3/actions
2. Verifique se o workflow "Railway Deploy" está rodando ou foi concluído
3. Se necessário, acione manualmente:
   - Vá em "Actions" > "Railway Deploy" > "Run workflow"

## Deploy Manual (se necessário)

Se o deploy automático não funcionar, você pode fazer manualmente:

### Opção 1: Via Railway Dashboard
1. Acesse: https://railway.app
2. Selecione o projeto
3. Clique em "Deploy" ou "Redeploy"

### Opção 2: Via Railway CLI
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link ao projeto (se necessário)
railway link

# Deploy
railway up
```

## Variáveis de Ambiente Necessárias

Certifique-se de que estas variáveis estão configuradas no Railway:

- `NODE_ENV=production`
- `JWT_SECRET` (secreto JWT para autenticação)
- `YT_DLP_COOKIES_PATH` (opcional - caminho para cookies)
- `YTDLP_COOKIES` (opcional - cookies do YouTube em formato texto)
- `RAILWAY_PUBLIC_DOMAIN` (será definido automaticamente pelo Railway)

## Verificar Logs

Após o deploy, verifique os logs no Railway:
1. Acesse o projeto no Railway
2. Vá em "Deployments" > selecione o deployment mais recente
3. Clique em "View Logs"

## Troubleshooting

Se o deploy falhar:

1. Verifique os logs do build no Railway
2. Verifique se todas as dependências estão no `package.json`
3. Verifique se o `nixpacks.toml` está correto
4. Verifique se o `railway.json` está configurado corretamente

## Últimas Correções Aplicadas

- ✅ Rolagem automática melhorada (verifica visibilidade antes de rolar)
- ✅ Clicáveis garantidos (CSS e JavaScript corrigidos)
- ✅ Smooth scroll global
- ✅ Erro de formato yt-dlp corrigido
- ✅ Auth-section não bloqueia mais cliques
