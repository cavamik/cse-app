/**
 * Ridimensiona e comprime un'immagine in formato moderno WebP
 * (con fallback automatico a JPEG qualora il browser non supporti WebP),
 * ottimizzando il peso finale per un target medio di ~100 KB
 * e una risoluzione ideale per la stampa di verbali A4 (max 1280px).
 */
export async function compressImage(file: File, maxSizeKB: number = 100): Promise<File> {
  return new Promise((resolve) => {
    // Se non è un'immagine, la restituisce così com'è
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Limita la risoluzione massima a 1280px sul lato lungo (nitidezza ottimale per stampa A4)
        const maxDimension = 1280;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Verifica supporto export WebP da Canvas
        let isWebpSupported = false;
        try {
          isWebpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        } catch {
          isWebpSupported = false;
        }

        const targetFormat = isWebpSupported ? 'image/webp' : 'image/jpeg';
        const targetExt = isWebpSupported ? '.webp' : '.jpg';

        // Compressione progressiva a scalare per garantire peso ~100 KB
        const iterateQuality = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }

              // Se il blob rientra nel target o abbiamo raggiunto la qualità minima
              if (blob.size <= maxSizeKB * 1024 || quality <= 0.35) {
                const newFileName = file.name.replace(/\.[^.]+$/, '') + targetExt;
                const compressedFile = new File([blob], newFileName, {
                  type: targetFormat,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                iterateQuality(quality - 0.12);
              }
            },
            targetFormat,
            quality
          );
        };

        // Partiamo da 0.80, ideale per WebP per stare sotto i 100 KB con qualità eccellente
        iterateQuality(0.8);
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}
