import * as pixi from "pixi.js";
import { hsv2rgb } from "./pixihelp";
import { app } from "./globals";
import { V } from "./math";
import { pmod } from "./help";

export class Background {
  graphics: pixi.Container = new pixi.Container();
  layers: Array<pixi.Graphics> = [];
  maxDim: number;
  time: number = 0;

  constructor() {
    const lcount = 3;
    this.maxDim = Math.max(app.renderer.width, app.renderer.height);
    for (let i = lcount - 1; i >= 0; --i) {
      const layer = new pixi.Graphics();
      this.layers.push(layer);
      this.graphics.addChild(layer);
      const cut = 2 * (1 << i);
      layer.lineStyle(Math.max(1, 4 / cut), hsv2rgb(200, 0.5, 1), 1);
      for (let x = 0; x < this.maxDim * 3; x += this.maxDim / cut) {
        layer.moveTo(x - this.maxDim, -this.maxDim);
        layer.lineTo(x - this.maxDim, this.maxDim * 2);
        layer.moveTo(-this.maxDim, x - this.maxDim);
        layer.lineTo(this.maxDim * 2, x - this.maxDim);
      }
      layer.alpha = (1 - i / lcount) * 0.5 + 0.5;
    }
    this.graphics.alpha = 0.05;
    this.layers = this.layers.reverse();
  }

  draw(delta: number, c: V) {
    this.time += delta * 20;
    this.time = this.time % (5 * this.maxDim * (1 << this.layers.length));
    for (let i = 0; i < this.layers.length; ++i) {
      const layer = this.layers[i];
      const divisor = this.maxDim * (1 << (i + 1));
      const x = -(-1 + pmod((c.x + this.time) / divisor, 1)) * this.maxDim;
      const y =
        -(-1 + pmod((c.y + this.time * 0.2) / divisor, 1)) * this.maxDim;
      layer.position.set(x, y);
    }
  }
}
