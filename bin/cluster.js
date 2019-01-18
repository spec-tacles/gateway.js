const { default: Cluster } = require('../dist/Cluster');
const { decode, encode } = require('@spectacles/util');

exports.command = 'cluster';
exports.describe = 'Spawn a cluster of shards';
exports.builder = yargs => yargs.option('min', {
	description: 'The minimum shard ID to spawn',
	type: 'number',
	implies: 'max',
	conflicts: 'ids',
}).option('max', {
	description: 'The maximum shard ID to spawn',
	type: 'number',
	implies: 'min',
	conflicts: 'ids',
}).option('ids', {
	description: 'A list of shard IDs to spawn',
	type: 'array',
	conflicts: ['min', 'max'],
	coerce: arg => arg.map(Number),
})
	.example('cluster --ids 1 2 3 5 6 7', 'Spawn the specified shards (1, 2, 3, 5, 6, and 7)')
	.example('cluster --min 2 --max 8', 'Spawn shards 2 through 8 inclusive');

exports.handler = argv => {
	const cluster = new Cluster(argv.token);
	for (const event of argv.events) {
		cluster.on(event, (data, shard) => {
			const packet = { event, data, shard: shard.id };

			if (argv.fork) process.send(packet);
			else process.stdout.write(encode(packet));
		});
	}

	const listener = ({ data, shard }) => {
		shard = cluster.shards.get(shard);
		if (shard) shard.send(data);
	};

	if (argv.fork) process.on('message', listener);
	else process.stdin.on('data', d => listener(decode(d)));

	if (argv.ids) cluster.spawn(argv.ids);
	else cluster.spawn(argv.min, argv.max);

	cluster.once('exit', () => process.exit(0));
};
