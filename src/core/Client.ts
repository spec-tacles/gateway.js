import { AxiosInstance } from 'axios';

import Connection from './Connection';
import Redis from '../redis';

import { Error, codes } from '../util/errors';
import request from '../util/request';

export type Gateway = { url: string, shards: number } | null;
export interface Options {
  token: string;
};

export default class Client {
  public readonly options: Options;
  public readonly redis: Redis;
  public readonly request: AxiosInstance;
  public readonly connections: Connection[] = [];

  public gateway: Gateway = null;

  constructor(options: Options) {
    this.options = options;
    this.redis = new Redis(this);
    this.request = request(options.token);
  }

  async fetchGateway(): Promise<Gateway> {
    return this.gateway = (await this.request.get('/gateway/bot')).data;
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
