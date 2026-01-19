# Como Iniciar a Aplicação Localmente

## Pré-requisitos

- Node.js >= 20.0.0
- npm >= 10.0.0

## Passos para Iniciar

### 1. Instalar Dependências (se necessário)

```bash
cd /Users/josyasborba/Desktop/ezv2
npm install
```

### 2. Iniciar o Servidor

**Opção 1: Modo Produção**
```bash
npm start
```

**Opção 2: Modo Desenvolvimento (com watch)**
```bash
npm run dev
```

### 3. Acessar a Aplicação

Abra seu navegador e acesse:
```
http://localhost:8080
```

## Variáveis de Ambiente (Opcional)

Se precisar configurar variáveis de ambiente, crie um arquivo `.env` na raiz:

```env
PORT=8080
NODE_ENV=development
JWT_SECRET=seu-secret-aqui
```

## Parar o Servidor

Pressione `Ctrl + C` no terminal onde o servidor está rodando.

## Troubleshooting

### Porta já em uso
Se a porta 8080 estiver em uso, você pode:
1. Matar o processo usando a porta:
   ```bash
   lsof -ti:8080 | xargs kill -9
   ```
2. Ou definir outra porta:
   ```bash
   PORT=3000 npm start
   ```

### Erro de dependências
```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro de permissão
```bash
chmod +x node_modules/.bin/*
```
