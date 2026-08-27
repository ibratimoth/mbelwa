const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const BASE_URL = process.env.NEXTSMS_BASE_URL || 'https://messaging-service.co.tz';
const TOKEN = process.env.NEXTSMS_TOKEN;
const WA_ACCOUNT = process.env.NEXTSMS_WA_ACCOUNT;

/**
 * Sends a WhatsApp message with a custom individual card header to a single recipient
 */
async function sendSingleWhatsAppWithCard({ phone, cardUrl, variables, templateName }) {
  try {
    const cleanedPhone = parseInt(phone.toString().replace(/[^0-9]/g, ''), 10);

    const payload = {
      to: [cleanedPhone],
      account: WA_ACCOUNT,
      template: templateName,
      header: {
        image: {
          file: cardUrl,
          name: 'Event Card'
        }
      },
      personalisation: [variables]
    };

    console.log(`payload for WhatsApp message to ${cleanedPhone}:`, JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${BASE_URL}/api/whatsapp/v2/text/multi`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        }
      }
    );

    return response.data;
  } catch (err) {
    logger.error(`WHATSAPP ERROR (${phone}):`, err.response?.data || err.message);
    console.error(`WHATSAPP ERROR (${phone}):`, err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendSingleWhatsAppWithCard };