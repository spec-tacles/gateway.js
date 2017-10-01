import Guild from './Guild';
import Hash from './base/Hash';

import { EMOJI } from '../types/structures';

export default class Emoji extends Hash<EMOJI> {
  constructor(guild: Guild, data: EMOJI) {
    super(guild.client, `guild.${guild.raw.id}.emoji.${data.id}`, data);
  }

  public complex() {
    return {};
  }
}
