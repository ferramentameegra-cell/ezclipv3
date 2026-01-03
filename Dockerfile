FROM node:20-slim

# Dependências do sistema (sem pip)
RUN apt-get update && apt-get install -y \
  yt-dlp \
  ffmpeg \
  curl \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Diretório da aplicação
WORKDIR /app

# Dependências Node
COPY package*.json ./
RUN npm install

# Código da aplicação
COPY . .

# Porta
EXPOSE 8080

# Start
CMD ["npm", "start"]
