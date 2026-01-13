FROM node:20-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Instalar yt-dlp diretamente do GitHub (versão mais recente)
# Isso evita cache antigo e garante a versão mais atualizada
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --version

# Verificar instalações
RUN ffmpeg -version && yt-dlp --version

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# Criar diretório para cookies (opcional, pode ser montado via volume)
RUN mkdir -p /app/cookies

EXPOSE 8080
CMD ["node", "src/index.js"]
