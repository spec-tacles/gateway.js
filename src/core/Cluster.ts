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
   * @param {number|number[]} [shards=this.gateway.shards] The shards to spawn
   */
  public async spawn(shards?: number | number[]): Promise<void> {
    const gateway = await Shard.fetchGateway(this.token);

    if (shards === undefined) shards = gateway.shards;
    if (typeof shards === 'number') {
      const count = shards;
      shards = Array(shards);
      for (let i = 0; i < count; i++) shards[i] = i;
    }

    for (const shard of shards) {
      const existing = this.shards.get(shard);
      if (existing) existing.reconnect();
      else this.shards.set(shard, new ClusterableShard(this, shard));
    }
  }
}
