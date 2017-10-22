const { Client } = require('../dist');
const { dispatch } = require('../dist/util/constants');

if (typeof process.env.token !== 'string') throw new Error('no token');
const client = new Client({ token: process.env.token || '' });
client.login();

const redis = client.redis.duplicate();
redis.on('message', console.log);
redis.subscribe('READY');
