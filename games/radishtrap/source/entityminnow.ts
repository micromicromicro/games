import * as pixi from "pixi.js";
import { AIEntity } from "./aientity";
import { V, v0, vpool } from "./math";
import { SimLayer, Entity, rotateToPhys } from "./layersim";
import { PhysCirc, PhysWall } from "./physics";
import { randRange, randChoose } from "./help";

let minnowTexture: pixi.Texture;
export const setMinnowTexture = (t: pixi.Texture) => {
  minnowTexture = t;
};
export class Minnow extends AIEntity {
  sprite: pixi.Sprite;
  pulse = 0;
  foresight: number;
  seePlayer: boolean = false;
  targetPoint = new V();
  constructor(diff: number) {
    super();
    this.foresight = randRange(2, 5);
    if (diff >= 1) {
      this.settMaxSpeed = 35;
      this.settAcc = 30;
    } else {
      this.settMaxSpeed = 28;
      this.settAcc = 24;
    }
    this.phys.radius = 3;
    const pthis = this;
    this.phys.listener = new class {
      handle(context: SimLayer, other: PhysCirc<SimLayer> | PhysWall): boolean {
        return false;
      }

      changedRoom(context: SimLayer) {
        if (!pthis.phys.room) {
          pthis.destroy(context);
        }
      }
    }();

    this.sprite = new pixi.Sprite(minnowTexture);
    this.sprite.scale.y = randChoose([1, -1]);
    this.sprite.anchor.set(0.5, 0.5);
    this.graphics.addChild(this.sprite);
  }

  aiUpdate(context: SimLayer, now: number) {
    const player = context.getPlayer();
    if (player && this.checkPlayerVisible(context)) {
      // Player is nearby and exposed
      this.seePlayer = true;
      this.targetPoint.setv(
        player.position
          .c()
          .add(player.vel.c().scale(this.foresight))
          .add(player.acc.c())
      );
      this.lastRoom = null;
      this.aiNextUpdate = now + 50;
      return;
    }
    if (this.phys.room.id != this.lastRoom) {
      this.seePlayer = false;
      this.pulse = 0;
      this.targetPoint.setv(this.aimAtDoor(context));
    }
    this.aiNextUpdate = now + 200;
  }

  lowUpdate() {
    super.lowUpdate();
    if (this.seePlayer) {
      this.pulse = (this.pulse + 1) % 40;
      this.sprite.alpha =
        (Math.sin(this.pulse / 40 * 2 * Math.PI) + 1) * 0.25 + 0.75;
    } else {
      this.sprite.alpha = 1;
    }
    this.navigateAbsolute(this.targetPoint.c());
  }

  postUpdate(delta: number) {
    super.postUpdate(delta);
    rotateToPhys(this, this.graphics);
  }
}
