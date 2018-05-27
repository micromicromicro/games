import * as pixi from "pixi.js";

export class Layer {
  graphics: pixi.Container = new pixi.Container();
  update(delta: number) {}
}
