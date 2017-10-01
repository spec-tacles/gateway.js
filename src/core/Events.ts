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

  constructor(dispatcher: Dispatcher) {
    this.dispatcher = dispatcher;
  }

  public get client(): Client {
    return this.dispatcher.connection.client;
  }

  public get redis(): Redis {
    return this.client.redis;
  }

  // EVENTS

  public async [events.CHANNEL_CREATE](d: gateway.CHANNEL_CREATE) {
    const channel = new Channel(this.client, d);
    await channel.save();
  }

  public async [events.CHANNEL_DELETE](d: gateway.CHANNEL_DELETE) {
    const channel = new Channel(this.client, d);
    // TODO: delete channel
  }

  public async [events.CHANNEL_PINS_UPDATE](d: gateway.CHANNEL_PINS_UPDATE) {
    // TODO: handle pin updates
  }

  public async [events.CHANNEL_UPDATE](d: gateway.CHANNEL_UPDATE) {
    const channel = new Channel(this.client, d);
    await channel.save();
  }

  public async [events.GUILD_CREATE](d: gateway.GUILD_CREATE) {
    const guild = new Guild(this.client, d);
    await guild.save();
  }

  public async [events.GUILD_DELETE](d: gateway.GUILD_DELETE) {
    const guild = new Guild(this.client, d);
    await guild.save();
  }

  public async [events.GUILD_UPDATE](d: gateway.GUILD_UPDATE) {
    await this.redis.insertGuild(d);
  }

  public async [events.READY](d: gateway.READY) {
    const user = new User(this.client, d.user);
    const guilds = d.guilds.map(g => new Guild(this.client, g));
    const channels = d.private_channels.map(c => new Channel(this.client, c));

    await Promise.all([
      user.save(),
      ...guilds.map(g => g.save()),
      ...channels.map(c => c.save()),
    ]);
  }
}
