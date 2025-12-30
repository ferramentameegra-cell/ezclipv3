#!/bin/bash

# Script de deploy no Railway
# Execute: bash railway-deploy.sh

echo "🚀 Iniciando deploy no Railway..."

# Verificar se Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "📦 Instalando Railway CLI..."
    npm install -g @railway/cli
fi

# Verificar se está logado
echo "🔐 Verificando login..."
railway whoami || railway login

# Inicializar projeto se necessário
if [ ! -f ".railway/railway.json" ]; then
    echo "📝 Inicializando projeto Railway..."
    railway init
fi

# Fazer deploy
echo "📤 Fazendo deploy..."
railway up

echo "✅ Deploy concluído!"
echo "🌐 Acesse o dashboard do Railway para ver a URL do seu projeto"


