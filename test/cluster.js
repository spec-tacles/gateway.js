const { Cluster } = require('../dist');
const { inspect } = require('util');

if (typeof process.env.DISCORD_TOKEN !== 'string') throw new Error('no token');
const client = new Cluster(process.env.DISCORD_TOKEN);

client.on('close', console.log.bind(null, 'close'));
client.on('connect', console.log.bind(null, 'connect'));
client.on('disconnect', console.log.bind(null, 'disconnect'));
client.on('send', console.log.bind(null, 'send'));
client.on('receive', (pk) => console.log('receive', inspect(pk, { depth: 1 })));
client.on('error', console.log);

(async () => {
  await client.spawn();
})();
