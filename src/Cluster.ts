import ClusterableShard from './ClusterableShard';
import { EventEmitter } from 'events';
import Gateway from './Gateway';

/**
 * Information about connecting to the Discord gateway.
 * @typedef Gateway
 * @type {object}
 * @prop {string} url The URL of the gateway
 * @prop {number} shards The shard count to use
 */

/**
 * @typedef WSOptions
 * @type {object}
 * @prop {?boolean} reconnect Whether to automatically attempt to reconnect
 */

/**
 * Manages connections to the gateway.
 */
export default class Cluster extends EventEmitter {
  public gateway: Gateway;

  /**
   * Current connections to the gateway.
   * @type {Map<number, Shard>}
   * @readonly
   */
  public readonly shards: Map<number, ClusterableShard> = new Map();

  /**
   * @constructor
   * @param {Client} client The client of this manager
   * @param {WSOptions} [options={}] Connection options
   */
  constructor(token: string | Gateway) {
    super();
    this.gateway = Gateway.fromToken(token);
  }

  /**
   * Spawn shards. Providing no parameters will spawn the recommended shard count.
   * @param {?number|Array<number>} [minOrIDs] The lowest shard ID to spawn, or an array of shard IDs to spawn
   * @param {?number} [max] The highest shard ID to spawn, limited to the shard count
   * from Shard.fetchGateway; if not provided, minOrIDs will be taken as a single shard ID
   */
  public spawn(): void;
  public spawn(id: number): void;
  public spawn(ids: number[]): void;
  public spawn(min: number, max: number): void;
  public spawn(minOrIDs?: number | number[], max?: number): void {
    if (typeof minOrIDs === 'undefined') {
      // no parameters provided
      this.spawn(0, this.gateway.shards);
    } else if (Array.isArray(minOrIDs)) {
      // array of shard IDs provided
      minOrIDs.map(id => this.spawn(id));
    } else if (max !== undefined) {
      // range of shard IDs provided
      if (max > this.gateway.shards) max = this.gateway.shards;
      for (; minOrIDs < max; minOrIDs++) this.spawn(minOrIDs);
    } else {
      // single shard ID provided
      const existing = this.shards.get(minOrIDs);
      if (existing) existing.reconnect();
      else this.shards.set(minOrIDs, new ClusterableShard(this, minOrIDs));
    }
  }

  public kill(closeCode?: number): void {
    for (const shard of this.shards.values()) shard.disconnect(closeCode);
  }
}
