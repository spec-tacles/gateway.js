import pako = require('pako');
import throttle from 'p-throttle';
import { Errors, encoding, encode, decode } from '@spectacles/util';
import { Dispatch, OP, Presence } from '@spectacles/types';

import Gateway from './Gateway';
import WebSocket from './util/WebSocket';
import zlib from './util/zlib';
import { EventEmitter } from 'events';

declare module 'pako' {
  export const Z_NO_FLUSH = 0;
  export const Z_PARTIAL_FLUSH = 1;
  export const Z_SYNC_FLUSH = 2;
  export const Z_FULL_FLUSH = 3;
  export const Z_FINISH = 4;
}

const { Codes, Error: SpectaclesError } = Errors;
const isBlob = (v: unknown): v is Blob => {
  if (typeof Blob === 'undefined') return false;
  return v instanceof Blob;
};

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
   * The current reconnect backoff timeout.
   * @type {number}
   */
  public backoff: number = 1e3;

  /**
   * Send an identify packet. Will attempt to resume if a session is available.
   * @returns {Promise<undefined>}
   */
  public identify: (pk?: Partial<Identify>) => Promise<void>;

  /**
   * The sequence of this connection.
   * @type {number}
   * @default [0]
   */
  public seq: number = 0;

  /**
   * The session identifier of this connection.
   * @type {?string}
   */
  public session: string | null = null;

  /**
   * The underlying websocket connection.
   * @type {WebSocket}
   */
  public ws!: WebSocket;

  /**
   * The zlib inflate context to use for this connection.
   * @type {pako.Inflate}
   */
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
   * @param {string|Gateway} token The token to connect with, or the gateway information to use
   * @param {number} shard The shard of this connection
   */
  constructor(token: string | Gateway, public readonly id: number) {
    super();

    this.gateway = Gateway.fetch(token);
    this.identify = this.gateway.identify.bind(this.gateway, this);
    this.send = throttle(this.send.bind(this), 120, 60) as any; // ts complains about this for some reason

    this.connect().catch(e => this.emit('error', e));
  }

  /**
   * Connect to the gateway.
   * @returns {Promise<undefined>}
   */
  public async connect(): Promise<void> {
    if (this.ws) {
      switch (this.ws.readyState) {
        case WebSocket.CONNECTING:
        case WebSocket.CLOSING:
          return;
        case WebSocket.OPEN:
          this.disconnect();
      }
    }

    await this.gateway.fetch();
    this.emit('connect');

    this.ws = new WebSocket(`${this.gateway.url}?v=${this.version}&encoding=${encoding}&compress=zlib-stream`);
    this._registerWSListeners();
    this._acked = true;
  }

  /**
   * Disconnect from the gateway.
   * @param {?number} code The code to close the connection with
   * @param {?string} reason The reason to disconnect with
   * @returns {undefined}
   */
  public disconnect(code?: number, reason?: string): void {
    if ([WebSocket.CLOSED, WebSocket.CLOSING].includes(this.ws.readyState)) return;
    this.emit('disconnect');
    this._reset();

    this.ws.close(code, reason);
  }

  /**
   * Disconnect and reconnect to the gateway after a 1s timeout.
   * @param {?number} code The code to close the connection with
   * @param {?number} delay The time (in ms) to delay between disconnect and connect
   * @returns {Promise<undefined>}
   */
  public async reconnect(code?: number): Promise<void> {
    this.disconnect(code);
    await wait(this.backoff);
    this.connect();
  }

  /**
   * Resume your session with the gateway.
   * @returns {Promise<undefined>}
   * @throws {SpectaclesError} Throws if there's no session available to resume
   */
  public resume(): void {
    if (!this.session) throw new SpectaclesError(Codes.NO_SESSION);

    return this.send(OP.RESUME, {
      token: this.gateway.token,
      seq: this.seq,
      session_id: this.session,
    });
  }

  /**
   * Send a heartbeat to the gateway.
   * @returns {undefined}
   */
  public heartbeat(): void {
    return this.send(OP.HEARTBEAT, this.seq);
  }

  /**
   * Handle data as received from the websocket.
   * @param {WebSocket.Data} data The data to receive
   * @returns {undefined}
   */
  public receive = ({ data }: MessageEvent): void => { // arrow function for "this" context
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

    this.inflate.push(conv, flush ? zlib.Z_SYNC_FLUSH : zlib.Z_NO_FLUSH);
    if (!flush) return;

    let result: string | number[] | Uint8Array = this.inflate.result;
    if (Array.isArray(result)) result = new Uint8Array(result);

    const decoded: Payload = decode(result);
    this.emit('receive', decoded);
    this.handlePayload(decoded);
  }

  private handlePayload(payload: Payload) {
    switch (payload.op) {
      case OP.DISPATCH:
        if (payload.s && payload.s > this.seq) this.seq = payload.s;
        if (payload.t === Dispatch.READY) this.session = payload.d.session_id;
        if (payload.t) this.emit(payload.t, payload.d);
        break;
      case OP.HEARTBEAT:
        this.heartbeat();
        break;
      case OP.RECONNECT:
        this.reconnect();
        break;
      case OP.INVALID_SESSION:
        if (!payload.d) this.session = null;
        wait(Math.random() * 5 + 1).then(() => this.identify());
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
        }, payload.d.heartbeat_interval);

        this.identify();
        break;
      case OP.HEARTBEAT_ACK:
        this._acked = true;
        break;
    }
  }

  /**
   * Send data through the websocket connection. Valid string and number values for `op` parameter
   * are documented on the
   * [Discord API documentation](https://discordapp.com/developers/docs/topics/opcodes-and-status-codes#gateway-gateway-opcodes)
   * of Gateway Op codes.
   * @param {number | Buffer | Blob | ArrayBuffer | Payload | string} op The Op code, payload, T, or the encoded packet to send
   * @param {*} d The data to send if `op` is a number (Op code) or string (T)
   * @returns {undefined}
   * @example
   * gateway.send(Buffer.from(JSON.stringify({ op: 1, d: gateway.seq })));
   * @example
   * gateway.send({ op: 1, d: gateway.seq });
   * @example
   * gateway.send(4, { guild_id: 'some guild', channel_id: 'some channel', self_mute: false, self_deaf: false });
   * @example
   * gateway.send('REQUEST_GUILD_MEMBERS', { guild_id: 'some guild', query: 'foo', limit: 10 });
   */
  public send(pk: Buffer | Blob | ArrayBuffer | Payload): void;
  public send(op: OP | keyof typeof OP, d: any): void;
  public send(op: OP | Buffer | Blob | ArrayBuffer | Payload | keyof typeof OP, d?: any): void;
  public send(op: OP | Buffer | Blob | ArrayBuffer | Payload | keyof typeof OP, d?: any): void {
    if (Buffer.isBuffer(op) || isBlob(op) || op instanceof ArrayBuffer) {
      this.emit('send', op);
      return this.ws.send(op);
    }

    let data: Payload;
    switch (typeof op) {
      case 'object':
        data = op;
        break;
      case 'string':
        op = OP[op]; // intentional fallthrough
      case 'number':
        data = { op, d };
        break;
      default:
        throw new Error(`Invalid op type "${typeof op}"`);
    }

    this.emit('send', data);
    return this.ws.send(encode(data));
  }

  private handleOpen = (event: Event): void => { // arrow function for "this" context
    this.backoff = 1e3;
    this.emit('open', event);
  }

  /**
   * Handle the close of this connection.
   * @param {CloseEvent} event The close event of the closure
   * @returns {undefined}
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
   * @returns {undefined}
   * @private
   */
  private handleError = (err: Event): void => { // arrow function for "this" context
    this.emit('error', err);
    this.backoff *= 2;
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
    this.inflate = new zlib.Inflate();
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
