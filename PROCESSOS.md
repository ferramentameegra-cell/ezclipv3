# 🔄 Gerenciamento de Processos - EZ Clips

## 📊 Status Atual dos Processos

### ✅ Processo Principal (Servidor)
- **Status**: ✅ RODANDO
- **PID**: 59296
- **Porta**: 8080
- **Arquivo**: `src/index.js`
- **Workers**: Incluídos no mesmo processo (não precisa de processos separados)

### ⚠️ Processos Opcionais
- **Redis**: Não está rodando (opcional - usando memória)
- **Workers Separados**: Não necessário (workers rodam no servidor principal)

## 🛠️ Scripts de Gerenciamento

### 1. Verificar Status Completo
```bash
./manage-processes.sh status
```

### 2. Verificar Processos Rápidos
```bash
./check-processes.sh
```

### 3. Iniciar Todos os Processos
```bash
./manage-processes.sh start
# ou
./start-all.sh
```

### 4. Parar Todos os Processos
```bash
./manage-processes.sh stop
```

### 5. Reiniciar Todos os Processos
```bash
./manage-processes.sh restart
```

## 📋 Processos da Aplicação

### Processo Principal
- **Nome**: Servidor Node.js
- **Comando**: `node src/index.js`
- **Porta**: 8080
- **Funcionalidades**:
  - API REST (Express)
  - Workers de processamento de vídeo (integrados)
  - Sistema de filas (Bull/Mock)
  - Rate limiting
  - Limpeza automática de arquivos

### Workers (Integrados)
Os workers rodam **dentro do processo principal**, não precisam de processos separados:
- `videoProcessWorker.js` - Processa geração de séries de clipes
- `videoDownloadWorker.js` - Processa downloads do YouTube

**Nota**: Se você quiser escalar horizontalmente, pode executar `node worker.js` em processos separados, mas não é necessário para funcionamento básico.

## 🔍 Verificação Manual

### Ver processos Node.js
```bash
ps aux | grep "node src/index.js" | grep -v grep
```

### Ver porta 8080
```bash
lsof -i :8080
```

### Testar API
```bash
curl http://localhost:8080/health
```

### Ver logs
```bash
tail -f server.log
# ou se estiver rodando em foreground
# os logs aparecem no terminal
```

## 🚨 Solução de Problemas

### Processo não está rodando
```bash
# Iniciar
./manage-processes.sh start

# Verificar erros
cat server.log
```

### Porta 8080 já está em uso
```bash
# Ver qual processo está usando
lsof -i :8080

# Parar processo existente
./manage-processes.sh stop

# Ou matar processo específico
kill -9 <PID>
```

### Processo travado
```bash
# Parar todos os processos Node.js relacionados
pkill -f "node src/index.js"

# Reiniciar
./manage-processes.sh restart
```

## 📝 Notas Importantes

1. **Um único processo**: O servidor principal (`src/index.js`) já inclui todos os workers necessários. Não é necessário rodar processos separados.

2. **Redis é opcional**: Se não houver Redis configurado, o sistema usa filas mock em memória, que funcionam perfeitamente para desenvolvimento e produção pequena/média.

3. **Workers separados**: Só são necessários se você quiser escalar horizontalmente (múltiplos servidores processando jobs).

4. **FFmpeg obrigatório**: O FFmpeg deve estar instalado para processamento de vídeo funcionar.

## 🎯 Comandos Rápidos

```bash
# Status completo
./manage-processes.sh status

# Iniciar
./manage-processes.sh start

# Parar
./manage-processes.sh stop

# Reiniciar
./manage-processes.sh restart
```
