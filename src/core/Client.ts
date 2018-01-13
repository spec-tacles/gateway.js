import Spectacles, { encode, decode } from '@spectacles/spectacles.js';
import Connection from './Connection';
import { Error, codes } from '../util/errors';
import { AxiosRequestConfig } from 'axios';

export type Gateway = { url: string, shards: number };
export interface Options {
  token: string;
  group?: string;
  publisher?: string;
  events?: Iterable<string>;
  reconnect?: boolean;
  local?: boolean;
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

  /**
   * The group to publish events to.
   */
  public publisher: string;

  constructor(options: Options) {
    super(options.token, options.group || 'gateway');
    this.reconnect = options.reconnect === undefined ? true : options.reconnect;
    this.events = new Set(options.events || []);
    this.publisher = options.publisher || 'default';
    if (options.local) {
      this.publish = this.emit;
      this.subscribe = (() => {}) as any;
    }
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
      await this.subscribe(str);

      this.connections[shard] = new Connection(this, shard);
    }));
  }

  /**
   * Publish to opened channels.
   * @param channel the channel to send to
   * @param data the data to send
   * @param options options for publishing
   */
  public publish(event: string, data: Buffer) {
    return this.amqp.publish(this.publisher, event, data);
  }
};
