# Spectacles gateway
The gateway to Discord.

## Overview
The Spectacles gateway is a powerful abstraction for the Discord API, enabling anything from a massive, fully-scalable application to a simple 1-server bot. Its approach is extremely minimalistic while providing a clean API interface, allowing the developer to beautifully orchestrate their data without extra fluff.

## Your first bot
The Spectacles gateway client can be used in a variety of ways. However, let's just start off with the most basic example.

```js
const { Client } = require('@spectacles/gateway');
const client = new Client({ token: 'your token', events: ['MESSAGE_CREATE'], local: true });
client.on('MESSAGE_CREATE', console.log);
client.spawn();
```

This application will setup the client, automatically spawn the recommended number of shards, and log any messages it receives to console. You'll notice that the event name is exactly as emitted by Discord and the message contents are an object exactly as received from Discord; this pattern is core to Spectacles and will recur throughout the library. Adding any events to the `events` option as shown on line 2 of the above example will cause those events to be emitted on the client. Please refer to the [Discord API documentation](https://discordapp.com/developers/docs/topics/gateway#events) for information about available events.

Logging messages is all well and good, but let's get into the request-response system of a typical Discord bot.

```js
client.on('MESSAGE_CREATE', (message) => {
  if (message.content === '!ping') client.channels[message.channel_id].messages.create({ content: 'pong!' });
});
```

This is our first encounter with Spectacles' REST system in order to create the "pong!" response. The client essentially acts as an API router, allowing you to query any endpoint on the Discord API. `client.channels[message.channel_id].messages` will set the endpoint to `/channels/${message.channel_id}/messages` and the call to `.create` will set the method to `POST`; obviously the parameters are the POST content. A full mapping of method name to HTTP method:

| HTTP      | Spectacles |
|-----------|------------|
| GET       | fetch      |
| POST      | create     |
| PUT       | update     |
| PATCH     | edit       |
| DELETE    | delete     |

For example, if you want to load information about all of a guild's roles:

```js
await client.guilds['some guild id'].roles.fetch();
```

Then, maybe you want to add a guild member to a role.

```js
await client.guilds['some guild id'].members['some user id'].roles['some role id'].update();
```

That's basically it: given the data from Discord, you're free to do with it as you please. Spectacles makes no assumptions about how or whether you want to store it, use it, or receive it. Please refer to the [Discord API documentation](https://discordapp.com/developers/docs/intro) for details about their endpoints.
