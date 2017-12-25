const { Client } = require('../dist');

if (typeof process.env.token !== 'string') throw new Error('no token');
const client = new Client({
  token: process.env.token || '',
  events: new Set().add('MESSAGE_CREATE').add('GUILD_CREATE'),
});

(async () => {
  await client.login('localhost:32768');
})();
