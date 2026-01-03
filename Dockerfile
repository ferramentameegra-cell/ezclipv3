FROM node:20-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Instalar yt-dlp via pip (mais confiável que binário standalone)
RUN pip3 install --no-cache-dir yt-dlp

# Verificar instalação
RUN yt-dlp --version && ffmpeg -version

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Garantir que /tmp/uploads existe
RUN mkdir -p /tmp/uploads

EXPOSE 3000
CMD ["node", "index.js"]

