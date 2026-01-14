#!/bin/bash

# Script para verificar e listar todos os processos da aplicação EZ Clips

echo "=========================================="
echo "  EZ CLIPS - VERIFICAÇÃO DE PROCESSOS"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar processo principal (servidor Node.js)
echo "1. PROCESSO PRINCIPAL (Servidor Node.js)"
echo "----------------------------------------"
MAIN_PROCESS=$(ps aux | grep "node src/index.js" | grep -v grep)
if [ -z "$MAIN_PROCESS" ]; then
    echo -e "${RED}❌ Servidor principal NÃO está rodando${NC}"
    echo "   Execute: npm start ou node src/index.js"
else
    echo -e "${GREEN}✅ Servidor principal está rodando${NC}"
    echo "$MAIN_PROCESS" | awk '{print "   PID: " $2 " | CPU: " $3 "% | Mem: " $4 "% | Comando: " $11 " " $12 " " $13}'
fi
echo ""

# 2. Verificar porta 8080
echo "2. PORTA 8080 (Servidor HTTP)"
echo "----------------------------------------"
PORT_PROCESS=$(lsof -i :8080 2>/dev/null)
if [ -z "$PORT_PROCESS" ]; then
    echo -e "${RED}❌ Nenhum processo usando a porta 8080${NC}"
else
    echo -e "${GREEN}✅ Porta 8080 está em uso${NC}"
    echo "$PORT_PROCESS" | tail -n +2 | awk '{print "   PID: " $2 " | Processo: " $1}'
fi
echo ""

# 3. Verificar processos Node.js relacionados
echo "3. TODOS OS PROCESSOS NODE.JS"
echo "----------------------------------------"
NODE_PROCESSES=$(ps aux | grep -E "node.*ezv2|node.*src/index|node.*worker" | grep -v grep)
if [ -z "$NODE_PROCESSES" ]; then
    echo -e "${YELLOW}⚠️  Nenhum processo Node.js relacionado encontrado${NC}"
else
    echo -e "${GREEN}✅ Processos Node.js encontrados:${NC}"
    echo "$NODE_PROCESSES" | awk '{print "   PID: " $2 " | CPU: " $3 "% | Mem: " $4 "% | " substr($0, index($0,$11))}'
fi
echo ""

# 4. Verificar Redis (se configurado)
echo "4. REDIS (Opcional)"
echo "----------------------------------------"
REDIS_PROCESS=$(ps aux | grep redis-server | grep -v grep)
if [ -z "$REDIS_PROCESS" ]; then
    echo -e "${YELLOW}⚠️  Redis não está rodando (opcional - usando memória)${NC}"
else
    echo -e "${GREEN}✅ Redis está rodando${NC}"
    echo "$REDIS_PROCESS" | awk '{print "   PID: " $2 " | CPU: " $3 "% | Mem: " $4 "%"}'
fi
echo ""

# 5. Verificar FFmpeg
echo "5. FFMPEG (Verificação)"
echo "----------------------------------------"
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version 2>/dev/null | head -n 1)
    echo -e "${GREEN}✅ FFmpeg está instalado${NC}"
    echo "   $FFMPEG_VERSION"
else
    echo -e "${RED}❌ FFmpeg NÃO está instalado${NC}"
    echo "   Instale com: brew install ffmpeg (macOS) ou apt-get install ffmpeg (Linux)"
fi
echo ""

# 6. Verificar variáveis de ambiente
echo "6. VARIÁVEIS DE AMBIENTE"
echo "----------------------------------------"
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ Arquivo .env encontrado${NC}"
    ENV_VARS=$(grep -E "^(PORT|REDIS_URL|OPENAI_API_KEY|VIDEO_PROCESS_CONCURRENCY)=" .env 2>/dev/null | sed 's/=.*/=***/' || echo "   Nenhuma variável relevante encontrada")
    if [ ! -z "$ENV_VARS" ]; then
        echo "$ENV_VARS"
    fi
else
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
fi
echo ""

# 7. Resumo e comandos
echo "=========================================="
echo "  RESUMO E COMANDOS"
echo "=========================================="
echo ""

if [ -z "$MAIN_PROCESS" ]; then
    echo -e "${YELLOW}Para iniciar o servidor:${NC}"
    echo "   cd /Users/josyasborba/Desktop/ezv2"
    echo "   npm start"
    echo ""
    echo "   ou"
    echo ""
    echo "   node src/index.js"
    echo ""
fi

echo "Para ver logs em tempo real:"
echo "   tail -f logs/app.log (se existir)"
echo ""
echo "Para parar todos os processos:"
echo "   pkill -f 'node src/index.js'"
echo ""
echo "Para verificar saúde da API:"
echo "   curl http://localhost:8080/health"
echo ""
