import React, { useState, useEffect, useCallback } from 'react';
import { productsAPI } from '../services/api';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import { API_BASE_URL } from '../config/apiBaseUrl';
import ImageUploadManager from './ImageUploadManager';
import {
  PhotoIcon,
  StarIcon,
  TrashIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogIconButton,
  AdminDialogTitle,
} from './AdminDialog';
import { cn } from '../lib/utils';

const EnhancedImageGalleryManager = ({
  productId,
  productName,
  isOpen,
  onClose,
  onImagesUpdate,
}) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await productsAPI.getImages(productId);
      const data = response.data;
      setImages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!isOpen || !productId) return;
    fetchImages();
  }, [isOpen, productId, fetchImages]);

  const handleFilesSelected = useCallback(
    async (files, settings) => {
      if (!files || files.length === 0) return;

      setUploading(true);
      const token = localStorage.getItem('authToken');

      try {
        for (const file of files) {
          const formData = new FormData();
          formData.append('image', file);
          formData.append('alt_text', file.name);
          formData.append('is_primary', Array.isArray(images) && images.length === 0);
          formData.append('processing_settings', JSON.stringify(settings || {}));

          const response = await fetch(
            `${API_BASE_URL}/api/admin/products/${productId}/images/upload`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            }
          );

          if (!response.ok) {
            throw new Error('Upload failed');
          }
        }

        await fetchImages();
        onImagesUpdate && onImagesUpdate();
      } catch (error) {
        console.error('Error uploading images:', error);
        alert('Error uploading images. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [productId, images, fetchImages, onImagesUpdate]
  );

  const handleUrlSubmit = async (urlData) => {
    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/products/${productId}/images/url`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_url: urlData.url,
            alt_text: urlData.altText || 'Product image',
            is_primary: urlData.isPrimary || (Array.isArray(images) && images.length === 0),
            processing_settings: urlData.settings || {},
          }),
        }
      );

      if (response.ok) {
        await fetchImages();
        onImagesUpdate && onImagesUpdate();
      }
    } catch (error) {
      console.error('Error adding URL image:', error);
    }
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;

    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/products/${productId}/images/${imageId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        await fetchImages();
        onImagesUpdate && onImagesUpdate();
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  const handleSetPrimary = async (imageId) => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/products/${productId}/images/${imageId}/primary`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        await fetchImages();
        onImagesUpdate && onImagesUpdate();
      }
    } catch (error) {
      console.error('Error setting primary image:', error);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();

    if (draggedItem === null || draggedItem === dropIndex) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedItem];

    newImages.splice(draggedItem, 1);
    newImages.splice(dropIndex, 0, draggedImage);

    const imageOrders = newImages.map((img, index) => ({
      id: img.id,
      sort_order: index,
    }));

    setImages(newImages);
    setDraggedItem(null);

    const token = localStorage.getItem('authToken');
    try {
      await fetch(`${API_BASE_URL}/api/admin/products/${productId}/images/reorder`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageOrders }),
      });

      onImagesUpdate && onImagesUpdate();
    } catch (error) {
      console.error('Error reordering images:', error);
      await fetchImages();
    }
  };

  if (!isOpen) return null;

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AdminDialogContent
        size="xl"
        className="flex max-h-[min(92dvh,calc(100dvh-1rem))] max-w-[min(72rem,calc(100vw-0.75rem))] flex-col overflow-hidden bg-[#fbfbfb] p-0 dark:bg-black/40"
      >
        <AdminDialogHeader className="border-b border-border/40 bg-card px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PhotoIcon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <AdminDialogTitle className="text-lg font-semibold">
                  Manage product images
                </AdminDialogTitle>
                <AdminDialogDescription className="mt-1 line-clamp-2">
                  {productName
                    ? `Gallery for “${productName}”. Reorder by dragging cards; the primary image is highlighted.`
                    : 'Reorder by dragging cards; the primary image is highlighted.'}
                </AdminDialogDescription>
              </div>
            </div>
            <AdminDialogIconButton onClick={onClose} className="h-8 w-8 shrink-0 rounded-lg" />
          </div>
        </AdminDialogHeader>

        <AdminDialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/10 p-0">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Gallery — uses remaining width */}
            <section className="flex min-h-[min(40vh,22rem)] min-w-0 flex-1 flex-col border-border/40 lg:min-h-[min(68vh,36rem)] lg:border-r">
              <div className="shrink-0 border-b border-border/40 bg-card/90 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Image gallery</h3>
                  {!loading && Array.isArray(images) && images.length > 0 && (
                    <span className="admin-chip tabular-nums">{images.length} image(s)</span>
                  )}
                </div>
                <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-muted-foreground">
                  <ArrowsRightLeftIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  Drag any card onto another to change order (storefront follows this order).
                </p>
              </div>

              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {loading ? (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div
                      className="h-9 w-9 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-primary"
                      aria-hidden
                    />
                    <span className="text-sm">Loading images…</span>
                  </div>
                ) : !Array.isArray(images) || images.length === 0 ? (
                  <div className="admin-empty-state min-h-[14rem] py-10">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
                      <PhotoIcon className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No images yet</p>
                    <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                      Use the panel on the right to upload files or add a URL. The first image you add becomes primary
                      until you change it.
                    </p>
                  </div>
                ) : (
                  <ul className="m-0 list-none grid gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(152px,1fr))] sm:gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]">
                    {images.map((image, index) => (
                      <li key={image.id} className="min-w-0">
                        <div
                          className={cn(
                            'flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow',
                            image.is_primary
                              ? 'border-primary/50 ring-2 ring-primary/25'
                              : 'border-border/70 hover:border-border hover:shadow-md'
                          )}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                        >
                          <div className="relative aspect-square bg-muted/30">
                            {image.image_url ? (
                              <img
                                src={getImageUrl(image.image_url, 'product')}
                                alt={image.alt_text || 'Product image'}
                                onError={(e) => handleImageError(e, 'product')}
                                className="absolute inset-0 h-full w-full object-cover"
                                draggable={false}
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                                <PhotoIcon className="h-8 w-8 opacity-50" />
                                <span className="text-[11px]">No preview</span>
                              </div>
                            )}
                            {image.is_primary && (
                              <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
                                Primary
                              </span>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col gap-2 border-t border-border/50 p-2.5">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span className="tabular-nums">#{index + 1}</span>
                              <span className="truncate">
                                {image.image_type === 'file' ? 'Uploaded file' : 'External URL'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {!image.is_primary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimary(image.id)}
                                  title="Set as primary image"
                                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-border/70 bg-muted/30 px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50"
                                >
                                  <StarIcon className="h-3.5 w-3.5 shrink-0" />
                                  Primary
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(image.id)}
                                title="Delete image"
                                className={cn(
                                  'inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200/80 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-100',
                                  image.is_primary ? 'col-span-2' : ''
                                )}
                              >
                                <TrashIcon className="h-3.5 w-3.5 shrink-0" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Upload */}
            <aside className="flex w-full shrink-0 flex-col border-t border-border/40 bg-card lg:w-[min(100%,22rem)] lg:border-l lg:border-t-0 xl:w-[26rem]">
              <div className="shrink-0 border-b border-border/40 px-4 py-3 sm:px-5">
                <h3 className="text-sm font-semibold text-foreground">Add images</h3>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Upload multiple files or paste a URL. Optional compression runs before upload.
                </p>
              </div>
              <div className="custom-scrollbar min-h-0 max-h-[min(42vh,20rem)] flex-1 overflow-y-auto p-4 sm:p-5 lg:max-h-none">
                <div className="rounded-xl border border-border/40 bg-muted/15 p-3 sm:p-4">
                  <ImageUploadManager
                    onFilesSelected={handleFilesSelected}
                    onUrlSubmit={handleUrlSubmit}
                    multiple
                    maxFiles={10}
                    showAdvancedSettings
                    defaultSettings={{
                      compression: {
                        enabled: true,
                        quality: 85,
                        maxWidth: 1920,
                        maxHeight: 1080,
                      },
                      format: {
                        outputFormat: 'webp',
                      },
                      optimization: {
                        removeMetadata: true,
                        progressive: true,
                        autoOrient: true,
                      },
                    }}
                  />
                </div>

                {uploading && (
                  <div
                    className="mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] text-muted-foreground"
                    role="status"
                  >
                    <div
                      className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                      aria-hidden
                    />
                    Processing and uploading…
                  </div>
                )}
              </div>
            </aside>
          </div>
        </AdminDialogBody>

        <AdminDialogFooter className="border-t border-border/40 bg-card px-5 py-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Done
          </button>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
};

export default EnhancedImageGalleryManager;
