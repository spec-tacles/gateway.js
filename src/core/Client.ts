import { AxiosInstance } from 'axios';

import Connection from './Connection';
import redis from '../redis';

import { Error, codes } from '../util/errors';
import request from '../util/request';

export type Gateway = { url: string, shards: number } | null;
export interface Options {
  token: string;
  cache?: boolean;
};

export default class Client {
  public readonly token: string;
  public cache: boolean;

  public readonly redis: any;
  public readonly request: AxiosInstance;
  public readonly connections: Connection[] = [];

  public gateway: Gateway = null;

  constructor(options: Options) {
    Object.defineProperty(this, 'token', { value: options.token });

    this.redis = redis();
    this.cache = options.cache === undefined ? true : options.cache;
    this.request = request(options.token);
  }

  async fetchGateway(force = false): Promise<Gateway> {
    if (this.gateway && !force) return this.gateway;
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
