import * as pixi from "pixi.js";
import { AIEntity } from "./aientity";
import { V, v0, vpool } from "./math";
import { SimLayer, Entity, rotateToPhys } from "./layersim";
import { PhysCirc, PhysWall } from "./physics";
import { randRange, randChoose } from "./help";

class JellyLeg {
  points: Array<pixi.Point> = [];
  time: number;
  seglen2: number;
  first = true;
  constructor(g: pixi.Container, l: number, tex: pixi.Texture, a: number) {
    const n = Math.floor(l / 10);
    this.seglen2 = l / n;
    this.seglen2 *= this.seglen2;
    for (let i = 0; i < n; ++i) {
      this.points.push(new pixi.Point());
    }
    const leg = new pixi.mesh.Rope(tex, this.points);
    leg.alpha = a;
    g.addChild(leg);
  }

  update(delta: number, p: V) {
    this.time += delta;
    if (this.time < 0.01) return;
    this.time -= 0.01;
    if (this.first) {
      this.first = false;
      for (let cur of this.points) {
        cur.x = p.x;
        cur.y = p.y;
      }
      return;
    }
    let last: pixi.Point | V = p;
    for (let cur of this.points) {
      const dx = last.x - cur.x;
      const dy = last.y - cur.y;
      const dist2 = dx * dx + dy * dy;
      last = cur;
      if (dist2 < this.seglen2) continue;
      const fixx = dx * (1 - this.seglen2 / dist2) * 0.5;
      const fixy = dy * (1 - this.seglen2 / dist2) * 0.5;
      cur.x += fixx;
      cur.y += fixy;
    }
  }
}

let jellyLegTexture: pixi.Texture;
let jellyTexture: pixi.Texture;
export class Jellyfish extends AIEntity {
  sprite: pixi.Sprite;
  doorPoint: V = new V().set(0, 0);
  legs: Array<JellyLeg> = [];
  rOffset: number;
  constructor() {
    super();
    this.settMaxSpeed = 10;
    this.settAcc = 4;
    this.phys.radius = 10;
    this.phys.mass = 50;
    this.phys.restitution = 0.2;
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
    this.lastRoom = null;

    this.rOffset = randRange(-1, 1);
    for (let i = 0; i < 3; ++i) {
      this.legs.push(new JellyLeg(this.graphics, 50, jellyLegTexture, 1));
    }
    this.sprite = new pixi.Sprite(jellyTexture);
    this.sprite.scale.y = randChoose([1, -1]);
    this.sprite.anchor.set(0.5, 0.5);
    this.graphics.addChild(this.sprite);
  }

  aiUpdate(context: SimLayer, now: number) {
    if (this.phys.room.id != this.lastRoom) {
      this.doorPoint.setv(this.aimAtDoor(context));
    }
    const doorVect = this.doorPoint
      .c()
      .sub(this.phys.position.c())
      .normTry()
      .scale(this.settAcc);
    let avoidVect = vpool.take().set(0, 0);
    {
      const processEntity = (e: PhysCirc<SimLayer>) => {
        if (!(e.data instanceof BigJellyfish)) return;
        if (
          Math.abs(e.position.x - this.phys.position.x) > 60 ||
          Math.abs(e.position.y - this.phys.position.y) > 60
        )
          return;
        const change = this.invertDistance(
          this.phys.position.c().sub(e.position.c()),
          this.phys.radius + e.radius
        );
        avoidVect = avoidVect.add(change);
      };
      for (let e of this.phys.room.elements) processEntity(e);
      const seenOther = new Set<string>();
      for (let d of this.phys.room.doors) {
        if (seenOther.has(d.other)) continue;
        seenOther.add(d.other);
        const otherRoom = context.rooms.get(d.other);
        if (!otherRoom) continue;
        for (let e of otherRoom.phys.elements) processEntity(e);
      }
      avoidVect = avoidVect.scale(3);
    }

    this.navigateRelative(doorVect.add(avoidVect));
    this.aiNextUpdate = now + 500;
  }

  postUpdate(delta: number) {
    this.sprite.position.set(this.phys.position.x, this.phys.position.y);
    rotateToPhys(this, this.sprite);
    for (let i = 0; i < 3; ++i) {
      const p = this.phys.position
        .c()
        .add(vpool.take().seta(this.sprite.rotation, 7))
        .add(
          vpool
            .take()
            .seta(
              (i / 3 + this.rOffset) * 2 * Math.PI + this.sprite.rotation,
              6
            )
        );
      try {
        this.legs[i].update(delta, p);
      } finally {
        p.release();
      }
    }
  }
}

let bigJellyLegTexture: pixi.Texture;
let bigJellyFrames: Array<pixi.Texture> = [];
export class BigJellyfish extends AIEntity {
  sprite: PIXI.extras.AnimatedSprite;
  playTimer: number = 0;
  doorDest: V = new V();
  legs: Array<JellyLeg> = [];
  rSpeed: number = 0;
  rTime: number = 0;
  constructor() {
    super();
    this.settMaxSpeed = 8;
    this.settAcc = 8;
    this.phys.radius = 30;
    this.phys.mass = 100;
    this.phys.restitution = 0.2;
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
    this.lastRoom = null;

    this.rSpeed = randRange(-0.3, 0.3);
    for (let i = 0; i < 4; ++i) {
      const leg = new JellyLeg(this.graphics, 300, bigJellyLegTexture, 0.1);
      this.legs.push(leg);
    }
    this.sprite = new PIXI.extras.AnimatedSprite(bigJellyFrames);
    this.sprite.scale.y = randChoose([1, -1]);
    this.sprite.anchor.set(0.5, 0.5);
    this.sprite.animationSpeed = 0.06;
    this.sprite.loop = false;
    this.graphics.addChild(this.sprite);
  }

  aiUpdate(context: SimLayer, now: number) {
    if (this.phys.room.id != this.lastRoom) {
      this.doorDest.setv(this.aimAtDoor(context));
    }
    this.aiNextUpdate = now + 1000;
  }

  lowUpdate() {
    this.navigateAbsolute(this.doorDest.c());
    this.playTimer += 0.05;
    if (this.playTimer > 10) {
      this.playTimer -= 10;
      this.sprite.gotoAndPlay(0);
    }
  }

  postUpdate(delta: number) {
    this.rTime += delta * this.rSpeed * 0.3;
    this.sprite.position.set(this.phys.position.x, this.phys.position.y);
    rotateToPhys(this, this.sprite);
    const animFactor = Math.max(0, Math.min(this.playTimer - 0.5, 1.2)) / 1.2;
    for (let i = 0; i < this.legs.length; ++i) {
      const p = this.phys.position
        .c()
        .add(vpool.take().seta(this.sprite.rotation, (animFactor - 1) * 10))
        .add(
          vpool
            .take()
            .seta(
              i / this.legs.length * 2 * Math.PI +
                this.sprite.rotation +
                this.rTime,
              7 + 15 * (1 - animFactor)
            )
        );
      try {
        this.legs[i].update(delta, p);
      } finally {
        p.release();
      }
    }
  }
}

export const setJellyTextures = (
  jellyLegTexture0: pixi.Texture,
  jellyTexture0: pixi.Texture,
  bigJellyLegTexture0: pixi.Texture,
  bigJellyFrames0: Array<pixi.Texture>
) => {
  jellyLegTexture = jellyLegTexture0;
  jellyTexture = jellyTexture0;
  bigJellyLegTexture = bigJellyLegTexture0;
  bigJellyFrames = bigJellyFrames0;
};
