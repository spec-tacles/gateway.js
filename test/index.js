const { Client } = require('../dist');

if (typeof process.env.token !== 'string') throw new Error('no token');
const client = new Client({
  token: process.env.token || '',
  events: new Set().add('MESSAGE_CREATE').add('GUILD_CREATE'),
  local: true,
});

client.on('MESSAGE_CREATE', console.log);

(async () => {
  // await client.connect('localhost:32768');
  // console.log('connected');
  await client.spawn();
  console.log('spawned');
})();
