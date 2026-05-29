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

## Uso embutido

```html
<script
  src="https://xchannel.riosoft.com/widget/xchannel-webchat.js"
  data-widget-key="abc123"
  data-api-base-url="https://xchannel.riosoft.com"
></script>
```

## Contexto de usuario logado

```html
<script
  src="https://xchannel.riosoft.com/widget/xchannel-webchat.js"
  data-widget-key="abc123"
  data-api-base-url="https://xchannel.riosoft.com"
  data-external-user-id="cliente-42"
  data-user-name="Maria Silva"
  data-user-email="maria@example.com"
></script>
```

Para MVP isso permite contexto simples. A autenticacao forte deve evoluir para `data-user-token`, emitido por endpoint seguro do sistema hospedeiro.

## Contrato REST esperado

- `POST /api/ChatWidget/bootstrap`
- `GET /api/ChatWidget/conversations`
- `POST /api/ChatWidget/conversations`
- `GET /api/ChatWidget/conversations/{chatGuid}/messages`
- `POST /api/ChatWidget/conversations/{chatGuid}/messages`
- `POST /api/ChatWidget/conversations/{chatGuid}/attachments`
- `POST /api/ChatWidget/conversations/{chatGuid}/close`

Enquanto o backend nao existir, use `data-demo-mode="true"` ou omita `data-api-base-url` para rodar com mock local.

