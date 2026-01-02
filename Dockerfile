FROM node:20-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar yt-dlp
RUN pip3 install -U yt-dlp

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências Node
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
