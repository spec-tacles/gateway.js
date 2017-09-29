import Client from '../../core/Client';
import Redis from '../../redis';

export default abstract class Base<T> {
  public static flatten(obj: any) {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const type = typeof obj[k];
      if (type !== 'object' && type !== 'function') out[k] = obj[k];
    }
    return out;
  }

  public raw: T;
  public readonly client: Client;

  constructor(client: Client, data: T) {
    this.client = client;
    this._patch(data);
  }

  protected get redis(): Redis {
    return this.client.redis;
  }

  public toJSON() {
    return Base.flatten(this.raw);
  }

  public async notify(event: string): Promise<void> {
    await this.redis.publishAsync(event, this.key);
  }

  protected _patch(data: T): void {
    this.raw = data;
  }

  public abstract save(): Promise<void>;
  public abstract get key(): string;
}
