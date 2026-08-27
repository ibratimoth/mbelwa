const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const sendBulkSMS = require('../services/smsService').sendBulkSMS;
const { sms_log: SmsLog } = require('../models');
const logger = require('../utils/logger');

const connection = new IORedis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null
});

const smsWorker = new Worker(
  'sms-queue',
  async (job) => {

    const { messages } = job.data;

    logger.info('📩 messages:');
    logger.info(JSON.stringify(messages, null, 2));

    try {

      const response = await sendBulkSMS(messages);

      logger.info('📩 SMS RESPONSE:');
      logger.info(JSON.stringify(response, null, 2));

      // ===============================
      // BUILD LOOKUP MAP (CRITICAL FIX)
      // ===============================
      const referenceMap = new Map();

      for (const m of messages) {
        referenceMap.set(m.to, m.reference);
      }

      // ===============================
      // SUCCESS UPDATE
      // ===============================
      for (const msg of response.messages) {

        const reference_id = referenceMap.get(msg.to);

        if (!reference_id) continue;

        await SmsLog.update(
          {
            status: msg.status?.name === 'DELIVERED'
              ? 'DELIVERED'
              : 'SENT',

            provider_message_id: msg.messageId?.toString() || null,
            provider_response: msg
          },
          {
            where: { reference_id }
          }
        );
      }

      return response;

    } catch (err) {

      logger.error(err?.response?.data || err.message);

      // ===============================
      // FAIL SAFE UPDATE
      // ===============================
      for (const msg of messages) {

        await SmsLog.update(
          {
            status: 'FAILED'
          },
          {
            where: {
              reference_id: msg.reference
            }
          }
        );
      }

      throw err;
    }
  },
  { connection }
);

// LOGS
smsWorker.on('completed', (job) => {
  logger.info(`✅ Job completed: ${job.id}`);
});

smsWorker.on('failed', (job, err) => {
  logger.error(`❌ Job failed: ${job?.id}`);
  logger.error(err.message);
});