# XChannel WebChat Widget

Widget React embutivel para conversar com o backend do XChannel por APIs REST e uma camada de tempo real substituivel.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

O build gera `dist/xchannel-webchat.js`.

## Arquitetura

```text
src/
├── components/   # UI isolada, sem chamada direta a API
├── contexts/     # WidgetConfigContext e ChatContext
├── hooks/        # Fachadas para estado e realtime
├── services/     # REST e realtime
├── types/        # Contratos de dominio e payloads
├── utils/        # Helpers puros
├── App.tsx       # Composicao dos providers e UI
└── main.tsx      # Entrypoint, Shadow DOM e validacao inicial
```

Componentes chamam hooks. Hooks/contextos coordenam estado e services. Estilos sao injetados somente no Shadow Root.

## Uso embutido

```html
<script
  src="https://xchannel.riosoft.com/widget/xchannel-webchat.js"
  data-widget-key="abc123"
  data-auth-token="token-emitido-pelo-host"
  data-api-base-url="https://xchannel.riosoft.com"
></script>
```

`data-auth-token` e enviado em todas as chamadas HTTP como `Authorization: Bearer <token>`,
incluindo `POST /api/ChatWidget/bootstrap`. O XChannel deve usar esse token para
identificar se a sessao pertence a um visitante anonimo, landing page, CRM ou outro
sistema integrado. `data-token` tambem e aceito como alias. `data-user-token`
continua funcionando como fallback por compatibilidade.

## Contexto de usuario logado

```html
<script
  src="https://xchannel.riosoft.com/widget/xchannel-webchat.js"
  data-widget-key="abc123"
  data-api-base-url="https://xchannel.riosoft.com"
  data-auth-token="token-real-do-sistema"
  data-external-user-id="cliente-42"
  data-user-name="Maria Silva"
  data-user-email="maria@example.com"
></script>
```

O modo final do widget nao e decidido pelo front. A resposta de `bootstrap` deve
informar se a sessao e `anonymous` ou `authenticated` e quais recursos estao
habilitados.

Tambem e possivel inicializar via JavaScript:

```js
window.XChannelWebChat.init({
  apiBaseUrl: 'https://xchannel.riosoft.com',
  authToken: 'token-real-do-sistema',
  sourceSystem: 'CRM',
});
```

## Contrato REST esperado

- `POST /api/ChatWidget/bootstrap`
- `GET /api/ChatWidget/conversations`
- `POST /api/ChatWidget/conversations`
- `GET /api/ChatWidget/conversations/{chatGuid}/messages`
- `POST /api/ChatWidget/conversations/{chatGuid}/messages`
- `POST /api/ChatWidget/conversations/{chatGuid}/attachments`
- `POST /api/ChatWidget/conversations/{chatGuid}/close`

Enquanto o backend nao existir, use `data-demo-mode="true"` ou omita `data-api-base-url` para rodar com mock local.
