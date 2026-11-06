const MAX_EDGE = 1280
const MAX_BYTES = 25 * 1024 * 1024

export function compressImage(file: File) {
  if (file.size > MAX_BYTES) {
    return Promise.reject(new Error('Troppo grande'))
  }

  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas'))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      URL.revokeObjectURL(url)
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Formato'))
    }
    image.src = url
  })
}
