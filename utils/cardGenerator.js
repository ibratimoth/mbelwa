// utils/cardGenerator.js
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs/promises');

const TEMPLATES_DIR = process.env.TEMPLATES_DIR || 'public/templates';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

/**
 * generateCardPNG - creates a card PNG with name, type and qr image.
 * @param {Object} opts - { name, type, qrPath, baseTemplateFilename, outputFilename }
 * @returns {String} outputPath
 */
async function generateCardPNG({
  name,
  type,
  qrPath,
  baseTemplateFilename = 'card_base.jpg',
  outputFilename,
}) {
  const safeName = name || '';
  const typeText = type === 'double' ? 'Double' : 'Single';

  // Resolve file paths
  const basePath = path.join(TEMPLATES_DIR, baseTemplateFilename);
  const outFile = outputFilename || `${Date.now()}-${safeName.replace(/\s+/g, '_')}.png`;
  const outPath = path.join(UPLOAD_DIR, outFile);

  // Load images
  const baseImg = await Jimp.read(basePath);
  const qrImg = await Jimp.read(qrPath);

  const width = baseImg.bitmap.width;
  const height = baseImg.bitmap.height;

  // --- QR CODE (Position Kept from previous revision: Top-Right) ---
  const qrSize = Math.round(width * 0.16);
  const qrX = width - qrSize - Math.round(width * 0.06); 
  const qrY = Math.round(height * 0.08); // 8% from top edge is a good spot

  qrImg.resize(qrSize, qrSize);
  baseImg.composite(qrImg, qrX, qrY);

  // Load fonts
  const combinedFont = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK); 

  // --- TEXT ADJUSTMENTS: Move text to be *above* the horizontal line ---
  const nameX = width / 2;
  
  // Adjusted Y-position: Moving it up to 35% of the height to sit ABOVE the line
  const nameY = height * 0.35; 
  
  // Format the text as requested: "ibrahimu - Double"
  const combinedText = `${safeName} - ${typeText}`;
  
  // Print combined name and type, centered horizontally
  const combinedWidth = combinedText ? Jimp.measureText(combinedFont, combinedText) : 0;
  baseImg.print(combinedFont, nameX - combinedWidth / 2, nameY, combinedText);

  // Ensure upload directory exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Save PNG
  await baseImg.writeAsync(outPath);

  return outPath;
}

module.exports = { generateCardPNG };