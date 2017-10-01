import Client from '../core/Client';
import Hash from './base/Hash';

import { USER } from '../types/structures';

export default class User extends Hash<USER> {
  constructor(client: Client, data: USER) {
    super(client, `user.${data.id}`, data);
  }

  public complex() {
    return {};
  }
}
