import Guild from './Guild';
import Hash from './base/Hash';

import { ROLE } from '../types/structures';

export default class Role extends Hash<ROLE> {
  constructor(guild: Guild, data: ROLE) {
    super(guild.client, `guild.${guild.raw.id}.role.${data.id}`, data);
  }

  public complex() {
    return {};
  }
}
