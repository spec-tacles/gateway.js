import Client from '../core/Client';
import { Complex } from './base';
import Hash from './base/Hash';
import Set from './base/Set';

import { CHANNEL, ChannelTypes, USER, OVERWRITE } from '../types/structures';

export default class Channel extends Hash<CHANNEL> {
  constructor(client: Client, d: CHANNEL) {
    super(client, `channel.${d.id}`, d);
  }

  public complex() {
    return {
      recipients: this.raw.recipients ? new Set<USER>(this.client, `${this.key}.recipients`, this.raw.recipients) : null,
      permission_overwrites: new Set<OVERWRITE>(this.client, `${this.key}.overwrites`, this.raw.permission_overwrites),
    };
  }
}
