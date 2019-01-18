#!/usr/bin/env node
import * as yargs from 'yargs';
import Gateway from '../src/Gateway';
import cluster from './cluster';
import shard from './shard';

yargs
	.env('DISCORD')
	.option('config', {
		'config': true,
		'global': true,
		'description': 'The location of the Spectacles gateway config file',
		'alias': 'c',
		'default': 'spectacles.json',
		'type': 'string',
	})
	.option('token', {
		description: 'The token to login with',
		hidden: true,
		global: true,
		alias: 't',
		demandOption: 'A token is required; please create a spectacles.json file with your token or provide a DISCORD_TOKEN environment variable',
		type: 'string',
		coerce: arg => new Gateway(arg),
	})
	.option('total', {
		description: 'The total number of shards being spawned',
		type: 'number',
		global: true,
	})
	.option('fork', {
		'description': 'Whether this process is a Node child process fork',
		'type': 'boolean',
		'hidden': true,
		'default': false,
		'global': true,
	})
	.option('events', {
		'description': 'Shard events to listen to',
		'type': 'array',
		'default': ['close', 'error', 'open', 'receive'],
		'global': true,
	})
	.middleware(argv => {
		if (argv.total) (argv.token as unknown as Gateway).shards = argv.total;
	})
	.command(cluster)
	.command(shard)
	.help()
	.argv;
