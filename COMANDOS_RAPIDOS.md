# ⚡ Comandos Rápidos - EZ Clips

## 🔍 Ver Todos os Processos

```bash
# Verificação completa
./manage-processes.sh status

# Verificação rápida
./check-processes.sh

# Ver processos manualmente
ps aux | grep "node src/index.js" | grep -v grep
```

## 🚀 Iniciar Processos

```bash
# Iniciar tudo
./manage-processes.sh start

# Ou usar npm
npm start

# Ou diretamente
node src/index.js
```

## 🛑 Parar Processos

```bash
# Parar tudo
./manage-processes.sh stop

# Ou manualmente
pkill -f "node src/index.js"
```

## 🔄 Reiniciar Processos

```bash
./manage-processes.sh restart
```

## 📊 Status da API

```bash
# Health check
curl http://localhost:8080/health

# Deve retornar: {"status":"ok"}
```

## 📝 Ver Logs

```bash
# Se rodando em background
tail -f server.log

# Se rodando em foreground
# Os logs aparecem no terminal
```

## 🎯 Resumo

**Processo Principal**: `node src/index.js`
- Inclui servidor + workers
- Porta: 8080
- Não precisa de processos separados

**Status Atual**: ✅ Servidor está rodando (PID: 59296)
