# Spectacles Gateway

Spawns shards and manages a bot's lifetime on the Discord WebSocket gateway.

## Getting started

```js
const { Cluster } = require('@spectacles/gateway');
const cluster = new Cluster('a token');
cluster.spawn();
```

You've just spawned the recommended number of shards.

## Events

The shard emits events in the form `[event name], [data]`. The cluster emits events in the form `[event name], [data], [shard]`. When using a cluster, events will only be emitted on shards that have event listeners. Available events:

- `close` - WebSocket closures (follows the CloseEvent API)
- `error` - proxied from the underlying WebSocket connection
- `send` - before data is sent over the connection (emitted as unencoded packet, or buffer)
- `receive` - data that is received from the connection (decoded prior to emission)
- `connect` - explicit connections to the WebSocket (fired initially and upon any reconnections)
- `disconnect` - explicit disconnections from the WebSocket (i.e. when the client requests a connection closure)
- `[Discord gateway event]` - OP 0 data, keyed by `t` (only `d` is emitted)


## Properties

### `Cluster`

- `token: string` - your token
- `shards: Map<number, Shard>` - a map of your shard connections, keyed by shard id
- _`constructor(token: string)`_
- `spawn(shards: number | number[])` - spawn `shards` number of shards (if number), or spawn the specified shard IDs (if array)

### `Shard`

- *static* `gateway?: { url: string, shards: number }` - information about the gateway to connect to and how many shards to use in total
- *static* `fetchGateway(force = false): Promise<{ url: string, shards: number }>` - fetch gateway info from discord or from cache unless forced
- `client: Client` - the client of this shard
- `shard: number` - this shard id
- `version: 6` - the gateway version to use (locked at 6)
- _`constructor(token: string, shard: number)`_
- *readonly* `seq: number` - the current sequence
- *readonly* `session?: string` - the current session identifier
- *readonly* `ws: WebSocket` - the raw websocket
- `connect(): Promise<void>` - connect to the gateway
- `disconnect(code?: number): Promise<void>` - disconnect
- `reconnect(code?: number): Promise<void>` - reconnect
- `identify(pk?: Partial<Identify>): Promise<void>` - identify
- `resume(): Promise<void>` - resume the session
- `heartbeat(): Promise<void>` - send a heartbeat
- `receive(data: WebSocket.Data): void` - handle packets received
- `send(opOrPK: number | buffer | Payload | string, d?: any): Promise<void>` - send data to the gateway
  - `send(pk: Buffer)` - just send a buffer
  - `send(pk: Payload)` - send a pre-formatted payload object
  - `send(op: number | string, d: any)` - send `d` to the gateway: if `op` is a number, send as that op; if `op` is a string, send as op 0 with `op` as `t`
