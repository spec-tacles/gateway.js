let ws: typeof WebSocket;

if (typeof window === 'undefined') ws = require('ws');
else if (typeof WebSocket !== 'undefined') ws = WebSocket;
else throw new Error('no WebSocket module found');

export default ws;
