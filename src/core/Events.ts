import { Actions } from '@spectacles/spectacles.js';
import { RedisClient } from 'redis-p';

import Client from './Client';
import Connection, { Payload } from './Connection';

import { dispatch } from '@spectacles/spectacles.js';
import { disconnect } from 'cluster';

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
      case dispatch.READY: {
        const multi = this.redis.multi();

        this.actions.updateUser(d.user, multi);
        for (const g of d.guilds) this.actions.updateGuild(g, multi);
        for (const c of d.private_channels) this.actions.updateChannel(c, multi);
        await multi.exec();

        break;
      }

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
      case dispatch.MESSAGE_REACTION_ADD:
        await this.actions.addReaction(d);
        break;
      case dispatch.MESSAGE_REACTION_REMOVE:
        await this.actions.removeReaction(d);
        break;
      case dispatch.MESSAGE_REACTION_REMOVE_ALL:
        await this.client.data.channels.get(d.channel_id).messages.get(d.message_id).reactions.clear();
        break;

      // GUILDS
      case dispatch.GUILD_DELETE:
        if (d.unavailable === undefined) {
          await this.actions.removeGuild(d.id);
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
      case dispatch.GUILD_MEMBERS_CHUNK: {
        const multi = this.redis.multi();
        for (const m of d.members) this.actions.updateMember(d.guild_id, m, multi);
        await multi.exec();
        break;
      }
      case dispatch.GUILD_MEMBER_UPDATE:
      case dispatch.GUILD_MEMBER_ADD:
        await this.actions.updateMember(d.guild_id, d);
        break;
      case dispatch.GUILD_MEMBER_REMOVE:
        // TODO: delete guild member
        break;

      // VOICE
      case dispatch.VOICE_STATE_UPDATE:
        await this.actions.updateVoiceState(d);
        break;
      case dispatch.VOICE_SERVER_UPDATE:
        await this.actions.updateVoiceServer(d);
        break;
    }
  }
}
