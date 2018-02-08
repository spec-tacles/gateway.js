import * as WebSocket from 'ws';
import * as os from 'os';
import * as throttle from 'p-throttle';

import Client from './Client';

import { Error, codes } from '../util/errors';
import { OP, Dispatch, encoding, encode, decode } from '../util';
import CloseEvent from '../util/CloseEvent';

let erlpack: { pack: (d: any) => Buffer, unpack: (d: Buffer | Uint8Array) => any } | void;
try {
  erlpack = require('erlpack');
} catch (e) {
  // do nothing
}

const identify = throttle(async function (this: Connection) {
  if (!this.client.gateway) throw new Error(codes.NO_GATEWAY);

  await this.send(OP.IDENTIFY, {
    token: this.client.token,
    properties: {
      $os: os.platform(),
      $browser: 'spectacles',
      $device: 'spectacles',
    },
    compress: false,
    large_threshold: 250,
    shard: [this.shard, this.client.gateway.shards],
    presence: {},
  });
}, 1, 5e3);

/**
 * A Discord Gateway payload.
 * @typedef Payload
 * @type {object}
 * @property {?string} t
 * @property {?number} s
 * @property {number} op
 * @property {*} d
 */
export type Payload = { t?: string, s?: number, op: number, d: any };

/**
 * A connection to the Discord Gateway.
 */
export default class Connection {
  /**
   * The connection manager.
   * @type {Client}
   * @readonly
   */
  public readonly client: Client;

  /**
   * The shard that this connection represents.
   * @type {number}
   * @readonly
   */
  public readonly shard: number;

  /**
   * The API version to use.
   * @type {number=6}
   * @readonly
   */
  public readonly version: number = 6;

  /**
   * Send an identify packet.
   * @returns {Promise<undefined>}
   */
  public identify: () => Promise<void>;

  /**
   * The underlying websocket connection.
   * @type {?WebSocket}
   * @private
   */
  private _ws?: WebSocket;

  /**
   * The sequence of this connection.
   * @type {number=-1}
   * @private
   */
  private _seq: number = -1;

  /**
   * The session identifier of this connection.
   * @type {?string}
   * @private
   */
  private _session: string | null = null;

  /**
   * The heartbeater interval.
   * @type {Timer}
   * @private
   */
  private _heartbeater?: NodeJS.Timer;

  /**
   * Whether the Discord Gateway has acknowledged the previous heartbeat.
   * @type {boolean}
   * @private
   */
  private _acked = true;

  /**
   * @constructor
   * @param {Client} client The client
   * @param {number} shard The shard of this connection
   */
  constructor(client: Client, shard: number) {
    this.client = client;
    this.shard = shard;

    this.receive = this.receive.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);

    this.send = throttle(this.send.bind(this), 120, 60);
    this.identify = identify;
  }

  /**
   * The sequence of this connection.
   * @returns {number}
   */
  public get seq(): number {
    return this._seq;
  }

  /**
   * The session identifier of this connection.
   * @returns {?string}
   */
  public get session(): string | null {
    return this._session;
  }

  /**
   * The underlying websocket connection to the gateway.
   * @returns {WebSocket}
   * @throws {Error} Throws if there is no connection available.
   */
  public get ws(): WebSocket {
    if (!this._ws) throw new Error(codes.NO_WEBSOCKET);
    return this._ws;
  }

  /**
   * Connect to the gateway.
   * @returns {Promise<undefined>}
   */
  public async connect(): Promise<void> {
    if (!this.client.gateway) throw new Error(codes.NO_GATEWAY);
    this._emit('connect');

    this._ws = new WebSocket(`${this.client.gateway.url}?v=${this.version}&encoding=${encoding}`);
    this._ws.on('message', this.receive);
    this._ws.on('close', this.handleClose);
    this._ws.on('error', this.handleError);

    this._acked = true;
    await new Promise(r => this.ws.once('open', r));
  }

  /**
   * Disconnect from the gateway.
   * @returns {Promise<undefined>}
   */
  public async disconnect(): Promise<void> {
    if (this.ws.readyState === WebSocket.CLOSED) return Promise.resolve();
    this._emit('disconnect');

    this.ws.removeListener('message', this.receive);
    this.ws.removeListener('close', this.handleClose);
    this.ws.removeListener('error', this.handleError);

    if (this.ws.readyState !== WebSocket.CLOSING) this.ws.close();
    await new Promise(r => this.ws.once('close', r));
    this._seq = -1;
    this._session = null;
  }

  /**
   * Disconnect and reconnect to the gateway after a 1s timeout.
   * @returns {Promise<undefined>}
   */
  public async reconnect(): Promise<void> {
    await this.disconnect();
    await new Promise(r => setTimeout(r, 1e3 + Math.random() - 0.5));
    await this.connect();
  }

  /**
   * Resume your session with the gateway.
   * @returns {Promise<undefined>}
   * @throws {Error} Throws if there's no session available to resume.
   */
  public resume(): Promise<void> {
    if (!this.session) throw new Error(codes.NO_SESSION);

    return this.send(OP.RESUME, {
      token: this.client.token,
      seq: this.seq,
      session: this.session,
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
    const decoded = decode(data);
    this._emit('receive', data);

    switch (decoded.op) {
      case OP.DISPATCH:
        if (decoded.s && decoded.s > this._seq) this._seq = decoded.s;
        if (decoded.t === Dispatch.READY) this._session = decoded.d.session_id;
        this.client.emit(decoded.t, decoded.d);
        break;
      case OP.HEARTBEAT:
        this.heartbeat();
        break;
      case OP.RECONNECT:
        this.reconnect();
        break;
      case OP.INVALID_SESSION:
        if (decoded.d) this.resume();
        else this.reconnect();
        break;
      case OP.HELLO:
        if (this._heartbeater) clearInterval(this._heartbeater);
        this._heartbeater = setInterval(() => {
          if (this._acked) {
            this.heartbeat();
            this._acked = false;
          } else {
            this.reconnect();
          }
        }, decoded.d.heartbeat_interval);

        if (this._session) this.resume();
        else this.identify();

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
  public send(op: number, d: any, t?: string): Promise<void> {
    const data: { op: number, d: any, t?: string, s?: number } = { op, d };
    if (op === OP.DISPATCH) {
      data.t = t;
      data.s = this._seq;
    }

    this._emit('send', data);

    return new Promise((resolve, reject) => {
      this.ws.send(encode(data), (err) => {
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
    this.client.emit('close', new CloseEvent(code, reason));

    this._seq = -1;
    if (this._heartbeater) {
      clearInterval(this._heartbeater);
      this._heartbeater = undefined;
    }

    switch (code) {
      case 4004:
      case 4010:
      case 4011: // unrecoverable errors (disconnect)
        return;
      case 4000: // unknown error (reconnect)
        break;
      default: // other errors (clear session and reconnect)
        this._session = null;
        break;
    }

    if (this.client.reconnect) await this.reconnect();
  }

  /**
   * Handle an error with this connection.
   * @param {*} err The error that occurred
   * @returns {Promise<undefined>}
   * @private
   */
  private async handleError(err: any) {
    this._emit('error', err);
    await this.reconnect();
  }

  private _emit(event: string, ...data: any[]) {
    return this.client.emit(event, this.shard, ...data);
  }
}
