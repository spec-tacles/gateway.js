const { Client } = require('../dist');
const { inspect } = require('util');

if (typeof process.env.token !== 'string') throw new Error('no token');
const client = new Client(process.env.token);

client.on('close', console.log.bind(null, 'close'));
client.on('connect', console.log.bind(null, 'connect'));
client.on('disconnect', console.log.bind(null, 'disconnect'));
client.on('send', console.log.bind(null, 'send'));
// client.on('receive', (shard, pk) => console.log('receive', inspect(pk, { depth: 1 })));

(async () => {
  await client.spawn();
  console.log('spawned');
  // setTimeout(() => {
  //   const c = client.connections.get(0);
  //   // c.reconnect();
  //   c.disconnect();
  // }, 5000);
})();
