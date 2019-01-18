#!/usr/bin/env node
const { Gateway } = require('../dist');

require('yargs')
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
		'default': 'close,error,open,receive',
		'global': true,
	})
	.middleware(argv => {
		if (argv.total) argv.token.shards = argv.total;
	})
	.command(require('./cluster'))
	.command(require('./shard'))
	.help()
	.argv;
