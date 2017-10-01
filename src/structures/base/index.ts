import Client from '../../core/Client';
import Redis from '../../redis';

export interface Flat {
  [key: string]: string | boolean | number | undefined,
}

export interface Complex {
  [key: string]: Base<any> | Base<any>[] | null
}

export default abstract class Base<T> {
  public static flatten(obj: any): Flat {
    const out: Flat = {};
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
    this.patch(data);
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

  public patch(data: T): void {
    this.raw = data;
  }

  public abstract save(): Promise<void>;
  public abstract get key(): string;
}
