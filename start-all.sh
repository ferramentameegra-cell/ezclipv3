#!/bin/bash

# Script para iniciar todos os processos da aplicação EZ Clips

echo "=========================================="
echo "  EZ CLIPS - INICIANDO PROCESSOS"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ir para o diretório do projeto
cd "$(dirname "$0")" || exit 1

# Verificar se já está rodando
MAIN_PROCESS=$(ps aux | grep "node src/index.js" | grep -v grep)
if [ ! -z "$MAIN_PROCESS" ]; then
    echo -e "${YELLOW}⚠️  Servidor já está rodando!${NC}"
    echo ""
    echo "Processo encontrado:"
    echo "$MAIN_PROCESS" | awk '{print "   PID: " $2 " | CPU: " $3 "% | Mem: " $4 "%"}'
    echo ""
    read -p "Deseja parar e reiniciar? (s/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "Parando processo existente..."
        pkill -f "node src/index.js"
        sleep 2
    else
        echo "Mantendo processo existente."
        exit 0
    fi
fi

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não está instalado!${NC}"
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não está instalado!${NC}"
    exit 1
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
    echo "   Criando .env básico..."
    cat > .env << EOF
PORT=8080
NODE_ENV=production
VIDEO_PROCESS_CONCURRENCY=10
EOF
    echo -e "${GREEN}✅ Arquivo .env criado${NC}"
fi

# Verificar dependências
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules não encontrado${NC}"
    echo "   Instalando dependências..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erro ao instalar dependências${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependências instaladas${NC}"
fi

# Criar diretórios necessários
echo "Criando diretórios necessários..."
mkdir -p /tmp/uploads
mkdir -p /tmp/uploads/series
mkdir -p /tmp/uploads/retention
mkdir -p /tmp/uploads/retention-custom
mkdir -p tmp/captions
mkdir -p tmp/renders
echo -e "${GREEN}✅ Diretórios criados${NC}"

# Iniciar servidor
echo ""
echo "=========================================="
echo "  INICIANDO SERVIDOR"
echo "=========================================="
echo ""
echo -e "${GREEN}🚀 Iniciando servidor Node.js...${NC}"
echo "   Porta: 8080"
echo "   Arquivo: src/index.js"
echo ""
echo "   Para parar: Ctrl+C ou pkill -f 'node src/index.js'"
echo ""
echo "=========================================="
echo ""

# Iniciar o servidor
npm start
