import { Actions } from '@spectacles/spectacles.js';
import { RedisClient } from 'redis-p';

import Client from './Client';
import Connection, { Payload } from './Connection';

import { dispatch } from '@spectacles/spectacles.js';

export default class EventHandler {
  public readonly client: Client;
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.client = connection.client;
    this.connection = connection;
  }

  public get actions(): Actions {
    return this.client.data.actions;
  }

  public get redis(): RedisClient {
    return this.client.data.redis;
  }

  public async handle(data: Payload) {
    if (this.client.cache) await this.store(data);
    if (data.t) this.client.data.redis.publish(data.t, Connection.encode(data.d) as any);
  }

  public async store(data: Payload) {
    const d = data.d;
    switch (data.t) {
      // CHANNELS
      case dispatch.CHANNEL_CREATE:
      case dispatch.CHANNEL_UPDATE:
        await this.actions.updateChannel(d);
        break;
      case dispatch.CHANNEL_DELETE:
        // TODO: delete channel
        break;

      // MESSAGES
      case dispatch.MESSAGE_CREATE:
      case dispatch.MESSAGE_UPDATE:
        await this.actions.updateMessage(d);
        break;
      case dispatch.MESSAGE_DELETE:
        // TODO: delete message
        break;

      // GUILDS
      case dispatch.GUILD_DELETE:
        if (d.unavailable === undefined) {
          // TODO: delete guild
          break;
        }
      case dispatch.GUILD_CREATE:
      case dispatch.GUILD_UPDATE:
        await this.actions.updateGuild(d);
        break;
      case dispatch.GUILD_ROLE_CREATE:
      case dispatch.GUILD_ROLE_UPDATE:
        await this.actions.updateRole(d.guild_id, d.role);
        break;
      case dispatch.GUILD_MEMBER_UPDATE:
      case dispatch.GUILD_MEMBER_ADD:
        await this.actions.updateMember(d.guild_id, d);
        break;
      case dispatch.GUILD_MEMBER_REMOVE:
        // TODO: delete guild member
        break;
      case dispatch.VOICE_STATE_UPDATE:
        await this.actions.updateVoiceState(d);
        break;
      case dispatch.VOICE_SERVER_UPDATE:
        await this.actions.updateVoiceServer(d);
        break;
    }
  }
}
