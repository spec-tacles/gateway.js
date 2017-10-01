import Hash from './base/Hash';

import Guild from './Guild';
import User from './User';

import { MEMBER } from '../types/structures';

export default class Member extends Hash<MEMBER> {
  public readonly guild: Guild;

  constructor(guild: Guild, data: MEMBER) {
    super(guild.client, `user.${data.user.id}.guild.${guild.raw.id}`, data);
    this.guild = guild;
  }

  public complex() {
    return {
      user: new User(this.client, this.raw.user),
    };
  }
}
