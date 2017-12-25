import Spectacles, { decode } from '@spectacles/spectacles.js';
import Connection from './Connection';
import { Error, codes } from '../util/errors';

export type Gateway = { url: string, shards: number };
export interface Options {
  token: string;
  events?: Set<string>;
  reconnect?: boolean;
};

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
    this.events = options.events || new Set();
  }

  async fetchGateway(force = false): Promise<Gateway> {
    if (this.gateway && !force) return this.gateway;
    const gateway = (await this.rest.get<Gateway>('/gateway/bot')).data;
    return this.gateway = gateway;
  }

  spawn(): void {
    if (!this.gateway) throw new Error(codes.NO_GATEWAY);
    if (this.connections.length) throw new Error(codes.ALREADY_SPAWNED);

    for (let i = 0; i < this.gateway.shards; i++) {
      const conn = new Connection(this, i);
      this.connections.push(conn);
      conn.connect();
    }
  }

  async login(url: string = 'localhost', options?: any) {
    await this.connect(url, options);
    await this.fetchGateway();
    this.spawn();

    this.on(Spectacles.SEND_QUEUE, (buf: Buffer) => {
      const data = decode<{ guild_id: string, d: any, op: number }>(buf);
      if (data.guild_id) this.connections[(data.guild_id as any >> 22) % this.connections.length].send(data.op, data.d);
    });

    await this.open([Spectacles.SEND_QUEUE, ...this.events]);
    await this.subscribe(Spectacles.SEND_QUEUE);
  }
};
