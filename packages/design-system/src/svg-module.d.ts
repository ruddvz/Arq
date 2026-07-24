// Vite's own convention for static asset imports (see vite/client's own d.ts) -
// declared locally here rather than depending on the `vite` package itself, since
// this package is only ever bundled as part of a consumer's Vite build (apps/web),
// never built standalone.
declare module '*.svg' {
  const src: string;
  export default src;
}
