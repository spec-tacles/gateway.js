import Client from '../core/Client';
import { GUILD } from '../types/structures';
import Hash from './base/Hash';
import Set from './base/Set';

import Channel from './Channel';
import Emoji from './Emoji';
import Member from './Member';
import Role from './Role';

export default class Guild extends Hash<GUILD> {
  constructor(client: Client, data: GUILD) {
    super(client, `guild.${data.id}`, data);
  }

  public complex() {
    if (this.raw.unavailable) return {};

    return {
      roles: this.raw.roles.map(role => new Role(this, role)),
      emojis: this.raw.emojis.map(emoji => new Emoji(this, emoji)),
      members: this.raw.members ? this.raw.members.map(member => new Member(this, member)) : null,
      channels: this.raw.channels ? this.raw.channels.map(channel => new Channel(this.client, channel)) : null,
    };
  }
}
