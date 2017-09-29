import * as structures from './structures';

export type READY = {
  v: number,
  user: structures.USER,
  private_channels: structures.CHANNEL[],
  guilds: structures.UNAVAILABLE_GUILD[],
  session_id: string,
  _trace: string[],
};

export type CHANNEL_UPDATE = structures.CHANNEL;

export type GUILD_CREATE = structures.AVAILABLE_GUILD;
export type GUILD_UPDATE = structures.AVAILABLE_GUILD;
export type GUILD_DELETE = structures.UNAVAILABLE_GUILD;
export type GUILD_BAN_ADD = structures.USER & { guild_id: string };
export type GUILD_BAN_REMOVE = structures.USER & { guild_id: string };

export type GUILD_EMOJIS_UPDATE = {
  guild_id: string,
  emojis: structures.EMOJI[],
};

export type GUILD_MEMBER_ADD = structures.MEMBER & { guild_id: string };
export type GUILD_MEMBER_REMOVE = {
  guild_id: string,
  user: structures.USER,
};
export type GUILD_MEMBER_UPDATE = {
  guild_id: string,
  roles: string[],
  user: structures.USER,
  nick: string,
};

export type GUILD_MEMBERS_CHUNK = {
  guild_id: string,
  members: structures.MEMBER[],
};

export type GUILD_ROLE_CREATE = {
  guild_id: string,
  role: structures.ROLE,
};
