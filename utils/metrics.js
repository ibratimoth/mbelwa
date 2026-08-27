const client = require('prom-client');

// Auto-track CPU, RAM heap, Active connections, Garbage Collection ticks
client.collectDefaultMetrics({ register: client.register });

// 1. Core Speed Counter tracking total Ticket Scanning traffic
const gateScanCounter = new client.Counter({
  name: 'gate_scans_total',
  help: 'Total count of scanned tickets received at entry checkpoints',
  labelNames: ['eventId', 'status'] // Split graphs by individual wedding and outcome
});

// 2. Metrics Counter measuring bulk SMS dispatch failures vs successes
const smsDispatchedCounter = new client.Counter({
  name: 'sms_dispatched_total',
  help: 'Total notifications passed out to global cellular SMS channels',
  labelNames: ['eventId', 'status']
});

module.exports = { client, gateScanCounter, smsDispatchedCounter };