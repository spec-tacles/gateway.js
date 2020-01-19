# Spectacles Gateway

Spawns shards and manages a bot's lifetime on the Discord WebSocket gateway.

## Getting started

```js
const { Cluster } = require('@spectacles/gateway');
const cluster = new Cluster('a token');
cluster.spawn();
```

You've just spawned the recommended number of shards. If you want to use a custom or fixed shard count:

```js
const { Cluster, Gateway } = require('@spectacles/gateway');
const gateway = new Gateway('token', 30);

const cluster = new Cluster(gateway);
```

This will spawn 30 shards for the given token. Providing shard count isn't necessary after the first call.

## Events

The shard emits events in the form `[event name], [data]`. The cluster emits events in the form `[event name], [data], [shard]`. When using a cluster, events will only be emitted on shards that have event listeners. Available events:

- `open` - WebSocket opened
- `close` - WebSocket closures (follows the CloseEvent API)
- `error` - proxied from the underlying WebSocket connection
- `send` - before data is sent over the connection (emitted as unencoded packet, or buffer)
- `receive` - data that is received from the connection (decoded prior to emission)
- `connect` - explicit connections to the WebSocket (fired initially and upon any reconnections)
- `disconnect` - explicit disconnections from the WebSocket (i.e. when the client requests a connection closure)
- `[Discord gateway event]` - OP 0 data, keyed by `t` (only `d` is emitted)

For details about Discord Gateway events, check out [their documentation](https://discordapp.com/developers/docs/topics/gateway#commands-and-events).

```js
shard.on('MESSAGE_CREATE', message => {
  // message = https://discordapp.com/developers/docs/resources/channel#message-object-message-structure
});
```

## Properties

### `Cluster`

- `gateway: Gateway` - the gateway session to use with the cluster
- `token: string` - your token
- `shards: Map<number, Shard>` - a map of your shard connections, keyed by shard id
- _`constructor(token: string | Gateway)`_
- `spawn(shards: number | number[])` - spawn `shards` number of shards (if number), or spawn the specified shard IDs (if array)

### `Shard`

- *static readonly* `ZLIB_SUFFIX: UInt8Array` - the zlib suffix
- `gateway: Gateway` - the gateway session to use with this shard
- `client: Client` - the client of this shard
- `shard: number` - this shard id
- `version: 6` - the gateway version to use (locked at 6)
- _`constructor(token: string | Gateway, shard: number)`_
- *readonly* `seq: number` - the current sequence
- *readonly* `session?: string` - the current session identifier
- *readonly* `ws: WebSocket` - the raw websocket
- `connect(): Promise<void>` - connect to the gateway
- `disconnect(code?: number): Promise<void>` - disconnect
- `reconnect(code?: number): Promise<void>` - reconnect
- `identify(pk?: Partial<Identify>): Promise<void>` - identify
- `resume(): void` - resume the session
- `heartbeat(): void` - send a heartbeat
- `receive(data: WebSocket.Data): void` - handle packets received
- `send(opOrPK: number | buffer | Payload | string, d?: any): void` - send data to the gateway
  - `send(pk: Buffer)` - just send a buffer
  - `send(pk: Payload)` - send a pre-formatted payload object
  - `send(op: number | string, d: any)` - send `d` to the gateway: if `op` is a number, send as that op; if `op` is a string, send as op 0 with `op` as `t`

### `Gateway`

Represents connection information for a token.

- *static* `tokens: Map<string, Gateway>` - map of tokens to instantiated gateway instances; used to ensure singletons per token
- *static* `fetch(tokenOrGateway: string | Gateway): Gateway` - fetches the gateway for a given token
- _`constructor(token: string, shardCount?: number)`_
- `token: string` - the token of this gateway
- `shards: number` - total shard count of this token; recommended count is set if no value is provided
- *readonly* `url: string` - the gateway URL to connect to
- *readonly* `sessionStartLimit: null | { total: number, remaining: number, resetAfter: Date }` - information about the session start ratelimits
- `identify(shard: Shard, packet: Partial<Identify>): Promise<void>` - identify with the given shard; attempts to resume if a session is available on the shard
- `fetch(force = false): Promise<this>` - fetch gateway information; automatically called when connecting
