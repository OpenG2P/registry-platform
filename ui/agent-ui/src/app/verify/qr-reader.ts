'use client';

/**
 * Reads the QR out of a file the agent uploaded — a printed credential scanned
 * to PDF, or a photo of one.
 *
 * This runs in the BROWSER on purpose. The alternative, posting the image to
 * the API, would mean shipping a picture of a citizen's credential to the
 * server and adding a QR/PDF toolchain (zbar, poppler) to a Python image that
 * needs neither. Reading it here sends only the payload string, which is the
 * only part the verifier wants.
 */

import jsQR from 'jsqr';

/** Widest side we rasterise to. Big enough for a phone photo's QR to survive,
 *  small enough that a large scan does not stall the tab. */
const MAX_DIMENSION = 2000;

function decodeImageData(data: ImageData): string | null {
    // `attemptBoth` costs a second pass but catches inverted prints, which a
    // black-background scan or a photo of a screen produces surprisingly often.
    const found = jsQR(data.data, data.width, data.height, {
        inversionAttempts: 'attemptBoth',
    });
    return found?.data ?? null;
}

function scaled(width: number, height: number): { w: number; h: number } {
    const longest = Math.max(width, height);
    if (longest <= MAX_DIMENSION) return { w: width, h: height };
    const factor = MAX_DIMENSION / longest;
    return { w: Math.round(width * factor), h: Math.round(height * factor) };
}

async function readFromImage(file: File): Promise<string | null> {
    const bitmap = await createImageBitmap(file);
    const { w, h } = scaled(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return decodeImageData(ctx.getImageData(0, 0, w, h));
}

async function readFromPdf(file: File): Promise<string | null> {
    const pdfjs = await import('pdfjs-dist');
    // Bundled worker rather than a CDN: the portal must keep working on a
    // network that cannot reach the public internet.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
    ).toString();

    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
        // A credential is one page, but a scan may carry a cover sheet, so try
        // each page and stop at the first QR found.
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            // Render above 1:1 — a QR at native PDF scale is often too few
            // pixels for the decoder to lock onto.
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(viewport.width, MAX_DIMENSION);
            canvas.height = Math.min(viewport.height, MAX_DIMENSION);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) continue;
            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
            const payload = decodeImageData(
                ctx.getImageData(0, 0, canvas.width, canvas.height),
            );
            if (payload) return payload;
        }
        return null;
    } finally {
        // Release the worker's copy of the document; a long shift verifying
        // many cards otherwise accumulates them.
        await doc.cleanup();
    }
}

export async function readQrFromFile(file: File): Promise<string | null> {
    const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    return isPdf ? readFromPdf(file) : readFromImage(file);
}
