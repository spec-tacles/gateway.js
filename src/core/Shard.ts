import * as WebSocket from 'ws';
import * as https from 'https';
import * as os from 'os';
import * as throttle from 'p-throttle';
import { promisify } from 'util';
import { Constants, Errors, encoding, encode, decode } from '@spectacles/util';
import { Presence } from '@spectacles/types';

import CloseEvent from '../util/CloseEvent';
import { EventEmitter } from 'events';

const { version } = require('../../package.json');
const { OP, Dispatch } = Constants;
const { Codes, Error } = Errors;
const wait = promisify(setTimeout);

const identify = throttle(async function (this: Shard, packet: Partial<Identify> = {}) {
  if (this.session) this.resume();

  await this.send(OP.IDENTIFY, Object.assign({
    token: this.token,
    properties: {
      $os: os.platform(),
      $browser: 'spectacles',
      $device: 'spectacles',
    },
    compress: encoding === 'etf',
    large_threshold: 250,
    shard: [this.id, (await this.fetchGateway()).shards],
    presence: {},
  }, packet));
}, 1, 5e3);

export interface Identify {
  token: string,
  properties: {
    $os: string,
    browser: string,
    device: string,
  },
  compress: string,
  large_threshold: number,
  shard: [number, number],
  presence: Partial<Presence>,
}

export interface Payload {
  t?: string,
  s?: number,
  op: number,
  d: any
}

export type Gateway = { url: string, shards: number };

export interface Shardable {
  token: string;
}

/**
 * A Discord Gateway payload.
 * @typedef Payload
 * @type {object}
 * @property {?string} t
 * @property {?number} s
 * @property {number} op
 * @property {*} d
 */

/**
 * A connection to the Discord Gateway.
 */
export default class Shard extends EventEmitter implements Shardable {
  public static gateway?: Gateway;

  public static async fetchGateway(token: string, force = false) {
    if (this.gateway && !force) return this.gateway;

    return this.gateway = await new Promise<Gateway>((resolve, reject) => {
      https.get({
        host: 'discordapp.com',
        path: '/api/v6/gateway/bot',
        headers: {
          Authorization: `Bot ${token}`,
          Accept: 'application/json',
          'User-Agent': `DiscordBot (https://github.com/spec-tacles/gateway, ${version})`,
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
              return resolve(JSON.parse(data));
            } catch (e) {
              return reject(e);
            }
          })
          .once('error', reject);
      });
    });
  }

  // public readonly client: Client;
  public readonly id: number;

  /**
   * The API version to use.
   * @type {number}
   * @default [6]
   * @readonly
   */
  public readonly version: number = 6;

  /**
   * Send an identify packet. Will attempt to resume if a session is available.
   * @returns {Promise<undefined>}
   */
  public identify: (pk?: Partial<Identify>) => Promise<void>;

  /**
   * The sequence of this connection.
   * @type {number}
   * @default [-1]
   * @private
   */
  public seq: number = 0;

  /**
   * The session identifier of this connection.
   * @type {?string}
   * @private
   */
  public session: string | null = null;

  /**
   * The underlying websocket connection.
   * @type {WebSocket}
   */
  public ws!: WebSocket;

  public token: string;

  /**
   * The heartbeater interval.
   * @type {Timer}
   * @private
   */
  private _heartbeater?: NodeJS.Timer = undefined;

  /**
   * Whether the Discord Gateway has acknowledged the previous heartbeat.
   * @type {boolean}
   * @private
   */
  private _acked: boolean = true;

  /**
   * @constructor
   * @param {string} token The token to connect with
   * @param {number} shard The shard of this connection
   */
  constructor(token: string, id: number) {
    super();
    this.token = token;

    /**
     * The shard that this connection represents.
     * @type {number}
     * @readonly
     */
    this.id = id;

    this.receive = this.receive.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);

    this.send = throttle(this.send.bind(this), 120, 60);
    this.identify = identify;

    this.connect();
  }

  /**
   * Connect to the gateway.
   * @returns {Promise<undefined>}
   */
  public connect(): Promise<void> {
    const connect = async (r: () => void) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) await this.disconnect();
      this.emit('connect');

      this.ws = new WebSocket(`${(await this.fetchGateway()).url}?v=${this.version}&encoding=${encoding}`);
      this._registerWSListeners();

      this._acked = true;
      this.ws.once('open', r);
    };

    return new Promise(r => setImmediate(connect, r));
  }

  /**
   * Disconnect from the gateway.
   * @param {?number} code The code to close the connection with, if any.
   * @returns {Promise<undefined>}
   */
  public async disconnect(code?: number): Promise<void> {
    if ([WebSocket.CLOSED, WebSocket.CLOSING].includes(this.ws.readyState)) return Promise.resolve();
    this.emit('disconnect');
    this._reset();

    this.ws.close(code);
    await new Promise(r => this.ws.once('close', r));
  }

  /**
   * Disconnect and reconnect to the gateway after a 1s timeout.
   * @param {?number} code The code to close the connection with, if any.
   * @param {?number} delay The time (in ms) to delay between disconnect and connect
   * @returns {Promise<undefined>}
   */
  public async reconnect(code?: number, delay: number = 1e3 + Math.random() - 0.5): Promise<void> {
    await this.disconnect(code);
    await wait(delay);
    await this.connect();
  }

  /**
   * Resume your session with the gateway.
   * @returns {Promise<undefined>}
   * @throws {Error} Throws if there's no session available to resume.
   */
  public resume(): Promise<void> {
    if (!this.session) throw new Error(Codes.NO_SESSION);

    return this.send(OP.RESUME, {
      token: this.token,
      seq: this.seq,
      session_id: this.session,
    });
  }

  /**
   * Send a heartbeat to the gateway.
   * @returns {Promise<undefined>}
   */
  public heartbeat(): Promise<void> {
    return this.send(OP.HEARTBEAT, this.seq);
  }

  /**
   * Handle data as received from the websocket.
   * @param {WebSocket.Data} data The data to receive
   * @returns {undefined}
   */
  public receive(data: WebSocket.Data): void {
    const decoded: Payload = decode(data);
    this.emit('receive', decoded);

    switch (decoded.op) {
      case OP.DISPATCH:
        if (decoded.s && decoded.s > this.seq) this.seq = decoded.s;
        if (decoded.t === Dispatch.READY) this.session = decoded.d.session_id;
        if (decoded.t) this.emit(decoded.t, decoded.d);
        break;
      case OP.HEARTBEAT:
        this.heartbeat();
        break;
      case OP.RECONNECT:
        this.reconnect();
        break;
      case OP.INVALID_SESSION:
        if (!decoded.d) this.session = null;
        wait(Math.floor(Math.random() * 5) + 1).then(() => this.identify());
        break;
      case OP.HELLO:
        this._clearHeartbeater();
        this._heartbeater = setInterval(() => {
          if (this._acked) {
            this.heartbeat();
            this._acked = false;
          } else {
            this.reconnect(4009);
          }
        }, decoded.d.heartbeat_interval);

        this.identify();
        break;
      case OP.HEARTBEAT_ACK:
        this._acked = true;
        break;
    }
  }

  /**
   * Send data through the websocket connection.
   * @param {number} op The OP to send
   * @param {*} d The data to send
   * @param {?string} t The event to send; use when sending an OP 0.
   * @returns {Promise<undefined>}
   */
  public send(pk: Buffer): Promise<void>;
  public send(pk: Payload): Promise<void>;
  public send(op: number | string, d: any): Promise<void>;
  public send(op: number | Buffer | Payload | string, d?: any): Promise<void> {
    if (Buffer.isBuffer(op)) {
      this.emit('send', op);
      return this._send(op);
    }

    let data: Payload;
    switch (typeof op) {
      case 'object':
        data = op as Payload;
        break;
      case 'string': {
        data = {
          op: OP.DISPATCH,
          t: op as string,
          s: this.seq,
          d,
        };
        break;
      }
      case 'number':
        data = { op, d } as Payload;
        break;
      default:
        return Promise.reject(new global.Error(`Invalid op type "${typeof op}"`))
    }

    this.emit('send', data);
    return this._send(encode(data));
  }

  public fetchGateway(force?: boolean): Promise<Gateway> {
    return Shard.fetchGateway(this.token, force);
  }

  private _send(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.send(data, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Handle the close of this connection.
   * @param {number} code The code the connection closed with
   * @param {string} reason The reason the connection closed
   * @returns {Promise<undefined>}
   * @private
   */
  private async handleClose(code: number, reason: string): Promise<void> {
    this.emit('close', new CloseEvent(code, reason));
    this._reset();

    switch (code) {
      case 4004:
      case 4010:
      case 4011: // unrecoverable errors (disconnect)
        return;
      case 4000: // unknown error (reconnect)
        break;
      default: // other errors (clear session and reconnect)
        this.session = null;
        break;
    }

    await this.reconnect();
  }

  /**
   * Handle an error with this connection.
   * @param {*} err The error that occurred
   * @returns {Promise<undefined>}
   * @private
   */
  private async handleError(err: any) {
    this.emit('error', err);
    await this.reconnect();
  }

  private _registerWSListeners() {
    if (!this.ws.listeners('message').includes(this.receive)) this.ws.on('message', this.receive);
    if (!this.ws.listeners('close').includes(this.handleClose)) this.ws.on('close', this.handleClose);
    if (!this.ws.listeners('error').includes(this.handleError)) this.ws.on('error', this.handleError);
  }

  private _reset() {
    this._clearWSListeners();
    this._clearHeartbeater();
    this.seq = 0;
  }

  private _clearWSListeners() {
    this.ws.removeListener('message', this.receive);
    this.ws.removeListener('close', this.handleClose);
    this.ws.removeListener('error', this.handleError);
  }

  private _clearHeartbeater() {
    if (this._heartbeater) {
      clearInterval(this._heartbeater);
      this._heartbeater = undefined;
    }
  }
}
