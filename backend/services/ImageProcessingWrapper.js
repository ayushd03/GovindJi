const sharp = require('sharp');
const fs = require('fs').promises;

const MAX_INPUT_PIXELS = Number.parseInt(process.env.MAX_IMAGE_INPUT_PIXELS || '60000000', 10);
sharp.cache(false);

class ImageProcessingWrapper {
  /**
   * Process an image using Sharp
   * @param {string|Buffer} input - Input file path or buffer
   * @param {Object} settings - Processing settings
   * @param {string} outputFilename - Optional output filename
   * @returns {Promise<Object>} Processing result
   */
  async processImage(input, settings = {}, outputFilename = null) {
    let tempFilePath = null;

    try {
      const processedSettings = this.validateSettings(settings);

      let originalSize;
      let originalMeta;

      if (Buffer.isBuffer(input)) {
        originalSize = input.length;
      } else {
        const stat = await fs.stat(input);
        originalSize = stat.size;
        if (typeof input === 'string' && input.includes('temp_')) {
          tempFilePath = input;
        }
      }

      if (processedSettings.mode === 'auto') {
        const autoResult = await this.processToTargetSize(input, processedSettings);
        if (tempFilePath) {
          try {
            await fs.unlink(tempFilePath);
          } catch (cleanupError) {
            console.warn('Could not clean up temp file:', cleanupError.message);
          }
        }
        if (!autoResult.success) {
          return autoResult;
        }
        const ext = 'webp';
        const name =
          outputFilename ||
          `processed_${Date.now()}.${ext}`;
        return {
          success: true,
          output_filename: name,
          processed_buffer: autoResult.processed_buffer,
          original: autoResult.original,
          processed: autoResult.processed,
          settings_used: autoResult.settings_used || processedSettings,
          compression_ratio: autoResult.compression_ratio,
        };
      }

      const originalSharp = this._createSharp(input);
      originalMeta = await originalSharp.metadata();

      let orientedMeta = originalMeta;
      let pipeline = this._createSharp(input);
      if (processedSettings.optimization.autoOrient) {
        pipeline = pipeline.rotate();
        orientedMeta = await pipeline.clone().metadata();
      }

      const resizeOnce = this._computeManualResize(processedSettings, orientedMeta);
      if (resizeOnce) {
        pipeline = pipeline.resize(resizeOnce.width, resizeOnce.height, {
          fit: resizeOnce.fit,
          withoutEnlargement: true,
        });
      }

      const outputFormat = this.determineOutputFormat(
        orientedMeta.format,
        processedSettings.format
      );

      const highFidelity = !processedSettings.compression.enabled;
      const keepMeta = !processedSettings.optimization.removeMetadata;
      if (keepMeta) {
        pipeline = pipeline.withMetadata();
      }

      pipeline = this._applyOutputEncoder(
        pipeline,
        outputFormat,
        processedSettings,
        highFidelity
      );

      const processedBuffer = await pipeline.toBuffer();
      const finalMeta = await this._createSharp(processedBuffer).metadata();

      if (!outputFilename) {
        const extension = outputFormat === 'jpeg' || outputFormat === 'jpg' ? 'jpg' : outputFormat;
        outputFilename = `processed_${Date.now()}.${extension}`;
      }

      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.warn('Could not clean up temp file:', cleanupError.message);
        }
      }

      return {
        success: true,
        output_filename: outputFilename,
        processed_buffer: processedBuffer,
        original: {
          format: originalMeta.format,
          size: [originalMeta.width, originalMeta.height],
          file_size: originalSize,
        },
        processed: {
          format: finalMeta.format,
          size: [finalMeta.width, finalMeta.height],
          file_size: processedBuffer.length,
        },
        settings_used: processedSettings,
        compression_ratio: Math.round((1 - processedBuffer.length / originalSize) * 100),
      };
    } catch (error) {
      console.error('Image processing error:', error);

      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.warn('Could not clean up temp file after error:', cleanupError.message);
        }
      }

      return {
        success: false,
        error: error.message,
        error_type: error.constructor.name,
      };
    }
  }

  /**
   * One resize pass: explicit resize wins; else max dimensions when compression is on.
   * Uses dimensions after auto-orient.
   * @private
   */
  _computeManualResize(processedSettings, orientedMeta) {
    const w0 = orientedMeta.width;
    const h0 = orientedMeta.height;
    if (!w0 || !h0) {
      return null;
    }

    if (processedSettings.resize.enabled) {
      const { width, height, maintainAspectRatio } = processedSettings.resize;
      if (width || height) {
        return {
          width: width || undefined,
          height: height || undefined,
          fit: maintainAspectRatio ? 'inside' : 'fill',
        };
      }
    }

    if (!processedSettings.compression.enabled) {
      return null;
    }

    const { maxWidth, maxHeight } = processedSettings.compression;
    if (w0 <= maxWidth && h0 <= maxHeight) {
      return null;
    }

    return {
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
    };
  }

  /**
   * @private
   */
  _applyOutputEncoder(pipeline, outputFormat, processedSettings, highFidelity) {
    const prog = processedSettings.optimization.progressive;
    const qUser = processedSettings.compression.quality;
    const q = highFidelity ? Math.max(qUser, 93) : qUser;

    if (outputFormat === 'webp') {
      return pipeline.webp({
        quality: highFidelity ? Math.min(100, Math.max(q, 95)) : q,
        effort: highFidelity ? 6 : 5,
        smartSubsample: true,
      });
    }
    if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
      return pipeline.jpeg({
        quality: highFidelity ? Math.min(100, Math.max(q, 95)) : q,
        progressive: prog,
        mozjpeg: true,
      });
    }
    if (outputFormat === 'png') {
      return pipeline.png({
        progressive: prog,
        compressionLevel: highFidelity ? 6 : 9,
        adaptiveFiltering: true,
      });
    }
    if (outputFormat === 'gif') {
      return pipeline.gif({ effort: 7 });
    }

    const fmt = String(outputFormat || 'jpeg').toLowerCase();
    if (fmt === 'tiff' || fmt === 'tif') {
      return pipeline.tiff({ quality: highFidelity ? 100 : q });
    }

    return pipeline.jpeg({
      quality: highFidelity ? 95 : q,
      progressive: prog,
      mozjpeg: true,
    });
  }

  async processImages(inputs, settings = {}) {
    const results = [];

    for (const input of inputs) {
      try {
        const result = await this.processImage(input, settings);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          input: typeof input === 'string' ? input : 'buffer',
        });
      }
    }

    return results;
  }

  getDefaultSettings() {
    return {
      mode: 'auto',
      targetFileSize: 150 * 1024,
      compression: {
        enabled: true,
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1080,
      },
      format: {
        outputFormat: 'webp',
        convertToWebp: true,
      },
      optimization: {
        removeMetadata: true,
        progressive: true,
        autoOrient: true,
      },
      resize: {
        enabled: false,
        width: null,
        height: null,
        maintainAspectRatio: true,
      },
    };
  }

  validateSettings(settings) {
    const defaults = this.getDefaultSettings();
    const validated = {
      ...defaults,
      compression: { ...defaults.compression },
      format: { ...defaults.format },
      optimization: { ...defaults.optimization },
      resize: { ...defaults.resize },
    };

    if (settings.mode === 'auto' || settings.mode === 'manual') {
      validated.mode = settings.mode;
    }

    if (typeof settings.targetFileSize === 'number' && Number.isFinite(settings.targetFileSize)) {
      const minT = 25 * 1024;
      const maxT = 3 * 1024 * 1024;
      validated.targetFileSize = Math.round(
        Math.min(maxT, Math.max(minT, settings.targetFileSize))
      );
    }

    if (settings.compression) {
      if (typeof settings.compression.enabled === 'boolean') {
        validated.compression.enabled = settings.compression.enabled;
      }
      if (
        typeof settings.compression.quality === 'number' &&
        settings.compression.quality >= 1 &&
        settings.compression.quality <= 100
      ) {
        validated.compression.quality = Math.round(settings.compression.quality);
      }
      if (typeof settings.compression.maxWidth === 'number' && settings.compression.maxWidth > 0) {
        validated.compression.maxWidth = Math.round(settings.compression.maxWidth);
      }
      if (typeof settings.compression.maxHeight === 'number' && settings.compression.maxHeight > 0) {
        validated.compression.maxHeight = Math.round(settings.compression.maxHeight);
      }
    }

    if (settings.format) {
      const allowedFormats = ['webp', 'jpeg', 'jpg', 'png', 'gif', 'original'];
      if (allowedFormats.includes(settings.format.outputFormat)) {
        validated.format.outputFormat = settings.format.outputFormat;
      }
      if (typeof settings.format.convertToWebp === 'boolean') {
        validated.format.convertToWebp = settings.format.convertToWebp;
      }
    }

    if (settings.optimization) {
      if (typeof settings.optimization.removeMetadata === 'boolean') {
        validated.optimization.removeMetadata = settings.optimization.removeMetadata;
      }
      if (typeof settings.optimization.progressive === 'boolean') {
        validated.optimization.progressive = settings.optimization.progressive;
      }
      if (typeof settings.optimization.autoOrient === 'boolean') {
        validated.optimization.autoOrient = settings.optimization.autoOrient;
      }
    }

    if (settings.resize) {
      if (typeof settings.resize.enabled === 'boolean') {
        validated.resize.enabled = settings.resize.enabled;
      }
      if (typeof settings.resize.width === 'number' && settings.resize.width > 0) {
        validated.resize.width = Math.round(settings.resize.width);
      }
      if (typeof settings.resize.height === 'number' && settings.resize.height > 0) {
        validated.resize.height = Math.round(settings.resize.height);
      }
      if (typeof settings.resize.maintainAspectRatio === 'boolean') {
        validated.resize.maintainAspectRatio = settings.resize.maintainAspectRatio;
      }
    }

    return validated;
  }

  determineOutputFormat(originalFormat, formatSettings) {
    const outputFormat = formatSettings.outputFormat?.toLowerCase() || 'webp';

    if (outputFormat === 'original') {
      return originalFormat?.toLowerCase() || 'jpeg';
    }

    const supportedFormats = ['webp', 'jpeg', 'jpg', 'png', 'gif'];
    return supportedFormats.includes(outputFormat) ? outputFormat : 'webp';
  }

  /**
   * Auto mode: best WebP quality that fits under target byte size (with optional downscale passes).
   * @param {Buffer} input
   * @param {Object} settings
   */
  async processToTargetSize(input, settings = {}) {
    try {
      const processedSettings = this.validateSettings(settings);
      const targetSize = processedSettings.targetFileSize || 150 * 1024;
      const overshoot = 1.03;

      let buffer;
      let originalSize;
      let metaUpload;

      if (Buffer.isBuffer(input)) {
        buffer = input;
        originalSize = input.length;
        metaUpload = await this._createSharp(input).metadata();
      } else {
        const stat = await fs.stat(input);
        originalSize = stat.size;
        metaUpload = await this._createSharp(input).metadata();
      }

      if (processedSettings.optimization.autoOrient) {
        buffer = await this._createSharp(input).rotate().toBuffer();
      } else if (!Buffer.isBuffer(input)) {
        buffer = await fs.readFile(input);
      }

      let meta = await this._createSharp(buffer).metadata();

      const maxInitialEdge = 3200;
      if (
        meta.width &&
        meta.height &&
        (meta.width > maxInitialEdge || meta.height > maxInitialEdge)
      ) {
        buffer = await this._createSharp(buffer)
          .resize(maxInitialEdge, maxInitialEdge, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        meta = await this._createSharp(buffer).metadata();
      }

      const encodeWebp = (buf, quality) => {
        let p = this._createSharp(buf).webp({ quality, effort: 6, smartSubsample: true });
        if (processedSettings.optimization.removeMetadata === false) {
          p = p.withMetadata();
        }
        return p.toBuffer();
      };

      const bestQualityUnderTarget = async (buf) => {
        const atLow = await encodeWebp(buf, 18);
        if (atLow.length <= targetSize * overshoot) {
          let lo = 18;
          let hi = 100;
          let ans = 18;
          let ansBuf = atLow;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const trial = await encodeWebp(buf, mid);
            if (trial.length <= targetSize * overshoot) {
              ans = mid;
              ansBuf = trial;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
          return { buf: ansBuf, quality: ans };
        }
        return { buf: atLow, quality: 18 };
      };

      let { buf: outputBuffer } = await bestQualityUnderTarget(buffer);
      let guard = 0;
      const minEdge = 160;

      while (outputBuffer.length > targetSize * overshoot && guard < 14) {
        guard += 1;
        const m = await this._createSharp(buffer).metadata();
        const w = m.width || 800;
        const h = m.height || 800;
        const scale = Math.sqrt((targetSize * 0.92) / outputBuffer.length);
        const newW = Math.max(minEdge, Math.floor(w * scale));
        const newH = Math.max(minEdge, Math.floor(h * scale));
        buffer = await this._createSharp(buffer)
          .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        ({ buf: outputBuffer } = await bestQualityUnderTarget(buffer));
      }

      const finalMeta = await this._createSharp(outputBuffer).metadata();
      const name = `processed_${Date.now()}.webp`;

      processedSettings.format.outputFormat = 'webp';

      return {
        success: true,
        output_filename: name,
        processed_buffer: outputBuffer,
        original: {
          file_size: originalSize,
          format: metaUpload.format,
          size: [metaUpload.width, metaUpload.height],
        },
        processed: {
          file_size: outputBuffer.length,
          format: 'webp',
          size: [finalMeta.width, finalMeta.height],
        },
        compression_ratio: Math.round((1 - outputBuffer.length / originalSize) * 100),
        settings_used: processedSettings,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  _createSharp(input) {
    return sharp(input, {
      sequentialRead: true,
      limitInputPixels: Number.isFinite(MAX_INPUT_PIXELS) ? MAX_INPUT_PIXELS : undefined,
    });
  }
}

module.exports = ImageProcessingWrapper;
