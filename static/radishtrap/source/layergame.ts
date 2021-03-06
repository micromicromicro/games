import * as pixi from "pixi.js";
import { SimLayer, Room, Entity, roomCenter } from "./layersim";
import { map as levelMapData } from "./level";
import { V, v0, vpool } from "./math";
import { randChoose, randRange } from "./help";
import { app, colorBg } from "./globals";
import { createText } from "./pixihelp";
import { Player } from "./player";
import { Guppy } from "./entityguppy";
import { Minnow } from "./entityminnow";
import { Jellyfish, BigJellyfish } from "./entityjellies";
import { Star } from "./entitystar";

export class GameLayer extends SimLayer {
  scoreboard: pixi.Text;
  player: Player;
  center_: V = new V();
  lastScore = -1;
  scoreTime = 0;

  constructor(diff: number) {
    super({ map: levelMapData, settFadeByDistance: true });
    colorBg(diff == 0 ? 245 : 260);
    this.player = new Player(this, diff);
    this.adjustRooms(this.mapData.start);
    const startRoom = this.rooms.get(this.mapData.start);
    this.player.phys.position.setv(roomCenter(startRoom));
    this.center_.setv(this.player.phys.position.c());
    this.player.phys.room = startRoom.phys;
    this.addEntity(this.player);
    this.scoreboard = createText("", 20);
    this.graphics.addChild(this.scoreboard);
    this.settFadeByDistance = true;
  }

  update(delta: number) {
    this.scoreTime += delta;
    super.update(delta);

    if (this.player == null) {
      if (this.scoreboard) {
        this.graphics.removeChild(this.scoreboard);
        this.scoreboard = null;
      }
    } else {
      if (this.player.score != this.lastScore) {
        this.scoreTime = 0;
        this.scoreboard.text = "" + Math.floor(this.player.score);
        this.lastScore = this.player.score;
      }
      this.scoreboard.scale.x = this.scoreboard.scale.y = Math.max(
        1,
        1.5 - this.scoreTime
      );
      this.scoreboard.position.set(
        app.renderer.width - this.scoreboard.width - 10,
        10
      );
    }
  }

  createLife(r: Room, v: V) {
    const distance = this.player.distance;
    const diff = this.player.diff;

    /*
    let score = randRange(0, 10);
    let mine: Entity;
    do {
      if ((score -= 2) < 0) {
        mine = new Jellyfish();
        break;
      }
      if ((score -= 2) < 0 && r.data.spawns.length > 1) {
        mine = new BigJellyfish();
        break;
      }
      if ((score -= 2) < 0) {
        mine = new Minnow(diff);
        break;
      }
      mine = new Guppy(diff);
    } while (false);
    */

    let score = randRange(0, distance);
    let mine: Entity;
    do {
      if (
        (score -=
          20 *
          Math.pow(
            Math.max(Math.cos(((distance + 1.5) / 20) * 2 * Math.PI), 0),
            2
          )) < 0
      ) {
        mine = new Star(diff);
        break;
      }
      if ((score -= 20) < 0) {
        mine = new Guppy(diff);
        break;
      }
      if ((score -= 10) < 0) {
        mine = new Jellyfish();
        break;
      }
      if ((score -= 20) < 0) {
        mine = new Guppy(diff);
        break;
      }
      if ((score -= 10) < 0 && r.data.spawns.length > 1) {
        mine = new BigJellyfish();
        break;
      }
      if ((score -= 10) < 0) {
        mine = new Guppy(diff);
        break;
      }
      mine = new Minnow(diff);
    } while (false);

    mine.phys.room = r.phys;
    mine.phys.position.setv(v);
    this.addEntity(mine);
  }

  center() {
    if (this.player != null) {
      this.center_.setv(this.player.phys.position.c());
    }
    return this.center_;
  }

  getPlayer() {
    if (!this.player) return null;
    return this.player.phys;
  }

  clearPlayer() {
    this.player = null;
  }

  getMaxDist() {
    if (!this.player) return -1;
    return this.player.distance;
  }
}
