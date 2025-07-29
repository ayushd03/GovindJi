import React, { useState, useRef } from 'react';
import { PhotoIcon, CogIcon, XMarkIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import './ImageUploadManager.css';

const ImageUploadManager = ({
  onFilesSelected,
  onUrlSubmit,
  multiple = true,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB - increased limit
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  showAdvancedSettings = true,
  defaultSettings = {}
}) => {
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [showSettings, setShowSettings] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  const fileInputRef = useRef(null);
  
  // Default advanced settings
  const [settings, setSettings] = useState({
    mode: 'auto', // 'auto' or 'manual'
    targetFileSize: 150 * 1024, // 150KB for auto mode
    compression: {
      enabled: true,
      quality: 85,
      maxWidth: 1920,
      maxHeight: 1080
    },
    format: {
      outputFormat: 'webp', // webp, jpeg, png, original
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
    },
    ...defaultSettings
  });

  const [urlForm, setUrlForm] = useState({
    url: '',
    altText: '',
    isPrimary: false
  });

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles([...e.dataTransfer.files]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles([...e.target.files]);
    }
  };

  const validateFile = (file) => {
    const errors = [];
    
    if (!allowedTypes.includes(file.type)) {
      errors.push(`${file.name}: Unsupported file type. Allowed: ${allowedTypes.join(', ')}`);
    }
    
    if (file.size > maxSize) {
      errors.push(`${file.name}: File too large. Max size: ${(maxSize / (1024 * 1024)).toFixed(1)}MB`);
    }
    
    return errors;
  };

  const handleFiles = (files) => {
    setErrors([]);
    let validFiles = [];
    let fileErrors = [];

    // Limit number of files
    const filesToProcess = multiple ? files.slice(0, maxFiles) : [files[0]];

    filesToProcess.forEach(file => {
      const validationErrors = validateFile(file);
      if (validationErrors.length === 0) {
        validFiles.push(file);
      } else {
        fileErrors = [...fileErrors, ...validationErrors];
      }
    });

    if (fileErrors.length > 0) {
      setErrors(fileErrors);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      // Pass files and settings to parent
      onFilesSelected && onFilesSelected(validFiles, settings);
    }
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (urlForm.url.trim()) {
      onUrlSubmit && onUrlSubmit({
        url: urlForm.url.trim(),
        altText: urlForm.altText.trim(),
        isPrimary: urlForm.isPrimary,
        settings: settings
      });
      setUrlForm({ url: '', altText: '', isPrimary: false });
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  const updateSetting = (path, value) => {
    setSettings(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return updated;
    });
  };

  return (
    <div className="image-upload-manager">
      {/* Upload Mode Toggle */}
      <div className="upload-mode-toggle">
        <button
          type="button"
          className={`mode-btn ${uploadMode === 'file' ? 'active' : ''}`}
          onClick={() => setUploadMode('file')}
        >
          <PhotoIcon className="w-4 h-4 mr-2" />
          Upload Files
        </button>
        <button
          type="button"
          className={`mode-btn ${uploadMode === 'url' ? 'active' : ''}`}
          onClick={() => setUploadMode('url')}
        >
          <PhotoIcon className="w-4 h-4 mr-2" />
          From URL
        </button>
        {showAdvancedSettings && (
          <button
            type="button"
            className={`settings-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Advanced Settings"
          >
            <CogIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Advanced Settings Panel */}
      {showSettings && showAdvancedSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h4>Image Processing Settings</h4>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="close-settings"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="settings-content">
            {/* Mode Selection */}
            <div className="setting-group">
              <h5>🎯 Processing Mode</h5>
              <div className="mode-selector">
                <label className="mode-option">
                  <input
                    type="radio"
                    name="processing-mode"
                    value="auto"
                    checked={settings.mode === 'auto'}
                    onChange={(e) => updateSetting('mode', e.target.value)}
                  />
                  <div className="mode-info">
                    <strong>🚀 Auto Mode</strong>
                    <p>Automatically optimizes images to your target size using WebP format with smart quality adjustment</p>
                  </div>
                </label>
                
                <label className="mode-option">
                  <input
                    type="radio"
                    name="processing-mode"
                    value="manual"
                    checked={settings.mode === 'manual'}
                    onChange={(e) => updateSetting('mode', e.target.value)}
                  />
                  <div className="mode-info">
                    <strong>🛠️ Manual Mode</strong>
                    <p>Full control over compression, format, dimensions, and optimization settings</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Auto Mode Settings */}
            {settings.mode === 'auto' && (
              <div className="setting-group">
                <h5>🎚️ Auto Mode Configuration</h5>
                <div className="setting-item">
                  <label className="flex items-center justify-between">
                    <span>Target File Size</span>
                    <span className="text-lg font-semibold text-blue-600">{Math.round(settings.targetFileSize / 1024)}KB</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="25"
                    value={settings.targetFileSize / 1024}
                    onChange={(e) => updateSetting('targetFileSize', parseInt(e.target.value) * 1024)}
                    className="quality-slider"
                  />
                  <div className="slider-labels">
                    <span>📱 50KB<br/><small>Mobile-friendly</small></span>
                    <span>💻 500KB<br/><small>High quality</small></span>
                  </div>
                </div>
                <div className="auto-mode-info">
                  <h6 className="font-semibold text-gray-800 mb-2 flex items-center">
                    ✨ Auto-Applied Optimizations
                  </h6>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-green-500">✓</span>
                      <span>WebP format</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-500">✓</span>
                      <span>Smart quality</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-500">✓</span>
                      <span>Metadata removed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-500">✓</span>
                      <span>Auto-orientation</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Mode Settings */}
            {settings.mode === 'manual' && (
              <>
                {/* Compression Settings */}
                <div className="setting-group">
                  <h5>🗜️ Compression & Quality</h5>
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={settings.compression.enabled}
                      onChange={(e) => updateSetting('compression.enabled', e.target.checked)}
                    />
                    <div>
                      <strong>Enable Compression</strong>
                      <p className="text-xs text-gray-500 mt-1">Reduce file size while maintaining quality</p>
                    </div>
                  </label>
                  
                  {settings.compression.enabled && (
                    <div className="setting-subgroup">
                      <div className="setting-item">
                        <label className="flex items-center justify-between">
                          <span>Quality</span>
                          <span className="text-lg font-semibold text-blue-600">{settings.compression.quality}%</span>
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={settings.compression.quality}
                          onChange={(e) => updateSetting('compression.quality', parseInt(e.target.value))}
                          className="quality-slider"
                        />
                        <div className="slider-labels">
                          <span>🗜️ 10%<br/><small>Smallest</small></span>
                          <span>🌟 100%<br/><small>Best quality</small></span>
                        </div>
                      </div>
                      
                      <div className="setting-row">
                        <div className="setting-item">
                          <label>Max Width (px)</label>
                          <input
                            type="number"
                            value={settings.compression.maxWidth}
                            onChange={(e) => updateSetting('compression.maxWidth', parseInt(e.target.value) || null)}
                            placeholder="1920"
                            className="dimension-input"
                          />
                        </div>
                        <div className="setting-item">
                          <label>Max Height (px)</label>
                          <input
                            type="number"
                            value={settings.compression.maxHeight}
                            onChange={(e) => updateSetting('compression.maxHeight', parseInt(e.target.value) || null)}
                            placeholder="1080"
                            className="dimension-input"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Format Settings */}
                <div className="setting-group">
                  <h5>📄 Output Format</h5>
                  <div className="setting-item">
                    <label>Choose output format</label>
                    <select
                      value={settings.format.outputFormat}
                      onChange={(e) => updateSetting('format.outputFormat', e.target.value)}
                      className="format-select"
                    >
                      <option value="original">📁 Keep Original Format</option>
                      <option value="webp">🚀 WebP (Best compression)</option>
                      <option value="jpeg">📷 JPEG (Universal)</option>
                      <option value="png">🖼️ PNG (Transparency)</option>
                    </select>
                  </div>
                </div>

                {/* Optimization Settings */}
                <div className="setting-group">
                  <h5>⚡ Advanced Optimizations</h5>
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={settings.optimization.removeMetadata}
                      onChange={(e) => updateSetting('optimization.removeMetadata', e.target.checked)}
                    />
                    <div>
                      <strong>Remove Metadata</strong>
                      <p className="text-xs text-gray-500 mt-1">Strip EXIF data for smaller files</p>
                    </div>
                  </label>
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={settings.optimization.progressive}
                      onChange={(e) => updateSetting('optimization.progressive', e.target.checked)}
                    />
                    <div>
                      <strong>Progressive JPEG</strong>
                      <p className="text-xs text-gray-500 mt-1">Loads progressively for better UX</p>
                    </div>
                  </label>
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={settings.optimization.autoOrient}
                      onChange={(e) => updateSetting('optimization.autoOrient', e.target.checked)}
                    />
                    <div>
                      <strong>Auto-Orient Images</strong>
                      <p className="text-xs text-gray-500 mt-1">Fix rotation based on EXIF data</p>
                    </div>
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="error-list">
          {errors.map((error, index) => (
            <div key={index} className="error-item">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* File Upload Mode */}
      {uploadMode === 'file' && (
        <div className="file-upload-section">
          <div
            className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden-input"
              multiple={multiple}
              accept={allowedTypes.join(',')}
              onChange={handleChange}
            />
            
            <div className="upload-content">
              <PhotoIcon className="upload-icon" />
              <div className="upload-text">
                <p className="primary-text">
                  {dragActive ? 'Drop files here' : 'Choose files or drag here'}
                </p>
                <p className="secondary-text">
                  Supports: {allowedTypes.map(type => type.split('/')[1].toUpperCase()).join(', ')} 
                  {' '}(Max {(maxSize / (1024 * 1024)).toFixed(1)}MB each)
                  {multiple && ` • Up to ${maxFiles} files`}
                </p>
              </div>
            </div>
          </div>

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <h4>Selected Files ({selectedFiles.length})</h4>
              <div className="files-list">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="remove-file"
                      title="Remove file"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL Upload Mode */}
      {uploadMode === 'url' && (
        <div className="url-upload-section">
          <form onSubmit={handleUrlSubmit} className="url-form">
            <div className="form-group">
              <label htmlFor="imageUrl">Image URL *</label>
              <input
                id="imageUrl"
                type="url"
                value={urlForm.url}
                onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="url-input"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="altText">Alt Text</label>
              <input
                id="altText"
                type="text"
                value={urlForm.altText}
                onChange={(e) => setUrlForm({ ...urlForm, altText: e.target.value })}
                placeholder="Describe the image"
                className="alt-input"
              />
            </div>
            
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={urlForm.isPrimary}
                  onChange={(e) => setUrlForm({ ...urlForm, isPrimary: e.target.checked })}
                />
                Set as primary image
              </label>
            </div>
            
            <button type="submit" className="add-url-btn">
              <CheckIcon className="w-4 h-4 mr-2" />
              Add Image from URL
            </button>
          </form>
        </div>
      )}

      {/* Settings Summary */}
      {!showSettings && showAdvancedSettings && (
        <div className="settings-summary">
          <small className="text-gray-600">
            Current Mode: <strong className={settings.mode === 'auto' ? 'text-green-600' : 'text-blue-600'}>
              {settings.mode === 'auto' ? `Auto (${Math.round(settings.targetFileSize / 1024)}KB target, WebP)` : 
               `Manual (${settings.compression.enabled ? `${settings.compression.quality}% quality` : 'No compression'}, ${settings.format.outputFormat})`}
            </strong>
          </small>
        </div>
      )}
    </div>
  );
};

export default ImageUploadManager;