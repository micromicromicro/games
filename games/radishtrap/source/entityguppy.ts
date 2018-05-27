import * as pixi from "pixi.js";
import { AIEntity } from "./aientity";
import { V, v0, vpool } from "./math";
import { SimLayer, Entity, rotateToPhys } from "./layersim";
import { PhysCirc, PhysWall } from "./physics";
import { randChoose } from "./help";

let guppyTexture: pixi.Texture;
export const setGuppyTexture = (t: pixi.Texture) => {
  guppyTexture = t;
};
export class Guppy extends AIEntity {
  targetPoint: V = new V().set(0, 0);
  constructor(diff: number) {
    super();
    if (diff >= 1) {
      this.settMaxSpeed = 35;
      this.settAcc = 30;
    } else {
      this.settMaxSpeed = 28;
      this.settAcc = 24;
    }
    this.phys.radius = 2;
    const pthis = this;
    this.phys.listener = new class {
      handle(context: SimLayer, other: PhysCirc<SimLayer> | PhysWall) {}

      changedRoom(context: SimLayer) {
        if (!pthis.phys.room) {
          pthis.destroy(context);
        }
      }
    }();
    const sprite = new pixi.Sprite(guppyTexture);
    sprite.scale.y = randChoose([1, -1]);
    sprite.anchor.set(0.5, 0.5);
    this.graphics.addChild(sprite);
  }

  aiUpdate(context: SimLayer, now: number) {
    const player = context.getPlayer();
    if (player && this.checkPlayerVisible(context)) {
      // Player is nearby and exposed
      this.targetPoint.setv(player.position.c());
      this.lastRoom = null;
      this.aiNextUpdate = now + 50;
    } else {
      // Player not visible, just go towards the door
      if (this.phys.room.id != this.lastRoom) {
        this.targetPoint.setv(this.aimAtDoor(context));
      }
      this.aiNextUpdate = now + 200;
    }
  }

  lowUpdate() {
    this.navigateAbsolute(this.targetPoint.c());
  }

  postUpdate(delta: number) {
    super.postUpdate(delta);
    rotateToPhys(this, this.graphics);
  }
}
