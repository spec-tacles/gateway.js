import Client from '../core/Client';
import { AVAILABLE_GUILD, ROLE } from '../types/structures';
import Hash from './base/Hash';
import Set from './base/Set';

import Channel from './Channel';
import Member from './Member';

export default class Guild extends Hash<AVAILABLE_GUILD> {
  public id: string;
  public name: string;
  public icon: string;
  public splash: string;
  public owner_id: string;
  public region: string;
  public afk_channel_id: string;
  public afk_timeout: number;
  public embed_enabled: boolean;
  public embed_channel_id: string;
  public verification_level: number;
  public default_message_notifications: number;
  public explicit_content_filter: number;
  public roles: Set<ROLE>; // TODO: add role types
  public emojis: any[]; // TODO: add emoji types
  public features: string[];
  public mfa_level: number;
  public application_id?: string;
  public widget_enabled: boolean;
  public widget_channel_id: string;
  public joined_at?: string;
  public large?: boolean;
  public unavailable?: boolean;
  public member_count?: number;
  public voice_states?: any[]; // TODO: add voice state types
  public members?: Member[]; // TODO: add member types
  public channels?: Channel[];
  public presences?: any[]; // TODO: add presence types

  constructor(client: Client, data: AVAILABLE_GUILD) {
    super(client, data);
    this.roles = new Set(this.client, `${this.key}.roles`, data.roles);
  }

  public get key(): string {
    return `guild.${this.id}`;
  }

  protected _patch(data: AVAILABLE_GUILD) {
    super._patch(data);
  }
}
