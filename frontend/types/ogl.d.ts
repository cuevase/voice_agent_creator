declare module 'ogl' {
  export class Renderer { constructor(options?: any); gl: WebGLRenderingContext & WebGL2RenderingContext; setSize: (w: number, h: number) => void; }
  export class Program { constructor(gl: WebGLRenderingContext, opts: any); uniforms: any; }
  export class Mesh { constructor(gl: WebGLRenderingContext, opts: any); }
  export class Triangle { constructor(gl: WebGLRenderingContext); }
  export class Vec3 { constructor(x: number, y: number, z: number); set(x: number, y: number, z: number): void }
} 