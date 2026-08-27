const axios = require('axios');
const logger = require('../utils/logger');
 require('dotenv').config();

const BASE_URL = process.env.NEXTSMS_BASE_URL;
const TOKEN = process.env.NEXTSMS_TOKEN;
const SENDER = process.env.NEXTSMS_SENDER;

async function sendBulkSMS(messages) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/sms/v2/text/multi`,
      {
        messages,
        flash: 0,
        reference: `ref-${Date.now()}`
      },
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
    logger.error("SMS ERROR:", err.response?.data || err.message);
    console.error("SMS ERROR:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  sendBulkSMS,
  SENDER
};