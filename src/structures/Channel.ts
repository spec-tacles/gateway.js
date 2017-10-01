import Client from '../core/Client';
import { Complex } from './base';
import Hash from './base/Hash';
import Set from './base/Set';

import User from './User';
import Overwrite from './Overwrite';

import { CHANNEL } from '../types/structures';

export default class Channel extends Hash<CHANNEL> {
  constructor(client: Client, d: CHANNEL) {
    super(client, `channel.${d.id}`, d);
  }

  public complex() {
    return {
      recipients: this.raw.recipients ? this.raw.recipients.map(u => new User(this.client, u)) : null,
      permission_overwrites: this.raw.permission_overwrites.map(o => new Overwrite(this, o)),
    };
  }

  public extra() {
    return [
      this.raw.recipients ? new Set(this.client, `${this.key}.recipients`, this.raw.recipients.map(u => u.id)) : null,
    ];
  }
}
