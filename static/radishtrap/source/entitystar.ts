import * as pixi from "pixi.js";
import { AIEntity } from "./aientity";
import { V, v0, vpool } from "./math";
import { SimLayer, Entity, rotateToPhys } from "./layersim";
import { PhysCirc, PhysWall } from "./physics";
import { randChoose, randRange } from "./help";

let starTextures: Array<pixi.Texture>;
export const setStarTextures = (t: pixi.Texture, t2: pixi.Texture) => {
  starTextures = [t, t2];
};
export class Star extends AIEntity {
  time: number;
  baseRotation: number;
  rotation: number = 0;
  period: number;
  drag: number;
  rotateMod: number;
  constructor(diff: number) {
    super();
    if (diff >= 1) {
      this.settMaxSpeed = 1000;
      this.settAcc = 200;
      this.period = randRange(4, 10);
      this.drag = 0.9;
    } else {
      this.settMaxSpeed = 1000;
      this.settAcc = 50;
      this.period = randRange(10, 20);
      this.drag = 0.95;
    }
    this.aiNextUpdate = Number.MAX_VALUE;
    this.time = this.period;
    const type = randChoose([0, 1]);
    this.rotateMod = randRange(-1, 1);
    this.phys.radius = type == 0 ? 8 : 11;
    const pthis = this;
    this.phys.listener = new class {
      handle(context: SimLayer, other: PhysCirc<SimLayer> | PhysWall) {}

      changedRoom(context: SimLayer) {
        if (!pthis.phys.room) {
          pthis.destroy(context);
        }
      }
    }();
    const sprite = new pixi.Sprite(starTextures[type]);
    sprite.scale.y = randChoose([1, -1]);
    sprite.anchor.set(0.5, 0.5);
    sprite.rotation = this.baseRotation = randRange(0, Math.PI * 2);
    this.graphics.addChild(sprite);
  }

  lowUpdate() {
    this.phys.vel.setv(this.phys.vel.c().scale(0.9));
  }

  update(context: SimLayer, delta: number) {
    this.time += delta;
    if (this.time >= this.period) {
      this.time -= this.period;
      this.rotation = randRange(0, 2 * Math.PI);
    }
    const timeFactor = Math.max(0, 1 - 2 * this.time / this.period);
    this.graphics.rotation +=
      delta * this.rotateMod * Math.PI * 0.5 * timeFactor;
    this.phys.acc.setv(
      vpool.take().seta(this.rotation, this.settAcc * timeFactor)
    );
    this.lowUpdateTime += delta;
    if (this.lowUpdateTime > 0.05) {
      this.lowUpdate();
      this.lowUpdateTime -= 0.05;
    }
  }
}
