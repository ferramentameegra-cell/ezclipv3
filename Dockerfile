FROM node:20-slim

# Dependências do sistema
RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  ffmpeg \
  curl \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp atualizado (CRÍTICO)
RUN pip3 install --upgrade yt-dlp

# Diretório da aplicação
WORKDIR /app

# Dependências Node
COPY package*.json ./
RUN npm install

# Código da aplicação
COPY . .

# Porta da aplicação
EXPOSE 8080

# Start
CMD ["npm", "start"]
