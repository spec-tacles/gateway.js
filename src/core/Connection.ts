import WebSocket = require('ws');
import os = require('os');
import { Buffer } from 'buffer';
import throttle = require('p-throttle');

import Client from './Client';
import Events from './Events';

import { Error, codes } from '../util/errors';
import { op, dispatch } from '../util/constants';

let erlpack: { pack: (d: any) => Buffer, unpack: (d: Buffer | Uint8Array) => any } | void;
try {
  erlpack = require('erlpack');
} catch (e) {
  // do nothing
}

const identify = throttle(function (this: Connection) {
  if (!this.client.gateway) throw new Error(codes.NO_GATEWAY);

  this.send(op.IDENTFY, {
    token: this.client.data.token,
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
}, 1, 5000);

export type Payload = { t?: string, s?: number, op: number, d: any };

export default class Connection {
  public static encoding = erlpack ? 'etf' : 'json';

  public static encode(data: any) {
    return erlpack ? erlpack.pack(data) : JSON.stringify(data)
  }

  public static decode(data: WebSocket.Data) {
    if (data instanceof ArrayBuffer) data = Buffer.from(data);
    if (Array.isArray(data)) data = data.join();
    if (typeof data === 'string') data = Buffer.from(data);

    return erlpack ? erlpack.unpack(data) : JSON.parse(data.toString());
  }

  public readonly client: Client;
  public readonly shard: number;
  public readonly events: Events;

  public readonly version: number = 6;

  private _ws: WebSocket;
  private _seq: number = -1;
  private _session: string | null = null;
  private _heartbeater: NodeJS.Timer;

  constructor(client: Client, shard: number) {
    this.client = client;
    this.shard = shard;
    this.events = new Events(this);

    this.receive = this.receive.bind(this);
    this.handleClose = this.handleClose.bind(this);

    this.send = throttle(this.send.bind(this), 120, 60);
    this.identify = identify;
  }

  public get seq(): number {
    return this._seq;
  }

  public get session(): string | null {
    return this._session;
  }

  public get ws(): WebSocket {
    return this._ws;
  }

  public connect(): void {
    if (!this.client.gateway) throw new Error(codes.NO_GATEWAY);

    this._ws = new WebSocket(`${this.client.gateway.url}?v=${this.version}&encoding=${Connection.encoding}`);
    this._ws.on('message', this.receive);
    this._ws.on('close', this.handleClose);
    this._ws.on('error', console.error);
  }

  public disconnect(): void {
    if (this._ws.readyState !== WebSocket.CLOSED && this._ws.readyState !== WebSocket.CLOSING) this._ws.close();
    this._ws.removeListener('message', this.receive);
    this._ws.removeListener('close', this.handleClose);
    this._ws.removeListener('error', console.error);
  }

  public reconnect(): void {
    this.disconnect();
    this.connect();
  }

  public resume(): void {
    if (!this.session) throw new Error(codes.NO_SESSION);

    return this.send(op.RESUME, {
      token: this.client.data.token,
      seq: this.seq,
      session: this.session,
    });
  }

  public heartbeat(): void {
    return this.send(op.HEARTBEAT, this.seq);
  }

  // see throttled method above
  public identify(): void {}

  public receive(data: WebSocket.Data): void {
    const decoded = Connection.decode(data);

    switch (decoded.op) {
      case op.DISPATCH:
        if (decoded.s) this._seq = decoded.s;
        if (decoded.t === dispatch.READY) this._session = decoded.d.session_id;
        this.events.handle(decoded);
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

  public send(op: number, d: Object): void {
    return this._ws.send(Connection.encode({ op, d }));
  }

  public handleClose(code: number, reason: string): void {
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
};
