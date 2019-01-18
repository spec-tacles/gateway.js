const { default: Shard } = require('../dist/Shard');
const { decode, encode } = require('@spectacles/util');

exports.command = 'shard';
exports.describe = 'Spawn a single shard';
exports.builder = yargs => yargs.option('id', {
	description: 'The shard ID to spawn',
	type: 'number',
	required: true,
});

exports.handler = argv => {
	const shard = new Shard(argv.token, argv.id);
	for (const event of argv.events) {
		shard.on(event, data => {
			const packet = { event, data };

			if (argv.fork) process.send(packet);
			else process.stdout.write(encode(packet));
		});
	}

	if (argv.fork) process.on('message', data => shard.send(data));
	else process.stdin.on('data', data => shard.send(decode(data)));

	shard.once('exit', () => process.exit(0));
};
