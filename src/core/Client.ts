import Spectacles, { encode, decode, exchanges } from '@spectacles/spectacles.js';
import Connection from './Connection';
import { Error, codes } from '../util/errors';
import { AxiosRequestConfig } from 'axios';

export type Gateway = { url: string, shards: number };
export interface Options {
  token: string;
  events?: Iterable<string>;
  reconnect?: boolean;
};

declare module 'axios' {
  class AxiosInstance {
    get<T = any>(url: string, options?: AxiosRequestConfig): Promise<T>;
    delete<T = any>(url: string, options?: AxiosRequestConfig): Promise<T>;
    head<T = any>(url: string, options?: AxiosRequestConfig): Promise<T>;
    options<T = any>(url: string, options?: AxiosRequestConfig): Promise<T>;
    post<T = any>(endpoint: string, data: any, options?: AxiosRequestConfig): Promise<T>;
    put<T = any>(url: string, data: any, options?: AxiosRequestConfig): Promise<T>;
    patch<T = any>(endpoint: string, data: any, options?: AxiosRequestConfig): Promise<T>;
  }
}

export default class Client extends Spectacles {
  /**
   * Whether to automatically reconnect upon unhandleable websocket close
   */
  public reconnect: boolean;

  /**
   * Events to send to the message broker. WARNING: ensure all and only these events are consumed by connected clients
   */
  public events: Set<string>;

  /**
   * Current websocket connections
   */
  public readonly connections: Connection[] = [];

  /**
   * Gateway connection information
   */
  public gateway?: Gateway;

  constructor(options: Options) {
    super(options.token);
    this.reconnect = options.reconnect === undefined ? true : options.reconnect;
    this.events = new Set(options.events || []);
  }

  public async fetchGateway(force = false): Promise<Gateway> {
    if (this.gateway && !force) return this.gateway;
    const gateway = await this.rest.get<Gateway>('/gateway/bot');
    return this.gateway = gateway;
  }

  public async spawn(shards?: number | number[], total?: number): Promise<void> {
    const gateway = await this.fetchGateway();

    if (total !== undefined) gateway.shards = total;
    if (shards === undefined) shards = gateway.shards;
    if (typeof shards === 'number') {
      const count = shards;
      shards = Array(shards);
      for (let i = 0; i < count; i++) shards[i] = i;
    }

    await Promise.all(shards.map(async shard => {
      const str = shard.toString();
      this.on(str, async ({ op, d }, ack) => {
        try {
          await this.connections[shard].send(op, d);
          ack();
        } catch (e) {
          this.emit('error', e);
        }
      });
      const q = await this.open(str, { exchange: exchanges.SEND, queue: '' });
      await this.subscribe(q.queue);

      this.connections[shard] = new Connection(this, shard);
    }));
  }

  public async connect(url: string, options?: any) {
    await super.connect(url, options);
    await Promise.all(Array.from(this.events).map(e => this.open(e)));
  }

  /**
   * Publish to opened channels.
   * @param channel the channel to send to
   * @param data the data to send
   * @param options options for publishing
   */
  public publish(event: string, data: Buffer) {
    return this.amqp.publish(exchanges.RECEIVE, event, data);
  }
};
