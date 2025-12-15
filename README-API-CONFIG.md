# Configuração da API

## URLs da API

### Desenvolvimento Local
```
http://localhost:8088/ons-api/api/v1
```

### Produção
```
https://projeto-ons-backendons-f5u22n-2dd318-147-93-32-227.traefik.me/ons-api/api/v1
```

## Como Configurar

### Opção 1: Variável de Ambiente (Recomendado)

Crie um arquivo `.env` na raiz do projeto `ons_front`:

```env
# Para desenvolvimento local
VITE_API_BASE_URL=http://localhost:8088/ons-api/api/v1

# Para produção (ou use .env.production)
VITE_API_BASE_URL=https://projeto-ons-backendons-f5u22n-2dd318-147-93-32-227.traefik.me/ons-api/api/v1
```

### Opção 2: Arquivos de Ambiente por Ambiente

- `.env.development` - Para desenvolvimento local
- `.env.production` - Para produção

O Vite automaticamente carrega o arquivo correto baseado no modo de execução.

## Build para Produção

Ao fazer o build para produção, certifique-se de que a variável `VITE_API_BASE_URL` está configurada corretamente:

```bash
# Build com URL de produção
VITE_API_BASE_URL=https://projeto-ons-backendons-f5u22n-2dd318-147-93-32-227.traefik.me/ons-api/api/v1 npm run build
```

Ou configure no arquivo `.env.production` antes do build.

## Arquivos que Usam a Configuração

- `client/lib/api-config.ts` - Configuração centralizada
- `client/lib/auth-api.ts` - Autenticação
- `client/lib/avd-api.ts` - API de AVD (Aviso de Débito)
- `client/pages/AvisoDebito.tsx` - Upload de comprovantes

Todos os arquivos importam a configuração de `api-config.ts`, garantindo consistência.

