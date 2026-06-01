export async function prepareAttachmentFile(file: File): Promise<File> {
    if (!isImageFile(file)) {
        return file;
    }

    const image = await loadImage(file);

    if (!isStickerCandidate(file, image)) {
        return file;
    }

    return resizeWebpSticker(file, image);
}

function isImageFile(file: File): boolean {
    return file.type.toLowerCase().startsWith('image/') || isWebpImage(file);
}

function isWebpImage(file: File): boolean {
    return (
        file.type.toLowerCase().split(';')[0] === 'image/webp' ||
        file.name.toLowerCase().endsWith('.webp')
    );
}

function isStickerCandidate(file: File, image: HTMLImageElement): boolean {
    if (isWebpImage(file)) {
        return true;
    }

    return (
        image.naturalWidth > 0 &&
        image.naturalWidth === image.naturalHeight &&
        image.naturalWidth <= 512
    );
}

async function resizeWebpSticker(
    file: File,
    image: HTMLImageElement
): Promise<File> {
    const size = 512;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context || !image.naturalWidth || !image.naturalHeight) {
        throw new Error('Nao foi possivel preparar o sticker para envio.');
    }

    canvas.width = size;
    canvas.height = size;
    context.clearRect(0, 0, size, size);

    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);
    const x = Math.round((size - width) / 2);
    const y = Math.round((size - height) / 2);

    context.drawImage(image, x, y, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.92)
    );

    if (!blob) {
        throw new Error('Nao foi possivel redimensionar o sticker para 512x512.');
    }

    const fileName = file.name.toLowerCase().endsWith('.webp')
        ? file.name
        : `${file.name.replace(/\.[^/.]+$/, '')}.webp`;

    const resizedFile = new File([blob], fileName, {
        type: 'image/webp',
        lastModified: file.lastModified,
    });

    const resizedImage = await loadImage(resizedFile);

    if (resizedImage.naturalWidth !== size || resizedImage.naturalHeight !== size) {
        throw new Error('O sticker precisa ser enviado em 512x512.');
    }

    return resizedFile;
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Nao foi possivel carregar a imagem WebP.'));
        };
        image.src = url;
    });
}
