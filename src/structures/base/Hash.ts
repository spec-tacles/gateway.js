import Base, { Flat, Complex } from './index';
import Client from '../../core/Client';

export type Basic = string | boolean | number | undefined | BasicObject | BasicArray;
export interface BasicArray extends Array<Basic> {};
export interface BasicObject {
  [key: string]: Basic,
};

export default abstract class Hash<T extends { [key: string]: Basic }> extends Base<T> {
  public readonly key: string;

  private _flat: Flat;
  private _complex: Complex = {};

  constructor(client: Client, key: string, d: T) {
    super(client, d);
    this.key = key;
  }

  public async save() {
    for (const v of Object.values(this._complex)) {
      if (!v) continue;
      if (Array.isArray(v)) await Promise.all(v.map(s => s.save()));
      else await v.save();
    }

    await this.redis.hmsetAsync(this.key, this.raw);
  }

  public patch(d: T) {
    super.patch(d);
    this._flat = this.flatten();
    this._complex = this.complex();

    for (const [k, v] of Object.entries(this._complex)) {
      if (v && k in d) {
        if (Array.isArray(v)) for (const s of v) s.patch(d[k]);
        else v.patch(d[k]);
      }
    }
  }

  public flatten(): Flat {
    return Base.flatten(this.raw);
  }

  public abstract complex(): Complex;
}
