const QRCode = require('qrcode');

/**
 * Generates Data URL for QR Code containing verification URL.
 */
async function generateVerificationQRCode(certificateId, frontendBaseUrl) {
  const baseUrl = (frontendBaseUrl || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const verificationUrl = `${baseUrl}/verify/${encodeURIComponent(certificateId)}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });

    return {
      verificationUrl,
      qrDataUrl
    };
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

module.exports = {
  generateVerificationQRCode
};
