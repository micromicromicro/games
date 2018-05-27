import * as pixi from "pixi.js";
import { hsv2rgb } from "./pixihelp";
import { app } from "./globals";

export class Background {
  graphics: pixi.Container = new pixi.Container();
  layers: Array<pixi.Graphics> = [];
  minDim: number;
  time: number = 0;

  constructor() {
    const lcount = 3;
    this.minDim = Math.min(app.renderer.width, app.renderer.height);
    for (let i = lcount - 1; i >= 0; --i) {
      const layer = new pixi.Graphics();
      this.layers.push(layer);
      this.graphics.addChild(layer);
      const cut = 2 * (1 << i);
      layer.lineStyle(Math.max(1, 4 / cut), hsv2rgb(200, 0.5, 1), 1);
      for (let x = 0; x < this.minDim * 3; x += this.minDim / cut) {
        layer.moveTo(x - this.minDim, -this.minDim);
        layer.lineTo(x - this.minDim, this.minDim * 2);
        layer.moveTo(-this.minDim, x - this.minDim);
        layer.lineTo(this.minDim * 2, x - this.minDim);
      }
      layer.alpha = (1 - i / lcount) * 0.5 + 0.5;
    }
    this.graphics.alpha = 0.05;
    this.layers = this.layers.reverse();
  }

  draw(delta: number, c: V) {
    this.time =
      (this.time + delta * 20) % (this.minDim * (1 << this.layers.length));
    for (let i = 0; i < this.layers.length; ++i) {
      const layer = this.layers[i];
      const divisor = this.minDim * (1 << (i + 1));
      const x = -(-1 + ((c.x + this.time) / divisor) % 1) * this.minDim;
      const y = -(-1 + ((c.y + this.time * 0.2) / divisor) % 1) * this.minDim;
      layer.position.set(x, y);
    }
  }
}
