import Connection from './Connection';
import Events from './Events';

import { dispatch } from '../util/constants';
import * as gateway from '../types/gateway';

export default class WSDispatcher {
  public readonly connection: Connection;
  public readonly events: Events;

  constructor(connection: Connection) {
    this.connection = connection;
    this.events = new Events(this);
  }

  public async dispatch(t: string, d: any) {
    switch (t) {
      case dispatch.READY:
        await this.events.ready(d);
        break;
      case dispatch.GUILD_CREATE:
        await this.events.guildCreate(d);
        break;
      case dispatch.GUILD_UPDATE:
        await this.events.guildUpdate(d);
        break;
      case dispatch.GUILD_DELETE:
        const guild = <gateway.GUILD_CREATE | gateway.GUILD_UPDATE | gateway.GUILD_DELETE> d;
        await this.redis.insertGuild(guild);
        break;
      case dispatch.CHANNEL_DELETE:
      case dispatch.CHANNEL_UPDATE:
      case dispatch.CHANNEL_CREATE:
        const channel = <gateway.CHANNEL_UPDATE> d;
        await this.redis.insertChannel(channel);
        break;
      case dispatch.GUILD_BAN_ADD:
        const banAdd = <gateway.GUILD_BAN_ADD> d;
        await this.redis.insertBan(banAdd.guild_id, banAdd.id);
        break;
      case dispatch.GUILD_BAN_REMOVE:
        const banRemove = <gateway.GUILD_BAN_REMOVE> d;
        await this.redis.removeBan(banRemove.guild_id, banRemove.id);
        break;
      case dispatch.GUILD_EMOJIS_UPDATE:
        const emojisUpdate = <gateway.GUILD_EMOJIS_UPDATE> d;
        await this.redis.insertEmojis(emojisUpdate.guild_id, emojisUpdate.emojis);
      case dispatch.GUILD_MEMBER_ADD:
      case dispatch.GUILD_MEMBER_UPDATE:
        const member = <gateway.GUILD_MEMBER_ADD | gateway.GUILD_MEMBER_UPDATE> d;
        await this.redis.insertMember(member.guild_id, member);
        break;
      case dispatch.GUILD_MEMBER_REMOVE:
        const memberRemove = <gateway.GUILD_MEMBER_REMOVE> d;
        await this.redis.removeMember(memberRemove.guild_id, memberRemove.user);
        break;
      case dispatch.GUILD_MEMBERS_CHUNK:
        const members = <gateway.GUILD_MEMBERS_CHUNK> d;
        await Promise.all(members.members.map(m => this.redis.insertMember(members.guild_id, m)));
        break;
      case dispatch.GUILD_ROLE_CREATE:
        const role = <gateway.GUILD_ROLE_CREATE> d;
        await this.redis.insertRole(role.guild_id, role.role);
        break;
    }
  }

  private _publish(channel: string, message: string) {
    return this.redis.publishAsync(`${this.connection.shard}:${channel}`, message);
  }
}
