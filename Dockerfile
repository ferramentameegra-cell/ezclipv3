FROM node:20-slim

# ===============================
# Dependências do sistema
# ===============================
RUN apt-get update && apt-get install -y \
    ffmpeg \
    yt-dlp \
    curl \
    ca-certificates \
    python3 \
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
# Porta Railway
# ===============================
EXPOSE 8080

# ===============================
# Start
# ===============================
CMD ["npm", "start"]
