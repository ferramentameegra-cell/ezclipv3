# Como Alterar a Imagem do Banner de Boas-Vindas

## Localização dos Arquivos

O banner de boas-vindas está na seção **Hero** da página inicial.

### Arquivos Envolvidos:
- **HTML**: `public/index.html` (linhas 136-181)
- **CSS**: `public/styles.css` (linhas 239-242 para fundo da seção, linhas 369-374 para o card preview)

## Opções para Adicionar Imagem

### Opção 1: Imagem de Fundo na Seção Hero (Recomendado)

Edite o arquivo `public/styles.css` na linha 239:

```css
.hero {
    padding: 4rem 0;
    /* Remova ou comente a linha do gradiente */
    /* background: linear-gradient(180deg, var(--bg) 0%, var(--bg-secondary) 100%); */
    
    /* Adicione sua imagem */
    background-image: url('/assets/backgrounds/sua-imagem.jpg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
}
```

### Opção 2: Imagem no Card Preview (Lado Direito)

Edite o arquivo `public/styles.css` na linha 369:

```css
.preview-video {
    width: 100%;
    height: 100%;
    /* Remova ou comente o gradiente */
    /* background: linear-gradient(135deg, var(--primary), var(--secondary)); */
    /* opacity: 0.1; */
    
    /* Adicione sua imagem */
    background-image: url('/assets/backgrounds/sua-imagem.jpg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 1;
}
```

### Opção 3: Adicionar Tag <img> no HTML

Edite o arquivo `public/index.html` na linha 172:

```html
<div class="card-preview">
    <!-- Adicione uma tag img aqui -->
    <img src="/assets/backgrounds/sua-imagem.jpg" alt="Banner" style="width: 100%; height: 100%; object-fit: cover;">
    <div class="preview-video"></div>
    <div class="preview-overlay">
        <div class="play-icon">▶</div>
    </div>
</div>
```

## Onde Colocar a Imagem

1. **Pasta recomendada**: `assets/backgrounds/`
   - Já existe uma imagem exemplo: `ezclip-background.png`
   - Você pode substituir ou adicionar uma nova

2. **Pasta alternativa**: `public/images/` (crie se não existir)
   - Acessível diretamente via URL: `/images/sua-imagem.jpg`

## Formatos Suportados

- JPG/JPEG
- PNG
- WebP (recomendado para melhor performance)
- SVG

## Tamanho Recomendado

- **Para fundo da seção hero**: 1920x1080px ou maior
- **Para card preview**: 400x711px (proporção 9:16)

## Exemplo Completo

Para usar a imagem existente `ezclip-background.png`:

```css
.hero {
    padding: 4rem 0;
    background-image: url('/assets/backgrounds/ezclip-background.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    /* Opcional: adicionar overlay escuro para melhorar legibilidade do texto */
    position: relative;
}

.hero::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9); /* Overlay branco semi-transparente */
    z-index: 0;
}

.hero-container {
    position: relative;
    z-index: 1;
}
```

## Após Fazer as Alterações

1. Salve os arquivos
2. Recarregue a página (Ctrl+F5 ou Cmd+Shift+R para limpar cache)
3. Se necessário, faça commit e deploy
