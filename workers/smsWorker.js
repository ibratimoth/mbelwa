// const { Worker } = require('bullmq');
// const IORedis = require('ioredis');
// const sendBulkSMS = require('../services/smsService').sendBulkSMS;
// const { sms_log: SmsLog } = require('../models');
// const logger = require('../utils/logger');

// const connection = new IORedis({
//   host: '127.0.0.1',
//   port: 6379,
//   maxRetriesPerRequest: null
// });

// const smsWorker = new Worker(
//   'sms-queue',
//   async (job) => {

//     const { messages } = job.data;

//     logger.info('📩 messages:');
//     logger.info(JSON.stringify(messages, null, 2));

//     try {

//       const response = await sendBulkSMS(messages);

//       logger.info('📩 SMS RESPONSE:');
//       logger.info(JSON.stringify(response, null, 2));

//       // ===============================
//       // BUILD LOOKUP MAP (CRITICAL FIX)
//       // ===============================
//       const referenceMap = new Map();

//       for (const m of messages) {
//         referenceMap.set(m.to, m.reference);
//       }

//       // ===============================
//       // SUCCESS UPDATE
//       // ===============================
//       for (const msg of response.messages) {

//         const reference_id = referenceMap.get(msg.to);

//         if (!reference_id) continue;

//         await SmsLog.update(
//           {
//             status: msg.status?.name === 'DELIVERED'
//               ? 'DELIVERED'
//               : 'SENT',

//             provider_message_id: msg.messageId?.toString() || null,
//             provider_response: msg
//           },
//           {
//             where: { reference_id }
//           }
//         );
//       }

//       return response;

//     } catch (err) {

//       logger.error(err?.response?.data || err.message);

//       // ===============================
//       // FAIL SAFE UPDATE
//       // ===============================
//       for (const msg of messages) {

//         await SmsLog.update(
//           {
//             status: 'FAILED'
//           },
//           {
//             where: {
//               reference_id: msg.reference
//             }
//           }
//         );
//       }

//       throw err;
//     }
//   },
//   { connection }
// );

// // LOGS
// smsWorker.on('completed', (job) => {
//   logger.info(`✅ Job completed: ${job.id}`);
// });

// smsWorker.on('failed', (job, err) => {
//   logger.error(`❌ Job failed: ${job?.id}`);
//   logger.error(err.message);
// });


const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { sendBulkSMS } = require('../services/smsService');
const { sendSingleWhatsAppWithCard } = require('../services/whatsappService');
const { sms_log: SmsLog } = require('../models');
const logger = require('../utils/logger');

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null
});

const smsWorker = new Worker(
  'sms-queue',
  async (job) => {
    // ==========================================
    // 1. HANDLE WHATSAPP JOBS
    // ==========================================
    if (job.name === 'send-whatsapp') {
      const { recipients, templateName } = job.data;

      logger.info(`💬 Processing WhatsApp job ${job.id} for ${recipients.length} recipient(s)...`);

      for (const r of recipients) {
        try {
          const response = await sendSingleWhatsAppWithCard({
            phone: r.phone,
            cardUrl: r.cardUrl,
            variables: r.variables,
            templateName
          });

          logger.info(`💬 WHATSAPP SENT TO ${r.phone}:`, JSON.stringify(response, null, 2));

          await SmsLog.update(
            {
              status: 'SENT',
              provider_response: response
            },
            {
              where: { reference_id: r.reference }
            }
          );
        } catch (err) {
          logger.error(`❌ WHATSAPP WORKER ERROR (${r.phone}):`, err?.response?.data || err.message);

          await SmsLog.update(
            { status: 'FAILED' },
            { where: { reference_id: r.reference } }
          );
        }
      }

      return { processed: recipients.length };
    }

    // ==========================================
    // 2. HANDLE STANDARD SMS JOBS
    // ==========================================
    if (job.name === 'send-sms') {
      const { messages } = job.data;

      logger.info(`📩 Processing SMS job ${job.id} for ${messages.length} message(s)...`);

      try {
        const response = await sendBulkSMS(messages);

        logger.info('📩 SMS RESPONSE:');
        logger.info(JSON.stringify(response, null, 2));

        // Map recipient numbers to reference IDs for lookup
        const referenceMap = new Map();
        for (const m of messages) {
          referenceMap.set(m.to, m.reference);
        }

        if (response?.messages && Array.isArray(response.messages)) {
          for (const msg of response.messages) {
            const reference_id = referenceMap.get(msg.to);
            if (!reference_id) continue;

            await SmsLog.update(
              {
                status: msg.status?.name === 'DELIVERED' ? 'DELIVERED' : 'SENT',
                provider_message_id: msg.messageId?.toString() || null,
                provider_response: msg
              },
              {
                where: { reference_id }
              }
            );
          }
        }

        return response;
      } catch (err) {
        logger.error('❌ SMS WORKER ERROR:', err?.response?.data || err.message);
        console.log('❌ SMS WORKER ERROR:', err?.response?.data || err.message);

        // Fail-safe database log update
        for (const msg of messages) {
          await SmsLog.update(
            { status: 'FAILED' },
            { where: { reference_id: msg.reference } }
          );
        }

        throw err;
      }
    }
  },
  { connection }
);

// ==========================================
// WORKER EVENT LISTENERS
// ==========================================
smsWorker.on('completed', (job) => {
  logger.info(`✅ Job [${job.name}] completed successfully with ID: ${job.id}`);
});

smsWorker.on('failed', (job, err) => {
  logger.error(`❌ Job [${job?.name}] failed with ID: ${job?.id}`);
  logger.error(`Error details: ${err.message}`);
});

module.exports = smsWorker;