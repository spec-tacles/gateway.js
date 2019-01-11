import cp = require('child_process');
import path = require('path');
import { EventEmitter } from 'events';
import Gateway from './Gateway';

export default class ChildCluster extends EventEmitter {
  public gateway: Gateway;

  constructor(token: string) {
    super();
    this.gateway = Gateway.fetch(token);
  }

  public spawn(shards: Array<[number, number]>): void {
    for (const [min, max] of shards) {
      const proc = cp.fork(path.resolve(__dirname, '..', 'bin', 'index.js'), [
        'cluster',
        '--min', min.toString(),
        '--max', max.toString(),
      ]);
    }
  }
}
