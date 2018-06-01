import * as pixi from "pixi.js";
import { PhysCirc, PhysWall } from "./physics";
import {
  app,
  key_down,
  key_left,
  key_right,
  key_up,
  touches,
  do_game_over
} from "./globals";
import { V, v0, vpool } from "./math";
import { SimLayer, Entity, rotateToPhys, Room } from "./layersim";

export class Player extends Entity {
  shape: pixi.Graphics;
  maxSpeed: number;
  acc: number;
  rails: boolean;
  rotSpeed: number;
  diff: number;
  score = 0;
  distance = 0;
  time = 0;
  distanceTime = 0;
  maxDistanceTime: number;

  constructor(sim: SimLayer, diff: number) {
    super();
    this.maxDistanceTime = diff == 0 ? Number.MAX_VALUE : 30;
    this.diff = diff;
    this.maxSpeed = 100;
    this.acc = 80;
    this.phys = new PhysCirc();
    this.phys.mass = 50;
    this.phys.radius = 10;
    const this1 = this;
    this.phys.listener = new class {
      handle(context: SimLayer, other: any): boolean {
        if (context.getPlayer() == null) return false;
        if (this1.diff >= 1 || !(other instanceof PhysWall)) {
          do_game_over(context, this1.diff, this1.score);
          this1.destroy(context);
          context.clearPlayer();
          return true;
        }
      }

      changedRoom(context: SimLayer) {
        const room = <Room>this1.phys.room.data;
        if (room.data.distance > this1.distance) {
          this1.distanceTime = 0;
          const timeFactor =
            1 -
            2 * Math.atan(this1.time / Math.max(1, this1.distance)) / Math.PI;
          const distFactor = room.data.distance - this1.distance;
          const adding = room.data.distance * distFactor * timeFactor * 1000;
          this1.score += adding;
          this1.distance = room.data.distance;
          if (String(room.data.distance) == sim.mapData.endDist) {
            do_game_over(context, this1.diff, this1.score);
            this1.destroy(context);
            context.clearPlayer();
            return;
          }
        }
        sim.adjustRooms(this1.phys.room.id);
      }
    }();
    this.shape = new pixi.Graphics();
    this.shape.lineStyle(1, pixi.utils.rgb2hex([1, 1, 1]), 1);
    this.shape.moveTo(15, 0);
    this.shape.lineTo(-10, -10);
    this.shape.lineTo(-10, 10);
    this.shape.closePath();
    this.graphics.addChild(this.shape);
  }

  update(context: SimLayer, delta: number) {
    this.distanceTime += delta;
    if (this.distanceTime > this.maxDistanceTime) {
      do_game_over(context, this.diff, this.score);
      this.destroy(context);
      context.clearPlayer();
      return;
    }
    this.time += delta;
    this.phys.acc.set(0, 0);
    let change = v0
      .add(key_left() ? vpool.take().set(-1, 0) : v0)
      .add(key_right() ? vpool.take().set(1, 0) : v0)
      .add(key_up() ? vpool.take().set(0, -1) : v0)
      .add(key_down() ? vpool.take().set(0, 1) : v0);
    const minDim = Math.min(app.renderer.width, app.renderer.height) / 2;
    for (let [id, t] of touches) {
      const factor = vpool
        .take()
        .set(
          -(app.renderer.width / 2 - t.x) / minDim,
          -(app.renderer.height / 2 - t.y) / minDim
        )
        .norm();
      change = change.add(factor);
    }
    try {
      const changeLen = change.c().len();
      if (changeLen > 1) change = change.descale(changeLen);
      this.phys.acc.setv(this.phys.acc.c().add(change.c().scale(this.acc)));
    } finally {
      change.release();
    }
    const len = this.phys.vel.c().len();
    if (len > this.maxSpeed)
      this.phys.vel.setv(this.phys.vel.c().scale(this.maxSpeed / len));
  }

  postUpdate(delta: number) {
    this.graphics.position.set(this.phys.position.x, this.phys.position.y);
    rotateToPhys(this, this.graphics);
    this.graphics.alpha = 1 - this.distanceTime / this.maxDistanceTime;
  }
}
