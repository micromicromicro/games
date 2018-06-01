import { Entity, SimLayer } from "./layersim";
import { PhysCirc } from "./physics";
import { V, v0, vpool } from "./math";
import { randChoose, randNormish } from "./help";

export class AIEntity extends Entity {
  phys: PhysCirc<SimLayer>;
  settMaxSpeed: number;
  settAcc: number;
  settVisibleRange: number = Math.pow(500, 2);
  lowUpdateTime = 0;

  lastRoom: string = null;

  constructor() {
    super();
    this.phys = new PhysCirc();
    this.phys.mass = 1;
    this.phys.restitution = 1;
    this.phys.data = this;
    this.aiNextUpdate = 1;
  }

  checkPlayerVisible(context: SimLayer) {
    const player = context.getPlayer();
    if (!player) return false;
    const vect = vpool.take();
    try {
      vect.setv(player.position.c().sub(this.phys.position.c()));
      if (vect.c().len2() > this.settVisibleRange) return false;
      const trace = this.phys.room.traceWalls(
        context,
        context.phys,
        this.phys.position.c(),
        vect.c()
      );
      if (trace != null) return false;
      return true;
    } finally {
      vect.release();
    }
  }

  aimAtDoor(context: SimLayer) {
    // Choose a new random exit to aim for
    let nextDoor = randChoose(
      this.phys.room.doors.filter(
        r =>
          r.other != this.lastRoom &&
          context.rooms.has(r.other) &&
          r.extent.c().len() > this.phys.radius * 2.1 &&
          (this.phys.radius < 10 ||
            context.rooms.get(r.other).data.spawns.length > 1)
      )
    );
    if (nextDoor == null) nextDoor = this.phys.room.doors[0];
    if (nextDoor != null) {
      this.lastRoom = this.phys.room.id;
      return nextDoor.start
        .c()
        .add(nextDoor.extent.c().scale(randNormish(0.5, 0.5, 5)));
    } else {
      this.lastRoom = null;
      return this.phys.position.c();
    }
  }

  /**
   * Return a vector along v which is weaker with greater distance (proportional to radius and acceleration)
   * @param v Vector to push along; must be unit if distance provided
   * @param d Distance to invert; determined from v if not present
   */
  invertDistance(v: V, r: number, d?: number): V {
    try {
      if (d == null) {
        d = v.c().len();
        v = v.descale(d);
      }
      if (d < 0.001) return v0;
      return v.c().scale(this.settAcc / Math.pow(d / (2 * r), 2));
    } finally {
      v.release();
    }
  }

  navigateAbsolute(goal: V) {
    this.phys.acc.setv(
      goal
        .sub(this.phys.position.c())
        .norm()
        .scale(this.settAcc)
    );
  }

  navigateRelative(goal: V) {
    const capped = goal.cap(this.settAcc);
    this.phys.acc.setv(capped);
  }

  lowUpdate() {}

  update(context: SimLayer, delta: number) {
    this.lowUpdateTime += delta;
    if (this.lowUpdateTime > 0.05) {
      this.lowUpdate();
      this.lowUpdateTime -= 0.05;
    }
    this.phys.vel.setv(this.phys.vel.c().cap(this.settMaxSpeed));
  }

  postUpdate(delta: number) {
    this.graphics.position.set(this.phys.position.x, this.phys.position.y);
  }
}
