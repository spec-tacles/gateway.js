const { Client } = require('../dist');

if (typeof process.env.token !== 'string') throw new Error('no token');
const client = new Client(process.env.token);

client.on('MESSAGE_CREATE', console.log);
client.on('close', console.log);

(async () => {
  await client.spawn();
  console.log('spawned');
})();
