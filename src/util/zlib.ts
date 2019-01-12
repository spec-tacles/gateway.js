import Pako = require('pako');

let zlib: typeof Pako;
let ZlibSync: typeof Pako | undefined;
if (typeof window === 'undefined') {
  try {
    ZlibSync = require('zlib-sync');
  } catch {}
}

if (ZlibSync) zlib = ZlibSync;
else zlib = require('pako');

export default zlib;
