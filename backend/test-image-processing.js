const ImageProcessingWrapper = require('./services/ImageProcessingWrapper');
const fs = require('fs').promises;
const path = require('path');

async function testImageProcessing() {
    console.log('🧪 Testing Image Processing Setup...\n');
    
    try {
        const processor = new ImageProcessingWrapper();
        
        // Test 1: Check Python availability
        console.log('1. Checking Python availability...');
        const isPythonAvailable = await processor.checkPythonAvailability();
        console.log(`   Python available: ${isPythonAvailable ? '✅ Yes' : '❌ No'}`);
        
        // Test 2: Check Sharp availability
        console.log('\n2. Checking Sharp availability...');
        let isSharpAvailable = false;
        try {
            require('sharp');
            isSharpAvailable = true;
            console.log('   Sharp available: ✅ Yes');
        } catch (error) {
            console.log('   Sharp available: ❌ No');
        }
        
        // Test 3: Create a test image buffer (small red square)
        if (isSharpAvailable) {
            console.log('\n3. Testing image processing with Sharp fallback...');
            const sharp = require('sharp');
            
            // Create a test image - 1000x1000 red square
            const testImageBuffer = await sharp({
                create: {
                    width: 1000,
                    height: 1000,
                    channels: 3,
                    background: { r: 255, g: 0, b: 0 }
                }
            })
            .jpeg({ quality: 100 })
            .toBuffer();
            
            console.log(`   Original test image size: ${Math.round(testImageBuffer.length / 1024)}KB`);
            
            // Test processing
            const result = await processor.simpleFallbackResize(testImageBuffer, {
                mode: 'auto',
                targetFileSize: 150 * 1024
            });
            
            if (result.success) {
                console.log(`   ✅ Processing successful!`);
                console.log(`   📦 Compressed to: ${Math.round(result.processed.file_size / 1024)}KB`);
                console.log(`   📉 Compression ratio: ${result.compression_ratio}%`);
                console.log(`   🔄 Format: ${result.processed.format}`);
            } else {
                console.log(`   ❌ Processing failed: ${result.error}`);
            }
        }
        
        console.log('\n✅ Image processing setup test completed!');
        
        if (!isPythonAvailable && !isSharpAvailable) {
            console.log('\n⚠️  WARNING: Neither Python nor Sharp is available.');
            console.log('   Images will be uploaded without processing.');
            console.log('   Install Python + PIL or Sharp for image optimization.');
        } else if (!isPythonAvailable) {
            console.log('\n💡 INFO: Using Sharp fallback for image processing.');
            console.log('   For full features, install Python + PIL + pillow-heif.');
        } else {
            console.log('\n🎉 SUCCESS: Python image processing is available!');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

testImageProcessing();