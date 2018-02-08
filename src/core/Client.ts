import Connection from './Connection';
import https = require('https');
import { EventEmitter } from 'events';

/**
 * Information about connecting to the Discord gateway.
 * @typedef Gateway
 * @type {object}
 * @prop {string} url The URL of the gateway
 * @prop {number} shards The shard count to use
 */
export type Gateway = { url: string, shards: number };

/**
 * @typedef WSOptions
 * @type {object}
 * @prop {?boolean} reconnect Whether to automatically attempt to reconnect
 */
export interface Options {
  reconnect?: boolean;
}

/**
 * Manages connections to the gateway.
 */
export default class Client extends EventEmitter {
  public token: string;

  /**
   * Whether to attempt to automatically reconnect; if false, an error event will be emitted on the client.
   * @type {boolean}
   */
  public reconnect: boolean;

  /**
   * Current connections to the gateway.
   * @type {Connection[]}
   * @readonly
   */
  public readonly connections: Map<number, Connection> = new Map();

  /**
   * Information about the gateway.
   * @type {Gateway}
   */
  public gateway?: Gateway;

  /**
   * @constructor
   * @param {Client} client The client of this manager
   * @param {WSOptions} [options={}] Connection options
   */
  constructor(token: string, options: Options = {}) {
    super();
    this.token = token;
    this.reconnect = options.reconnect === undefined ? true : options.reconnect;
  }

  /**
   * Fetch the gateway info.
   * @param {boolean} [force={}] Whether to override any previous cache
   */
  public async fetchGateway(force = false): Promise<Gateway> {
    if (this.gateway && !force) return this.gateway;

    return this.gateway = await new Promise<Gateway>((resolve, reject) => {
      https.get({
        host: 'discordapp.com',
        path: '/api/v6/gateway/bot',
        headers: {
          Authorization: `Bot ${this.token}`,
        },
      }, (res) => {
        if (res.statusCode !== 200) return reject(res);

        let data = '';
        res
          .setEncoding('utf8')
          .on('data', chunk => data += chunk)
          .once('end', () => {
            try {
              return resolve(JSON.parse(data));
            } catch (e) {
              return reject(e);
            }
          })
          .once('error', reject);
      });
    });
  }

  /**
   * Spawn shards.
   * @param {number|number[]} [shards=this.gateway.shards] The shards to spawn
   */
  public async spawn(shards?: number | number[]): Promise<void> {
    const gateway = await this.fetchGateway();

    if (shards === undefined) shards = gateway.shards;
    if (typeof shards === 'number') {
      const count = shards;
      shards = Array(shards);
      for (let i = 0; i < count; i++) shards[i] = i;
    }

    await Promise.all(shards.map(shard => {
      const conn = new Connection(this, shard);
      this.connections.set(shard, conn);
      return conn.connect();
    }));
  }
}
