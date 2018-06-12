import * as pixi from "pixi.js";
import { SimLayer, Room } from "./layersim";
import { map as demoMapData } from "./demo";
import { V, vpool, v0 } from "./math";
import { randChoose } from "./help";
import { Guppy } from "./entityguppy";
import { Star } from "./entitystar";
import { colorBg } from "./globals";

const demoCenter = new V().set(200, 200);

export class DemoLayer extends SimLayer {
  constructor() {
    super({ map: demoMapData, settSpawn: false, settFadeByDistance: false });
    colorBg(260);
    this.adjustRooms(this.mapData.start);
    const allSpawns: Array<[Room, V]> = [];
    this.rooms.forEach((r, k) =>
      this.mapData.rooms[k.toString()].spawns.forEach(s =>
        allSpawns.push([r, new V().set(s[0], s[1])])
      )
    );
    try {
      for (let i = 0; i < 8; ++i) {
        const spawn = randChoose(allSpawns);
        this.createLife(spawn[0], spawn[1].c());
      }
    } finally {
      allSpawns.forEach(s => s[1].release());
    }
  }

  createLife(r: Room, v: V) {
    const mine = new Guppy(1);
    mine.phys.room = r.phys;
    mine.phys.position.setv(v);
    this.addEntity(mine);
  }

  center() {
    return demoCenter;
  }

  getPlayer() {
    return null;
  }

  clearPlayer() {}

  getMaxDist() {
    return -1;
  }
}
