const { default: Gateway } = require('../dist');

class Tester2000 extends Gateway {
  publish(event, data) {
    this.emit(event, data);
  }

  subscribe() {}
};

const client = new Tester2000({
  token: process.env.token,
  events: ['MESSAGE_CREATE'],
});
client.on('MESSAGE_CREATE', console.log);
client.spawn();
