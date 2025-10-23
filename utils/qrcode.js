// utils/qrcode.js
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs/promises');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

async function generateQRCodeToFile(text, filename) {
  const filePath = path.join(UPLOAD_DIR, filename);
  const dataUrl = await qrcode.toDataURL(text, { margin: 1, errorCorrectionLevel: 'H' });
  // convert dataURL to buffer
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));
  return filePath;
}

module.exports = { generateQRCodeToFile };
