FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    yt-dlp \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8080
CMD ["node", "src/index.js"]
