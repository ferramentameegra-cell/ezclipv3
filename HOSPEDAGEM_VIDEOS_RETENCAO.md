# 🎬 Guia de Hospedagem de Vídeos de Retenção

## 📋 Visão Geral

Os vídeos de retenção podem ser hospedados de duas formas:
1. **Arquivos locais** (atual) - Em `retention-library/` ou `/tmp/retention-library/`
2. **URLs externas** (recomendado para produção) - Hospedados em CDN/serviço de armazenamento

## 🏆 Melhores Opções de Hospedagem (2024)

### 1. **Cloudinary** ⭐ RECOMENDADO
**Por quê:** Free tier generoso, CDN global, transformações automáticas

- **Free Tier:** 25 créditos/mês (suficiente para ~100 vídeos pequenos)
- **Preço pós-free:** $0.04/GB armazenamento, $0.04/GB bandwidth
- **Vantagens:**
  - CDN global automático
  - Otimização automática de vídeo
  - Transformações on-the-fly
  - Interface web amigável
- **Desvantagens:**
  - Limite no free tier
  - Pode ficar caro com muito tráfego

**Como usar:**
1. Criar conta em https://cloudinary.com
2. Upload dos vídeos via dashboard ou API
3. Obter URL pública (ex: `https://res.cloudinary.com/seu-account/video/upload/v1234567/hydraulic-press-1.mp4`)
4. Adicionar URL no modelo `src/models/niches.js`

---

### 2. **Bunny.net** 💰 MAIS ECONÔMICO
**Por quê:** Muito barato, CDN rápido, sem limites ocultos

- **Preço:** $0.01/GB armazenamento, $0.01/GB bandwidth
- **Free Trial:** $5 em créditos
- **Vantagens:**
  - Preço muito baixo
  - CDN global (100+ locais)
  - Sem limites ocultos
  - Suporte a vídeo streaming
- **Desvantagens:**
  - Não é totalmente gratuito
  - Interface menos intuitiva

**Como usar:**
1. Criar conta em https://bunny.net
2. Criar Storage Zone
3. Upload via FTP/API
4. Obter URL pública (ex: `https://seu-account.b-cdn.net/hydraulic-press-1.mp4`)
5. Adicionar URL no modelo

---

### 3. **AWS S3 + CloudFront** 🏢 ENTERPRISE
**Por quê:** Confiável, escalável, usado por grandes empresas

- **Preço:** ~$0.023/GB armazenamento, $0.085/GB bandwidth (primeiro 10TB)
- **Free Tier:** 5GB armazenamento, 20.000 requests/mês por 12 meses
- **Vantagens:**
  - Muito confiável
  - Escalável
  - Integração com outros serviços AWS
- **Desvantagens:**
  - Configuração mais complexa
  - Pode ficar caro com tráfego alto
  - Curva de aprendizado

---

### 4. **Google Cloud Storage** ☁️ ALTERNATIVA AWS
**Por quê:** Similar ao S3, integração com Google Cloud

- **Preço:** ~$0.020/GB armazenamento, $0.12/GB bandwidth
- **Free Tier:** 5GB armazenamento, 5GB egress/mês
- **Vantagens:**
  - Preço competitivo
  - Integração com Google Cloud
- **Desvantagens:**
  - Configuração complexa
  - Egress pode ficar caro

---

### 5. **Vercel Blob** 🚀 SIMPLES PARA VERCEL
**Por quê:** Integração nativa com Vercel, muito simples

- **Preço:** $0.15/GB armazenamento, $0.40/GB bandwidth
- **Free Tier:** Não tem (mas preço baixo)
- **Vantagens:**
  - Muito simples de usar
  - Integração com Vercel
  - API REST simples
- **Desvantagens:**
  - Mais caro que alternativas
  - Limitado ao ecossistema Vercel

---

### 6. **GitHub Releases** 🆓 GRATUITO (LIMITADO)
**Por quê:** Totalmente gratuito, mas com limitações

- **Preço:** Gratuito
- **Limites:** 2GB por arquivo, 10GB por repositório
- **Vantagens:**
  - Totalmente gratuito
  - CDN do GitHub
- **Desvantagens:**
  - Limites de tamanho
  - Não ideal para produção
  - URLs podem mudar

---

## 🎯 Recomendação por Caso de Uso

### Para Projetos Pequenos / MVP
**→ Cloudinary** (free tier suficiente)

### Para Projetos em Crescimento
**→ Bunny.net** (melhor custo-benefício)

### Para Produção Enterprise
**→ AWS S3 + CloudFront** (confiabilidade máxima)

### Para Projetos Vercel
**→ Vercel Blob** (simplicidade)

---

## 📝 Como Adicionar URLs no Código

### 1. Atualizar Modelo (`src/models/niches.js`)

Adicione o campo `url` nos vídeos de retenção:

```javascript
'hydraulic-press-1': {
  id: 'hydraulic-press-1',
  name: 'Prensa Hidráulica #1',
  tags: ['Alta retenção', 'Hipnótico', 'Seguro para TikTok'],
  description: 'Vídeo 1 de prensa hidráulica comprimindo objetos',
  url: 'https://res.cloudinary.com/seu-account/video/upload/v1234567/hydraulic-press-1.mp4' // ← Adicionar aqui
}
```

### 2. O Código Já Suporta URLs!

O sistema foi atualizado para detectar automaticamente se é uma URL ou caminho local:
- Se começar com `http://` ou `https://` → trata como URL
- Caso contrário → trata como caminho local

### 3. Upload para Cloudinary (Exemplo)

```bash
# Via CLI do Cloudinary
cloudinary uploader upload retention-library/hydraulic-press-1.mp4 \
  --folder retention-videos \
  --resource-type video

# Ou via Node.js
npm install cloudinary
```

```javascript
const cloudinary = require('cloudinary').v2;

cloudinary.uploader.upload('retention-library/hydraulic-press-1.mp4', {
  resource_type: 'video',
  folder: 'retention-videos',
  public_id: 'hydraulic-press-1'
}, (error, result) => {
  console.log('URL:', result.secure_url);
});
```

---

## 🔧 Configuração Recomendada

### Para Desenvolvimento
- Use arquivos locais em `retention-library/`

### Para Produção (Railway/Cloud)
- Use Cloudinary ou Bunny.net
- Adicione URLs no modelo
- Mantenha fallback para arquivos locais

---

## 📊 Comparação Rápida

| Serviço | Free Tier | Custo/Mês (100GB) | CDN | Facilidade |
|---------|-----------|-------------------|-----|------------|
| Cloudinary | ✅ 25 créditos | ~$4 | ✅ | ⭐⭐⭐⭐⭐ |
| Bunny.net | ✅ $5 trial | ~$1 | ✅ | ⭐⭐⭐⭐ |
| AWS S3 | ✅ 5GB/12m | ~$2.30 | ⚠️ (CloudFront) | ⭐⭐⭐ |
| GCS | ✅ 5GB | ~$2 | ⚠️ | ⭐⭐⭐ |
| Vercel Blob | ❌ | ~$15 | ✅ | ⭐⭐⭐⭐⭐ |
| GitHub | ✅ | $0 | ✅ | ⭐⭐⭐ |

---

## 🚀 Próximos Passos

1. Escolha um serviço baseado no seu caso de uso
2. Faça upload dos vídeos
3. Adicione as URLs no modelo `src/models/niches.js`
4. Teste o sistema
5. Configure fallback para arquivos locais (opcional)

---

## 📚 Links Úteis

- [Cloudinary Docs](https://cloudinary.com/documentation)
- [Bunny.net Docs](https://docs.bunny.net/)
- [AWS S3 Docs](https://docs.aws.amazon.com/s3/)
- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)
