import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';

/**
 * Processes a file silently in the background based on its type.
 * - Images: Compress and convert to WebP
 * - Videos: Keep as is
 * - Others: ZIP them
 */
export async function processFileSmartly(originalFile) {
  const fileType = originalFile.type;

  // 1. IMAGE HANDLING
  if (fileType.startsWith('image/')) {
    try {
      const options = {
        maxSizeMB: 1, 
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp'
      };
      
      const compressedBlob = await imageCompression(originalFile, options);
      const newName = originalFile.name.replace(/\.[^/.]+$/, "") + ".webp";
      const compressedFile = new File([compressedBlob], newName, { type: 'image/webp' });
      
      return {
        file: compressedFile,
        previewUrl: URL.createObjectURL(compressedFile),
        type: 'image'
      };
    } catch (error) {
      console.error("Image compression failed", error);
      return { file: originalFile, previewUrl: URL.createObjectURL(originalFile), type: 'image' };
    }
  }

  // 2. VIDEO HANDLING
  if (fileType.startsWith('video/')) {
    return {
      file: originalFile,
      previewUrl: URL.createObjectURL(originalFile), 
      type: 'video'
    };
  }

  // 3. DOCUMENT HANDLING
  try {
    const zip = new JSZip();
    zip.file(originalFile.name, originalFile);
    
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const zipName = originalFile.name.replace(/\.[^/.]+$/, "") + ".zip";
    const zipFile = new File([zipBlob], zipName, { type: 'application/zip' });

    return {
      file: zipFile,
      previewUrl: null, 
      type: 'document'
    };
  } catch (error) {
    return { file: originalFile, previewUrl: null, type: 'document' };
  }
}
