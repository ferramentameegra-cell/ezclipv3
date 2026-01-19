# 🔍 DEBUG DO LOGIN

## Problema Reportado
A página não faz login ao clicar em "Entrar" ou "Criar conta".

## Logs Adicionados

### Backend (`src/controllers/authController.js`)
- ✅ Log quando recebe tentativa de login
- ✅ Log se campos estão faltando
- ✅ Log se usuário foi encontrado
- ✅ Log se senha é válida
- ✅ Log quando login é bem-sucedido

### Frontend (`public/app.js`)
- ✅ Log antes de fazer requisição
- ✅ Log da resposta (status, ok)
- ✅ Log do texto da resposta
- ✅ Log dos dados parseados

## Como Verificar

### 1. Abrir Console do Navegador
- Pressione `F12` ou `Cmd+Option+I` (Mac)
- Vá para a aba "Console"

### 2. Tentar Fazer Login
- Preencha email e senha
- Clique em "Entrar"
- Observe os logs no console

### 3. Verificar Logs do Servidor
Se estiver rodando localmente:
```bash
# Ver logs do servidor Node.js
# Procure por linhas que começam com [AUTH]
```

### 4. Verificar Erros Comuns

#### Erro: "Failed to fetch" ou "Network error"
- **Causa**: Servidor não está rodando
- **Solução**: Inicie o servidor com `npm start` ou `node src/index.js`

#### Erro: "CORS policy"
- **Causa**: Problema de CORS (já configurado como permissivo)
- **Solução**: Verifique se `cors()` está configurado no `src/index.js`

#### Erro: "Email ou senha incorretos"
- **Causa**: Usuário não existe ou senha está errada
- **Solução**: 
  - Verifique se o admin foi criado (deve aparecer nos logs do servidor)
  - Email: `josyasborba@hotmail.com`
  - Senha: `12345678`

#### Erro: "Resposta inválida do servidor"
- **Causa**: Servidor retornou HTML em vez de JSON (erro 404 ou 500)
- **Solução**: Verifique se a rota `/api/auth/login` existe e está funcionando

## Teste Manual da API

### Com curl:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"josyasborba@hotmail.com","password":"12345678"}'
```

### Com fetch no console do navegador:
```javascript
fetch('http://localhost:8080/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'josyasborba@hotmail.com', password: '12345678' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Próximos Passos

1. **Recarregue a página** (Ctrl+Shift+R ou Cmd+Shift+R)
2. **Abra o Console** (F12)
3. **Tente fazer login**
4. **Copie os logs** do console e do servidor
5. **Envie os logs** para análise

## Informações Importantes

- O admin é criado automaticamente quando o servidor inicia
- Email: `josyasborba@hotmail.com`
- Senha: `12345678`
- Se o servidor reiniciar, o admin será recriado (dados em memória)
