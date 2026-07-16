export {};

declare global {
  interface Window {
    __removeBootScreen?: () => void;
  }
}
