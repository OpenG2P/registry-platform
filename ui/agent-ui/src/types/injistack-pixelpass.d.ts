/**
 * PixelPass ships no type declarations. Only `decode` is used here, and only
 * for one job: unwrapping the Base45(zlib(hex)) string a claim-169 QR carries
 * into the hex CWT that Inji's verify-service accepts.
 */
declare module '@injistack/pixelpass' {
    /** Base45(zlib(hex)) -> hex CWT. */
    export function decode(data: string): string;
}
