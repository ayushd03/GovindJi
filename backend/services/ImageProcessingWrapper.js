const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class ImageProcessingWrapper {
  constructor() {
    this.pythonScript = path.join(__dirname, 'ImageProcessingService.py');
    this.processedDir = path.join(__dirname, '..', 'uploads', 'processed');
    this.tempDir = path.join(__dirname, '..', 'uploads', 'temp');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.processedDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  /**
   * Process an image with the Python service
   * @param {string|Buffer} input - Input file path or buffer
   * @param {Object} settings - Processing settings
   * @param {string} outputFilename - Optional output filename
   * @returns {Promise<Object>} Processing result
   */
  async processImage(input, settings = {}, outputFilename = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure directories exist first
        await this.ensureDirectories();
        
        let inputPath;
        let tempFile = false;

        // Handle buffer input
        if (Buffer.isBuffer(input)) {
          const tempFilename = `temp_${uuidv4()}.tmp`;
          inputPath = path.join(this.tempDir, tempFilename);
          await fs.writeFile(inputPath, input);
          tempFile = true;
        } else {
          inputPath = input;
        }

        // Prepare arguments
        const args = [
          this.pythonScript,
          inputPath,
          '--settings', JSON.stringify(settings),
          '--output-dir', this.processedDir
        ];

        if (outputFilename) {
          args.push('--output-filename', outputFilename);
        }

        // Check if Python script exists
        try {
          await fs.access(this.pythonScript);
        } catch (scriptError) {
          throw new Error(`Python script not found: ${this.pythonScript}`);
        }

        // Spawn Python process
        const pythonProcess = spawn('python', args);
        
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          try {
            // Clean up temp file if created
            if (tempFile) {
              await fs.unlink(inputPath).catch(() => {});
            }

            if (code !== 0) {
              console.error('Python process stderr:', stderr);
              return reject(new Error(`Python process exited with code ${code}: ${stderr}`));
            }

            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              console.error('Error parsing Python output:', stdout);
              reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
          } catch (error) {
            reject(error);
          }
        });

        pythonProcess.on('error', (error) => {
          reject(new Error(`Failed to start Python process: ${error.message}`));
        });

      } catch (error) {
        reject(error);
      }
    });
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
   * Clean up old processed files
   * @param {number} maxAgeMs - Maximum age in milliseconds
   */
  async cleanupOldFiles(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
    try {
      const files = await fs.readdir(this.processedDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.processedDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old processed file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }

  /**
   * Simple fallback image processing using sharp (if available) or basic buffer manipulation
   * @param {Buffer} input - Input image buffer
   * @param {Object} settings - Processing settings
   * @returns {Promise<Object>} Processing result
   */
  async simpleFallbackResize(input, settings = {}) {
    try {
      // Try to use sharp if available
      let sharp;
      try {
        sharp = require('sharp');
      } catch (sharpError) {
        // Sharp not available, return original with warning
        return {
          success: false,
          error: 'No image processing libraries available (Python/sharp)',
          fallback: true
        };
      }

      const targetSize = settings.targetFileSize || 150 * 1024; // 150KB default
      
      // Use sharp for basic compression
      let processed = sharp(input);
      
      // Auto-orient
      processed = processed.rotate();
      
      // Resize if too large (basic heuristic)
      const metadata = await processed.metadata();
      if (metadata.width > 1920 || metadata.height > 1080) {
        processed = processed.resize(1920, 1080, { 
          fit: 'inside', 
          withoutEnlargement: true 
        });
      }
      
      // Convert to WebP with quality adjustment
      let quality = 85;
      let outputBuffer;
      
      // Try different quality levels to reach target size
      for (let attempt = 0; attempt < 5; attempt++) {
        outputBuffer = await processed.webp({ quality }).toBuffer();
        
        if (outputBuffer.length <= targetSize || quality <= 30) {
          break;
        }
        
        quality -= 15;
      }
      
      return {
        success: true,
        processed_buffer: outputBuffer,
        original: {
          file_size: input.length,
          format: metadata.format
        },
        processed: {
          file_size: outputBuffer.length,
          format: 'webp'
        },
        compression_ratio: Math.round((1 - outputBuffer.length / input.length) * 100),
        fallback: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Check if Python and required libraries are available
   * @returns {Promise<boolean>} True if available
   */
  async checkPythonAvailability() {
    return new Promise((resolve) => {
      const pythonProcess = spawn('python', ['-c', 'import PIL, pillow_heif; print("OK")']);
      
      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.on('close', (code) => {
        resolve(code === 0 && output.trim() === 'OK');
      });

      pythonProcess.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = ImageProcessingWrapper;