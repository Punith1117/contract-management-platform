// Polyfill for pptx-parser browser dependency
// This must be imported BEFORE any module that imports pptx-parser
(globalThis as any).window = globalThis;