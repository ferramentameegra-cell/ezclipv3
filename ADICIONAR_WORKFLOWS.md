# 📝 Como Adicionar Workflows Manualmente

Como o token atual não tem permissão `workflow`, você precisa adicionar os workflows manualmente via interface do GitHub.

## Opção 1: Via Interface do GitHub (Recomendado)

1. Acesse: https://github.com/ferramentameegra-cell/ezclipv3
2. Clique em "Add file" > "Create new file"
3. Caminho: `.github/workflows/auto-deploy.yml`
4. Cole o conteúdo do arquivo `auto-deploy.yml` que está no repositório local
5. Clique em "Commit new file"

## Opção 2: Usar Token com Permissão Workflow

1. Crie um novo token em: https://github.com/settings/tokens/new
2. Marque a permissão `workflow` ✅
3. Atualize o remote:
```bash
git remote set-url origin https://NOVO_TOKEN@github.com/ferramentameegra-cell/ezclipv3.git
```
4. Faça push:
```bash
git push origin main
```

## Opção 3: Usar Railway Dashboard (Mais Simples)

A forma mais fácil é conectar o GitHub diretamente no Railway:

1. Acesse: https://railway.app
2. "New Project" > "Deploy from GitHub repo"
3. Selecione `ferramentameegra-cell/ezclipv3`
4. Ative "Auto Deploy" nas configurações

Isso fará deploy automático sem precisar de GitHub Actions!



