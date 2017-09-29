import Client from '../core/Client';
import Base from './base';

export type RawUser = {
  id: string,
  username: string,
  discriminator: string,
  avatar: string,
  bot?: boolean,
  mfa_enabled?: boolean,
  verified?: boolean,
  email?: string,
}

export default class User extends Base<RawUser> {
  public raw: RawUser;

  public id: string;
  public username: string;
  public discriminator: string;
  public avatar: string;
  public bot?: boolean;
  public mfa_enabled?: boolean;
  public verified?: boolean;
  public email?: string;

  public get key(): string {
    return `user.${this.id}`;
  }
}
