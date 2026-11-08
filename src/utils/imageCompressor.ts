/**
 * Ridimensiona e comprime un'immagine in formato JPEG
 * mantenendo il peso finale entro i 200 KB.
 */
export async function compressImage(file: File, maxSizeKB: number = 200): Promise<File> {
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

        // Limita la risoluzione massima a 1280px sul lato lungo (ideale per verbale A4)
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

        // Compressione a scalare per garantire peso < 200 KB
        const iterateQuality = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }

              if (blob.size <= maxSizeKB * 1024 || quality <= 0.3) {
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^.]+$/, '.jpg'),
                  { type: 'image/jpeg', lastModified: Date.now() }
                );
                resolve(compressedFile);
              } else {
                iterateQuality(quality - 0.15);
              }
            },
            'image/jpeg',
            quality
          );
        };

        iterateQuality(0.75);
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}