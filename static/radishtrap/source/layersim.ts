import * as pixi from "pixi.js";
import { randChoose, randRange } from "./help";
import { app } from "./globals";
import { hsv2rgb, createText } from "./pixihelp";
import { V, v0, vpool } from "./math";
import { Physics, PhysCirc, PhysRoom, PhysWall, PhysDoor } from "./physics";
import { Layer } from "./layer";
import { Background } from "./background";
import { roomType, mapType } from "./maptype";

export abstract class Entity {
  phys: PhysCirc<SimLayer>;
  graphics: pixi.Container = new pixi.Container();
  aiNextUpdate: number;

  destroy(context: SimLayer) {
    context.removeEntity(this);
    this.graphics.destroy();
  }

  aiUpdate(context: SimLayer, now: number) {}
  update(context: SimLayer, delta: number) {}
  postUpdate(delta: number) {}
}

export const rotateToPhys = (e: Entity, g: pixi.DisplayObject) => {
  if (Math.abs(e.phys.vel.y) < 0.001 && Math.abs(e.phys.vel.x) < 0.001) return;
  g.rotation = Math.atan2(e.phys.vel.y, e.phys.vel.x);
};

export class RoomDoor {
  start: V;
  end: V;
  other: string;

  constructor(start: V, end: V, other: string) {
    this.start = start;
    this.end = end;
    this.other = other;
  }
}

export class Room {
  data: roomType;
  phys: PhysRoom<SimLayer> = new PhysRoom<SimLayer>();
  graphics: pixi.Container = new pixi.Container();
  lines: pixi.Graphics = new pixi.Graphics();
  distIndicator: pixi.Graphics = new pixi.Graphics();

  constructor(id: string, data: roomType) {
    this.data = data;
    this.phys.id = id;
    this.phys.data = this;
    if (data.spawns.length > 0) {
      const distLabel = createText("" + (this.data.distance + 1), 28);
      distLabel.alpha = 0.2;
      distLabel.position.set(
        data.spawns[0][0] - distLabel.width / 2,
        data.spawns[0][1] - distLabel.height / 2
      );
      this.graphics.addChild(distLabel);

      this.distIndicator.lineStyle(1, hsv2rgb(0, 0, 1), 0.2);
      this.distIndicator.arc(0, 0, 20, 0, 2 * Math.PI);
      this.distIndicator.position.set(
        data.spawns[0][0] - distLabel.width / 2,
        data.spawns[0][1] - distLabel.height / 2
      );
      this.graphics.addChild(this.distIndicator);
    }
    this.graphics.addChild(this.lines);
    this.lines.lineStyle(1, pixi.utils.rgb2hex([0.8, 0.4, 0.6]), 1);
    this.phys.doors = data.doors.map(d => {
      const door = new PhysDoor();
      door.start.set(d[1], d[2]);
      door.extent.set(d[3], d[4]);
      door.other = d[0];
      return door;
    });
    this.lines.lineStyle(
      1,
      hsv2rgb(((this.data.distance / 50 + 0.7) % 1) * 360, 0.8, 0.8),
      1
    );
    data.walls.forEach(w => {
      const wall = new PhysWall();
      wall.start.set(w[0], w[1]);
      wall.extent.set(w[2], w[3]);
      this.phys.walls.push(wall);
      this.lines.moveTo(w[0], w[1]);
      this.lines.lineTo(w[0] + w[2], w[1] + w[3]);
    });
  }
}

export const roomCenter = (r: Room) => {
  let sum = vpool.take().set(0, 0);
  let sumCount = 0;
  r.phys.walls.forEach(w => {
    sum = sum.add(w.start.c());
    sum = sum.add(w.start.c().add(w.extent.c()));
    sumCount += 2;
  });
  r.phys.doors.forEach(w => {
    sum = sum.add(w.start.c());
    sum = sum.add(w.start.c().add(w.extent.c()));
    sumCount += 2;
  });
  return sum.descale(sumCount);
};

export abstract class SimLayer extends Layer {
  world: pixi.Container;
  phys: Physics<SimLayer>;
  bg: Background;
  aiQueue: Array<Entity>;
  rooms: Map<String, Room>;
  entities: Set<Entity>;
  mapData: mapType;
  settSpawn: boolean;
  settFadeByDistance: boolean;

  constructor({
    map,
    settSpawn = true,
    settFadeByDistance = false
  }: {
    map: mapType;
    settSpawn?: boolean;
    settFadeByDistance?: boolean;
  }) {
    super();
    this.settSpawn = settSpawn;

    this.entities = new Set();

    this.aiQueue = [];

    this.graphics = new pixi.Container();

    this.world = new pixi.Container();

    this.mapData = map;
    this.rooms = new Map<String, Room>();

    this.bg = new Background();
    const this1 = this;
    this.phys = new Physics(
      new class {
        getRoom(context: SimLayer, roomId: string) {
          const found = this1.rooms.get(roomId);
          if (!found) return null;
          return found.phys;
        }
      }()
    );

    this.graphics.addChild(this.bg.graphics);
    this.graphics.addChild(this.world);
  }

  addEntity(e: Entity) {
    e.phys.room.elements.add(e.phys);
    this.world.addChild(e.graphics);
    if (e.aiNextUpdate != null) this.queueAiUpdate(e);
    this.entities.add(e);
  }

  removeEntity(e: Entity) {
    if (e.phys.room) {
      e.phys.room.elements.delete(e.phys);
      e.phys.room = null;
    }
    this.world.removeChild(e.graphics);
    this.aiQueue.splice(this.aiQueue.indexOf(e), 1);
    this.entities.delete(e);
  }

  queueAiUpdate(e: Entity) {
    for (let i = 0; i < this.aiQueue.length; ++i) {
      if (this.aiQueue[i].aiNextUpdate > e.aiNextUpdate) {
        this.aiQueue.splice(i, 0, e);
        return;
      }
    }
    this.aiQueue.push(e);
  }

  buildRoom(id: string): Room {
    return new Room(id, this.mapData.rooms[id]);
  }

  adjustRooms(start: string) {
    const walkDist = 5;
    // DFS from start room to create new rooms at edges, collect still
    // nearby (reachable) rooms
    const newRooms = new Map<String, Room>();
    const priority = new Array<[string, number]>();
    const insert = (e: [string, number]) => {
      for (let i = 0; i < priority.length; ++i) {
        const comp = priority[i];
        if (comp[1] > e[1]) {
          priority.splice(i, 0, e);
          return;
        }
      }
      priority.push(e);
    };
    const take = () => {
      return priority.shift();
    };
    const step = () => {
      const [id, distance] = take();
      if (newRooms.has(id)) return;
      let room = this.rooms.get(id);
      if (!room) {
        // Expanding edge, create new room
        room = new Room(id, this.mapData.rooms[id]);
        this.phys.rooms.set(id, room.phys);
        this.world.addChild(room.graphics);

        if (this.settSpawn && id != this.mapData.start) {
          const spawn = Math.min(1, room.data.spawns.length - 1);
          for (let i = 0; i < spawn; ++i) {
            const spawnLoc = randChoose(room.data.spawns.slice(1));
            this.createLife(room, new V().set(spawnLoc[0], spawnLoc[1]));
          }
        }
      }
      if (this.settFadeByDistance)
        room.graphics.alpha = 1 - distance / walkDist;
      else room.graphics.alpha = 1;
      const player = this.getPlayer();
      if (room.data.distance <= this.getMaxDist()) {
        room.distIndicator.visible = false;
      }
      newRooms.set(id, room);
      if (distance >= walkDist) return;
      room.phys.doors.forEach(d => {
        if (newRooms.has(d.other)) return;
        insert([d.other, distance + 1]);
      });
    };

    priority.push([start, 0]);
    step();
    while (priority.length > 0) step();

    // Remove old rooms + entities within
    for (let e of this.entities) {
      if (newRooms.has(e.phys.room.id)) continue;
      e.destroy(this);
    }
    for (let [id, r] of this.rooms) {
      const stillExists = newRooms.get(id);
      if (stillExists) continue;
      this.phys.rooms.delete(id);
      this.world.removeChild(r.graphics);
    }

    this.rooms = newRooms;
  }

  abstract createLife(r: Room, v: V);
  abstract center(): V;
  abstract getPlayer(): PhysCirc<SimLayer>;
  abstract getMaxDist(): number;
  abstract clearPlayer();

  update(delta: number) {
    const now = Date.now();
    while (this.aiQueue.length > 0) {
      const aiNext = this.aiQueue[0];
      const scheduleTime = aiNext.aiNextUpdate;
      if (scheduleTime > now) break;
      this.aiQueue.shift();
      aiNext.aiUpdate(this, now);
      if (aiNext.aiNextUpdate == scheduleTime)
        throw new Error("AI update same time");
      if (aiNext.aiNextUpdate != null) this.queueAiUpdate(aiNext);
    }

    for (let e of this.entities) e.update(this, delta);
    this.phys.update(this, delta, 10);
    for (let e of this.entities) e.postUpdate(delta);

    const center = this.center();
    this.world.position.set(
      -center.x + app.renderer.width * 0.5,
      -center.y + app.renderer.height * 0.5
    );
    this.bg.draw(delta, center.c());
  }
}
