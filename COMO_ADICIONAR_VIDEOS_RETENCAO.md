# 📹 Como Adicionar Vídeos de Retenção

Este guia explica as **3 formas** de adicionar vídeos de retenção ao sistema.

---

## 📋 **Forma 1: Upload via API (Recomendado para produção)**

### Passo 1: Adicionar o metadado do vídeo

Edite o arquivo `src/models/niches.js` e adicione o novo vídeo em `RETENTION_VIDEOS`:

```javascript
export const RETENTION_VIDEOS = {
  // ... vídeos existentes ...
  
  'meu-novo-video': {
    id: 'meu-novo-video',
    name: 'Meu Novo Vídeo',
    tags: ['Alta retenção', 'Hipnótico'],
    description: 'Descrição do meu novo vídeo de retenção'
  }
};
```

### Passo 2: Associar ao nicho (opcional)

Se quiser que o vídeo apareça em um nicho específico, adicione o ID na lista `retentionVideos` do nicho:

```javascript
export const NICHES = {
  podcast: {
    id: 'podcast',
    name: 'Podcast',
    // ...
    retentionVideos: [
      'hydraulic-press',
      'meu-novo-video',  // ← Adicione aqui
      // ...
    ]
  }
};
```

### Passo 3: Fazer upload do arquivo

**Via cURL:**
```bash
curl -X POST http://localhost:8080/api/retention/upload \
  -F "video=@/caminho/para/meu-video.mp4" \
  -F "retentionVideoId=meu-novo-video"
```

**Via Postman/Insomnia:**
- Method: `POST`
- URL: `http://localhost:8080/api/retention/upload`
- Body: `form-data`
  - Campo 1: `video` (type: file) → selecione o arquivo .mp4
  - Campo 2: `retentionVideoId` (type: text) → `meu-novo-video`

### ✅ Verificar se foi adicionado

```bash
curl http://localhost:8080/api/retention/video/meu-novo-video
```

Resposta esperada:
```json
{
  "id": "meu-novo-video",
  "path": "/tmp/retention-library/meu-novo-video.mp4",
  "name": "Meu Novo Vídeo",
  "exists": true
}
```

---

## 📁 **Forma 2: Adicionar manualmente (Mais rápido para desenvolvimento)**

### Passo 1: Adicionar o metadado

Mesmo processo da **Forma 1 - Passo 1**.

### Passo 2: Copiar arquivo para o diretório

**Em desenvolvimento:**
```bash
# Diretório na raiz do projeto
cp meu-video.mp4 retention-library/meu-novo-video.mp4
```

**Em produção (Railway):**
```bash
# Os arquivos serão salvos em /tmp/retention-library/
# Nota: Arquivos em /tmp são temporários e serão perdidos ao reiniciar
# Para produção, use upload via API ou configure armazenamento persistente
```

### ✅ Verificar

```bash
ls retention-library/meu-novo-video.mp4
```

---

## 🔄 **Forma 3: Via Interface Web (Futuro)**

Uma interface de administração será criada no futuro para facilitar o upload de vídeos de retenção diretamente pelo navegador.

---

## 📊 **Verificar todos os vídeos disponíveis**

```bash
curl http://localhost:8080/api/retention/
```

Retorna todos os vídeos de retenção com status de disponibilidade:
```json
{
  "videos": [
    {
      "id": "hydraulic-press",
      "name": "Prensa Hidráulica",
      "tags": ["Alta retenção", "Hipnótico", "Seguro para TikTok"],
      "description": "Loop de prensa hidráulica comprimindo objetos",
      "path": "/tmp/retention-library/hydraulic-press.mp4",
      "exists": true  // ← true se o arquivo existe
    },
    {
      "id": "satisfying-loops",
      "name": "Loops Satisfatórios",
      // ...
      "exists": false  // ← false se o arquivo não foi adicionado ainda
    }
  ]
}
```

---

## 🎯 **Boas Práticas**

### Requisitos dos vídeos:
- ✅ **Formato**: MP4, WebM ou MOV
- ✅ **Tamanho máximo**: 100MB (via API) ou ilimitado (manual)
- ✅ **Resolução recomendada**: 1080x1920 (9:16 vertical)
- ✅ **Duração**: Loops curtos (5-30 segundos)
- ✅ **Áudio**: Preferencialmente sem áudio (ou loopável)
- ✅ **Qualidade**: Alta qualidade para não perder qualidade ao redimensionar

### Nomes de arquivo:
- ✅ Use o mesmo ID do metadado: `meu-novo-video.mp4`
- ✅ Sempre use minúsculas e hífens: `meu-video-retention.mp4`
- ❌ Evite espaços: `meu video.mp4` (errado)

### Organização:
- ✅ Mantenha um backup dos vídeos fora do projeto
- ✅ Documente a fonte/origem de cada vídeo
- ✅ Teste os vídeos antes de adicionar à produção

---

## 🔍 **Resolução de Problemas**

### Erro: "Vídeo de retenção não encontrado no modelo"
**Solução**: Adicione o metadado primeiro em `src/models/niches.js` antes de fazer upload.

### Erro: "Arquivo não encontrado"
**Solução**: Verifique se o nome do arquivo corresponde ao ID:
- ID: `hydraulic-press`
- Arquivo: `hydraulic-press.mp4` ✅
- Arquivo: `HydraulicPress.mp4` ❌

### Vídeo não aparece na lista do nicho
**Solução**: Adicione o ID do vídeo na lista `retentionVideos` do nicho em `src/models/niches.js`.

### Arquivo não persiste em produção (Railway)
**Solução**: Em produção, use armazenamento persistente (Cloudflare R2, S3) ou configure o Railway com volumes persistentes. Por enquanto, use upload via API a cada deploy.

---

## 📚 **Exemplo Completo**

### Adicionar vídeo "fogo-abstrato" ao nicho "motivacional"

1. **Editar `src/models/niches.js`:**

```javascript
export const RETENTION_VIDEOS = {
  // ... existentes ...
  'fogo-abstrato': {
    id: 'fogo-abstrato',
    name: 'Fogo Abstrato',
    tags: ['Hipnótico', 'Alta retenção', 'Visual'],
    description: 'Chamas abstratas em loop'
  }
};

export const NICHES = {
  motivacional: {
    id: 'motivacional',
    name: 'Motivacional',
    // ...
    retentionVideos: [
      'sunset-timelapse',
      'ocean-waves',
      'fogo-abstrato',  // ← Adicionar aqui
      'satisfying-loops',
      'abstract-flow'
    ]
  }
};
```

2. **Fazer upload:**
```bash
curl -X POST http://localhost:8080/api/retention/upload \
  -F "video=@fogo-abstrato.mp4" \
  -F "retentionVideoId=fogo-abstrato"
```

3. **Verificar:**
```bash
curl http://localhost:8080/api/retention/niche/motivacional | jq '.videos[] | select(.id == "fogo-abstrato")'
```

---

## 🚀 **Próximos Passos**

Após adicionar os vídeos de retenção, eles serão automaticamente:
- ✅ Disponibilizados na API
- ✅ Listados por nicho
- ✅ Usados pelo sistema de geração de séries (quando implementado)

**Nota**: O overlay de vídeo de retenção nos clips ainda está em desenvolvimento. Os vídeos serão aplicados automaticamente quando essa funcionalidade for finalizada.
