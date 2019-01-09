import https = require('https');
const { version, repository } = require('../../package.json');

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
  public static fromToken(gatewayOrToken: string | Gateway): Gateway {
    return typeof gatewayOrToken === 'string' ? new this(gatewayOrToken) : gatewayOrToken;
  }

  public shards: number;
  public token!: string;
  protected _data?: GatewayData;

  constructor(token: string, shards: number = 0) {
    this.shards = shards;
    Object.defineProperty(this, 'token', {
      writable: true,
      configurable: true,
      value: token,
    });
  }

  public get url(): string {
    return this._data ? this._data.url : '';
  }

  public get sessionStartLimit(): null | { total: number, remaining: number, resetAfter: Date } {
    return this._data ? {
      total: this._data.session_start_limit.total,
      remaining: this._data.session_start_limit.remaining,
      resetAfter: new Date(this._data.session_start_limit.reset_after),
    } : null;
  }

  public fetch(force = false): Promise<this> {
    if (!force) return Promise.resolve(this);

    return new Promise<this>((resolve, reject) => {
      https.get({
        host: 'discordapp.com',
        path: '/api/v6/gateway/bot',
        headers: {
          Authorization: `Bot ${this.token}`,
          Accept: 'application/json',
          'User-Agent': `DiscordBot (${repository.url}, ${version})`,
        },
      }, (res) => {
        if (res.statusCode !== 200) return reject(res);

        let data = '';
        res
          .setEncoding('utf8')
          .on('data', chunk => data += chunk)
          .once('end', () => {
            res.removeAllListeners();

            try {
              this._data = JSON.parse(data)
              if (this.shards <= 0) this.shards = this._data!.shards;
              return resolve(this);
            } catch (e) {
              return reject(e);
            }
          })
          .once('error', reject);
      });
    });
  }
}
