# Spectacles Gateway

Spawns shards and manages a bot's lifetime on the Discord WebSocket gateway.

## Getting started

```js
const { Client } = require('@spectacles/gateway');
const client = new Client('a token');
client.spawn();
```

You've just spawned the recommended number of shards.

## Events

The client emits events from its shards in the form `[event name], [shard id], [data]`.  Available events:

- `close` - WebSocket closures (follows the CloseEvent API)
- `error` - proxied from the underlying WebSocket connection
- `send` - data that is sent over the connection
- `receive` - data that is received from the connection (decoded prior to emission)
- `connect` - explicit connections to the WebSocket (fired initially and upon any reconnections)
- `disconnect` - explicit disconnections from the WebSocket (i.e. when the client requests a connection closure)
- `[Discord gateway event]` - OP 0 data, keyed by `t` (only `d` is emitted)