# 📹 Passo a Passo Detalhado: Upload de Vídeos de Retenção

Este guia mostra **exatamente** como fazer upload de vídeos de retenção, com todos os detalhes e exemplos práticos.

---

## 🎯 **Pré-requisitos**

Antes de começar, verifique:
- ✅ Servidor rodando em `http://localhost:8080`
- ✅ Você tem os arquivos de vídeo (MP4, WebM ou MOV)
- ✅ Editor de código para editar `src/models/niches.js`

---

## 📋 **MÉTODO 1: Upload via API (Recomendado)**

### **Passo 1: Preparar o arquivo de vídeo**

1. Certifique-se que o arquivo está em um dos formatos suportados:
   - ✅ `.mp4` (recomendado)
   - ✅ `.webm`
   - ✅ `.mov`

2. Verifique o tamanho:
   - Limite via API: 100MB
   - Recomendado: arquivos pequenos (5-30 segundos, loops)

3. Escolha um **ID único** para o vídeo (será usado como nome do arquivo):
   - Exemplo: `meu-video-retention`
   - Use apenas letras minúsculas, números e hífens
   - ❌ Sem espaços, acentos ou caracteres especiais

---

### **Passo 2: Adicionar metadado do vídeo**

1. Abra o arquivo `src/models/niches.js` no editor

2. Localize a seção `RETENTION_VIDEOS` (linha ~70)

3. Adicione o novo vídeo seguindo o formato:

```javascript
export const RETENTION_VIDEOS = {
  'hydraulic-press': {
    id: 'hydraulic-press',
    name: 'Prensa Hidráulica',
    tags: ['Alta retenção', 'Hipnótico', 'Seguro para TikTok'],
    description: 'Loop de prensa hidráulica comprimindo objetos'
  },
  // ... outros vídeos existentes ...
  
  // ⬇️ ADICIONE SEU NOVO VÍDEO AQUI
  'meu-video-retention': {
    id: 'meu-video-retention',
    name: 'Meu Vídeo de Retenção',
    tags: ['Alta retenção', 'Hipnótico'],
    description: 'Descrição do meu vídeo de retenção'
  }
};
```

**Explicação dos campos:**
- `id`: ID único do vídeo (mesmo nome que será usado no arquivo)
- `name`: Nome exibido na interface
- `tags`: Array de tags para categorização
- `description`: Descrição do vídeo

**Exemplo completo:**

```javascript
'fogo-abstrato': {
  id: 'fogo-abstrato',
  name: 'Fogo Abstrato',
  tags: ['Hipnótico', 'Alta retenção', 'Visual', 'Seguro para TikTok'],
  description: 'Chamas abstratas em loop perfeito para retenção'
}
```

4. Salve o arquivo (`Cmd+S` ou `Ctrl+S`)

5. **Reinicie o servidor** para que as mudanças tenham efeito:
   ```bash
   # Pare o servidor (Ctrl+C no terminal onde está rodando)
   # Depois inicie novamente:
   npm start
   ```

---

### **Passo 3: Associar o vídeo a um nicho (Opcional)**

Se você quiser que o vídeo apareça na lista de um nicho específico:

1. No mesmo arquivo `src/models/niches.js`, localize a seção `NICHES`

2. Encontre o nicho desejado (ex: `podcast`, `educacao`, `motivacional`, etc.)

3. Adicione o ID do vídeo na lista `retentionVideos`:

```javascript
export const NICHES = {
  podcast: {
    id: 'podcast',
    name: 'Podcast',
    description: 'Conversas, entrevistas e debates',
    retentionVideos: [
      'hydraulic-press',
      'satisfying-loops',
      'meu-video-retention',  // ⬅️ ADICIONE AQUI
      'timelapse-abstract',
      'mechanical-loop'
    ],
    // ...
  },
  // ... outros nichos ...
};
```

4. Salve o arquivo e reinicie o servidor

---

### **Passo 4: Fazer upload do arquivo via API**

#### **Opção A: Usando cURL (Terminal/Mac/Linux)**

```bash
curl -X POST http://localhost:8080/api/retention/upload \
  -F "video=@/caminho/para/meu-video-retention.mp4" \
  -F "retentionVideoId=meu-video-retention"
```

**Exemplo prático:**

Se o arquivo está em `~/Downloads/fogo.mp4` e o ID é `fogo-abstrato`:

```bash
curl -X POST http://localhost:8080/api/retention/upload \
  -F "video=@/Users/seu-usuario/Downloads/fogo.mp4" \
  -F "retentionVideoId=fogo-abstrato"
```

**Resposta esperada (sucesso):**
```json
{
  "success": true,
  "message": "Vídeo de retenção 'fogo-abstrato' adicionado com sucesso",
  "video": {
    "id": "fogo-abstrato",
    "path": "/tmp/retention-library/fogo-abstrato.mp4",
    "name": "Fogo Abstrato",
    "tags": ["Hipnótico", "Alta retenção", "Visual"],
    "description": "Chamas abstratas em loop perfeito para retenção",
    "exists": true
  }
}
```

**Se houver erro, você verá:**
```json
{
  "error": "Mensagem de erro aqui",
  "hint": "Dica de como corrigir"
}
```

#### **Opção B: Usando Postman**

1. Abra o Postman
2. Crie uma nova requisição:
   - **Method**: `POST`
   - **URL**: `http://localhost:8080/api/retention/upload`
3. Vá para a aba **Body**
4. Selecione **form-data**
5. Adicione dois campos:

   **Campo 1:**
   - Key: `video` (selecione tipo **File**)
   - Value: Clique em "Select Files" e escolha seu arquivo `.mp4`

   **Campo 2:**
   - Key: `retentionVideoId` (tipo **Text**)
   - Value: `meu-video-retention` (o ID que você definiu)

6. Clique em **Send**

#### **Opção C: Usando Insomnia**

1. Abra o Insomnia
2. Crie nova requisição:
   - **Method**: `POST`
   - **URL**: `http://localhost:8080/api/retention/upload`
3. Vá para **Body** → **Multipart Form**
4. Adicione:
   - `video`: tipo File → selecione seu arquivo
   - `retentionVideoId`: tipo Text → digite o ID
5. Clique em **Send**

#### **Opção D: Usando JavaScript/Fetch (Frontend)**

```javascript
const formData = new FormData();
formData.append('video', fileInput.files[0]); // fileInput é um <input type="file">
formData.append('retentionVideoId', 'meu-video-retention');

fetch('http://localhost:8080/api/retention/upload', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => {
  console.log('Sucesso:', data);
})
.catch(error => {
  console.error('Erro:', error);
});
```

---

### **Passo 5: Verificar se o upload funcionou**

Execute no terminal:

```bash
curl http://localhost:8080/api/retention/video/meu-video-retention
```

**Resposta esperada:**
```json
{
  "id": "meu-video-retention",
  "path": "/tmp/retention-library/meu-video-retention.mp4",
  "name": "Meu Vídeo de Retenção",
  "tags": ["Alta retenção", "Hipnótico"],
  "description": "Descrição do meu vídeo de retenção",
  "exists": true
}
```

Se `"exists": true`, o upload foi bem-sucedido! ✅

---

## 📁 **MÉTODO 2: Upload Manual (Mais Rápido para Desenvolvimento)**

### **Passo 1: Adicionar metadado**

Mesmo processo do **Método 1 - Passo 2**.

### **Passo 2: Copiar arquivo para o diretório**

**Em desenvolvimento (local):**

1. Localize o diretório `retention-library/` na raiz do projeto:
   ```
   /Users/josyasborba/Desktop/ezv2/retention-library/
   ```

2. Copie seu arquivo de vídeo para este diretório:
   ```bash
   cp ~/Downloads/fogo.mp4 retention-library/fogo-abstrato.mp4
   ```

   **IMPORTANTE**: O nome do arquivo deve ser **exatamente igual ao ID** que você definiu no metadado:
   - ID: `fogo-abstrato`
   - Arquivo: `fogo-abstrato.mp4` ✅
   - Arquivo: `FogoAbstrato.mp4` ❌ (errado)

3. Verifique se o arquivo foi copiado:
   ```bash
   ls -lh retention-library/fogo-abstrato.mp4
   ```

**Em produção (Railway):**

Os arquivos devem ser salvos em `/tmp/retention-library/`:
```bash
# Via SSH ou exec no container
cp fogo.mp4 /tmp/retention-library/fogo-abstrato.mp4
```

**⚠️ ATENÇÃO**: Em produção, arquivos em `/tmp` são temporários e serão perdidos ao reiniciar o servidor. Para produção, use upload via API ou configure armazenamento persistente.

---

### **Passo 3: Verificar**

```bash
curl http://localhost:8080/api/retention/video/fogo-abstrato
```

Deve retornar `"exists": true`.

---

## 🔍 **Verificação Completa**

### **1. Listar todos os vídeos com status:**

```bash
curl http://localhost:8080/api/retention/ | python3 -m json.tool
```

Isso mostra todos os vídeos e indica quais têm arquivos (`exists: true/false`).

### **2. Ver vídeos de um nicho específico:**

```bash
curl http://localhost:8080/api/retention/niche/podcast | python3 -m json.tool
```

### **3. Verificar um vídeo específico:**

```bash
curl http://localhost:8080/api/retention/video/meu-video-retention | python3 -m json.tool
```

---

## 🐛 **Solução de Problemas**

### **Erro: "Vídeo de retenção não encontrado no modelo"**

**Causa**: O ID fornecido não existe em `RETENTION_VIDEOS`.

**Solução**:
1. Verifique se você adicionou o metadado em `src/models/niches.js`
2. Certifique-se que o ID está exatamente igual (case-sensitive)
3. Reinicie o servidor após adicionar o metadado

### **Erro: "ID do vídeo de retenção não fornecido"**

**Causa**: O campo `retentionVideoId` não foi enviado no body.

**Solução**:
- Verifique se está enviando o campo `retentionVideoId` no form-data
- No cURL: `-F "retentionVideoId=meu-video"`
- No Postman: Certifique-se que o campo está definido como "Text", não "File"

### **Erro: "Formato não suportado"**

**Causa**: O arquivo não é MP4, WebM ou MOV.

**Solução**:
- Converta o vídeo para MP4 usando ffmpeg:
  ```bash
  ffmpeg -i video-original.mov -c:v libx264 -c:a aac video-convertido.mp4
  ```

### **Erro: "Arquivo não encontrado" após upload**

**Causa**: O arquivo foi salvo, mas não está sendo encontrado.

**Solução**:
1. Verifique os logs do servidor
2. Confirme o caminho retornado na resposta do upload
3. Verifique se o arquivo realmente existe:
   ```bash
   ls -lh /tmp/retention-library/meu-video-retention.mp4
   ```

### **Vídeo não aparece na lista do nicho**

**Causa**: O ID do vídeo não foi adicionado na lista `retentionVideos` do nicho.

**Solução**:
1. Edite `src/models/niches.js`
2. Adicione o ID na lista `retentionVideos` do nicho desejado
3. Reinicie o servidor

---

## 📝 **Exemplo Completo do Início ao Fim**

Vamos adicionar um vídeo chamado "chuva-de-codigo" ao nicho "tech":

### **1. Preparar o arquivo:**
```bash
# Arquivo: ~/Downloads/code-rain.mp4
# ID escolhido: chuva-de-codigo
```

### **2. Editar `src/models/niches.js`:**

```javascript
export const RETENTION_VIDEOS = {
  // ... existentes ...
  'chuva-de-codigo': {
    id: 'chuva-de-codigo',
    name: 'Chuva de Código',
    tags: ['Hipnótico', 'Tech', 'Alta retenção'],
    description: 'Efeito matrix de código em loop'
  }
};

export const NICHES = {
  tech: {
    id: 'tech',
    name: 'Tech',
    description: 'Tecnologia, programação e inovação',
    retentionVideos: [
      'circuit-animation',
      'code-rain',
      'chuva-de-codigo',  // ← Adicionar aqui
      'mechanical-loop',
      'abstract-tech'
    ],
    // ...
  }
};
```

### **3. Reiniciar o servidor:**
```bash
# Ctrl+C no terminal onde está rodando
npm start
```

### **4. Fazer upload:**
```bash
curl -X POST http://localhost:8080/api/retention/upload \
  -F "video=@/Users/seu-usuario/Downloads/code-rain.mp4" \
  -F "retentionVideoId=chuva-de-codigo"
```

### **5. Verificar:**
```bash
# Verificar se o vídeo foi adicionado
curl http://localhost:8080/api/retention/video/chuva-de-codigo

# Verificar se aparece no nicho tech
curl http://localhost:8080/api/retention/niche/tech
```

**Resultado esperado:**
- ✅ Vídeo salvo em `/tmp/retention-library/chuva-de-codigo.mp4`
- ✅ `"exists": true` na resposta
- ✅ Vídeo aparece na lista do nicho "tech"

---

## ✅ **Checklist Final**

Antes de considerar o upload completo, verifique:

- [ ] Metadado adicionado em `src/models/niches.js`
- [ ] Servidor reiniciado após adicionar metadado
- [ ] Upload realizado com sucesso (resposta `"success": true`)
- [ ] Verificação retorna `"exists": true`
- [ ] (Opcional) Vídeo associado a um nicho
- [ ] (Opcional) Vídeo aparece na lista do nicho

---

## 🚀 **Dicas Pro**

1. **Nomes consistentes**: Use sempre minúsculas e hífens para IDs
2. **Arquivos pequenos**: Vídeos de 5-30 segundos são ideais
3. **Qualidade**: Use alta qualidade, mas comprima para tamanho razoável
4. **Backup**: Mantenha backup dos vídeos originais fora do projeto
5. **Teste**: Teste o vídeo antes de adicionar à produção

---

## 📚 **Comandos Úteis**

```bash
# Listar todos os vídeos
curl http://localhost:8080/api/retention/ | python3 -m json.tool

# Verificar um vídeo específico
curl http://localhost:8080/api/retention/video/ID_DO_VIDEO

# Ver vídeos de um nicho
curl http://localhost:8080/api/retention/niche/ID_DO_NICHO

# Verificar se o arquivo existe no sistema
ls -lh retention-library/*.mp4
# ou em produção:
ls -lh /tmp/retention-library/*.mp4
```

---

**Pronto!** Agora você tem um guia completo para fazer upload de vídeos de retenção. 🎉

Se tiver dúvidas, consulte os logs do servidor ou verifique se todos os passos foram seguidos corretamente.
