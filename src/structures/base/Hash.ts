import Base, { Flat, Complex } from './index';
import Client from '../../core/Client';

export type Basic = string | boolean | number | undefined | BasicObject | BasicArray;
export interface BasicArray extends Array<Basic> {};
export interface BasicObject {
  [key: string]: Basic,
};

export default abstract class Hash<T extends { [key: string]: Basic }> extends Base<T> {
  public readonly key: string;

  constructor(client: Client, key: string, d: T) {
    super(client, d);
    this.key = key;
  }

  public async save() {
    const promises = [];

    for (const v of Object.values(this.complex())) {
      if (!v) continue;
      if (Array.isArray(v)) promises.push(...v.map(s => s.save()));
      else promises.push(v.save());
    }

    for (const v of this.extra()) if (v) promises.push(v.save());

    await Promise.all(promises);
    await this.redis.hmsetAsync(this.key, this.flatten());
  }

  public flatten(): Flat {
    return Base.flatten(this.raw);
  }

  public extra(): Array<Base<any> | null> {
    return [];
  }

  public abstract complex(): Complex;
}
