# 🔐 Configurar Secrets no GitHub

Para o deploy automático funcionar, você precisa configurar os seguintes secrets no GitHub:

## Passo 1: Obter Railway Token

1. Acesse: https://railway.app/account/tokens
2. Clique em "New Token"
3. Dê um nome (ex: "GitHub Actions Deploy")
4. Copie o token gerado

## Passo 2: Obter Railway Project ID

1. Acesse seu projeto no Railway: https://railway.app
2. Vá em Settings do projeto
3. Copie o "Project ID" ou encontre na URL do projeto

## Passo 3: Adicionar Secrets no GitHub

1. Acesse: https://github.com/ferramentameegra-cell/ezclipv3/settings/secrets/actions
2. Clique em "New repository secret"
3. Adicione os seguintes secrets:

### Secret 1: RAILWAY_TOKEN
- Name: `RAILWAY_TOKEN`
- Value: (cole o token do passo 1)

### Secret 2: RAILWAY_PROJECT_ID (Opcional)
- Name: `RAILWAY_PROJECT_ID`
- Value: (cole o Project ID do passo 2)

## Passo 4: Verificar Deploy

Após configurar os secrets:
1. Faça um push para a branch `main`
2. Acesse: https://github.com/ferramentameegra-cell/ezclipv3/actions
3. Verifique se o workflow "Auto Deploy to Railway" está executando

## Alternativa: Usar Script

Execute o script para configurar automaticamente:

```bash
bash setup-github-secrets.sh
```

**Nota:** O script requer que você tenha `jq` instalado e forneça o Railway Token e Project ID quando solicitado.



