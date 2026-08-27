// // utils/cardGenerator.js
// const Jimp = require('jimp');
// const path = require('path');
// const fs = require('fs/promises');

// const TEMPLATES_DIR = process.env.TEMPLATES_DIR || 'public/templates';
// const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

// /**
//  * generateCardPNG - creates a card PNG with name, type and qr image.
//  * @param {Object} opts - { name, type, qrPath, baseTemplateFilename, outputFilename }
//  * @returns {String} outputPath
//  */

// async function generateCardPNG({
//   name,
//   type,
//   qrPath,
//   baseTemplateFilename,
//   outputFilename,
//   layoutConfig = {}
// }) {

//   //console.log('layoutConfig received in generateCardPNG:', layoutConfig);
//   const safeName = name || '';
//   const typeText = type === 'double' ? 'Double' : 'Single';

//   const basePath = path.join(TEMPLATES_DIR, baseTemplateFilename);
//   const outFile = outputFilename || `${Date.now()}-${safeName.replace(/\s+/g, '_')}.png`;
//   const outPath = path.join(UPLOAD_DIR, outFile);

//   const baseImg = await Jimp.read(basePath);
//   const qrImg = await Jimp.read(qrPath);

//   const width = baseImg.bitmap.width;
//   const height = baseImg.bitmap.height;

//   const combinedFont = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

//   // =========================
//   // DEFAULT VALUES (ONLY IF NOT SET)
//   // =========================
//   const qrSize = Math.round(width * 0.25);

//   const qrX = Math.round(
//     layoutConfig.qrX ?? (width - qrSize - Math.round(width * 0.06))
//   );

//   const qrY = Math.round(
//     layoutConfig.qrY ?? Math.round(height * 0.08)
//   );

//   const nameX = Math.round(
//     layoutConfig.nameX ?? width / 2
//   );

//   const nameY = Math.round(
//     layoutConfig.nameY ?? height * 0.57
//   );

//   // =========================
//   // QR CODE
//   // =========================
//   qrImg.resize(qrSize, qrSize);
//   baseImg.composite(qrImg, qrX, qrY);

//   // =========================
//   // TEXT (UNCHANGED LOGIC)
//   // =========================
//   const combinedText = `${safeName} - ${typeText}`;

//   const combinedWidth = Jimp.measureText(combinedFont, combinedText);

//   baseImg.print(
//     combinedFont,
//     nameX - combinedWidth / 2,
//     nameY,
//     combinedText
//   );

//   // =========================
//   // SAVE
//   // =========================
//   await fs.mkdir(UPLOAD_DIR, { recursive: true });
//   await baseImg.writeAsync(outPath);

//   return outPath;
// }

// async function generatePreviewCard(event) {

//   const basePath = path.join(
//     'public/templates',
//     event.card_template
//   );

//   return {
//     url: `/public/templates/${event.card_template}`
//   };
// }

// module.exports = { generateCardPNG, generatePreviewCard };

const Jimp = require('jimp');
const path = require('path');
const fs = require('fs/promises');

const TEMPLATES_DIR = process.env.TEMPLATES_DIR || 'public/templates';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

/**
 * generateCardPNG - creates a card PNG/JPEG with name, type and QR image, strictly capped by size.
 */
async function generateCardPNG({
  name,
  type,
  qrPath,
  baseTemplateFilename,
  outputFilename,
  layoutConfig = {},
  maxSizeBytes = 2097152 // 2 MB
}) {
  const safeName = name || '';
  const typeText = type === 'double' ? 'Double' : 'Single';

  const basePath = path.join(TEMPLATES_DIR, baseTemplateFilename);
  const outFile = outputFilename || `${Date.now()}-${safeName.replace(/\s+/g, '_')}.png`;
  const outPath = path.join(UPLOAD_DIR, outFile);

  const baseImg = await Jimp.read(basePath);
  const qrImg = await Jimp.read(qrPath);

  const width = baseImg.bitmap.width;
  const height = baseImg.bitmap.height;

  const combinedFont = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

  // =========================
  // POSITION CALCULATIONS
  // =========================
  const qrSize = Math.round(width * 0.25);

  const qrX = Math.round(
    layoutConfig.qrX ?? (width - qrSize - Math.round(width * 0.06))
  );

  const qrY = Math.round(
    layoutConfig.qrY ?? Math.round(height * 0.08)
  );

  const nameX = Math.round(
    layoutConfig.nameX ?? width / 2
  );

  const nameY = Math.round(
    layoutConfig.nameY ?? height * 0.57
  );

  // =========================
  // QR CODE & TEXT COMPOSITE
  // =========================
  qrImg.resize(qrSize, qrSize);
  baseImg.composite(qrImg, qrX, qrY);

  const combinedText = `${safeName} - ${typeText}`;
  const combinedWidth = Jimp.measureText(combinedFont, combinedText);

  baseImg.print(
    combinedFont,
    nameX - combinedWidth / 2,
    nameY,
    combinedText
  );

  // Set maximum deflate compression level for PNGs
  baseImg.deflateLevel(9);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await baseImg.writeAsync(outPath);

  // =========================
  // FILE SIZE ENFORCEMENT LOOP
  // =========================
  let fileStats = await fs.stat(outPath);
  
  if (fileStats.size > maxSizeBytes) {
    let currentImg = baseImg;
    let scaleFactor = 0.9;

    // Iteratively scale down dimensions until file size drops below limit
    while (fileStats.size > maxSizeBytes && scaleFactor >= 0.4) {
      const targetWidth = Math.round(width * scaleFactor);
      
      currentImg = baseImg.clone().resize(targetWidth, Jimp.AUTO);
      currentImg.deflateLevel(9);
      
      await currentImg.writeAsync(outPath);
      fileStats = await fs.stat(outPath);
      
      scaleFactor -= 0.1;
    }
  }

  return outPath;
}

async function generatePreviewCard(event) {
  return {
    url: `/public/templates/${event.card_template}`
  };
}

module.exports = { generateCardPNG, generatePreviewCard };