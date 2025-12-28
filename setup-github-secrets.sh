#!/bin/bash

# Script para configurar secrets no GitHub usando a API
# Token do GitHub - será solicitado ou pode ser definido como variável de ambiente
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
REPO_OWNER="ferramentameegra-cell"
REPO_NAME="ezclipv3"

echo "🔐 Configurando secrets no GitHub..."

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo "📦 Instalando jq..."
    brew install jq 2>/dev/null || echo "⚠️  Instale jq manualmente: brew install jq"
fi

# Obter Railway Token e Project ID
echo "📝 Para configurar os secrets, você precisa:"
echo ""
echo "1. Railway Token:"
echo "   Acesse: https://railway.app/account/tokens"
echo "   Crie um token e cole abaixo"
read -p "Railway Token: " RAILWAY_TOKEN

echo ""
echo "2. Railway Project ID:"
echo "   Acesse seu projeto no Railway"
echo "   O Project ID está na URL ou nas configurações"
read -p "Railway Project ID: " PROJECT_ID

# Configurar secrets via GitHub API
echo ""
echo "📤 Adicionando secrets no GitHub..."

# RAILWAY_TOKEN
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/RAILWAY_TOKEN" \
  -d "{\"encrypted_value\":\"$(echo -n $RAILWAY_TOKEN | base64)\",\"key_id\":\"$(curl -s -H \"Authorization: token $GITHUB_TOKEN\" https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/public-key | jq -r '.key_id')\"}"

# RAILWAY_PROJECT_ID
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/RAILWAY_PROJECT_ID" \
  -d "{\"encrypted_value\":\"$(echo -n $PROJECT_ID | base64)\",\"key_id\":\"$(curl -s -H \"Authorization: token $GITHUB_TOKEN\" https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/public-key | jq -r '.key_id')\"}"

echo ""
echo "✅ Secrets configurados!"
echo ""
echo "🚀 O deploy automático será executado no próximo push para main"

