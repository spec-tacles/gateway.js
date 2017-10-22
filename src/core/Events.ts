import Client from './Client';
import Connection, { Payload } from './Connection';
import Cache from '@spectacles/cache';

import { dispatch } from '../util/constants';

export default class EventHandler {
  public readonly client: Client;
  public readonly connection: Connection;
  public readonly cache: Cache;

  constructor(connection: Connection) {
    this.client = connection.client;
    this.connection = connection;
    this.cache = new Cache({ redis: this.client.redis });
  }

  public async handle(data: Payload) {
    if (this.client.cache) await this.store(data);
    this.client.redis.publishAsync(data.t, this.connection.encode(data.d));
  }

  public async store(data: Payload) {
    const d = data.d;
    switch (data.t) {
      // CHANNELS
      case dispatch.CHANNEL_CREATE:
      case dispatch.CHANNEL_UPDATE:
        await this.cache.actions.updateChannel(d);
        break;
      case dispatch.CHANNEL_DELETE:
        // TODO: delete channel
        break;

      // MESSAGES
      case dispatch.MESSAGE_CREATE:
      case dispatch.MESSAGE_UPDATE:
        await this.cache.actions.updateMessage(d);
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
        await this.cache.actions.updateGuild(d);
        break;
      case dispatch.GUILD_ROLE_CREATE:
      case dispatch.GUILD_ROLE_UPDATE:
        await this.cache.actions.updateRole(d.guild_id, d.role);
        break;
    }
  }
}
