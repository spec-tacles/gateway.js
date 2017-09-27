import Client from './core/Client';

if (typeof process.env.token !== 'string') throw new Error('no token');
const client = new Client({ token: process.env.token || '' });
client.login();
