import React, { useState, useRef, useEffect, useId } from 'react';
import { PhotoIcon, CogIcon, XMarkIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import './ImageUploadManager.css';

const ImageUploadManager = ({
  onFilesSelected,
  onUrlSubmit,
  multiple = true,
  maxFiles = 10,
  maxSize = Infinity, // No file size limit
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  showAdvancedSettings = true,
  defaultSettings = {}
}) => {
  /** One visible panel at a time so settings does not push file/URL UI out of the scroll area. */
  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'url' | 'settings'
  const processingModeRadioName = `${useId()}-processing-mode`;
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

  const onFilesSelectedRef = useRef(onFilesSelected);
  onFilesSelectedRef.current = onFilesSelected;

  useEffect(() => {
    if (!onFilesSelectedRef.current) return;
    onFilesSelectedRef.current(selectedFiles, settings);
  }, [settings, selectedFiles]);

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
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSetting = (path, value) => {
    setSettings((prev) => {
      const keys = path.split('.');
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        cur[k] = { ...cur[k] };
        cur = cur[k];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const maxSizeLabel =
    Number.isFinite(maxSize) && maxSize < Number.MAX_SAFE_INTEGER
      ? `${(maxSize / (1024 * 1024)).toFixed(1)}MB each`
      : 'no per-file limit';

  return (
    <div className="image-upload-manager">
      <div
        className="upload-tabs"
        role="tablist"
        aria-label="Image upload and processing"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'file'}
          id="upload-tab-file"
          className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          <PhotoIcon className="w-4 h-4 shrink-0" aria-hidden />
          <span>Files</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'url'}
          id="upload-tab-url"
          className={`tab-btn ${activeTab === 'url' ? 'active' : ''}`}
          onClick={() => setActiveTab('url')}
        >
          <PhotoIcon className="w-4 h-4 shrink-0" aria-hidden />
          <span>URL</span>
        </button>
        {showAdvancedSettings && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            id="upload-tab-settings"
            className={`tab-btn tab-btn-settings ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            title="Image processing settings"
          >
            <CogIcon className="w-4 h-4 shrink-0" aria-hidden />
            <span className="tab-btn-settings-label">Settings</span>
          </button>
        )}
      </div>

      {/* Advanced Settings Panel (tab content) */}
      {activeTab === 'settings' && showAdvancedSettings && (
        <div
          className="settings-panel"
          role="tabpanel"
          aria-labelledby="upload-tab-settings"
          id="upload-panel-settings"
        >
          <div className="settings-header">
            <h4>Image Processing Settings</h4>
            <p className="settings-header-caption">Choose automatic optimization or manually tune compression, output format, and metadata behavior.</p>
          </div>

          <div className="settings-content">
            {/* Mode Selection */}
            <div className="setting-group">
              <h5>Processing mode</h5>
              <div className="mode-selector">
                <label className="mode-option">
                  <input
                    type="radio"
                    name={processingModeRadioName}
                    value="auto"
                    checked={settings.mode === 'auto'}
                    onChange={(e) => updateSetting('mode', e.target.value)}
                  />
                  <div className="mode-info">
                    <strong>Auto</strong>
                    <p>Targets a set file size with WebP and adaptive quality.</p>
                  </div>
                </label>
                
                <label className="mode-option">
                  <input
                    type="radio"
                    name={processingModeRadioName}
                    value="manual"
                    checked={settings.mode === 'manual'}
                    onChange={(e) => updateSetting('mode', e.target.value)}
                  />
                  <div className="mode-info">
                    <strong>Manual</strong>
                    <p>Choose compression, format, and optimization yourself.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Auto Mode Settings */}
            {settings.mode === 'auto' && (
              <div className="setting-group">
                <h5>Target file size</h5>
                <div className="setting-item">
                  <label className="setting-value-row">
                    <span className="setting-value-label">Output budget</span>
                    <span className="setting-value-pill tabular-nums">{Math.round(settings.targetFileSize / 1024)} KB</span>
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
                    <span>50 KB<span className="slider-label-hint">Smaller files</span></span>
                    <span>500 KB<span className="slider-label-hint">Higher detail</span></span>
                  </div>
                </div>
                <div className="auto-mode-info">
                  <h6 className="auto-mode-info-title">Included in auto</h6>
                  <ul className="auto-mode-info-list">
                    {['WebP output', 'Adaptive quality', 'Metadata stripped', 'EXIF orientation'].map((label) => (
                      <li key={label} className="auto-mode-info-item">
                        <CheckIcon className="auto-mode-info-check" aria-hidden />
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Manual Mode Settings */}
            {settings.mode === 'manual' && (
              <>
                {/* Compression Settings */}
                <div className="setting-group">
                  <h5>Compression</h5>
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={settings.compression.enabled}
                      onChange={(e) => updateSetting('compression.enabled', e.target.checked)}
                    />
                    <div>
                      <strong>Enable compression</strong>
                      <p className="setting-label-hint">Resize and re-encode to reduce file size.</p>
                    </div>
                  </label>
                  
                  {settings.compression.enabled && (
                    <div className="setting-subgroup">
                      <div className="setting-item">
                        <label className="setting-value-row">
                          <span className="setting-value-label">Quality</span>
                          <span className="setting-value-pill tabular-nums">{settings.compression.quality}%</span>
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
                          <span>10%<span className="slider-label-hint">Smaller</span></span>
                          <span>100%<span className="slider-label-hint">Sharper</span></span>
                        </div>
                      </div>
                      
                      <div className="setting-row">
                        <div className="setting-item">
                          <label>Max width (px)</label>
                          <input
                            type="number"
                            value={settings.compression.maxWidth}
                            onChange={(e) => updateSetting('compression.maxWidth', parseInt(e.target.value) || null)}
                            placeholder="1920"
                            className="dimension-input"
                          />
                        </div>
                        <div className="setting-item">
                          <label>Max height (px)</label>
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
                  <h5>Output</h5>
                  <div className="setting-item">
                    <label>Format</label>
                    <select
                      value={settings.format.outputFormat}
                      onChange={(e) => updateSetting('format.outputFormat', e.target.value)}
                      className="format-select"
                    >
                      <option value="original">Original</option>
                      <option value="webp">WebP</option>
                      <option value="jpeg">JPEG</option>
                      <option value="png">PNG</option>
                    </select>
                  </div>
                </div>

                {/* Optimization Settings */}
                <div className="setting-group">
                  <h5>Optimization rules</h5>
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={settings.optimization.removeMetadata}
                      onChange={(e) => updateSetting('optimization.removeMetadata', e.target.checked)}
                    />
                    <div>
                      <strong>Remove metadata</strong>
                      <p className="setting-label-hint">Strip EXIF for smaller files and privacy.</p>
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
                      <p className="setting-label-hint">Decode in passes when output is JPEG.</p>
                    </div>
                  </label>
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={settings.optimization.autoOrient}
                      onChange={(e) => updateSetting('optimization.autoOrient', e.target.checked)}
                    />
                    <div>
                      <strong>Auto-orient</strong>
                      <p className="setting-label-hint">Correct rotation from camera EXIF.</p>
                    </div>
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Display (file validation) */}
      {activeTab === 'file' && errors.length > 0 && (
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
      {activeTab === 'file' && (
        <div
          className="file-upload-section"
          role="tabpanel"
          aria-labelledby="upload-tab-file"
          id="upload-panel-file"
        >
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
                  {' '}(Max {maxSizeLabel})
                  {multiple && ` • Up to ${maxFiles} files`}
                </p>
              </div>
            </div>
          </div>

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <h4 className="selected-files-title">Selected ({selectedFiles.length})</h4>
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
      {activeTab === 'url' && (
        <div
          className="url-upload-section"
          role="tabpanel"
          aria-labelledby="upload-tab-url"
          id="upload-panel-url"
        >
          <form onSubmit={handleUrlSubmit} className="url-form">
            <div className="form-group">
              <label htmlFor="imageUrl">Image URL</label>
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
              <CheckIcon className="add-url-btn-icon" aria-hidden />
              Add from URL
            </button>
          </form>
        </div>
      )}

      {/* Settings Summary */}
      {activeTab !== 'settings' && showAdvancedSettings && (
        <div className="settings-summary">
          <span className="settings-summary-label">Active pipeline</span>
          <span
            className={
              settings.mode === 'auto'
                ? 'settings-summary-value settings-summary-value--auto'
                : 'settings-summary-value settings-summary-value--manual'
            }
          >
            {settings.mode === 'auto'
              ? `Auto · ${Math.round(settings.targetFileSize / 1024)} KB · WebP`
              : `Manual · ${settings.compression.enabled ? `${settings.compression.quality}%` : 'Off'} · ${settings.format.outputFormat}`}
          </span>
        </div>
      )}
    </div>
  );
};

export default ImageUploadManager;
