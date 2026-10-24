/// <reference types="vite/client" />

interface MetaPixel {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  push: MetaPixel;
  queue: unknown[][];
  loaded: boolean;
  version: string;
}

interface Window {
  gtag?: (...args: unknown[]) => void;
  fbq?: MetaPixel;
  _fbq?: MetaPixel;
}
