# 📹 Guia Completo: Como Adicionar Vídeos de Retenção

## 📍 Localização das Pastas

### Desenvolvimento Local
```
/Users/josyasborba/Desktop/ezv2/retention-library/
```

### Produção (Railway)
```
/tmp/retention-library/
```

---

## 📋 Passo a Passo

### PASSO 1: Verificar os IDs Disponíveis

Primeiro, veja quais vídeos estão cadastrados no sistema. Abra o arquivo:
```
src/models/niches.js
```

Procure pela seção `RETENTION_VIDEOS` (linha 86). Você verá uma lista como:

```javascript
export const RETENTION_VIDEOS = {
  'hydraulic-press': {
    id: 'hydraulic-press',
    name: 'Prensa Hidráulica',
    ...
  },
  'satisfying-loops': {
    id: 'satisfying-loops',
    name: 'Loops Satisfatórios',
    ...
  },
  // ... mais vídeos
};
```

**Anote o ID** do vídeo que você quer adicionar (ex: `hydraulic-press`, `satisfying-loops`).

---

### PASSO 2: Preparar o Vídeo

**Requisitos do vídeo:**
- ✅ Formato: `.mp4`, `.webm` ou `.mov` (recomendado: `.mp4`)
- ✅ Resolução recomendada: **1080x1920** (formato vertical 9:16)
- ✅ Sem áudio ou áudio baixo (vídeos de retenção são silenciosos)
- ✅ Looping perfeito (sem cortes bruscos)
- ✅ Duração: 10-30 segundos (idealmente)

---

### PASSO 3: Nomear o Arquivo

O nome do arquivo **DEVE** corresponder exatamente ao ID do vídeo:

**Formato do nome:**
```
{ID-DO-VIDEO}.mp4
```

**Exemplos:**
- ID: `hydraulic-press` → Nome: `hydraulic-press.mp4`
- ID: `satisfying-loops` → Nome: `satisfying-loops.mp4`
- ID: `sand-kinetic` → Nome: `sand-kinetic.mp4`
- ID: `hydraulic-press-1` → Nome: `hydraulic-press-1.mp4`

⚠️ **IMPORTANTE:** 
- Use apenas letras minúsculas
- Use hífen (`-`) para separar palavras
- Não use espaços ou caracteres especiais
- A extensão deve ser `.mp4` (preferencialmente)

---

### PASSO 4: Criar a Pasta (se não existir)

**No desenvolvimento local:**
```bash
cd /Users/josyasborba/Desktop/ezv2
mkdir -p retention-library
```

**No Railway (produção):**
A pasta será criada automaticamente, mas você pode criar manualmente:
```bash
mkdir -p /tmp/retention-library
```

---

### PASSO 5: Copiar o Vídeo para a Pasta

**No desenvolvimento local:**
```bash
# Exemplo: copiar vídeo de retenção
cp ~/Downloads/hydraulic-press.mp4 /Users/josyasborba/Desktop/ezv2/retention-library/
```

Ou arraste e solte o arquivo manualmente:
1. Abra a pasta `retention-library/` no Finder
2. Arraste o vídeo para dentro da pasta
3. Renomeie o arquivo para corresponder ao ID (se necessário)

**Estrutura final deve ficar:**
```
ezv2/
  ├── retention-library/
  │   ├── hydraulic-press.mp4
  │   ├── satisfying-loops.mp4
  │   ├── sand-kinetic.mp4
  │   └── ... outros vídeos
```

---

### PASSO 6: Verificar se Funcionou

Após adicionar o vídeo, você pode verificar de duas formas:

#### Opção A: Via Código
Verifique os logs do servidor quando iniciar. Você deve ver:
```
[RETENTION] Vídeo encontrado: /caminho/retention-library/hydraulic-press.mp4
```

#### Opção B: Via API
Faça uma requisição GET para:
```
http://localhost:3000/api/retention/videos
```

Você verá uma lista de vídeos com `exists: true` para os que foram encontrados.

---

## 🆕 Adicionando um Novo Vídeo (não cadastrado)

Se você quer adicionar um vídeo que **não está** na lista de `RETENTION_VIDEOS`:

### PASSO 1: Adicionar Metadado

Edite o arquivo `src/models/niches.js` e adicione na seção `RETENTION_VIDEOS`:

```javascript
export const RETENTION_VIDEOS = {
  // ... vídeos existentes ...
  
  'meu-novo-video': {  // ← ID único (sem espaços, em minúsculas)
    id: 'meu-novo-video',
    name: 'Meu Novo Vídeo',
    tags: ['Alta retenção', 'Hipnótico'],
    description: 'Descrição do meu vídeo de retenção'
  }
};
```

### PASSO 2: Adicionar ao Nicho (opcional)

Se quiser que o vídeo apareça em um nicho específico, edite a seção `NICHES`:

```javascript
export const NICHES = {
  podcast: {
    // ...
    retentionVideos: [
      'hydraulic-press',
      'meu-novo-video',  // ← Adicione o ID aqui
      // ...
    ]
  }
};
```

### PASSO 3: Adicionar o Arquivo

Siga os passos 3-5 acima, usando o ID que você criou.

**Nome do arquivo:** `meu-novo-video.mp4`

---

## 📝 Lista Completa de Vídeos Cadastrados

| ID | Nome | Nome do Arquivo |
|---|---|---|
| `hydraulic-press` | Prensa Hidráulica | `hydraulic-press.mp4` |
| `hydraulic-press-1` | Prensa Hidráulica #1 | `hydraulic-press-1.mp4` |
| `hydraulic-press-2` | Prensa Hidráulica #2 | `hydraulic-press-2.mp4` |
| `hydraulic-press-3` | Prensa Hidráulica #3 | `hydraulic-press-3.mp4` |
| `satisfying-loops` | Loops Satisfatórios | `satisfying-loops.mp4` |
| `sand-kinetic` | Areia Cinética | `sand-kinetic.mp4` |
| `slime` | Slime | `slime.mp4` |
| `timelapse-abstract` | Timelapse Abstrato | `timelapse-abstract.mp4` |
| `mechanical-loop` | Loop Mecânico | `mechanical-loop.mp4` |
| `timelapse-nature` | Timelapse Natureza | `timelapse-nature.mp4` |
| `sunset-timelapse` | Pôr do Sol | `sunset-timelapse.mp4` |
| `ocean-waves` | Ondas do Mar | `ocean-waves.mp4` |
| `abstract-flow` | Fluxo Abstrato | `abstract-flow.mp4` |
| `circuit-animation` | Animação de Circuitos | `circuit-animation.mp4` |
| `code-rain` | Chuva de Código | `code-rain.mp4` |
| `abstract-tech` | Abstrato Tech | `abstract-tech.mp4` |
| `gold-particles` | Partículas Douradas | `gold-particles.mp4` |
| `timelapse-city` | Timelapse Urbano | `timelapse-city.mp4` |
| `abstract-numbers` | Números Abstratos | `abstract-numbers.mp4` |

---

## 🚀 Para Produção (Railway)

### Via Railway CLI

1. Conecte-se ao Railway:
```bash
railway login
railway link
```

2. Faça upload do arquivo:
```bash
railway run cp meu-video.mp4 /tmp/retention-library/
```

### Via SSH (se disponível)

1. Conecte via SSH ao Railway
2. Crie a pasta (se não existir):
```bash
mkdir -p /tmp/retention-library
```

3. Faça upload via SCP:
```bash
scp hydraulic-press.mp4 user@railway:/tmp/retention-library/
```

### Via Variável de Ambiente (Alternativa)

Você pode configurar `RETENTION_LIBRARY_DIR` no Railway para usar outro diretório:

```
RETENTION_LIBRARY_DIR=/app/retention-library
```

⚠️ **Nota:** Arquivos em `/tmp/` são **voláteis** e serão perdidos após restart do container. Para persistência, use um diretório dentro de `/app/`.

---

## ✅ Checklist Final

Antes de considerar concluído, verifique:

- [ ] O arquivo tem exatamente o mesmo nome do ID (case-sensitive)
- [ ] O arquivo está na pasta correta (`retention-library/` ou `/tmp/retention-library/`)
- [ ] O formato é `.mp4` (ou `.webm`/`.mov`)
- [ ] O vídeo está em formato vertical (9:16, 1080x1920)
- [ ] O ID está cadastrado em `src/models/niches.js` (se for novo)
- [ ] O servidor foi reiniciado após adicionar (se necessário)

---

## 🐛 Solução de Problemas

### Vídeo não aparece na lista

1. Verifique se o nome do arquivo está **exatamente** igual ao ID
2. Verifique se o arquivo está na pasta correta
3. Verifique os logs do servidor para erros
4. Reinicie o servidor

### Erro "Vídeo não encontrado"

1. Verifique o caminho: `retention-library/{ID}.mp4`
2. Verifique permissões do arquivo (deve ser legível)
3. Verifique se o ID existe em `RETENTION_VIDEOS`

### Vídeo aparece mas não carrega

1. Verifique se o formato é suportado (`.mp4`, `.webm`, `.mov`)
2. Verifique se o arquivo não está corrompido
3. Verifique o tamanho do arquivo (muito grande pode causar problemas)

---

## 📞 Suporte

Se tiver problemas, verifique:
- Logs do servidor (`console.log` com prefixo `[RETENTION]`)
- Caminho do arquivo no código (`src/services/retentionVideoManager.js`)
- Metadados no modelo (`src/models/niches.js`)
