# 🚀 Guia de Deploy no Railway

## Opção 1: Deploy via GitHub (Recomendado)

1. Acesse [railway.app](https://railway.app)
2. Faça login com sua conta GitHub
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Escolha o repositório: `ferramentameegra-cell/ezclipv3`
6. O Railway detectará automaticamente a configuração e fará o deploy

## Opção 2: Deploy via Railway CLI

1. Instale o Railway CLI:
```bash
npm install -g @railway/cli
```

2. Faça login:
```bash
railway login
```

3. Inicialize o projeto:
```bash
railway init
```

4. Faça o deploy:
```bash
railway up
```

## Variáveis de Ambiente

Configure as seguintes variáveis no Railway Dashboard:

- `PORT` - Será definido automaticamente pelo Railway
- `NODE_ENV=production`
- `R2_ACCOUNT_ID` - (Opcional) ID da conta Cloudflare R2
- `R2_ACCESS_KEY_ID` - (Opcional) Access Key do R2
- `R2_SECRET_ACCESS_KEY` - (Opcional) Secret Key do R2
- `R2_BUCKET_NAME` - (Opcional) Nome do bucket R2
- `R2_ENDPOINT` - (Opcional) Endpoint do R2

## Verificação

Após o deploy, você receberá uma URL como:
`https://seu-projeto.railway.app`

Acesse para verificar se está funcionando:
- `https://seu-projeto.railway.app/` - Status da API
- `https://seu-projeto.railway.app/health` - Health check

## Observações

- O Railway detectará automaticamente o `Procfile` ou `package.json` para iniciar o servidor
- O arquivo `nixpacks.toml` garante que FFmpeg seja instalado
- Os uploads serão armazenados temporariamente no sistema de arquivos do Railway (volátil)
- Para armazenamento persistente, configure o Cloudflare R2


