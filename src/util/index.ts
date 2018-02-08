let erlpack: { pack: (d: any) => Buffer, unpack: (d: Buffer | Uint8Array) => any } | void;
try {
  erlpack = require('erlpack');
} catch (e) {
  // do nothing
}

export * from './constants';
export * from './errors';

export const encoding = erlpack ? 'etf' : 'json';

export function encode(data: any) {
  return erlpack ? erlpack.pack(data) : Buffer.from(JSON.stringify(data));
}

export function decode<T = any>(data: ArrayBuffer | string | Buffer[] | Buffer): T {
  if (data instanceof ArrayBuffer) data = Buffer.from(data);
  else if (Array.isArray(data)) data = Buffer.concat(data);
  else if (typeof data === 'string') data = Buffer.from(data);

  return erlpack ? erlpack.unpack(data) : JSON.parse(data.toString());
}
