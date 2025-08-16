const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class ImageProcessingWrapper {
  constructor() {
    // No need for directories since we process in memory
  }

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
      // Merge with default settings
      const processedSettings = this.validateSettings(settings);
      
      let inputBuffer;
      let originalSize;
      
      // Handle input
      if (Buffer.isBuffer(input)) {
        inputBuffer = input;
        originalSize = input.length;
      } else {
        inputBuffer = await fs.readFile(input);
        originalSize = inputBuffer.length;
        // If input was a file path, remember to clean it up if it's a temp file
        if (input.includes('temp_')) {
          tempFilePath = input;
        }
      }

      // Get original image metadata
      const metadata = await sharp(inputBuffer).metadata();
      
      // Start processing pipeline
      let pipeline = sharp(inputBuffer);
      
      // Auto-orient if enabled
      if (processedSettings.optimization.autoOrient) {
        pipeline = pipeline.rotate();
      }
      
      // Resize if enabled
      if (processedSettings.resize.enabled) {
        const { width, height, maintainAspectRatio } = processedSettings.resize;
        if (width || height) {
          pipeline = pipeline.resize(width, height, {
            fit: maintainAspectRatio ? 'inside' : 'fill',
            withoutEnlargement: true
          });
        }
      }
      
      // Compress if enabled (resize based on max dimensions)
      if (processedSettings.compression.enabled) {
        const { maxWidth, maxHeight } = processedSettings.compression;
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
          pipeline = pipeline.resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      }
      
      // Determine output format and apply format-specific options
      const outputFormat = this.determineOutputFormat(metadata.format, processedSettings.format);
      
      if (outputFormat === 'webp') {
        pipeline = pipeline.webp({
          quality: processedSettings.compression.quality,
          progressive: processedSettings.optimization.progressive
        });
      } else if (outputFormat === 'jpeg') {
        pipeline = pipeline.jpeg({
          quality: processedSettings.compression.quality,
          progressive: processedSettings.optimization.progressive
        });
      } else if (outputFormat === 'png') {
        pipeline = pipeline.png({
          progressive: processedSettings.optimization.progressive
        });
      }
      
      // Process the image
      const processedBuffer = await pipeline.toBuffer();
      
      // Get final metadata
      const finalMetadata = await sharp(processedBuffer).metadata();
      
      // Generate filename for reference (but don't save to disk)
      if (!outputFilename) {
        const timestamp = Date.now();
        const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
        outputFilename = `processed_${timestamp}.${extension}`;
      }
      
      // Clean up temp file immediately after processing
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
          format: metadata.format,
          size: [metadata.width, metadata.height],
          file_size: originalSize
        },
        processed: {
          format: finalMetadata.format,
          size: [finalMetadata.width, finalMetadata.height],
          file_size: processedBuffer.length
        },
        settings_used: processedSettings,
        compression_ratio: Math.round((1 - processedBuffer.length / originalSize) * 100)
      };
      
    } catch (error) {
      console.error('Image processing error:', error);
      
      // Clean up temp file even on error
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
        error_type: error.constructor.name
      };
    }
  }

  /**
   * Process multiple images
   * @param {Array} inputs - Array of input files/buffers
   * @param {Object} settings - Processing settings
   * @returns {Promise<Array>} Array of processing results
   */
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
          input: typeof input === 'string' ? input : 'buffer'
        });
      }
    }
    
    return results;
  }

  /**
   * Get default settings
   * @returns {Object} Default processing settings
   */
  getDefaultSettings() {
    return {
      compression: {
        enabled: true,
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1080
      },
      format: {
        outputFormat: 'webp',
        convertToWebp: true
      },
      optimization: {
        removeMetadata: true,
        progressive: true,
        autoOrient: true
      },
      resize: {
        enabled: false,
        width: null,
        height: null,
        maintainAspectRatio: true
      }
    };
  }

  /**
   * Validate processing settings
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validated and sanitized settings
   */
  validateSettings(settings) {
    const defaults = this.getDefaultSettings();
    const validated = { ...defaults };

    if (settings.compression) {
      if (typeof settings.compression.enabled === 'boolean') {
        validated.compression.enabled = settings.compression.enabled;
      }
      if (typeof settings.compression.quality === 'number' && 
          settings.compression.quality >= 1 && settings.compression.quality <= 100) {
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


  /**
   * Determine output format based on settings
   * @param {string} originalFormat - Original image format
   * @param {Object} formatSettings - Format settings
   * @returns {string} Output format
   */
  determineOutputFormat(originalFormat, formatSettings) {
    const outputFormat = formatSettings.outputFormat?.toLowerCase() || 'webp';
    
    if (outputFormat === 'original') {
      return originalFormat?.toLowerCase() || 'jpeg';
    }
    
    const supportedFormats = ['webp', 'jpeg', 'jpg', 'png', 'gif'];
    return supportedFormats.includes(outputFormat) ? outputFormat : 'webp';
  }

  /**
   * Process image to target file size
   * @param {Buffer} input - Input image buffer
   * @param {Object} settings - Processing settings with targetFileSize
   * @returns {Promise<Object>} Processing result
   */
  async processToTargetSize(input, settings = {}) {
    try {
      const targetSize = settings.targetFileSize || 150 * 1024; // 150KB default
      const processedSettings = this.validateSettings(settings);
      
      // Always use WebP for size optimization
      processedSettings.format.outputFormat = 'webp';
      
      let metadata = await sharp(input).metadata();
      let pipeline = sharp(input);
      
      // Auto-orient
      pipeline = pipeline.rotate();
      
      // Start with reasonable dimensions if too large
      if (metadata.width > 2048 || metadata.height > 2048) {
        pipeline = pipeline.resize(2048, 2048, { fit: 'inside', withoutEnlargement: true });
      }
      
      let quality = 95;
      let outputBuffer;
      
      // Iteratively reduce quality to reach target size
      for (let attempt = 0; attempt < 10; attempt++) {
        outputBuffer = await pipeline.webp({ quality }).toBuffer();
        
        if (outputBuffer.length <= targetSize) {
          break;
        }
        
        if (outputBuffer.length > targetSize * 1.5 && quality > 30) {
          quality = Math.max(30, quality - 15);
        } else if (outputBuffer.length > targetSize && quality > 20) {
          quality = Math.max(20, quality - 5);
        } else {
          // Try reducing dimensions
          const currentMeta = await sharp(outputBuffer).metadata();
          const scaleFactor = Math.sqrt(targetSize / outputBuffer.length);
          const newWidth = Math.max(300, Math.round(currentMeta.width * scaleFactor));
          const newHeight = Math.max(200, Math.round(currentMeta.height * scaleFactor));
          
          pipeline = sharp(input).rotate().resize(newWidth, newHeight, { fit: 'inside' });
          quality = Math.min(85, quality + 10);
        }
      }
      
      return {
        success: true,
        processed_buffer: outputBuffer,
        original: {
          file_size: input.length,
          format: metadata.format,
          size: [metadata.width, metadata.height]
        },
        processed: {
          file_size: outputBuffer.length,
          format: 'webp',
          size: await sharp(outputBuffer).metadata().then(m => [m.width, m.height])
        },
        compression_ratio: Math.round((1 - outputBuffer.length / input.length) * 100),
        settings_used: processedSettings
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ImageProcessingWrapper;