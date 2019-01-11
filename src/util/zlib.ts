import Pako = require('pako');

let zlib: typeof Pako;
let ZlibSync: typeof Pako | undefined;
if (typeof window === 'undefined') {
  try {
    ZlibSync = require('zlib-sync');
  } catch {}
}

if (typeof window !== 'undefined' || !ZlibSync) zlib = require('pako');

export default zlib!;
