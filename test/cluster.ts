import { Cluster } from '../src';
import { inspect } from 'util';

if (typeof process.env.DISCORD_TOKEN !== 'string') throw new Error('no token');
const client = new Cluster(process.env.DISCORD_TOKEN);
client.gateway.shards = 10;

client.on('close', (shard) => console.log('close', shard.id));
client.on('connect', (shard) => console.log('connect', shard.id));
client.on('disconnect', (shard) => console.log('disconnect', shard.id));
client.on('send', (d, shard) => console.log('send', shard.id, d));
client.on('receive', (pk, shard) => console.log('receive', shard.id, inspect(pk, { depth: 1 })));
client.on('error', console.log);

(async () => {
  await client.spawn();
})();
