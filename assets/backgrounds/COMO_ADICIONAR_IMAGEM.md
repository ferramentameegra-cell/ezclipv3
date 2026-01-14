# 📸 Como Adicionar a Imagem de Background

## Passo a Passo

### 1. Prepare a Imagem
- **Nome do arquivo:** `ezclip-background.png` (ou `.jpg`)
- **Resolução:** 1080x1920 pixels (9:16 - formato vertical)
- **Formato:** PNG ou JPG
- **Localização:** Este diretório (`assets/backgrounds/`)

### 2. Adicione a Imagem

**Opção A - Via Finder (macOS):**
1. Abra o Finder
2. Navegue até: `/Users/josyasborba/Desktop/ezv2/assets/backgrounds/`
3. Arraste a imagem para este diretório
4. Renomeie para: `ezclip-background.png`

**Opção B - Via Terminal:**
```bash
cd /Users/josyasborba/Desktop/ezv2/assets/backgrounds/
# Copie sua imagem para cá e renomeie
cp /caminho/para/sua/imagem.png ezclip-background.png
```

**Opção C - Via Git:**
```bash
# Adicione a imagem ao repositório
git add assets/backgrounds/ezclip-background.png
git commit -m "feat: Adicionar imagem de background fixo"
git push origin main
```

### 3. Verifique se Funcionou

Após adicionar a imagem, você verá logs como:
```
[COMPOSER] ✅ Background fixo encontrado: /caminho/para/ezclip-background.png
[COMPOSER] Background fixo aplicado como layer 0
```

### 4. Teste

Gere um vídeo e verifique se o background aparece corretamente!

## ⚠️ Importante

- A imagem **DEVE** estar neste diretório
- O nome **DEVE** ser exatamente `ezclip-background.png` ou `ezclip-background.jpg`
- A resolução recomendada é **1080x1920** para evitar distorção

## 📁 Estrutura Esperada

```
assets/
└── backgrounds/
    ├── ezclip-background.png  ← SUA IMAGEM AQUI
    ├── README.md
    ├── INSTRUCOES.md
    └── COMO_ADICIONAR_IMAGEM.md (este arquivo)
```
