import Dispatcher from './Dispatcher';
import Client from './Client';
import Redis from '../redis';

import Channel from '../structures/Channel';
import Guild from '../structures/Guild';
import User from '../structures/User';

import * as gateway from '../types/gateway';
import { dispatch as events } from '../util/constants';

export default class Events {
  public readonly dispatcher: Dispatcher;
  private _initialGuildCount: number = 0;
  private _receivedGuilds: number = 0;

  constructor(dispatcher: Dispatcher) {
    this.dispatcher = dispatcher;
  }

  public get client(): Client {
    return this.dispatcher.connection.client;
  }

  public get redis(): Redis {
    return this.client.redis;
  }

  private emit(name: string, data: string | number | boolean) {
    return this.redis.publishAsync(name, data);
  }

  // EVENTS

  public async [events.CHANNEL_CREATE](d: gateway.CHANNEL_CREATE) {
    const channel = new Channel(this.client, d);
    await channel.save();
    await this.emit(events.CHANNEL_CREATE, channel.key);
  }

  public async [events.CHANNEL_DELETE](d: gateway.CHANNEL_DELETE) {
    const channel = new Channel(this.client, d);
    // TODO: delete channel
    await this.emit(events.CHANNEL_DELETE, channel.key);
  }

  public async [events.CHANNEL_PINS_UPDATE](d: gateway.CHANNEL_PINS_UPDATE) {
    // TODO: handle pin updates
  }

  public async [events.CHANNEL_UPDATE](d: gateway.CHANNEL_UPDATE) {
    const channel = new Channel(this.client, d);
    await channel.save();
    await this.emit(events.CHANNEL_UPDATE, channel.key);
  }

  public async [events.GUILD_CREATE](d: gateway.GUILD_CREATE) {
    const guild = new Guild(this.client, d);
    await guild.save();

    if (this._receivedGuilds !== Infinity) this._receivedGuilds++;
    if (this._receivedGuilds === this._initialGuildCount) {
      this._receivedGuilds = Infinity;
      await this.emit(events.READY, this.dispatcher.connection.shard);
    } else {
      await this.emit(events.GUILD_CREATE, guild.key);
    }
  }

  public async [events.GUILD_DELETE](d: gateway.GUILD_DELETE) {
    const guild = new Guild(this.client, d);
    await guild.save();

    // emit a different event if the user was removed from the guild (as opposed to the guild being deleted or the user leaving the guild)
    if (d.unavailable) await this.emit(events.GUILD_DELETE, guild.key);
    else await this.emit('GUILD_REMOVE', guild.key);
  }

  public async [events.GUILD_UPDATE](d: gateway.GUILD_UPDATE) {
    const guild = new Guild(this.client, d);
    await guild.save();
    await this.emit(events.GUILD_UPDATE, guild.key);
  }

  public async [events.READY](d: gateway.READY) {
    this._initialGuildCount = d.guilds.length;

    const user = new User(this.client, d.user);
    const guilds = d.guilds.map(g => new Guild(this.client, g));
    const channels = d.private_channels.map(c => new Channel(this.client, c));

    await Promise.all([
      user.save(),
      ...guilds.map(g => g.save()),
      ...channels.map(c => c.save()),
    ]);

    // do not emit ready until all guilds have been received (see guild create event)
  }
}
