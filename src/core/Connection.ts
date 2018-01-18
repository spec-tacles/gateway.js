import WebSocket = require('ws');
import os = require('os');
import { Buffer } from 'buffer';
import throttle = require('p-throttle');

import Client from './Client';

import { Error, codes } from '../util/errors';
import { op, dispatch, encoding, encode, decode } from '@spectacles/spectacles.js';

let erlpack: { pack: (d: any) => Buffer, unpack: (d: Buffer | Uint8Array) => any } | void;
try {
  erlpack = require('erlpack');
} catch (e) {
  // do nothing
}

const identify = throttle(async function (this: Connection) {
  if (!this.client.gateway) throw new Error(codes.NO_GATEWAY);

  await this.send(op.IDENTIFY, {
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
}, 1, 5000);

export type Payload = { t?: string, s?: number, op: number, d: any };

export default class Connection {
  public readonly client: Client;
  public readonly shard: number;

  public readonly version: number = 6;

  public identify: () => Promise<void>;

  private _ws?: WebSocket;
  private _seq: number = -1;
  private _session: string | null = null;
  private _heartbeater?: NodeJS.Timer;
  private _acked = true;

  constructor(client: Client, shard: number) {
    this.client = client;
    this.shard = shard;

    this.receive = this.receive.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);

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
    if (!this._ws) throw new Error(codes.NO_WEBSOCKET);
    return this._ws;
  }

  public async connect(): Promise<void> {
    if (!this.client.gateway) throw new Error(codes.NO_GATEWAY);

    this._ws = new WebSocket(`${this.client.gateway.url}?v=${this.version}&encoding=${encoding}`);
    this._ws.on('message', this.receive);
    this._ws.on('close', this.handleClose);
    this._ws.on('error', this.handleError);

    await new Promise(r => this.ws.once('open', r));
  }

  public async disconnect(): Promise<void> {
    console.log(this.ws.readyState);
    if (this.ws.readyState === WebSocket.CLOSED) return Promise.resolve();

    this.ws.removeListener('message', this.receive);
    this.ws.removeListener('close', this.handleClose);
    this.ws.removeListener('error', this.handleError);

    if (this.ws.readyState !== WebSocket.CLOSING) this.ws.close();
    await new Promise(r => this.ws.once('close', r));
    this._seq = -1;
    this._session = null;
  }

  public async reconnect(): Promise<void> {
    await this.disconnect();
    await new Promise(r => setTimeout(r, 1000 + 0.5 - Math.random()));
    await this.connect();
  }

  public resume(): Promise<void> {
    if (!this.session) throw new Error(codes.NO_SESSION);

    return this.send(op.RESUME, {
      token: this.client.token,
      seq: this.seq,
      session: this.session,
    });
  }

  public heartbeat(): Promise<void> {
    return this.send(op.HEARTBEAT, this.seq);
  }

  public receive(data: WebSocket.Data): void {
    const decoded = decode(data);

    switch (decoded.op) {
      case op.DISPATCH:
        if (decoded.s && decoded.s > this._seq) this._seq = decoded.s;
        if (decoded.t === dispatch.READY) this._session = decoded.d.session_id;
        if (this.client.events.has(decoded.t)) this.client.publish(decoded.t, decoded.d);
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
      case op.HEARTBEAT_ACK:
        this._acked = true;
        break;
    }
  }

  public send(op: number, d: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.send(encode({ op, d }), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async handleClose(code: number, reason: string): Promise<void> {
    this._seq = -1;
    if (this._heartbeater) {
      clearInterval(this._heartbeater);
      this._heartbeater = undefined;
    }

    switch (code) {
      case 4007: // invalid sequence (clear session and reconnect)
      case 4009: // session timed out (clear session and reconnect)
        this._session = null;
      case 4000: // unknown error (reconnect)
        await this.reconnect();
        break;
      default:
        this._session = null;
        if (this.client.reconnect) await this.reconnect();
        else await this.handleError(`WebSocket closed ${code}: ${reason}`);
    }
  }

  private async handleError(err: any) {
    this.client.emit('error', err);
    await this.reconnect();
  }
};
