declare module "pptx-parser" {
  function pptxParser(buffer: Buffer): Promise<string>;
  export = pptxParser;
}