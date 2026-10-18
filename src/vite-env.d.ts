/// <reference types="vite/client" />
declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
