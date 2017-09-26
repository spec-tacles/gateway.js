import redis = require('redis');
import tsubaki = require('tsubaki');
import Client from '../core/Client';

tsubaki.promisifyAll(redis.RedisClient.prototype);
tsubaki.promisifyAll(redis.Multi.prototype);

export default class Redis extends (<{ new(): any }> redis.RedisClient) {
  public readonly c: Client;

  constructor(c: Client) {
    super();
    this.c = c;

    c.on('READY', async d => {
      await this.insertUser(d.user);
      await Promise.all(d.guilds.map((g: any) => this.insertGuild(g)));
      await Promise.all(d.private_channels.map((c: any) => this.insertChannel(c)));
      await this.publishAsync('ready', d.user.id);
    });

    c.on('GUILD_CREATE', async d => {
      await this.insertGuild(d);
      await this.publishAsync('guildCreate', d.id);
    });

    c.on('PRESENCE_UPDATE', async d => {
      await this.insertUser(d.user);
      await this.insertGame(d.user.id, d.guild_id, d.game);
      await this.insertGame(d.user.id, d.guild_id, d.status);
    });

    c.on('GUILD_MEMBER_UPDATE', async d => {
      await this.insertUser(d.user);
    });
  }

  public async insertUser(user: any) {
    await this.hmsetAsync(`user:${user.id}`, Redis.flatten(user));
  }

  public async insertGame(userID: string, guildID: string, game: any) {
    await this.hmsetAsync(`user:${userID}:${guildID}:game`, Redis.flatten(game));
  }

  public async insertStatus(userID: string, guildID: string, status: string) {
    await this.setAsync(`user:${userID}:${guildID}:status`, status);
  }

  public async insertGuild(guild: any) {
    await this.hmsetAsync(`guild:${guild.id}`, Redis.flatten(guild));
    if (!guild.unavailable) await Promise.all(guild.roles.map((r: any) => this.insertRole(guild.id, r)));
  }

  public async insertEmoji(guildID: string, emoji: any) {
    await this.hmsetAsync(`guild:${guildID}:emoji:${emoji.id}`, Redis.flatten(emoji));
    await this.saddAsync(`guild:${guildID}:emoji:${emoji.id}:roles`, ...this.emoji.roles);
  }

  public async insertRole(guildID: string, role: any) {
    await this.hmsetAsync(`guild:${guildID}:role:${role.id}`, Redis.flatten(role));
  }

  public async insertChannel(channel: any) {
    if (channel.guild_id) await this.saddAsync(`guild:${channel.guild_id}:channel`, channel.id);
    await this.hmsetAsync(`channel:${channel.id}`, Redis.flatten(channel));
  }

  public static flatten(obj: any) {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const type = typeof obj[k];
      if (type !== 'object' && type !== 'function') out[k] = obj[k];
    }
    return out;
  }
}
