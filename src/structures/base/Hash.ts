import Base from './index';

export default abstract class Hash<T> extends Base<T> {
  public readonly structures: Base<any>;

  public async save() {
    await this.redis.hmsetAsync(this.key, this.raw);
  }

  protected _patch(d: T) {
    super._patch(d);
    for (const [k, v] of Object.entries(this.structures)) this[k] = v;
    Object.assign(this, d);
  }
}
