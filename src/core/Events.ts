import Dispatcher from './Dispatcher';
import Redis from '../redis';

import * as gateway from '../types/gateway';

export default class Events {
  public readonly dispatcher: Dispatcher;

  constructor(dispatcher: Dispatcher) {
    this.dispatcher = dispatcher;
  }

  public get redis(): Redis {
    return this.dispatcher.connection.client.redis;
  }

  // EVENTS

  public async guildCreate(d: gateway.GUILD_CREATE) {
    await this.redis.insertGuild(d);
  }

  public async guildDelete(d: gateway.GUILD_DELETE) {
    if (d.unavailable) await this.redis.insertGuild(d);
  }

  public async guildUpdate(d: gateway.GUILD_UPDATE) {
    await this.redis.insertGuild(d);
  }

  public async ready(d: gateway.READY) {
    await this.redis.insertUser(d.user);
    await Promise.all(d.guilds.map((guild) => this.redis.insertGuild(guild)));
    await Promise.all(d.private_channels.map(channel => this.redis.insertChannel(channel)));
  }
}
