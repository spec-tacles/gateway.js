export type USER = {
  id: string,
  username: string,
  discriminator: string,
  avatar: string,
  bot?: boolean,
  mfa_enabled?: boolean,
  verified?: boolean,
  email?: string,
};

export type OVERWRITE = {
  id: string,
  type: 'role' | 'member',
  allow: number,
  deny: number,
};

export enum ChannelTypes {
  GUILD_TEXT = 0,
  DM = 1,
  GUILD_VOICE = 2,
  GROUP_DM = 3,
  GUILD_CATEGORY = 4,
};

export type CHANNEL = {
  id: string,
  type: ChannelTypes,
  guild_id?: string,
  position?: number,
  permission_overwrites: OVERWRITE[],
  name?: string,
  topic?: string,
  last_message_id?: string,
  bitrate?: string,
  user_limit?: string,
  recipients?: USER[],
  icon?: string,
  owner_id?: string,
  application_id?: string,
  parent_id?: string,
};

export type ROLE = {
  id: string,
  name: string,
  color: number,
  hoist: boolean,
  position: number,
  permissions: number,
  managed: boolean,
  mentionable: boolean,
};

export type MEMBER = {
  user: USER,
  nick: string,
  roles: string[],
  joined_at: string,
  deaf: boolean,
  mute: boolean,
};

export type MEMBER_UPDATE = {
  user: USER,
  roles: string[],
  guild_id: string,
  nick: string,
};

export type EMOJI = {
  id: string,
  name: string,
  roles: string[],
  require_colons: boolean,
  managed: boolean,
};

export type REACTION = {
  count: number,
  me: boolean,
  emoji: EMOJI,
};

export type ATTACHMENT = {
  id: string,
  filename: string,
  size: number,
  url: string,
  proxy_url: string,
  height?: number,
  width?: number,
};

export type EMBED = {
  title: string,
  type: string,
  description: string,
  url: string,
  timestamp: string,
  color: number,
  footer: { text: string, icon_url: string, proxy_icon_url: string },
  image: { url: string, proxy_url: string, height: number, width: number },
  thumbnail: { url: string, proxy_url: string, height: number, width: number },
  video: { url: string, height: number, width: number },
  provider: { name: string, url: string },
  author: { name: string, url: string, icon_url: string, proxy_icon_url: string },
  fields: Array<{ name: string, value: string, inline: boolean }>,
};

export enum MessageType {
  DEFAULT = 0,
  RECIPIENT_ADD = 1,
  RECIPIENT_REMOVE = 2,
  CALL = 3,
  CHANNEL_NAME_CHANGE = 4,
  CHANNEL_ICON_CHANGE = 5,
  CHANNEL_PINNED_MESSAGE = 6,
  GUILD_MEMBER_JOIN = 7,
};

export type MESSAGE = {
  id: string,
  channel_id: string,
  author?: USER | { id: string, username: string, avatar: string },
  content: string,
  timestamp: string,
  edited_timestamp: string,
  tts: boolean,
  mention_everyone: boolean,
  mentions: USER[],
  mention_roles: string[],
  attachments: ATTACHMENT[],
  embeds: EMBED[],
  reactions?: REACTION[],
  nonce?: string,
  pinned: boolean,
  webhook_id: string,
  type: MessageType,
};

export enum MessageNotificationLevelType {
  ALL_MESSAGES = 0,
  ONLY_MENTIONS = 1,
};

export enum ExplicitContentFilterLevelType {
  DISABLED = 0,
  MEMBERS_WITHOUT_ROLES = 1,
  ALL_MEMBERS = 2,
};

export enum MFALevelType {
  NONE = 0,
  ELEVATED = 1,
};

export enum VerificationLevelType {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  VERY_HIGH = 4,
};

export type UNAVAILABLE_GUILD = {
  id: string,
  unavailable: true,
};

export type AVAILABLE_GUILD = {
  id: string,
  name: string,
  icon: string,
  splash: string,
  owner_id: string,
  region: string,
  afk_channel_id: string,
  afk_timeout: number,
  embed_enabled: boolean,
  embed_channel_id: string,
  verification_level: VerificationLevelType,
  default_message_notifications: MessageNotificationLevelType,
  explicit_content_filter: ExplicitContentFilterLevelType,
  roles: ROLE[],
  emojis: EMOJI[],
  features: string[],
  mfa_level: MFALevelType,
  application_id?: string,
  widget_enabled: boolean,
  widget_channel_id: string,
  joined_at?: string,
  large?: boolean,
  unavailable?: false,
  member_count?: number,
  voice_states?: any[], // TODO: add voice state types
  members?: MEMBER[],
  channels?: CHANNEL[],
  presences?: any[], // TODO: add presence types
};

export type GUILD = AVAILABLE_GUILD | UNAVAILABLE_GUILD;
