import DataManager from '@spectacles/spectacles.js';

import Connection from './Connection';
import * as redis from 'redis-p';

import { Error, codes } from '../util/errors';

let erlpack: { pack: (d: any) => Buffer, unpack: (d: Buffer | Uint8Array) => any } | void;
try {
  erlpack = require('erlpack');
} catch (e) {
  // do nothing
}

export type Gateway = { url: string, shards: number } | null;
export interface Options {
  token: string;
  redis?: redis.ClientOpts,
  cache?: boolean;
};

export function decode(data: Buffer) {
  return erlpack ? erlpack.unpack(data) : JSON.parse(data.toString());
}

export function encode(data: any) {
  return erlpack ? erlpack.pack(data) : JSON.stringify(data);
}

export default class Client {
  public cache: boolean;
  public readonly connections: Connection[] = [];
  public readonly data: DataManager;

  public gateway: Gateway = null;

  constructor(options: Options) {
    this.cache = options.cache === undefined ? true : options.cache;
    this.data = new DataManager(options);
  }

  async fetchGateway(force = false): Promise<Gateway> {
    if (this.gateway && !force) return this.gateway;
    return this.gateway = (await this.data.rest.get<Gateway>('/gateway/bot')).data;
  }

  spawn(): void {
    if (!this.gateway) throw new Error(codes.NO_GATEWAY);
    if (this.connections.length) throw new Error(codes.ALREADY_SPAWNED);

    for (let i = 0; i < this.gateway.shards; i++) {
      const conn = new Connection(this, i);
      this.connections.push(conn);
      conn.connect();
    }

    this.data.redis.set('shards', this.gateway.shards.toString());

    const listener = this.data.redis.duplicate({ return_buffers: true });
    listener.on('message', (_: Buffer, buf: Buffer) => {
      const data = decode(buf) as { guild_id: string, d: any, op: number };
      if (typeof data.guild_id === 'number') this.connections[(data.guild_id >> 22) % this.connections.length].send(data.op, data.d);
    });
    listener.subscribe('SEND');
  }

  async login() {
    await this.fetchGateway();
    this.spawn();
  }
};
