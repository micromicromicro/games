import { Pool } from "./help";

export class V {
  x: number = 0;
  y: number = 0;

  c(): V {
    return vpool.take().set(this.x, this.y);
  }

  unpool(): V {
    return new V().set(this.x, this.y);
  }

  release() {
    vpool.release(this);
  }

  set(x: number, y: number): V {
    this.x = x;
    this.y = y;
    return this;
  }

  setv(v: V): V {
    this.x = v.x;
    this.y = v.y;
    v.release();
    return this;
  }

  seta(r: number, l: number): V {
    this.x = Math.cos(r) * l;
    this.y = Math.sin(r) * l;
    return this;
  }

  scale(v: number): V {
    const out = vpool.take().set(this.x * v, this.y * v);
    this.release();
    return out;
  }

  descale(v: number): V {
    const out = vpool.take().set(this.x / v, this.y / v);
    this.release();
    return out;
  }

  add(v: V): V {
    const out = vpool.take().set(this.x + v.x, this.y + v.y);
    this.release();
    v.release();
    return out;
  }

  addXY(x: number, y: number): V {
    this.x += x;
    this.y += y;
    return this;
  }

  sub(v: V): V {
    const out = vpool.take().set(this.x - v.x, this.y - v.y);
    this.release();
    v.release();
    return out;
  }

  dot(v: V): number {
    const out = this.x * v.x + this.y * v.y;
    this.release();
    v.release();
    return out;
  }

  len(): number {
    return Math.sqrt(this.len2());
  }

  len2(): number {
    const out = Math.pow(this.x, 2) + Math.pow(this.y, 2);
    this.release();
    return out;
  }

  cap(max: number): V {
    const l = this.c().len();
    if (l <= max) return this;
    return this.scale(max / l);
  }

  norm(): V {
    const len = this.c().len();
    const out: V = vpool.take();
    if (len < 0.00000001) {
      out.set(1, 0);
    } else {
      out.set(this.x / len, this.y / len);
    }
    this.release();
    return out;
  }

  normTry(): V {
    const len = this.c().len();
    const out: V = vpool.take();
    if (len < 0.001) {
      out.set(0, 0);
    } else {
      out.set(this.x / len, this.y / len);
    }
    this.release();
    return out;
  }

  rev(): V {
    const out = vpool.take().set(-this.x, -this.y);
    this.release();
    return out;
  }

  /**
   * Counter clockwise
   */
  r90(): V {
    const out = vpool.take().set(-this.y, this.x);
    this.release();
    return out;
  }
}

class V0 extends V {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
  }

  release() {}

  set(x: number, y: number): V {
    throw new Error("Trying to set v0");
  }

  setv(v: V): V {
    throw new Error("Trying to set v0");
  }

  seta(a: number, l: number): V {
    throw new Error("Trying to set v0");
  }
}

export const v0 = new V0();

export const vpool = new Pool(V);
