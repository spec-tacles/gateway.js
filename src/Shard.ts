import pako = require('pako');
import throttle from 'p-throttle';
import { Errors, encoding, encode, decode } from '@spectacles/util';
import { Dispatch, OP, Presence } from '@spectacles/types';

import Gateway from './Gateway';
import WebSocket from './util/WebSocket';
import zlib from './util/zlib';
import { EventEmitter } from 'events';
const { Codes, Error } = Errors;

export const wait = (time: number) => new Promise<void>(r => setTimeout(r, time));

export type Identify = {
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

export type Payload = {
  t?: string,
  s?: number,
  op: number,
  d: any
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
export default class Shard extends EventEmitter {
  public static readonly ZLIB_SUFFIX = new Uint8Array([0x00, 0x00, 0xff, 0xff]);

  public gateway: Gateway;

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
  public identify: (pk?: Partial<Identify>) => Promise<void> = this.gateway.identify.bind(this.gateway, this);

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

  public inflate: pako.Inflate = new zlib.Inflate();

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
   * @param {string|Gateway} gatewayOrToken The token to connect with, or the gateway information to use
   * @param {number} shard The shard of this connection
   */
  constructor(token: string | Gateway, public readonly id: number) {
    super();

    this._registerWSListeners();
    this.gateway = Gateway.fetch(token);
    this.send = throttle(this.send.bind(this), 120, 60) as any; // ts complains about this for some reason

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

      this.ws = new WebSocket(`${this.gateway.url}?v=${this.version}&encoding=${encoding}&compress=zlib-stream`);
      this._registerWSListeners();

      this._acked = true;
      this.once('open', r);
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
    await new Promise(r => this.once('close', r));
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
  public resume(): void {
    if (!this.session) throw new Error(Codes.NO_SESSION);

    return this.send(OP.RESUME, {
      token: this.gateway.token,
      seq: this.seq,
      session_id: this.session,
    });
  }

  /**
   * Send a heartbeat to the gateway.
   * @returns {Promise<undefined>}
   */
  public heartbeat(): void {
    return this.send(OP.HEARTBEAT, this.seq);
  }

  /**
   * Handle data as received from the websocket.
   * @param {WebSocket.Data} data The data to receive
   * @returns {undefined}
   */
  public receive = ({ data }: MessageEvent): void => {
    let conv: Uint8Array | string;
    if (Array.isArray(data)) conv = new Uint8Array(Buffer.concat(data));
    else if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) conv = new Uint8Array(data);
    else conv = data;

    const suffix = conv.slice(conv.length - 4, conv.length);
    let flush = true;
    for (let i = 0; i < suffix.length; i++) {
      if (suffix[i] !== Shard.ZLIB_SUFFIX[i]) {
        flush = false;
        break;
      }
    }

    this.inflate.push(conv, flush ? (zlib as any).Z_SYNC_FLUSH : (zlib as any).Z_NO_FLUSH);
    if (!flush) return;

    let result: string | number[] | Uint8Array = this.inflate.result;
    if (Array.isArray(result)) result = new Uint8Array(result);

    const decoded: Payload = decode(result);
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
  public send(pk: Buffer | Blob): void;
  public send(pk: Payload): void;
  public send(op: number | string, d: any): void;
  public send(op: number | Buffer | Blob | Payload | string, d?: any): void {
    if (Buffer.isBuffer(op) || (typeof Blob !== 'undefined' && op instanceof Blob)) {
      this.emit('send', op);
      return this.ws.send(op);
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
        throw new global.Error(`Invalid op type "${typeof op}"`);
    }

    this.emit('send', data);
    return this.ws.send(encode(data));
  }

  private handleOpen = (event: Event): void => { // arrow function for "this" context
    this.emit('open', event);
  }

  /**
   * Handle the close of this connection.
   * @param {number} code The code the connection closed with
   * @param {string} reason The reason the connection closed
   * @returns {Promise<undefined>}
   * @private
   */
  private handleClose = (event: CloseEvent): void => { // arrow function for "this" context
    this.emit('close', event);
    this._reset();

    switch (event.code) {
      case 4004:
      case 4010:
      case 4011: // unrecoverable errors (disconnect)
        this.emit('exit', event);
        return;
    }

    this.reconnect();
  }

  /**
   * Handle an error with this connection.
   * @param {*} err The error that occurred
   * @returns {Promise<undefined>}
   * @private
   */
  private handleError = (err: Event) => { // arrow function for "this" context
    this.emit('error', err);
    this.reconnect();
  }

  private _registerWSListeners() {
    this.ws.onmessage = this.receive;
    this.ws.onerror = this.handleError;
    this.ws.onclose = this.handleClose;
    this.ws.onopen = this.handleOpen;
  }

  private _reset() {
    this._clearWSListeners();
    this._clearHeartbeater();
    this.seq = 0;
  }

  private _clearWSListeners() {
    this.ws.onmessage = null;
    this.ws.onclose = null;
    this.ws.onerror = null;
    this.ws.onopen = null;
  }

  private _clearHeartbeater() {
    if (this._heartbeater) {
      clearInterval(this._heartbeater);
      this._heartbeater = undefined;
    }
  }
}
