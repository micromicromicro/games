import { V, v0, vpool } from "./math";
import { between } from "./help";

export interface PhysListener<T> {
  getRoom(context: T, roomId: string): PhysRoom<T>;
}

export interface PhysEntityListener<T> {
  changedRoom(context: T);
  handle(context: T, other: PhysCirc<T> | PhysWall);
}

let ids = 0;
export class PhysCirc<T> {
  id: number = ids++;
  radius: number = 1;
  mass: number = 1;
  position: V = new V();
  vel: V = new V();
  acc: V = new V();
  restitution: number = 0;
  listener: PhysEntityListener<T>;
  room: PhysRoom<T>;
  data: any;

  evel: V = new V();
  evel_dirty: boolean = true;
  get_evel(deltaTime: number, atime: number) {
    if (this.evel_dirty) {
      this.evel.x = this.vel.x * deltaTime + this.acc.x * atime;
      this.evel.y = this.vel.y * deltaTime + this.acc.y * atime;
      this.evel_dirty = false;
    }
    return this.evel;
  }
}

export class PhysWall {
  start: V = new V();
  extent: V = new V();
}

export class PhysDoor extends PhysWall {
  other: string;
}

export class PhysRoom<T> {
  id: string;
  elements: Set<PhysCirc<T>> = new Set();
  walls: Array<PhysWall> = [];
  doors: Array<PhysDoor> = [];
  data: any;

  traceWalls(context: T, phys: Physics<T>, start: V, vect: V): PhysWall {
    let room: PhysRoom<T> = this;
    let lastRoom: string;
    const consNorm = vpool.take();
    const transNorm = vpool.take();
    try {
      const consLen = vect.c().len();
      consNorm.setv(vect.c().descale(consLen));
      transNorm.setv(consNorm.c().r90());
      const transStart = transNorm.c().dot(start.c());
      const consStart = consNorm.c().dot(start.c());
      const test = (w: PhysWall) => {
        const wallStart = transNorm.c().dot(w.start.c());
        const wallSpan = transNorm.c().dot(w.extent.c());
        const wallEnd = wallStart + wallSpan;
        if (wallStart < transStart == wallEnd < transStart) return false;
        const hitTime = (transStart - wallStart) / wallSpan;
        const dist =
          consNorm.c().dot(w.start.c().add(w.extent.c().scale(hitTime))) -
          consStart;
        if (dist < 0 || dist > consLen) return false;
        return true;
      };
      while (true) {
        const hit = room.walls.find(test);
        if (hit != null) return hit;
        const door = room.doors.find(d => d.other != lastRoom && test(d));
        if (door == null) return null;
        lastRoom = room.id;
        room = phys.listener.getRoom(context, door.other);
        if (!room) return null;
      }
    } finally {
      transNorm.release();
      start.release();
      vect.release();
    }
  }
}

class CircleLineCollision {
  trans_evel: number;
}

export class Physics<T> {
  rooms: Map<String, PhysRoom<T>> = new Map();
  listener: PhysListener<T>;

  constructor(listener: PhysListener<T>) {
    this.listener = listener;
  }

  update(context: T, deltaTime: number, passes: number) {
    const atime = 0.5 * deltaTime * deltaTime;
    const collide_circle_line = ({
      cons_norm,
      trans_norm,
      e1pos,
      e1evel,
      e1r = null,
      ws,
      we
    }: {
      cons_norm: V;
      trans_norm: V;
      e1pos: V;
      e1evel: V;
      e1r?: number;
      ws: V;
      we: V;
    }) => {
      const trans_wall = trans_norm.c().dot(ws.c());
      const trans_start = trans_norm.c().dot(e1pos.c());
      const trans_vel = trans_norm.c().dot(e1evel.c());
      let time: number;
      if (e1r == null) {
        time = (trans_wall - trans_start) / trans_vel;
      } else {
        const t1 = (trans_wall - e1r - trans_start) / trans_vel;
        const t2 = (trans_wall + e1r - trans_start) / trans_vel;
        if (Math.abs(t1) < Math.abs(t2)) time = t1;
        else time = t2;
      }
      if (time < 0 || time > 1) return null;
      const cons_wall = cons_norm.c().dot(ws.c());
      const cons_wall_end = cons_wall + cons_norm.c().dot(we.c());
      const cons_start = cons_norm.c().dot(e1pos.c());
      const cons_vel = cons_norm.c().dot(e1evel.c());
      const cons = cons_start + cons_vel * time;
      if (!between(cons_wall, cons, cons_wall_end)) return null;
      const out = new CircleLineCollision();
      out.trans_evel = trans_vel;
      return out;
    };

    for (let [id, room] of this.rooms) {
      for (let e1 of room.elements) {
        e1.evel_dirty = true;
      }
    }

    const traversedDoors = new Set<String>();
    for (let iter = 0; iter < passes; ++iter) {
      let collided = false;
      const seenECollPairs = {};
      const hashEPair = (...keys: Array<PhysCirc<T>>) => {
        return JSON.stringify(keys.map(k => k.id));
      };
      const hashERPair = (e: PhysCirc<T>, r: string) => {
        return JSON.stringify([e.id, r]);
      };
      const collide_circles = (
        e1pos: V,
        e1evel: V,
        e1r: number,
        e2pos: V,
        e2evel: V,
        e2r: number,
        out_edv: V
      ) => {
        if (
          Math.abs(e1pos.x - e2pos.x) + e1r + e2r >
            Math.abs(e1evel.x - e2evel.x) ||
          Math.abs(e1pos.y - e2pos.y) + e1r + e2r >
            Math.abs(e1evel.y - e2evel.y)
        )
          return null;
        const edp = vpool.take();
        try {
          edp.setv(e2pos.c().sub(e1pos.c()));
          out_edv.setv(e1evel.c().sub(e2evel.c()));
          const edv_len2 = out_edv.c().len2();
          if (edv_len2 < 0.00001) return null;
          const rs = e1r + e2r;
          const term1 = (edp.x * out_edv.x + edp.y * out_edv.y) / edv_len2;
          const term2a =
            -Math.pow(edp.x, 2) * Math.pow(out_edv.y, 2) +
            2 * edp.x * edp.y * out_edv.x * out_edv.y -
            Math.pow(edp.y, 2) * Math.pow(out_edv.x, 2) +
            Math.pow(out_edv.x, 2) * Math.pow(rs, 2) +
            Math.pow(out_edv.y, 2) * Math.pow(rs, 2);
          if (term2a < 0) return null;
          const term2 = Math.sqrt(term2a) / edv_len2;
          const time = Math.min(term1 + term2, term1 - term2);
          if (time > 1) return null;
          if (time < 0) return null;
          return time;
        } finally {
          edp.release();
        }
      };
      const massratio = (e1: PhysCirc<T>, e2: PhysCirc<T>) => {
        let e1portion: number;
        let e2portion: number;
        if (e1.mass == null) {
          e1portion = 0;
          e2portion = 1;
        } else if (e2.mass == null) {
          e1portion = 1;
          e2portion = 0;
        } else if (e1.mass == 0 && e2.mass == 0) {
          e1portion = 0.5;
          e2portion = 0.5;
        } else if (e1.mass == 0) {
          e1portion = 1;
          e2portion = 0;
        } else if (e2.mass == 0) {
          e1portion = 0;
          e2portion = 1;
        } else {
          const mtotal = e1.mass + e2.mass;
          e2portion = e1.mass / mtotal;
          e1portion = e2.mass / mtotal;
        }
        return { e1portion, e2portion };
      };
      const do_room_elements = (e1: PhysCirc<T>, room: PhysRoom<T>) => {
        for (let e2 of room.elements) {
          if (e1 == e2) continue;
          const phash = hashEPair(e1, e2);
          const _seen = seenECollPairs[phash];
          if (_seen != null) continue;
          seenECollPairs[phash] = 1;

          if (
            Math.abs(e1.position.x - e2.position.x) >
              Math.abs(
                e1.vel.x * deltaTime +
                  e1.acc.x * atime -
                  (e2.vel.x * deltaTime + e2.acc.x * atime)
              ) +
                e1.radius +
                e2.radius ||
            Math.abs(e1.position.y - e2.position.y) >
              Math.abs(
                e1.vel.y * deltaTime +
                  e1.acc.y * atime -
                  (e2.vel.y * deltaTime + e2.acc.y * atime)
              ) +
                e1.radius +
                e2.radius
          ) {
            continue;
          }

          // Dynamic overlap
          do {
            const edv = vpool.take();
            try {
              const time = collide_circles(
                e1.position,
                e1.get_evel(deltaTime, atime),
                e1.radius,
                e2.position,
                e2.get_evel(deltaTime, atime),
                e2.radius,
                edv
              );
              if (time == null) break;
              const e1_at = vpool.take();
              const e2_at = vpool.take();
              const sepnorm = vpool.take();
              try {
                e1_at.setv(
                  e1.position.c().add(
                    e1
                      .get_evel(deltaTime, atime)
                      .c()
                      .scale(time)
                  )
                );
                e2_at.setv(
                  e2.position.c().add(
                    e2
                      .get_evel(deltaTime, atime)
                      .c()
                      .scale(time)
                  )
                );
                sepnorm.setv(
                  e2_at
                    .c()
                    .sub(e1_at.c())
                    .norm()
                );
                const overlap = sepnorm.c().dot(edv.c());
                if (overlap < 0.001) break;
                const erest = 1 + Math.max(e1.restitution, e2.restitution);
                const { e1portion, e2portion } = massratio(e1, e2);
                e1.vel.setv(
                  e1.vel
                    .c()
                    .sub(
                      sepnorm.c().scale(overlap * erest * e1portion / deltaTime)
                    )
                );
                e1.evel_dirty = true;
                e2.vel.setv(
                  e2.vel
                    .c()
                    .add(
                      sepnorm.c().scale(overlap * erest * e2portion / deltaTime)
                    )
                );
                e2.evel_dirty = true;
                if (e1.listener) e1.listener.handle(context, e2);
                if (e2.listener) e2.listener.handle(context, e1);
              } finally {
                e1_at.release();
                e2_at.release();
                sepnorm.release();
              }
            } finally {
              edv.release();
            }
          } while (false);

          // Static overlap
          do {
            const sep = vpool.take();
            try {
              sep.setv(e2.position.c().sub(e1.position.c()));
              const dist = sep.c().len();
              const radsum = e1.radius + e2.radius;
              if (dist < 0.0001) {
                e1.position.set(e1.position.x - radsum / 0.51, e1.position.y);
                e2.position.set(e2.position.x + radsum / 0.51, e2.position.y);
              } else {
                if (dist > radsum) break;
                const { e1portion, e2portion } = massratio(e1, e2);
                const needSep = (radsum - dist) / dist;
                e1.position.setv(
                  e1.position.c().sub(sep.c().scale(e1portion * needSep))
                );
                e2.position.setv(
                  e2.position.c().add(sep.c().scale(e2portion * needSep))
                );
              }
              if (e1.listener) e1.listener.handle(context, e2);
              if (e2.listener) e2.listener.handle(context, e1);
            } finally {
              sep.release();
            }
          } while (false);
        }
      };

      const do_room_walls = (e1: PhysCirc<T>, room: PhysRoom<T>) => {
        for (let wall of room.walls) {
          const cons_norm = wall.extent.c().norm();
          const trans_norm = wall.extent
            .c()
            .r90()
            .norm();
          try {
            // Dynamic collide line
            do {
              const evel = e1.get_evel(deltaTime, atime);
              const collision = collide_circle_line({
                cons_norm: cons_norm,
                trans_norm: trans_norm,
                e1pos: e1.position,
                e1evel: evel,
                e1r: e1.radius,
                ws: wall.start,
                we: wall.extent
              });
              if (collision == null) break;
              collided = true;
              e1.vel.setv(
                e1.vel
                  .c()
                  .sub(
                    trans_norm
                      .c()
                      .scale(
                        collision.trans_evel * (1 + e1.restitution) / deltaTime
                      )
                  )
              );
              e1.evel_dirty = true;
              if (e1.listener) e1.listener.handle(context, wall);
            } while (false);

            // Dynamic collide corners
            {
              const edv = vpool.take();
              const e1_at = vpool.take();
              const sep = vpool.take();
              const fix_point = (p: V) => {
                try {
                  const time = collide_circles(
                    e1.position.c(),
                    e1.get_evel(deltaTime, atime),
                    e1.radius,
                    p.c(),
                    v0.c(),
                    0,
                    edv
                  );
                  if (time == null) return;
                  e1_at.setv(e1.position.c().add(edv.c().scale(time)));
                  sep.setv(
                    p
                      .c()
                      .sub(e1_at.c())
                      .norm()
                  );
                  const overlap = sep.c().dot(edv.c());
                  if (overlap < 0.001) return;
                  collided = true;
                  e1.vel.setv(
                    e1.vel
                      .c()
                      .sub(
                        sep
                          .c()
                          .scale(overlap * (1 + e1.restitution) / deltaTime)
                      )
                  );
                  e1.evel_dirty = true;
                  if (e1.listener) e1.listener.handle(context, wall);
                } finally {
                  p.release();
                }
              };
              try {
                fix_point(wall.start.c());
                fix_point(wall.start.c().add(wall.extent.c()));
              } finally {
                edv.release();
                e1_at.release();
                sep.release();
              }
            }

            // Static collide line
            do {
              const cons_point = cons_norm.c().dot(e1.position.c());
              const cons_wall = cons_norm.c().dot(wall.start.c());
              const cons_wall_end = cons_norm
                .c()
                .dot(wall.start.c().add(wall.extent.c()));
              if (cons_point < cons_wall || cons_point >= cons_wall_end) break;
              const trans_wall = trans_norm.c().dot(wall.start.c());
              const trans_point = trans_norm.c().dot(e1.position.c());
              const dist = trans_point - trans_wall;
              let neg = 1;
              if (dist < 0) neg = -1;
              if (dist * neg > e1.radius) break;
              collided = true;
              e1.position.setv(
                e1.position
                  .c()
                  .add(trans_norm.c().scale(neg * (e1.radius - dist * neg)))
              );
              if (e1.listener) e1.listener.handle(context, wall);
            } while (false);

            // Static collide points
            {
              const fix_point = (p: V) => {
                const sep = vpool.take();
                try {
                  sep.setv(p.c().sub(e1.position.c()));
                  const len = sep.c().len();
                  if (len >= e1.radius) return;
                  collided = true;
                  e1.position.setv(
                    e1.position.c().sub(sep.c().scale(e1.radius / len - 1))
                  );
                  if (e1.listener) e1.listener.handle(context, wall);
                } finally {
                  sep.release();
                  p.release();
                }
              };
              fix_point(wall.start.c());
              fix_point(wall.start.c().add(wall.extent.c()));
            }
          } finally {
            cons_norm.release();
            trans_norm.release();
          }
        }
      };

      const seenOthers = new Set<string>();
      for (let [id, room] of this.rooms) {
        for (let e1 of room.elements) {
          // Do collisions
          do_room_elements(e1, room);
          seenOthers.clear();
          for (let door of room.doors) {
            if (seenOthers.has(door.other)) continue;
            seenOthers.add(door.other);
            const otherSide = this.listener.getRoom(context, door.other);
            if (!otherSide) continue;
            do_room_elements(e1, otherSide);
            // TODO recurse until all room nodes > some radius away?
          }
          do_room_walls(e1, room);
          seenOthers.clear();
          for (let door of room.doors) {
            if (seenOthers.has(door.other)) continue;
            seenOthers.add(door.other);
            const otherSide = this.listener.getRoom(context, door.other);
            if (!otherSide) continue;
            do_room_walls(e1, otherSide);
          }

          // Identify door transversals
          traversedDoors.add(hashERPair(e1, room.id)); // Block travelling back to this room
          for (let door of room.doors) {
            const phash = hashERPair(e1, door.other);
            if (traversedDoors.has(phash)) continue;
            const cons_norm = door.extent.c().norm();
            const trans_norm = door.extent
              .c()
              .r90()
              .norm();
            const e_vel = e1.get_evel(deltaTime, atime);
            try {
              const collision = collide_circle_line({
                cons_norm: cons_norm,
                trans_norm: trans_norm,
                e1pos: e1.position,
                e1evel: e_vel,
                ws: door.start,
                we: door.extent
              });
              if (collision == null) continue;
              collided = true;
              const otherRoom = this.listener.getRoom(context, door.other);
              e1.room = otherRoom;
              room.elements.delete(e1);
              e1.listener.changedRoom(context);
              if (otherRoom) {
                otherRoom.elements.add(e1);
              }
              break;
            } finally {
              cons_norm.release();
              trans_norm.release();
            }
          }
        }
      }

      if (!collided) break;
    }

    // Update positions
    for (let [id, room] of this.rooms) {
      for (let e1 of room.elements) {
        const e_vel = e1.get_evel(deltaTime, atime);
        e1.position.setv(e1.position.c().add(e_vel.c()));
        e1.vel.setv(e1.vel.c().add(e1.acc.c().scale(deltaTime)));
        e1.evel_dirty = true;
      }
    }
  }
}
