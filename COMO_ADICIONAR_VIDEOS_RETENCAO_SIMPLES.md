# 🎬 Como Adicionar Vídeos de Retenção - Guia Rápido

## 📋 Método 1: Upload via API (Recomendado)

### Passo 1: Adicionar o vídeo no modelo

Edite o arquivo `src/models/niches.js` e adicione na seção `RETENTION_VIDEOS`:

```javascript
export const RETENTION_VIDEOS = {
  // ... vídeos existentes ...
  
  'meu-novo-video': {  // ← ID único (sem espaços, minúsculas, hífens)
    id: 'meu-novo-video',
    name: 'Meu Novo Vídeo',
    tags: ['Alta retenção', 'Hipnótico', 'Seguro para TikTok'],
    description: 'Descrição do vídeo de retenção'
  }
};
```

### Passo 2: Fazer upload via API

Use curl, Postman ou qualquer cliente HTTP:

```bash
curl -X POST http://localhost:8080/api/retention/upload \
  -F "video=@/caminho/para/seu-video.mp4" \
  -F "retentionVideoId=meu-novo-video"
```

**Ou via JavaScript (frontend):**

```javascript
const formData = new FormData();
formData.append('video', fileInput.files[0]);
formData.append('retentionVideoId', 'meu-novo-video');

const response = await fetch('/api/retention/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Vídeo adicionado:', result);
```

---

## 📋 Método 2: Adicionar Arquivo Manualmente

### Passo 1: Adicionar no modelo (mesmo do Método 1)

Edite `src/models/niches.js` e adicione o vídeo em `RETENTION_VIDEOS`.

### Passo 2: Copiar arquivo para a pasta

**Desenvolvimento Local:**
```bash
# Criar pasta se não existir
mkdir -p retention-library

# Copiar vídeo (nome deve ser igual ao ID)
cp ~/Downloads/meu-video.mp4 retention-library/meu-novo-video.mp4
```

**Produção (Railway):**
```bash
# A pasta será criada automaticamente em /tmp/retention-library/
# Ou você pode usar um diretório persistente
```

**Estrutura:**
```
ezv2/
  ├── retention-library/
  │   ├── meu-novo-video.mp4  ← Nome deve ser igual ao ID
  │   └── ... outros vídeos
```

---

## 📋 Método 3: Usar URL Externa (Recomendado para Produção)

### Passo 1: Fazer upload para CDN (Cloudinary, Bunny.net, etc.)

Exemplo com Cloudinary:
1. Acesse https://cloudinary.com
2. Faça upload do vídeo
3. Copie a URL pública

### Passo 2: Adicionar URL no modelo

```javascript
export const RETENTION_VIDEOS = {
  'meu-novo-video': {
    id: 'meu-novo-video',
    name: 'Meu Novo Vídeo',
    tags: ['Alta retenção', 'Hipnótico'],
    description: 'Descrição do vídeo',
    url: 'https://res.cloudinary.com/seu-account/video/upload/v1234567/meu-novo-video.mp4' // ← URL aqui
  }
};
```

O sistema detecta automaticamente se é URL ou arquivo local!

---

## ✅ Requisitos do Vídeo

- **Formato:** `.mp4`, `.webm` ou `.mov` (recomendado: `.mp4`)
- **Resolução:** 1080x1920 (vertical 9:16) - ideal para TikTok/Reels
- **Duração:** 10-30 segundos (idealmente)
- **Áudio:** Sem áudio ou áudio baixo (vídeos de retenção são silenciosos)
- **Loop:** Deve fazer loop perfeito (sem cortes bruscos)
- **Tamanho:** Máximo 100MB (via API) ou 50MB (upload customizado)

---

## 🔗 Associar Vídeo a um Nicho (Opcional)

Se quiser que o vídeo apareça em um nicho específico, edite `NICHES`:

```javascript
export const NICHES = {
  podcast: {
    name: 'Podcast',
    // ...
    retentionVideos: [
      'hydraulic-press',
      'meu-novo-video',  // ← Adicione o ID aqui
      // ...
    ]
  }
};
```

---

## 🧪 Testar se Funcionou

### Via API:
```bash
# Listar todos os vídeos
curl http://localhost:8080/api/retention

# Verificar vídeo específico
curl http://localhost:8080/api/retention/video/meu-novo-video

# Ver vídeos de um nicho
curl http://localhost:8080/api/retention/niche/podcast
```

### Via Frontend:
Acesse a plataforma e vá na seção de seleção de vídeo de retenção. O novo vídeo deve aparecer na lista.

---

## 📝 Exemplo Completo

### 1. Adicionar no modelo (`src/models/niches.js`):

```javascript
export const RETENTION_VIDEOS = {
  // ... existentes ...
  
  'cooking-satisfying': {
    id: 'cooking-satisfying',
    name: 'Cozinha Satisfatória',
    tags: ['Alta retenção', 'ASMR', 'Seguro para TikTok'],
    description: 'Vídeo de comida sendo preparada de forma satisfatória',
    url: 'https://res.cloudinary.com/seu-account/video/upload/v1234567/cooking-satisfying.mp4' // Opcional
  }
};
```

### 2. Adicionar ao nicho (opcional):

```javascript
export const NICHES = {
  food: {
    name: 'Comida',
    // ...
    retentionVideos: [
      'cooking-satisfying',  // ← Novo vídeo
      // ...
    ]
  }
};
```

### 3. Fazer upload (se não usar URL):

```bash
curl -X POST http://localhost:8080/api/retention/upload \
  -F "video=@cooking-satisfying.mp4" \
  -F "retentionVideoId=cooking-satisfying"
```

---

## 🐛 Problemas Comuns

### "Vídeo não encontrado"
- ✅ Verifique se o ID no modelo é igual ao nome do arquivo
- ✅ Verifique se o arquivo está na pasta correta
- ✅ Verifique se o servidor foi reiniciado

### "ID não encontrado no modelo"
- ✅ Adicione o vídeo primeiro em `RETENTION_VIDEOS` antes de fazer upload

### "Formato não suportado"
- ✅ Use apenas `.mp4`, `.webm` ou `.mov`
- ✅ Verifique se o arquivo não está corrompido

---

## 📚 Mais Informações

- **Guia Completo:** `COMO_ADICIONAR_VIDEOS_RETENCAO.md`
- **Hospedagem:** `HOSPEDAGEM_VIDEOS_RETENCAO.md`
- **Código:** `src/models/niches.js` (modelo)
- **API:** `src/routes/retention.js` (rotas)
