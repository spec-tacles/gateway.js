#!/usr/bin/env node
const readline = require('readline');
const { Cluster, Gateway, Shard } = require('../dist');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

require('yargs')
  .env('DISCORD')
  .option('config', {
    config: true,
    global: true,
    description: 'The location of the Spectacles gateway config file',
    alias: 'c',
    default: 'spectacles.json',
    type: 'string',
  })
  .option('token', {
    description: 'The token to login with',
    hidden: true,
    global: true,
    alias: 't',
    demandOption: 'A token is required; please create a spectacles.json file with your token',
    type: 'string',
    coerce: arg => new Gateway(arg),
  })
  .option('total', {
    description: 'The total number of shards being spawned',
    type: 'number',
    global: true,
  })
  .command('cluster', 'Spawn a cluster of shards', yargs => {
    yargs.option('min', {
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
    }).example('cluster --ids 1 2 3 5 6 7', 'Spawn the specified shards (1, 2, 3, 5, 6, and 7)')
      .example('cluster --min 2 --max 8', 'Spawn shards 2 through 8 inclusive');
  }, argv => {
    if (argv.total) argv.token.shards = argv.total;

    const cluster = new Cluster(argv.token);
    if (argv.ids) cluster.spawn(argv.ids);
    else cluster.spawn(argv.min, argv.max);

    cluster.once('exit', () => process.exit(0));
  })
  .command('shard', 'Spawn a single shard', yargs => {
    yargs.option('id', {
      description: 'The shard ID to spawn',
      type: 'number',
      required: true,
    });
  }, argv => {
    if (argv.total) argv.token.shards = argv.total;

    const shard = new Shard(argv.token, argv.id);
    if (process.send) {
      shard.on('receive', process.send);
    }

    shard.once('exit', () => process.exit(0));
  })
  .help()
  .argv;
