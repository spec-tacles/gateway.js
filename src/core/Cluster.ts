import Shard, { Shardable } from './Shard';
import ClusterableShard from './ClusterableShard';
import { EventEmitter } from 'events';

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
export default class Cluster extends EventEmitter implements Shardable {
  public token: string;

  /**
   * Whether to attempt to automatically reconnect; if false, an error event will be emitted on the client.
   * @type {boolean}
   */
  public reconnect: boolean = true;

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
  constructor(token: string) {
    super();
    this.token = token;
  }

  /**
   * Spawn shards.
   * @param {number} [min=0] The lowest shard ID to spawn
   * @param {number} [max=Infinity] The highest shard ID to spawn, limited to the shard count from Shard.fetchGateway
   */
  public async spawn(min: number = 0, max: number = Infinity): Promise<void> {
    const { shards } = await Shard.fetchGateway(this.token);
    if (max > shards) max = shards;

    for (let id = min; id < max; id++) {
      const existing = this.shards.get(id);
      if (existing) existing.reconnect();
      else this.shards.set(id, new ClusterableShard(this, id));
    }
  }
}
