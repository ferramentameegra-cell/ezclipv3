FROM node:20-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
<<<<<<< HEAD
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
=======
  yt-dlp \
  ffmpeg \
  curl \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*
>>>>>>> e9ec834772307373775b366a87f0b8f585455098

# Diretório da aplicação
WORKDIR /app

# Copiar dependências Node
COPY package*.json ./

# Instalar dependências Node
RUN npm install

# Copiar código da aplicação
COPY . .

<<<<<<< HEAD
# Garantir que /tmp/uploads existe
RUN mkdir -p /tmp/uploads

EXPOSE 3000
CMD ["node", "index.js"]

=======
# Porta usada pelo Railway
EXPOSE 8080

# Comando de start
CMD ["npm", "start"]
>>>>>>> e9ec834772307373775b366a87f0b8f585455098
