#!/bin/bash

# Script para configurar deploy automático no Railway
# Execute: bash railway-setup.sh

# GITHUB_TOKEN será solicitado ou pode ser definido como variável de ambiente
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

echo "🔐 Configurando deploy automático..."

# Verificar se Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "📦 Instalando Railway CLI..."
    npm install -g @railway/cli
fi

# Fazer login no Railway
echo "🔑 Fazendo login no Railway..."
railway login

# Criar novo projeto ou linkar existente
echo "📝 Configurando projeto Railway..."
read -p "Deseja criar um novo projeto? (s/n): " create_new

if [ "$create_new" = "s" ]; then
    railway init
else
    read -p "Cole o Project ID do Railway: " project_id
    railway link $project_id
fi

# Obter Railway Token
echo "🔑 Obtendo Railway Token..."
RAILWAY_TOKEN=$(railway tokens create --json | jq -r '.token')

if [ -z "$RAILWAY_TOKEN" ]; then
    echo "⚠️  Não foi possível obter o token automaticamente."
    echo "📋 Acesse: https://railway.app/account/tokens"
    echo "📋 Crie um token e adicione como secret RAILWAY_TOKEN no GitHub"
    read -p "Cole o Railway Token aqui: " RAILWAY_TOKEN
fi

# Configurar secrets no GitHub via API
echo "🔐 Configurando secrets no GitHub..."

# Obter Project ID
PROJECT_ID=$(railway status --json | jq -r '.project.id' 2>/dev/null || echo "")

if [ -z "$PROJECT_ID" ]; then
    read -p "Cole o Project ID do Railway: " PROJECT_ID
fi

# Adicionar secrets no GitHub
REPO_OWNER="ferramentameegra-cell"
REPO_NAME="ezclipv3"

echo "📤 Adicionando secrets no GitHub..."

# Usar GitHub CLI se disponível, senão usar API
if command -v gh &> /dev/null; then
    echo "$RAILWAY_TOKEN" | gh secret set RAILWAY_TOKEN --repo $REPO_OWNER/$REPO_NAME
    echo "$PROJECT_ID" | gh secret set RAILWAY_PROJECT_ID --repo $REPO_OWNER/$REPO_NAME
    echo "✅ Secrets configurados via GitHub CLI"
else
    echo "⚠️  GitHub CLI não encontrado. Configure manualmente:"
    echo ""
    echo "1. Acesse: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
    echo "2. Adicione os seguintes secrets:"
    echo "   - RAILWAY_TOKEN: $RAILWAY_TOKEN"
    echo "   - RAILWAY_PROJECT_ID: $PROJECT_ID"
    echo ""
fi

echo "✅ Configuração concluída!"
echo ""
echo "🚀 Próximos passos:"
echo "1. Faça push das alterações: git push origin main"
echo "2. O deploy automático será executado via GitHub Actions"
echo "3. Acompanhe o deploy em: https://github.com/$REPO_OWNER/$REPO_NAME/actions"

