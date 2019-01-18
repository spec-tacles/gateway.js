import Cluster from '../src/Cluster';
import { decode, encode } from '@spectacles/util';
import { CommandModule } from 'yargs';

const cluster: CommandModule<{ token: string, events: string[] }, {
	token: string;
	events: string[];
	min: number | undefined;
	max: number | undefined;
	ids: (string | number)[] | undefined;
}> = {
	command: 'cluster',
	describe: 'Spawn a cluster of shards',
	builder: yargs => yargs.option('min', {
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
		.example('cluster --min 2 --max 8', 'Spawn shards 2 through 8 inclusive'),
	handler: argv => {
		const cluster = new Cluster(argv.token);
		for (const event of argv.events) {
			cluster.on(event, (data, shard) => {
				const packet = { event, data, shard: shard.id };

				if (argv.fork && process.send) process.send(packet);
				else process.stdout.write(encode(packet));
			});
		}

		const listener = ({ data, shard }: { data: any, shard: number }) => {
			const s = cluster.shards.get(shard);
			if (s) s.send(data);
		};

		if (argv.fork) process.on('message', listener);
		else process.stdin.on('data', d => listener(decode(d)));

		if (argv.ids) cluster.spawn(argv.ids.map(Number));
		else if (argv.min !== undefined && argv.max !== undefined) cluster.spawn(argv.min, argv.max);
		else throw new Error('invalid arguments provided: missing IDs, min, or max');

		cluster.once('exit', () => process.exit(0));
	},
};

export default cluster;
