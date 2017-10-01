import Client from '../core/Client';
import Hash from './base/Hash';

import { OVERWRITE } from '../types/structures';

import Channel from './Channel';
import Member from './Member';

export default class Overwrite extends Hash<OVERWRITE> {
  constructor(channel: Channel, data: OVERWRITE) {
    super(channel.client, `channel.${channel.raw.id}.overwrite.${data.id}`, data);
  }

  public complex() {
    return {};
  }
}
