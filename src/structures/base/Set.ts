import Base from './index';
import Client from '../../core/Client';

export default class Set<T> extends Base<Iterable<T>> {
  public readonly key: string;

  constructor(client: Client, key: string, data: Iterable<T>) {
    super(client, data);
    this.key = key;
  }

  public async save() {
    await this.redis.sadd(this.key, ...this.raw);
  }
}
