// Test script for the new image API endpoints
// Run this with: node test-image-api.js

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001/api';

// You'll need to replace this with a valid admin JWT token
const ADMIN_TOKEN = 'your-admin-jwt-token-here';

async function testImageAPI() {
    console.log('🧪 Testing Image API Endpoints...\n');
    
    try {
        // First, get all products to test with
        console.log('1. Fetching products...');
        const productsResponse = await fetch(`${API_BASE}/products`);
        const products = await productsResponse.json();
        
        if (products.length === 0) {
            console.log('❌ No products found. Please add a product first.');
            return;
        }
        
        const testProduct = products[0];
        console.log(`✅ Using product: ${testProduct.name} (ID: ${testProduct.id})`);
        
        // Test 1: Get images for a product (should work without auth)
        console.log('\n2. Testing GET /api/products/:id/images');
        const imagesResponse = await fetch(`${API_BASE}/products/${testProduct.id}/images`);
        const images = await imagesResponse.json();
        console.log(`✅ Current images: ${images.length} found`);
        
        // Test 2: Add image by URL (requires admin auth)
        console.log('\n3. Testing POST /api/admin/products/:id/images/url');
        if (ADMIN_TOKEN === 'your-admin-jwt-token-here') {
            console.log('⚠️  Skipping admin tests - please set ADMIN_TOKEN in the script');
            return;
        }
        
        const urlImageResponse = await fetch(`${API_BASE}/admin/products/${testProduct.id}/images/url`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_url: 'https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=Test+Image',
                alt_text: 'Test image added via API',
                is_primary: false
            })
        });
        
        if (urlImageResponse.ok) {
            const newImage = await urlImageResponse.json();
            console.log(`✅ Added image via URL: ${newImage.id}`);
            
            // Test 3: Get updated images
            console.log('\n4. Testing updated image list');
            const updatedImagesResponse = await fetch(`${API_BASE}/products/${testProduct.id}/images`);
            const updatedImages = await updatedImagesResponse.json();
            console.log(`✅ Updated images: ${updatedImages.length} found`);
            
            // Test 4: Reorder images
            if (updatedImages.length > 1) {
                console.log('\n5. Testing image reordering');
                const imageOrders = updatedImages.map((img, index) => ({
                    id: img.id,
                    sort_order: updatedImages.length - 1 - index // Reverse order
                }));
                
                const reorderResponse = await fetch(`${API_BASE}/admin/products/${testProduct.id}/images/reorder`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${ADMIN_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ imageOrders })
                });
                
                if (reorderResponse.ok) {
                    console.log('✅ Images reordered successfully');
                } else {
                    console.log('❌ Failed to reorder images');
                }
            }
            
            // Test 5: Set primary image
            console.log('\n6. Testing set primary image');
            const setPrimaryResponse = await fetch(`${API_BASE}/admin/products/${testProduct.id}/images/${newImage.id}/primary`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${ADMIN_TOKEN}`
                }
            });
            
            if (setPrimaryResponse.ok) {
                console.log('✅ Primary image set successfully');
            } else {
                console.log('❌ Failed to set primary image');
            }
            
            // Test 6: Delete the test image
            console.log('\n7. Testing image deletion');
            const deleteResponse = await fetch(`${API_BASE}/admin/products/${testProduct.id}/images/${newImage.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${ADMIN_TOKEN}`
                }
            });
            
            if (deleteResponse.ok) {
                console.log('✅ Test image deleted successfully');
            } else {
                console.log('❌ Failed to delete test image');
            }
            
        } else {
            const error = await urlImageResponse.text();
            console.log(`❌ Failed to add image via URL: ${error}`);
        }
        
        console.log('\n✅ API testing completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

async function checkAPIHealth() {
    console.log('🏥 Checking API health...');
    
    try {
        const response = await fetch(`${API_BASE}/products`);
        if (response.ok) {
            console.log('✅ API is running and accessible');
            return true;
        } else {
            console.log('❌ API returned error status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ API is not accessible:', error.message);
        console.log('💡 Make sure the backend server is running on port 3001');
        return false;
    }
}

async function runTests() {
    console.log('🚀 Image API Test Suite\n');
    
    const isHealthy = await checkAPIHealth();
    if (!isHealthy) {
        process.exit(1);
    }
    
    console.log('');
    await testImageAPI();
}

// Run the tests
runTests();