import * as pixi from "pixi.js";
import { SimLayer, Room, Entity, roomCenter } from "./layersim";
import { map as levelMapData } from "./level";
import { V, v0, vpool } from "./math";
import { randChoose, randRange } from "./help";
import { app } from "./globals";
import { createText } from "./pixihelp";
import { Player } from "./player";
import { Guppy } from "./entityguppy";
import { Minnow } from "./entityminnow";
import { Jellyfish, BigJellyfish } from "./entityjellies";

export class GameLayer extends SimLayer {
  scoreboard: pixi.Text;
  player: Player;
  center_: V = new V();

  constructor(diff: number) {
    super({ map: levelMapData, settFadeByDistance: true });
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
    super.update(delta);

    if (this.player == null) {
      if (this.scoreboard) {
        this.graphics.removeChild(this.scoreboard);
        this.scoreboard = null;
      }
    } else {
      this.center_.setv(this.player.phys.position.c());
      this.scoreboard.text = "" + Math.floor(this.player.score);
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
    return this.center_;
  }

  getPlayer() {
    if (!this.player) return null;
    return this.player.phys;
  }

  clearPlayer() {
    this.player = null;
  }
}
