import { AxiosInstance } from 'axios';
import DataManager from '@spectacles/spectacles.js';

import Connection from './Connection';
import * as redis from 'redis-p';

import { Error, codes } from '../util/errors';

export type Gateway = { url: string, shards: number } | null;
export interface Options {
  token: string;
  redis?: redis.ClientOpts,
  cache?: boolean;
};

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
    return this.gateway = (await this.data.rest.get('/gateway/bot')).data;
  }

  spawn(): void {
    if (!this.gateway) throw new Error(codes.NO_GATEWAY);

    this.connections.splice(0, this.connections.length);
    for (let i = 0; i < this.gateway.shards; i++) {
      const conn = new Connection(this, i);
      this.connections.push(conn);
      conn.connect();
    }
  }

  async login() {
    await this.fetchGateway();
    this.spawn();
  }
};
