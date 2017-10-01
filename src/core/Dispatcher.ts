import Connection from './Connection';
import Events from './Events';

import * as gateway from '../types/gateway';

export default class WSDispatcher {
  public readonly connection: Connection;
  public readonly events: any;

  constructor(connection: Connection) {
    this.connection = connection;
    this.events = new Events(this);
  }

  public async dispatch(t: string, d: any) {
    if (t in this.events && typeof this.events[t] === 'function') await this.events[t](d);
  }
}
