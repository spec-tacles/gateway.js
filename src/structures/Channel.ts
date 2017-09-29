import Client from '../core/Client';
import Base from './base';
import User, { RawUser } from './User';

export enum ChannelTypes {
  GUILD_TEXT = 0,
  DM = 1,
  GUILD_VOICE = 2,
  GROUP_DM = 3,
  GUILD_CATEGORY = 4,
};

export type RawChannel = {
  id: string,
  type: ChannelTypes,
  guild_id?: string,
  position?: number,
  permission_overwrites: any[], // TODO: define permission overwrites
  name?: string,
  topic?: string,
  last_message_id?: string,
  bitrate?: string,
  user_limit?: string,
  recipients?: RawUser[],
  icon?: string,
  owner_id?: string,
  application_id?: string,
  parent_id?: string,
};

export default class Channel extends Base<RawChannel> {
  public raw: RawChannel;

  public id: string;
  public type: ChannelTypes;
  public guildID?: string;
  public position?: number;
  public permission_overwrites: any[];
  public name?: string;
  public topic?: string;
  public last_message_id?: string;
  public bitrate?: string;
  public user_limit?: string;
  public recipients?: User[];
  public icon?: string;
  public owner_id?: string;
  public application_id?: string;
  public parent_id?: string;

  public get key() {
    return `channel.${this.id}`;
  }

  protected _patch(data: RawChannel) {
    super._patch(data);
    this.recipients = data.recipients ? data.recipients.map(user => new User(this.client, user)) : undefined;
  }

  public async save() {
    await super.save();
    if (this.recipients) await this.redis.saddAsync(`${this.key}.recipients`, ...this.recipients.map(u => u.id));
  }
}
