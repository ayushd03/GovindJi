const axios = require('axios');

const DEFAULT_PROCESSING = {
  mode: 'auto',
  targetFileSize: 150 * 1024,
};

/**
 * Parse multipart `processing_settings` JSON or JSON-body object safely.
 * @param {string|object|undefined|null} value
 * @returns {object}
 */
function parseProcessingSettings(value) {
  if (value === undefined || value === null || value === '') {
    return { ...DEFAULT_PROCESSING };
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      return { ...DEFAULT_PROCESSING };
    }
  }
  return { ...DEFAULT_PROCESSING };
}

const DEFAULT_MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/**
 * Download an image URL into a buffer for server-side processing.
 * @param {string} imageUrl
 * @param {number} [maxBytes]
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
async function fetchImageFromUrl(imageUrl, maxBytes = DEFAULT_MAX_IMAGE_BYTES) {
  const res = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    timeout: 45000,
    headers: { Accept: 'image/*,*/*' },
    validateStatus: (s) => s >= 200 && s < 300,
  });

  const buffer = Buffer.from(res.data);
  const rawType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!rawType.startsWith('image/')) {
    const err = new Error(`URL did not return an image (content-type: ${rawType || 'unknown'})`);
    err.code = 'INVALID_IMAGE_CONTENT_TYPE';
    throw err;
  }

  return { buffer, contentType: rawType };
}

module.exports = {
  parseProcessingSettings,
  DEFAULT_PROCESSING,
  fetchImageFromUrl,
  DEFAULT_MAX_IMAGE_BYTES,
};
