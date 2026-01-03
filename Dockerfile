FROM node:20-slim

# ===============================
# Dependências do sistema
# ===============================
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Diretório da aplicação
# ===============================
WORKDIR /app

# ===============================
# Dependências Node
# ===============================
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ===============================
# Código da aplicação
# ===============================
COPY . .

# ===============================
# Porta usada pelo Railway
# ===============================
EXPOSE 8080

# ===============================
# Start da aplicação
# ===============================
CMD ["npm", "start"]
