# EZ Clips AI V2 - Retention Engine

Plataforma SaaS que transforma vídeos longos em séries cronológicas sequenciais virais, combinando conteúdo principal + vídeos de retenção hipnóticos, otimizados para TikTok, Reels e Shorts.

## 🚀 Características Principais

### Retention Engine por Nicho
- Sistema de vídeos de retenção específicos por nicho
- Biblioteca de vídeos hipnóticos testados para maximizar watch time
- Vídeos silenciosos, loopáveis e otimizados

### Séries Cronológicas
- Cortes sempre cronológicos (nunca highlights isolados)
- Numeração PARTE X/Y obrigatória
- Sequência não pode ser removida pelo usuário

### Layout Fixo 9:16
- Vídeo principal no topo
- Headline impactante no centro
- Vídeo de retenção na parte inferior
- Legendas animadas estilo TikTok

## 📋 Requisitos

- Node.js 18+
- FFmpeg (para processamento de vídeo)
- Conta Cloudflare R2 (opcional, para armazenamento)

## 🛠️ Instalação

1. Clone o repositório:
```bash
git clone https://github.com/ferramentameegra-cell/ezclipv3.git
cd ezclipv3
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o .env com suas configurações
```

4. Inicie o servidor:
```bash
npm start
```

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

## 📁 Estrutura do Projeto

```
ezv2/
├── src/
│   ├── controllers/     # Controladores da API
│   ├── models/          # Modelos de dados (nichos, vídeos)
│   ├── routes/          # Rotas da API
│   ├── services/        # Serviços (processamento de vídeo)
│   └── utils/           # Utilitários
├── public/              # Frontend (HTML, CSS, JS)
├── uploads/             # Vídeos enviados
├── retention-library/   # Biblioteca de vídeos de retenção
└── index.js            # Servidor principal
```

## 🎯 Fluxo de Uso

1. **Seleção do Vídeo**: YouTube ou upload próprio
2. **Trim + Estimativa**: Definir cortes e ver estimativa de partes
3. **Escolha do Nicho**: Selecionar nicho (obrigatório)
4. **Biblioteca de Retenção**: Escolher vídeo de retenção
5. **Preview & Estilo**: Visualizar layout final e ajustar estilo
6. **Geração**: Gerar série completa

## 🔌 API Endpoints

### Vídeo
- `POST /api/video/upload` - Upload de vídeo
- `POST /api/video/youtube` - Processar vídeo do YouTube
- `GET /api/video/info/:videoId` - Informações do vídeo

### Nichos
- `GET /api/niches` - Listar nichos
- `GET /api/niches/:nicheId` - Detalhes do nicho

### Retenção
- `GET /api/retention` - Listar vídeos de retenção
- `GET /api/retention/niche/:nicheId` - Vídeos por nicho

### Geração
- `POST /api/generate/series` - Gerar série
- `GET /api/generate/status/:jobId` - Status da geração
- `GET /api/generate/download/:seriesId` - Download da série

## 🎨 Nichos Disponíveis

- **Podcast**: Conversas, entrevistas e debates
- **Educação**: Aulas, tutoriais e conteúdo educacional
- **Motivacional**: Conteúdo inspirador e desenvolvimento pessoal
- **Tech**: Tecnologia, programação e inovação
- **Financeiro**: Investimentos, economia e finanças

## 🔧 Tecnologias

- **Backend**: Node.js, Express
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Processamento**: FFmpeg, fluent-ffmpeg
- **Armazenamento**: Cloudflare R2 (S3-compatible)
- **YouTube**: ytdl-core

## 📝 Licença

Este projeto é proprietário.

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, abra uma issue ou pull request.
deploy trigger

