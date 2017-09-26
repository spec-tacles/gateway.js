import Client from './core/Client';

const client = new Client();
(async () => {
  await client.fetchGateway();
  client.spawn();
})();
