import cp = require('child_process');
import path = require('path');
import { EventEmitter } from 'events';
import Gateway from './Gateway';
import { Payload } from './Shard';

export default class MasterCluster extends EventEmitter {
  public gateway: Gateway;
  public children: [{ min: number, max: number }, cp.ChildProcess][] = [];

  constructor(token: string) {
    super();
    this.gateway = Gateway.fetch(token);
  }

  public spawn(shards: Array<[number, number]>): void {
    for (const [min, max] of shards) {
      const proc = cp.fork(path.resolve(__dirname, '..', 'bin', 'index.js'), [
        'cluster',
        '--fork',
        '--min', min.toString(),
        '--max', max.toString(),
      ], {
        env: {
          DISCORD_TOKEN: this.gateway.token,
        },
      });

      proc.on('message', ({ data, event, shard }) => this.emit(event, data, shard));
      this.children.push([{ min, max }, proc]);
    }
  }

  public send(shard: number, data: Payload): boolean {
    for (const [{ min, max }, child] of this.children) {
      if (min <= shard && shard <= max) return child.send({ shard, data });
    }

    return false;
  }
}
