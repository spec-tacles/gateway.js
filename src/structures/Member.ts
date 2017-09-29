import Client from '../core/Client';
import Base from './base';

import Guild from './Guild';
import User, { RawUser } from './User';

export type RawMember = {
  user: RawUser,
  nick: string,
  roles: string[],
  joined_at: string,
  deaf: boolean,
  mute: boolean,
};

export default class Member extends Base<RawMember> {
  public readonly guild: Guild;
  public readonly user: User;

  constructor(client: Client, guild: Guild, data: RawMember) {
    super(client, data);

    this.guild = guild;
    this.user = new User(client, data.user);
  }

  public get key(): string {
    return `user.${this.user.id}.guild.${this.guild.id}`;
  }
}
