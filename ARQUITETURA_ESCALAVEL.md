# 🏗️ Arquitetura Escalável SaaS - EZ Clips AI

## 📐 Visão Geral da Arquitetura

Aplicação **stateless** com processamento **assíncrono** e **escalabilidade horizontal**.

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────────┐
│   API Layer     │  ← Stateless, múltiplas instâncias
│  (Express.js)   │
└──────┬──────────┘
       │ Enfileira Jobs
       ▼
┌─────────────────┐
│  Queue Layer    │  ← Redis/Bull (Job Queue)
│   (Bull/Redis)  │
└──────┬──────────┘
       │ Processa Jobs
       ▼
┌─────────────────┐
│  Worker Layer   │  ← Múltiplos workers em paralelo
│  (Background)   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Storage Layer  │  ← Arquivos temporários
│  (Local/S3)     │
└─────────────────┘
```

## 🔄 Componentes Principais

### 1. API Layer (Stateless)

**Arquivo:** `index.js`, `src/controllers/*.js`

**Características:**
- ✅ Stateless - nenhum estado mantido
- ✅ Responde imediatamente (não bloqueia)
- ✅ Enfileira jobs para processamento assíncrono
- ✅ Múltiplas instâncias podem rodar em paralelo

**Fluxo:**
1. Recebe requisição HTTP
2. Valida dados
3. Enfileira job
4. Retorna resposta imediata (jobId)

### 2. Queue Layer (Redis/Bull)

**Arquivo:** `src/queue/queue.js`

**Características:**
- ✅ Usa Redis para gerenciar filas
- ✅ Fallback para memória local (desenvolvimento)
- ✅ Retry automático em caso de falha
- ✅ Limpeza automática de jobs antigos

**Filas:**
- `video-download` - Downloads do YouTube
- `video-process` - Processamento de séries

### 3. Worker Layer (Background Processing)

**Arquivos:** 
- `src/workers/videoDownloadWorker.js`
- `src/workers/videoProcessWorker.js`
- `worker.js`

**Características:**
- ✅ Processa jobs assincronamente
- ✅ Múltiplos workers podem rodar em paralelo
- ✅ Escalabilidade horizontal
- ✅ Processamento sequencial por job (evita sobrecarga)

**Execução:**
```bash
# Worker único (desenvolvimento)
node worker.js

# Múltiplos workers (produção)
node worker.js &  # Worker 1
node worker.js &  # Worker 2
node worker.js &  # Worker 3
```

### 4. Storage Layer

**Arquivo:** `src/services/fileCleanup.js`

**Características:**
- ✅ Armazenamento temporário local
- ✅ Limpeza automática de arquivos antigos
- ✅ Pode ser migrado para S3/Cloud Storage

## 🚀 Escalabilidade Horizontal

### Como Escalar:

1. **API Layer:**
   - Execute múltiplas instâncias do `index.js`
   - Use load balancer (Railway, Nginx, etc.)
   - Cada instância é stateless

2. **Worker Layer:**
   - Execute múltiplos processos `worker.js`
   - Cada worker processa jobs da fila
   - Escala automaticamente com carga

3. **Queue Layer:**
   - Redis pode ser escalado (cluster, replicação)
   - Bull gerencia distribuição de jobs

## 📊 Fluxo Completo

### 1. Download de Vídeo YouTube

```
Cliente → API → Enfileira Job → Retorna jobId
                ↓
            Worker processa download
                ↓
            Atualiza videoStore
                ↓
            Cliente verifica status
```

### 2. Geração de Série

```
Cliente → API → Enfileira Job → Retorna jobId
                ↓
            Worker processa:
              - Valida vídeo baixado
              - Aplica trim
              - Divide em clips
              - Atualiza progresso
                ↓
            Cliente monitora progresso
                ↓
            Download quando completo
```

## 🔒 Confiabilidade

### Retry Automático:
- ✅ Jobs falhos são retentados automaticamente
- ✅ Backoff exponencial (2s, 4s, 8s)
- ✅ Máximo 3 tentativas

### Limpeza Automática:
- ✅ Arquivos temporários removidos após 24h
- ✅ Jobs completos mantidos por 1h
- ✅ Jobs falhos mantidos por 24h (debug)

### Processamento Seguro:
- ✅ Clips processados sequencialmente (evita sobrecarga)
- ✅ Validação de arquivos antes de processar
- ✅ Limpeza de arquivos corrompidos

## ⚙️ Configuração

### Variáveis de Ambiente:

```env
# Redis (opcional - fallback para memória)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Workers
ENABLE_WORKERS=true
ENABLE_CLEANUP=true
CLEANUP_INTERVAL_HOURS=6

# Node.js
NODE_ENV=production
PORT=3000
```

### Railway Deployment:

1. **API Service:**
   - Command: `node index.js`
   - Instâncias: Múltiplas (auto-scaling)

2. **Worker Service (Opcional):**
   - Command: `node worker.js`
   - Instâncias: 1-3 (conforme carga)

3. **Redis (Opcional):**
   - Use Railway Redis plugin
   - Ou serviço externo (Upstash, etc.)

## ✅ Validações Implementadas

- [x] Aplicação stateless
- [x] Processamento assíncrono
- [x] Job queue (Redis/Bull)
- [x] Workers em background
- [x] Escalabilidade horizontal
- [x] Retry automático
- [x] Limpeza de arquivos
- [x] Processamento seguro
- [x] Compatível com Railway

## 🎯 Benefícios

1. **Performance:**
   - API responde imediatamente
   - Processamento não bloqueia requisições

2. **Escalabilidade:**
   - Adicione mais workers conforme necessário
   - API pode escalar horizontalmente

3. **Confiabilidade:**
   - Retry automático
   - Isolamento de erros
   - Limpeza automática

4. **Manutenibilidade:**
   - Código separado por responsabilidade
   - Fácil de testar e debugar

## 📝 Próximos Passos (Opcional)

- [ ] Migrar storage para S3/Cloud Storage
- [ ] Adicionar métricas (Prometheus, etc.)
- [ ] Implementar rate limiting
- [ ] Adicionar cache (Redis)
- [ ] Monitoramento de filas

---

**Status:** ✅ Arquitetura escalável implementada e pronta para produção!


