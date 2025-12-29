# 🔧 Fix para Nixpacks - Node.js não detectado

Se o Nixpacks ainda não detectar o Node.js automaticamente, configure a variável de ambiente no Railway Dashboard:

## Solução: Configurar Variável de Ambiente no Railway

1. Acesse o Railway Dashboard: https://railway.app
2. Vá para seu projeto
3. Clique em **Settings** ou **Variables**
4. Adicione a seguinte variável de ambiente:

```
NIXPACKS_NODE_VERSION=20
```

5. Faça um novo deploy

## Arquivos de Configuração

Os seguintes arquivos já estão configurados para Node.js 20:
- `.nvmrc` → `20`
- `.node-version` → `20`
- `package.json` engines → `"node": "20"`

## Alternativa: Usar Dockerfile

Se o Nixpacks continuar com problemas, você pode criar um `Dockerfile`:

```dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["node", "index.js"]
```

E no Railway, configure para usar Dockerfile ao invés de Nixpacks.

