declare module "bwip-js" {
  export interface RenderOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?: "left" | "center" | "right";
    backgroundcolor?: string;
  }

  function toBuffer(options: RenderOptions): Promise<Buffer>;

  const bwipjs: {
    toBuffer: typeof toBuffer;
  };

  export default bwipjs;
}
