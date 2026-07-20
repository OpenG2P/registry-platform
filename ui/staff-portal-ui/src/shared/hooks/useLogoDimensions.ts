import { useEffect, useState } from 'react';

export type LogoDimensions = {
    naturalWidth: number;
    naturalHeight: number;
    isHorizontal: boolean;
};

export function useLogoDimensions(src: string | undefined | null): LogoDimensions | null {
    const [dimensions, setDimensions] = useState<LogoDimensions | null>(null);

    useEffect(() => {
        if (!src) {
            setDimensions(null);
            return;
        }

        setDimensions(null);
        const img = new window.Image();
        img.onload = () => {
            const { naturalWidth, naturalHeight } = img;
            if (naturalWidth > 0 && naturalHeight > 0) {
                setDimensions({
                    naturalWidth,
                    naturalHeight,
                    isHorizontal: naturalWidth / naturalHeight >= 1.2,
                });
            }
        };
        img.src = src;
    }, [src]);

    return dimensions;
}

export function useHorizontalLogo(src: string | undefined | null): boolean {
    const dimensions = useLogoDimensions(src);
    return dimensions?.isHorizontal ?? false;
}

type LogoDisplaySizeOptions = {
    squareHeight: number;
    horizontalHeight: number;
    maxHorizontalWidth?: number;
};

export function getLogoDisplaySize(
    dimensions: LogoDimensions | null,
    { squareHeight, horizontalHeight, maxHorizontalWidth = 480 }: LogoDisplaySizeOptions
) {
    if (!dimensions) {
        return {
            width: squareHeight,
            height: squareHeight,
            isHorizontal: false,
        };
    }

    const displayHeight = dimensions.isHorizontal ? horizontalHeight : squareHeight;
    const scaledWidth = Math.round(
        (displayHeight / dimensions.naturalHeight) * dimensions.naturalWidth
    );
    const displayWidth = dimensions.isHorizontal
        ? Math.min(scaledWidth, maxHorizontalWidth)
        : squareHeight;

    return {
        width: displayWidth,
        height: displayHeight,
        isHorizontal: dimensions.isHorizontal,
    };
}
