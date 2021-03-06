import fetch from 'node-fetch';
import pThrottle from 'p-throttle';
import { platform } from 'os';
import { OP } from '@spectacles/types';
import { Errors } from '@spectacles/util';
import Shard, { Identify, wait } from './Shard';
import HttpError from './util/HttpError';
const { version, repository } = require('../package.json');

export interface GatewayData {
  url: string;
  shards: number;
  session_start_limit: {
    total: number;
    remaining: number;
    reset_after: number;
  };
}

export default class Gateway {
  public static tokens: Map<string, Gateway> = new Map();

  public static fetch(gatewayOrToken: string | Gateway, shardCount?: number): Gateway {
    if (typeof gatewayOrToken === 'string') {
      const existing = this.tokens.get(gatewayOrToken);
      if (existing) return existing;
      return new this(gatewayOrToken, shardCount);
    }

    return gatewayOrToken;
  }

  public token!: string;
  protected _data?: GatewayData;
  protected _shards?: number;

  constructor(token: string, shards: number = 0) {
    this._shards = shards;
    Object.defineProperty(this, 'token', {
      writable: true,
      configurable: true,
      value: token,
    });

    this.identify = pThrottle(this.identify, 1, 5e3);
  }

  public get shards(): number {
    if (!this._shards) throw new Errors.Error(Errors.Codes.NO_GATEWAY);
    return this._shards;
  }

  public set shards(count: number) {
    this._shards = count;
  }

  public get url(): string {
    if (!this._data) throw new Errors.Error(Errors.Codes.NO_GATEWAY);
    return this._data.url;
  }

  public get sessionStartLimit(): null | { total: number, remaining: number, resetAfter: Date } {
    return this._data ? {
      total: this._data.session_start_limit.total,
      remaining: this._data.session_start_limit.remaining,
      resetAfter: new Date(this._data.session_start_limit.reset_after),
    } : null;
  }

  public async identify(shard: Shard, packet?: Partial<Identify>): Promise<void> {
    if (shard.session) return shard.resume();

    if (this.sessionStartLimit && this.sessionStartLimit.remaining === 0) {
      await wait(this.sessionStartLimit.resetAfter.getTime() - Date.now());
    }

    return shard.send(OP.IDENTIFY, Object.assign({
      token: this.token,
      properties: {
        $os: platform(),
        $browser: 'spectacles',
        $device: 'spectacles',
      },
      compress: false,
      large_threshold: 250,
      shard: [shard.id, this.shards],
      presence: {},
    }, packet));
  }

  public async fetch(force = false): Promise<this> {
    if (!force && this._data) return Promise.resolve(this);

    const res = await fetch('https://discordapp.com/api/v6/gateway/bot', {
      headers: {
        Authorization: `Bot ${this.token}`,
        Accept: 'application/json',
        'User-Agent': `DiscordBot (${repository.url}, ${version})`,
      },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText);

    this._data = await res.json();
    if (!this._shards || this._shards <= 0) this._shards = this._data!.shards;
    return this;
  }
}
