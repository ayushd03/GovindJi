#!/usr/bin/env python3
"""
Image Processing Service for GovindJi Dry Fruits
Handles image compression, format conversion, and optimization
"""

import os
import io
import sys
import json
import uuid
import time
import logging
from typing import Dict, Optional, Tuple, Union
from pathlib import Path

try:
    from PIL import Image, ImageOps, ExifTags
    import pillow_heif  # For HEIF/HEIC support
except ImportError as e:
    print(f"Error importing required libraries: {e}")
    print("Please install required packages: pip install Pillow pillow-heif")
    sys.exit(1)

# Register HEIF opener with Pillow
pillow_heif.register_heif_opener()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ImageProcessingService:
    """Service for processing and optimizing images"""
    
    # Supported input formats
    SUPPORTED_INPUT_FORMATS = {
        'JPEG', 'JPG', 'PNG', 'GIF', 'WEBP', 'BMP', 'TIFF', 'HEIC', 'HEIF'
    }
    
    # Output format mapping
    OUTPUT_FORMATS = {
        'jpeg': 'JPEG',
        'jpg': 'JPEG', 
        'png': 'PNG',
        'webp': 'WEBP',
        'gif': 'GIF',
        'original': None  # Keep original format
    }
    
    # Default settings
    DEFAULT_SETTINGS = {
        'mode': 'auto',  # 'auto' or 'manual'
        'targetFileSize': 150 * 1024,  # 150KB for auto mode
        'compression': {
            'enabled': True,
            'quality': 85,
            'maxWidth': 1920,
            'maxHeight': 1080
        },
        'format': {
            'outputFormat': 'webp',
            'convertToWebp': True
        },
        'optimization': {
            'removeMetadata': True,
            'progressive': True,
            'autoOrient': True
        },
        'resize': {
            'enabled': False,
            'width': None,
            'height': None,
            'maintainAspectRatio': True
        }
    }

    def __init__(self, output_dir: str = './processed_images'):
        """Initialize the image processing service"""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
    def process_image(
        self, 
        input_path: Union[str, Path, io.BytesIO], 
        settings: Optional[Dict] = None,
        output_filename: Optional[str] = None
    ) -> Dict:
        """
        Process an image according to the provided settings
        
        Args:
            input_path: Path to input image file or BytesIO object
            settings: Processing settings dict
            output_filename: Custom output filename (optional)
            
        Returns:
            Dict containing processing results and metadata
        """
        try:
            # Merge with default settings
            processing_settings = {**self.DEFAULT_SETTINGS}
            if settings:
                processing_settings = self._deep_merge(processing_settings, settings)
            
            # Load image
            if isinstance(input_path, io.BytesIO):
                image = Image.open(input_path)
                original_filename = f"image_{uuid.uuid4().hex}"
            else:
                input_path = Path(input_path)
                image = Image.open(input_path)
                original_filename = input_path.stem
                
            original_format = image.format
            original_size = image.size
            original_file_size = self._get_image_size(image)
            
            logger.info(f"Processing image: {original_filename}, Format: {original_format}, Size: {original_size}")
            
            # Handle Auto Mode vs Manual Mode
            if processing_settings.get('mode') == 'auto':
                # Auto mode: optimize for target file size
                image, processing_settings = self._process_auto_mode(image, processing_settings)
            else:
                # Manual mode: use user-defined settings
                # Auto-orient based on EXIF data
                if processing_settings['optimization']['autoOrient']:
                    image = self._auto_orient(image)
                
                # Resize if needed
                if processing_settings['resize']['enabled']:
                    image = self._resize_image(image, processing_settings['resize'])
                
                # Compress/resize based on max dimensions
                if processing_settings['compression']['enabled']:
                    image = self._compress_image(image, processing_settings['compression'])
            
            # Determine output format
            output_format = self._determine_output_format(
                original_format, 
                processing_settings['format']
            )
            
            # Generate output filename
            if not output_filename:
                timestamp = int(time.time() * 1000)
                extension = output_format.lower() if output_format != 'JPEG' else 'jpg'
                output_filename = f"{original_filename}_{timestamp}.{extension}"
            
            output_path = self.output_dir / output_filename
            
            # Save processed image
            save_kwargs = self._get_save_kwargs(output_format, processing_settings)
            
            # Remove metadata if requested
            if processing_settings['optimization']['removeMetadata']:
                # Create new image without EXIF data
                if image.mode in ('RGBA', 'LA'):
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    if image.mode == 'RGBA':
                        background.paste(image, mask=image.split()[-1])
                    else:
                        background.paste(image, mask=image.split()[-1])
                    image = background
                else:
                    # For non-transparent images, just copy the pixel data
                    new_image = Image.new(image.mode, image.size)
                    new_image.putdata(list(image.getdata()))
                    image = new_image
            
            # Save the processed image
            if output_format == 'GIF' and hasattr(image, 'is_animated') and image.is_animated:
                # Handle animated GIFs
                image.save(output_path, format=output_format, save_all=True, **save_kwargs)
            else:
                image.save(output_path, format=output_format, **save_kwargs)
            
            # Calculate final file size
            final_file_size = output_path.stat().st_size
            
            # Prepare result
            result = {
                'success': True,
                'output_path': str(output_path),
                'output_filename': output_filename,
                'original': {
                    'format': original_format,
                    'size': original_size,
                    'file_size': original_file_size
                },
                'processed': {
                    'format': output_format,
                    'size': image.size,
                    'file_size': final_file_size
                },
                'settings_used': processing_settings,
                'compression_ratio': round((1 - final_file_size / original_file_size) * 100, 2) if original_file_size > 0 else 0
            }
            
            logger.info(f"Image processed successfully: {output_filename}")
            logger.info(f"Size reduction: {result['compression_ratio']}%")
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
    
    def _deep_merge(self, base: Dict, override: Dict) -> Dict:
        """Deep merge two dictionaries"""
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result
    
    def _get_image_size(self, image: Image.Image) -> int:
        """Get image size in bytes"""
        img_bytes = io.BytesIO()
        image.save(img_bytes, format=image.format or 'JPEG')
        return len(img_bytes.getvalue())
    
    def _auto_orient(self, image: Image.Image) -> Image.Image:
        """Auto-orient image based on EXIF data"""
        try:
            return ImageOps.exif_transpose(image)
        except Exception as e:
            logger.warning(f"Could not auto-orient image: {e}")
            return image
    
    def _resize_image(self, image: Image.Image, resize_settings: Dict) -> Image.Image:
        """Resize image according to settings"""
        target_width = resize_settings.get('width')
        target_height = resize_settings.get('height')
        maintain_aspect = resize_settings.get('maintainAspectRatio', True)
        
        if not target_width and not target_height:
            return image
        
        current_width, current_height = image.size
        
        if maintain_aspect:
            # Calculate dimensions maintaining aspect ratio
            if target_width and target_height:
                # Fit within both dimensions
                ratio = min(target_width / current_width, target_height / current_height)
                new_width = int(current_width * ratio)
                new_height = int(current_height * ratio)
            elif target_width:
                # Scale by width
                ratio = target_width / current_width
                new_width = target_width
                new_height = int(current_height * ratio)
            else:
                # Scale by height
                ratio = target_height / current_height
                new_width = int(current_width * ratio)
                new_height = target_height
        else:
            # Exact dimensions (may distort)
            new_width = target_width or current_width
            new_height = target_height or current_height
        
        return image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    def _compress_image(self, image: Image.Image, compression_settings: Dict) -> Image.Image:
        """Compress image by resizing if it exceeds max dimensions"""
        max_width = compression_settings.get('maxWidth', 1920)
        max_height = compression_settings.get('maxHeight', 1080)
        
        current_width, current_height = image.size
        
        # Check if resizing is needed
        if current_width <= max_width and current_height <= max_height:
            return image
        
        # Calculate new dimensions maintaining aspect ratio
        ratio = min(max_width / current_width, max_height / current_height)
        new_width = int(current_width * ratio)
        new_height = int(current_height * ratio)
        
        logger.info(f"Resizing image from {current_width}x{current_height} to {new_width}x{new_height}")
        
        return image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    def _determine_output_format(self, original_format: str, format_settings: Dict) -> str:
        """Determine the output format based on settings"""
        output_format = format_settings.get('outputFormat', 'webp').lower()
        
        if output_format == 'original':
            return original_format or 'JPEG'
        
        return self.OUTPUT_FORMATS.get(output_format, 'WEBP')
    
    def _get_save_kwargs(self, output_format: str, settings: Dict) -> Dict:
        """Get save kwargs based on format and settings"""
        kwargs = {}
        
        if output_format in ('JPEG', 'WEBP'):
            kwargs['quality'] = settings['compression']['quality']
            kwargs['optimize'] = True
            
            if output_format == 'JPEG':
                kwargs['progressive'] = settings['optimization']['progressive']
        
        elif output_format == 'PNG':
            kwargs['optimize'] = True
        
        return kwargs

    def _process_auto_mode(self, image: Image.Image, settings: Dict) -> Tuple[Image.Image, Dict]:
        """
        Process image in auto mode to reach target file size
        """
        target_size = settings.get('targetFileSize', 150 * 1024)  # Default 150KB
        
        # Always use WebP for auto mode
        settings['format']['outputFormat'] = 'webp'
        
        # Always enable optimization in auto mode
        settings['optimization']['removeMetadata'] = True
        settings['optimization']['autoOrient'] = True
        settings['optimization']['progressive'] = True
        
        # Auto-orient first
        image = self._auto_orient(image)
        
        # Start with high quality and work down
        quality = 95
        max_iterations = 10
        
        # First, resize if image is very large
        width, height = image.size
        if width > 2048 or height > 2048:
            # Resize to reasonable dimensions first
            ratio = min(2048 / width, 2048 / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"Pre-resized image to {new_width}x{new_height} for auto-optimization")
        
        # Iteratively adjust quality to reach target size
        for iteration in range(max_iterations):
            # Test save with current settings
            test_buffer = io.BytesIO()
            save_kwargs = {
                'quality': quality,
                'optimize': True,
                'format': 'WEBP'
            }
            
            image.save(test_buffer, **save_kwargs)
            current_size = len(test_buffer.getvalue())
            
            logger.info(f"Auto-mode iteration {iteration + 1}: Quality {quality}%, Size {current_size} bytes (target: {target_size})")
            
            if current_size <= target_size:
                # We've reached our target
                break
            elif current_size > target_size * 1.5 and quality > 30:
                # Much too large, reduce quality more aggressively
                quality = max(30, quality - 15)
            elif current_size > target_size and quality > 20:
                # Still too large, reduce quality
                quality = max(20, quality - 5)
            else:
                # Can't reduce quality further, try resizing
                current_width, current_height = image.size
                scale_factor = (target_size / current_size) ** 0.5
                new_width = max(300, int(current_width * scale_factor))  # Minimum 300px width
                new_height = max(200, int(current_height * scale_factor))  # Minimum 200px height
                
                if new_width < current_width and new_height < current_height:
                    image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    logger.info(f"Auto-mode resized to {new_width}x{new_height}")
                    quality = min(85, quality + 10)  # Increase quality after resize
                else:
                    break  # Can't optimize further
        
        # Update settings with final values
        settings['compression']['quality'] = quality
        settings['compression']['enabled'] = True
        
        return image, settings


def process_image_from_cli():
    """CLI entry point for image processing"""
    import argparse
    import time
    
    parser = argparse.ArgumentParser(description='Process images with various optimizations')
    parser.add_argument('input_path', help='Path to input image')
    parser.add_argument('--settings', help='JSON settings string', default='{}')
    parser.add_argument('--output-dir', help='Output directory', default='./processed_images')
    parser.add_argument('--output-filename', help='Output filename')
    
    args = parser.parse_args()
    
    try:
        settings = json.loads(args.settings) if args.settings != '{}' else {}
    except json.JSONDecodeError:
        print("Error: Invalid JSON settings")
        sys.exit(1)
    
    processor = ImageProcessingService(args.output_dir)
    result = processor.process_image(args.input_path, settings, args.output_filename)
    
    print(json.dumps(result, indent=2))
    
    if result['success']:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    process_image_from_cli()