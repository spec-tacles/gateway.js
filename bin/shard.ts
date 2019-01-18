import Shard from '../src/Shard';
import { decode, encode } from '@spectacles/util';
import { CommandModule } from 'yargs';

const shard: CommandModule<{
	token: string,
	events: string[],
}, {
	token: string,
	events: string[],
	id: number,
}> = {
	command: 'shard',
	describe: 'Spawn a single shard',
	builder: {
		id: {
			description: 'The shard ID to spawn',
			type: 'number',
			required: true,
		},
	},
	handler: argv => {
		const shard = new Shard(argv.token, argv.id);
		for (const event of argv.events) {
			shard.on(event, data => {
				const packet = { event, data };

				if (argv.fork && process.send) process.send(packet);
				else process.stdout.write(encode(packet));
			});
		}

		if (argv.fork) process.on('message', data => shard.send(data));
		else process.stdin.on('data', data => shard.send(decode(data)));

		shard.once('exit', () => process.exit(0));
	},
}

export default shard;
