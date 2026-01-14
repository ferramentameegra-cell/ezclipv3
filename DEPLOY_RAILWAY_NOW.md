# 🚀 Deploy no Railway - Instruções

## Status Atual

✅ **Código no GitHub:** Todos os commits estão na branch `main`
✅ **Layout Vertical 9:16:** Implementado e testado
✅ **Background Fixo:** Configurado
✅ **Sem Tarjas Pretas:** Corrigido

## Opções de Deploy

### Opção 1: Deploy Automático (Recomendado)

O Railway está configurado para fazer deploy automático quando há push na branch `main`.

**Status:** Se o Railway estiver conectado ao GitHub, o deploy já foi acionado automaticamente.

**Verificar:**
1. Acesse: https://railway.app
2. Vá para seu projeto
3. Verifique a aba "Deployments"
4. O último deploy deve estar em andamento ou concluído

### Opção 2: Deploy Manual via Railway CLI

Se preferir fazer deploy manual:

```bash
# 1. Instalar Railway CLI (se não tiver)
npm install -g @railway/cli

# 2. Fazer login
railway login

# 3. Linkar ao projeto (se necessário)
railway link

# 4. Fazer deploy
railway up
```

### Opção 3: Deploy via GitHub Actions

O workflow `.github/workflows/railway-deploy.yml` está configurado.

**Para acionar manualmente:**
1. Acesse: https://github.com/ferramentameegra-cell/ezclipv3/actions
2. Selecione "Railway Deploy"
3. Clique em "Run workflow"

## Verificações Pós-Deploy

Após o deploy, verifique:

1. ✅ **Background Fixo:**
   - A imagem deve estar em `/tmp/assets/backgrounds/ezclip-background.png`
   - Ou configure `FIXED_BACKGROUND_PATH` como variável de ambiente

2. ✅ **Formato 9:16:**
   - Todos os vídeos devem ser gerados em 1080x1920
   - Verifique os logs: `[COMPOSER] ⚠️ Formato forçado para 9:16`

3. ✅ **Layout Vertical:**
   - Vídeo principal no topo
   - Headline no centro
   - Vídeo de retenção na parte inferior

4. ✅ **Sem Tarjas Pretas:**
   - Background deve aparecer nas áreas vazias
   - Verifique os logs: `[COMPOSER] Background fixo aplicado como layer 0`

## Variáveis de Ambiente Necessárias

Certifique-se de que estas variáveis estão configuradas no Railway:

- `NODE_ENV=production`
- `PORT=8080` (ou a porta configurada)
- `FIXED_BACKGROUND_PATH` (opcional, se background estiver em local diferente)
- Outras variáveis do seu projeto (Redis, etc.)

## Logs do Deploy

Para ver os logs do deploy no Railway:

```bash
railway logs
```

Ou acesse o dashboard do Railway e veja os logs em tempo real.

## Troubleshooting

Se o deploy falhar:

1. Verifique os logs: `railway logs`
2. Verifique se o `nixpacks.toml` está correto
3. Verifique se todas as dependências estão instaladas
4. Verifique se o background está acessível

## Próximos Passos

Após o deploy bem-sucedido:

1. Teste gerando um vídeo
2. Verifique se o formato é 9:16 (1080x1920)
3. Verifique se não há tarjas pretas
4. Verifique se o background aparece corretamente
