import Shard from './Shard';
import Cluster from './Cluster';

export default class ClusterableShard extends Shard {
  constructor(public cluster: Cluster, id: number) {
    super(cluster.gateway, id);
  }

  public emit(name: string | symbol, ...args: any[]) {
    if (this.listenerCount(name)) super.emit(name, ...args);
    return this.cluster.emit(name, ...args, this);
  }
}
