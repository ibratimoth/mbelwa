// queues/smsQueue.js
const { Queue } = require('bullmq');
const connection = require('../config/redis');

const smsQueue = new Queue('sms-queue', { connection });

module.exports = smsQueue;