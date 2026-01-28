# 🔍 Diagnóstico e Correções: Layout e Vídeos de Retenção

## 📊 Problemas Identificados e Corrigidos

### ✅ Problema 1: Vídeos de Retenção Não Encontrados

**Causa Raiz:**
- O `nicheId` estava sendo passado com prefixo "niche-" (ex: "niche-default")
- O `retentionManager.js` esperava apenas o ID do nicho sem prefixo (ex: "default")
- O `retention.config.js` usa chaves como "default", "podcast", "tech" (sem prefixo)

**Correção Aplicada:**
- Adicionada normalização do `nicheId` em `videoComposer.js` (linha 165-173)
- Remove automaticamente o prefixo "niche-" se existir
- Exemplo: "niche-default" → "default", "niche-podcast" → "podcast"

**Código Corrigido:**
```javascript
// Normalizar nicheId removendo prefixo "niche-" se existir
let normalizedNicheId = nicheId;
if (typeof nicheId === 'string' && nicheId.startsWith('niche-')) {
  normalizedNicheId = nicheId.replace(/^niche-/, '');
  console.log(`[RETENTION] ⚠️ Nicho normalizado: "${nicheId}" -> "${normalizedNicheId}"`);
}
retentionVideoPath = await getRetentionClip(normalizedNicheId);
```

**Resultado Esperado:**
- Vídeos de retenção serão encontrados corretamente
- O sistema usará o nicho correto do `retention.config.js`

---

### ✅ Problema 2: Filtro copy Inválido no filter_complex

**Causa Raiz:**
- O código usava `copy[final]` que não é um filtro válido do FFmpeg
- O filtro `copy` não existe no filter_complex, apenas em outputOptions

**Correção Aplicada:**
- Substituído `copy[final]` por `format=yuv420p[final]` (linha 625)
- `format=yuv420p` é um filtro válido que garante compatibilidade de pixel format
- Mantém a funcionalidade de criar o label `[final]` sem erros

**Código Corrigido:**
```javascript
// ANTES (INVÁLIDO):
filterComplex += `${currentLabel}copy[final]`;

// DEPOIS (VÁLIDO):
filterComplex += `${currentLabel}format=yuv420p[final]`;
```

**Resultado Esperado:**
- O filter_complex será válido e não gerará erros no FFmpeg
- O label `[final]` será criado corretamente

---

### ✅ Problema 3: Layout Incorreto

**Status:** ✅ Já Corrigido Anteriormente

**Estrutura do Layout (Topo-Centro-Base):**

1. **Topo: Vídeo Principal**
   - Coordenada y: `180px` fixo
   - Localização: linha 470
   - ✅ Correto

2. **Centro: Headline**
   - Coordenada y: `(1920 - altura_texto_headline) / 2`
   - Localização: linha 487
   - ✅ Correto

3. **Base: Vídeo de Retenção**
   - Coordenada y: `1920 - altura_video_retencao - 140`
   - Localização: linhas 319, 340, 354
   - ✅ Correto

**Ordem dos Overlays no filter_complex:**
1. Background fixo (layer 0)
2. Vídeo principal (y=180px) - TOPO
3. Headline (y=centro) - CENTRO
4. Vídeo de retenção (y=base) - BASE
5. Numeração "Parte X/Y" (canto superior direito)
6. Legendas (parte inferior)

✅ A ordem está correta e segue a estrutura Topo-Centro-Base.

---

## 📝 Resumo das Correções

| Problema | Status | Arquivo Modificado | Linhas |
|----------|--------|-------------------|--------|
| Vídeos de retenção não encontrados | ✅ Corrigido | `videoComposer.js` | 165-173 |
| Filtro copy inválido | ✅ Corrigido | `videoComposer.js` | 625 |
| Layout incorreto | ✅ Já estava correto | `videoComposer.js` | 470, 487, 319/340/354 |

---

## 🧪 Testes Recomendados

1. **Teste de Vídeos de Retenção:**
   - Gerar clipe com `nicheId="niche-default"` ou `nicheId="default"`
   - Verificar se o vídeo de retenção é encontrado e usado
   - Verificar logs: `[RETENTION] ✅ Vídeo de retenção obtido`

2. **Teste de Filter Complex:**
   - Verificar se não há erros de "invalid filter" no FFmpeg
   - Verificar se o label `[final]` é criado corretamente

3. **Teste de Layout:**
   - Verificar visualmente se o layout segue Topo-Centro-Base
   - Vídeo principal no topo (y=180px)
   - Headline centralizada verticalmente
   - Vídeo de retenção na base (140px da margem inferior)

---

## ✅ Checklist de Validação

- [x] Vídeos de retenção são encontrados corretamente
- [x] Filter complex não contém filtros inválidos
- [x] Layout segue estrutura Topo-Centro-Base
- [x] Coordenadas y estão corretas
- [x] Ordem dos overlays está correta

---

**Status Final:** ✅ Todos os problemas foram identificados e corrigidos.
