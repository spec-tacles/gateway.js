import { RedisClient, Multi } from 'redis';

import tsubaki = require('tsubaki');
import Client from '../core/Client';

import * as structures from '../types/structures';

tsubaki.promisifyAll(RedisClient.prototype);
tsubaki.promisifyAll(Multi.prototype);

export default class Redis extends (<{ new(): any }> RedisClient) {
  public readonly c: Client;

  constructor(c: Client) {
    super();
    this.c = c;
  }
}
