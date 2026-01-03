FROM node:20-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
  yt-dlp \
  ffmpeg \
  curl \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Diretório da aplicação
WORKDIR /app

# Copiar dependências Node
COPY package*.json ./

# Instalar dependências Node
RUN npm install

# Copiar código da aplicação
COPY . .

# Porta usada pelo Railway
EXPOSE 8080

# Comando de start
CMD ["npm", "start"]
