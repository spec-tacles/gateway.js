import * as redis from 'redis';

import tsubaki = require('tsubaki');
import Client from '../core/Client';

import * as structures from '../types/structures';

tsubaki.promisifyAll(redis.RedisClient.prototype);
tsubaki.promisifyAll(redis.Multi.prototype);

export default redis.createClient as any;
