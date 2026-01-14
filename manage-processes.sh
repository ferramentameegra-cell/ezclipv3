#!/bin/bash

# Script completo para gerenciar processos da aplicação EZ Clips
# Uso: ./manage-processes.sh [check|start|stop|restart|status]

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$(dirname "$0")" || exit 1

ACTION=${1:-status}

# Função para verificar processos
check_processes() {
    echo -e "${BLUE}=========================================="
    echo "  VERIFICAÇÃO DE PROCESSOS"
    echo "==========================================${NC}"
    echo ""
    
    # Servidor principal
    MAIN_PROCESS=$(ps aux | grep "node src/index.js" | grep -v grep)
    if [ -z "$MAIN_PROCESS" ]; then
        echo -e "${RED}❌ Servidor principal: NÃO está rodando${NC}"
        MAIN_PID=""
    else
        MAIN_PID=$(echo "$MAIN_PROCESS" | awk '{print $2}')
        echo -e "${GREEN}✅ Servidor principal: RODANDO (PID: $MAIN_PID)${NC}"
        echo "$MAIN_PROCESS" | awk '{print "   CPU: " $3 "% | Mem: " $4 "% | Tempo: " $10}'
    fi
    echo ""
    
    # Porta 8080
    PORT_PROCESS=$(lsof -i :8080 2>/dev/null | grep LISTEN)
    if [ -z "$PORT_PROCESS" ]; then
        echo -e "${RED}❌ Porta 8080: NÃO está em uso${NC}"
    else
        echo -e "${GREEN}✅ Porta 8080: EM USO${NC}"
    fi
    echo ""
    
    # Workers (se houver processos separados)
    WORKER_PROCESSES=$(ps aux | grep "node worker.js" | grep -v grep)
    if [ -z "$WORKER_PROCESSES" ]; then
        echo -e "${YELLOW}⚠️  Workers separados: NÃO encontrados (normal - workers rodam no mesmo processo)${NC}"
    else
        echo -e "${GREEN}✅ Workers separados encontrados:${NC}"
        echo "$WORKER_PROCESSES" | awk '{print "   PID: " $2 " | CPU: " $3 "% | Mem: " $4 "%"}'
    fi
    echo ""
    
    # Redis
    REDIS_PROCESS=$(ps aux | grep redis-server | grep -v grep)
    if [ -z "$REDIS_PROCESS" ]; then
        echo -e "${YELLOW}⚠️  Redis: NÃO está rodando (opcional - usando memória)${NC}"
    else
        echo -e "${GREEN}✅ Redis: RODANDO${NC}"
    fi
    echo ""
    
    # FFmpeg
    if command -v ffmpeg &> /dev/null; then
        echo -e "${GREEN}✅ FFmpeg: INSTALADO${NC}"
    else
        echo -e "${RED}❌ FFmpeg: NÃO instalado${NC}"
    fi
    echo ""
    
    # Health check
    echo "Testando API..."
    HEALTH=$(curl -s http://localhost:8080/health 2>/dev/null)
    if [ "$HEALTH" = '{"status":"ok"}' ]; then
        echo -e "${GREEN}✅ API: RESPONDENDO${NC}"
    else
        echo -e "${RED}❌ API: NÃO está respondendo${NC}"
    fi
    echo ""
}

# Função para iniciar processos
start_processes() {
    echo -e "${BLUE}=========================================="
    echo "  INICIANDO PROCESSOS"
    echo "==========================================${NC}"
    echo ""
    
    # Verificar se já está rodando
    MAIN_PROCESS=$(ps aux | grep "node src/index.js" | grep -v grep)
    if [ ! -z "$MAIN_PROCESS" ]; then
        echo -e "${YELLOW}⚠️  Servidor já está rodando!${NC}"
        echo "   Use './manage-processes.sh restart' para reiniciar"
        return 1
    fi
    
    # Verificar dependências
    if [ ! -d "node_modules" ]; then
        echo "Instalando dependências..."
        npm install
    fi
    
    # Criar diretórios
    mkdir -p /tmp/uploads /tmp/uploads/series /tmp/uploads/retention /tmp/uploads/retention-custom
    mkdir -p tmp/captions tmp/renders
    
    # Iniciar servidor em background
    echo "Iniciando servidor..."
    nohup node src/index.js > server.log 2>&1 &
    SERVER_PID=$!
    
    sleep 2
    
    # Verificar se iniciou
    if ps -p $SERVER_PID > /dev/null; then
        echo -e "${GREEN}✅ Servidor iniciado (PID: $SERVER_PID)${NC}"
        echo "   Logs: tail -f server.log"
        echo "   Para parar: ./manage-processes.sh stop"
    else
        echo -e "${RED}❌ Erro ao iniciar servidor${NC}"
        echo "   Verifique os logs: cat server.log"
        return 1
    fi
}

# Função para parar processos
stop_processes() {
    echo -e "${BLUE}=========================================="
    echo "  PARANDO PROCESSOS"
    echo "==========================================${NC}"
    echo ""
    
    # Encontrar e parar servidor principal
    MAIN_PROCESS=$(ps aux | grep "node src/index.js" | grep -v grep)
    if [ -z "$MAIN_PROCESS" ]; then
        echo -e "${YELLOW}⚠️  Nenhum processo encontrado para parar${NC}"
        return 0
    fi
    
    MAIN_PID=$(echo "$MAIN_PROCESS" | awk '{print $2}')
    echo "Parando servidor (PID: $MAIN_PID)..."
    kill $MAIN_PID 2>/dev/null
    
    sleep 1
    
    # Verificar se parou
    if ps -p $MAIN_PID > /dev/null 2>&1; then
        echo "Forçando parada..."
        kill -9 $MAIN_PID 2>/dev/null
    fi
    
    # Parar todos os processos relacionados
    pkill -f "node src/index.js" 2>/dev/null
    pkill -f "node worker.js" 2>/dev/null
    
    echo -e "${GREEN}✅ Processos parados${NC}"
}

# Função para reiniciar
restart_processes() {
    echo -e "${BLUE}=========================================="
    echo "  REINICIANDO PROCESSOS"
    echo "==========================================${NC}"
    echo ""
    
    stop_processes
    sleep 2
    start_processes
}

# Função para status detalhado
show_status() {
    check_processes
    
    echo -e "${BLUE}=========================================="
    echo "  INFORMAÇÕES ADICIONAIS"
    echo "==========================================${NC}"
    echo ""
    
    # Verificar arquivos importantes
    echo "Arquivos do projeto:"
    [ -f "package.json" ] && echo -e "  ${GREEN}✅${NC} package.json" || echo -e "  ${RED}❌${NC} package.json"
    [ -f "src/index.js" ] && echo -e "  ${GREEN}✅${NC} src/index.js" || echo -e "  ${RED}❌${NC} src/index.js"
    [ -f ".env" ] && echo -e "  ${GREEN}✅${NC} .env" || echo -e "  ${YELLOW}⚠️${NC}  .env (não encontrado)"
    echo ""
    
    # Verificar diretórios
    echo "Diretórios:"
    [ -d "node_modules" ] && echo -e "  ${GREEN}✅${NC} node_modules" || echo -e "  ${RED}❌${NC} node_modules"
    [ -d "/tmp/uploads" ] && echo -e "  ${GREEN}✅${NC} /tmp/uploads" || echo -e "  ${YELLOW}⚠️${NC}  /tmp/uploads"
    echo ""
    
    # Últimas linhas do log (se existir)
    if [ -f "server.log" ]; then
        echo "Últimas linhas do log:"
        tail -n 5 server.log | sed 's/^/  /'
        echo ""
    fi
}

# Executar ação
case $ACTION in
    check)
        check_processes
        ;;
    start)
        start_processes
        ;;
    stop)
        stop_processes
        ;;
    restart)
        restart_processes
        ;;
    status)
        show_status
        ;;
    *)
        echo "Uso: $0 [check|start|stop|restart|status]"
        echo ""
        echo "Comandos:"
        echo "  check   - Verificar processos rodando"
        echo "  start   - Iniciar todos os processos"
        echo "  stop    - Parar todos os processos"
        echo "  restart - Reiniciar todos os processos"
        echo "  status  - Status detalhado (padrão)"
        exit 1
        ;;
esac
