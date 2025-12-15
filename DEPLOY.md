# Guia de Deploy no Vercel

## Pré-requisitos

1. Ter uma conta no Vercel (https://vercel.com)
2. Ter o projeto conectado ao Git (GitHub, GitLab ou Bitbucket)

## Opção 1: Deploy via CLI do Vercel

### Primeira vez (autenticação):
```bash
npx vercel login
```

### Deploy de produção:
```bash
npx vercel --prod
```

### Deploy de preview (para testar):
```bash
npx vercel
```

## Opção 2: Deploy via Dashboard do Vercel

1. Acesse https://vercel.com
2. Clique em "Add New Project"
3. Conecte seu repositório Git
4. Configure:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `.` (raiz)
   - **Install Command**: `npm install`
5. Clique em "Deploy"

## Opção 3: Deploy automático via Git

Se o projeto já está conectado ao Vercel:
- **Push para `main`/`master`**: Deploy automático de produção
- **Push para outras branches**: Deploy automático de preview

## Verificar configuração

O projeto já está configurado com:
- ✅ `vercel.json` configurado
- ✅ Função serverless em `api/index.ts`
- ✅ Build command: `npm run build`
- ✅ Rotas configuradas para SPA e API

## Comandos úteis

```bash
# Ver status do deploy
npx vercel ls

# Ver logs
npx vercel logs

# Remover deploy
npx vercel remove

# Ver informações do projeto
npx vercel inspect
```

