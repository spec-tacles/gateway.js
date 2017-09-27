import WebSocket = require('ws');
import os = require('os');
import { Buffer } from 'buffer';

import Client from '../core/Client';

import { Error, codes } from '../util/errors';
import { op } from '../util/constants';

let erlpack: { pack: (d: Object) => Buffer, unpack: (d: Buffer | Uint8Array) => Object } | void;
try {
  erlpack = require('erlpack');
} catch (e) {
  // do nothing
}

export default class WSConnection {
  public readonly client: Client;
  public readonly shard: number;

  public encoding: 'json' | 'etf' = 'etf';
  public version: number = 6;

  private _ws: WebSocket;
  private _seq: number = -1;
  private _session: string | null = null;
  private _heartbeater: NodeJS.Timer;

  constructor(client: Client, shard: number = 0) {
    this.client = client;
    this.shard = shard;
  }

  public get seq() {
    return this._seq;
  }

  public get session() {
    return this._session;
  }

  public get ws() {
    return this._ws;
  }

  public connect() {
    if (!this.client.gateway) throw new Error(codes.NO_GATEWAY);

    this._ws = new WebSocket(`${this.client.gateway.url}?v=${this.version}&encoding=${this.encoding}`);
    this._ws.on('message', this.receive);
    this._ws.on('close', this.close);
    this._ws.on('error', console.error);
  }

  public disconnect() {
    if (this._ws.readyState !== WebSocket.CLOSED && this._ws.readyState !== WebSocket.CLOSING) this._ws.close();
    this._ws.removeListener('message', this.receive);
    this._ws.removeListener('close', this.close);
    this._ws.removeListener('error', console.error);
  }

  public reconnect() {
    this.disconnect();
    this.connect();
  }

  public resume() {
    if (!this.session) throw new Error(codes.NO_SESSION);

    return this.send(op.RESUME, {
      token: this.client.options.token,
      seq: this.seq,
      session: this.session,
    });
  }

  public heartbeat() {
    return this.send(op.HEARTBEAT, this.seq);
  }

  public identify() {
    if (!this.client.gateway) throw new Error(codes.NO_GATEWAY);

    return this.send(op.IDENTFY, {
      token: this.client.options.token,
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
  }

  public receive(data: WebSocket.Data) {
    const decoded = this.decode(data);

    switch (decoded.op) {
      case op.DISPATCH:
        this._seq = decoded.s;
        if (decoded.op.t === 'READY') this._session = decoded.op.d.session_id;
        this.client.emit(decoded.t, decoded.d);
        break;
      case op.HEARTBEAT:
        this.heartbeat();
        break;
      case op.RECONNECT:
        this.reconnect();
        break;
      case op.INVALID_SESSION:
        if (decoded.d) this.resume();
        else this.reconnect();
        break;
      case op.HELLO:
        if (this._heartbeater) clearInterval(this._heartbeater);
        this._heartbeater = setInterval(() => this.heartbeat(), decoded.d.heartbeat_interval);

        if (this._session) this.resume();
        else this.identify();

        break;
      case op.HEARTBEAT_ACK:
        // reconnect if not received before next heartbeat attempt
        break;
    }
  }

  public send(op: number, d: Object) {
    return this._ws.send(this.encode({ op, d }));
  }

  public close(code: number, reason: string) {
    switch (code) {
      case 4007: // invalid sequence (clear session and reconnect)
      case 4009: // session timed out (clear session and reconnect)
        this._session = null;
      case 4000: // unknown error (reconnect)
        this.reconnect();
        break;
      default:
        throw new global.Error(`WebSocket closed ${code}: ${reason}`);
    }
  }

  public decode(data: WebSocket.Data) {
    if (data instanceof ArrayBuffer) throw new Error(codes.ARRAYBUFFER_RECEIVED);
    if (Array.isArray(data)) data = data.join();

    switch (this.encoding) {
      case 'json':
        if (data instanceof Buffer) return JSON.parse(data.toString());
        return JSON.parse(data);
      case 'etf':
        if (typeof erlpack === 'undefined') throw new Error(codes.ERLPACK_NOT_INSTALLED);
        if (typeof data === 'string') data = Buffer.from(data);
        return erlpack.unpack(data);
      default:
        throw new Error(codes.INVALID_ENCODING);
    }
  }

  public encode(data: Object) {
    switch (this.encoding) {
      case 'json':
        return JSON.stringify(data);
      case 'etf':
        if (typeof erlpack === 'undefined') throw new Error(codes.ERLPACK_NOT_INSTALLED);
        return erlpack.pack(data);
      default:
        throw new Error(codes.INVALID_ENCODING);
    }
  }
};
