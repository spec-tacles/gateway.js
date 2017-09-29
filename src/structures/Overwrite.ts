import Client from '../core/Client';
import Base from './base';

import Channel from './Channel';
import Member from './Member';

export type RawOverwrite = {
  id: string,
  type: 'role' | 'member',
  allow: number,
  deny: number,
};

export default class Overwrite extends Base<RawOverwrite> {
  public readonly channel: Channel;

  public member?: Member;

  public id: string;
  public type: 'role' | 'member';
  public allow: number;
  public deny: number;

  constructor(client: Client, channel: Channel, data: RawOverwrite) {
    super(client, data);
    this.channel = channel;
  }

  protected _patch(data: RawOverwrite) {
    super._patch(data);
    switch (this.type) {
      case 'role':
        // TODO: set role property
        break;
      case 'member':
        // TODO: set member property
        break;
      default:
        throw new Error('invalid PermissionOverwrites type');
    }
  }

  public get key(): string {
    if (this.type === 'role') {
      return `role.${this.id}.overwrites`;
    } else if (this.type === 'member') {
      if (this.channel.guildID) return `user.${this.id}.guild.${this.channel.guildID}.overwrites`;
      else throw new Error('attempted to save PermissionOverwrites for a guild member in a channel without a guild');
    } else {
      throw new Error('invalid PermissionOverwrites type');
    }
  }
}
