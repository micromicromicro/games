export const pmod = (v: number, n: number): number => {
  return (v % n + n) % n;
};

/**
 * True if test between start and end. Start and end can be unordered
 * @param start one end
 * @param test value to test if is between start/end
 * @param end other end
 */
export const between = (start: number, test: number, end: number): boolean => {
  return test >= start == test < end;
};

export class Pool<T> {
  alloc: new () => T;
  poolfree: Array<T> = [];

  constructor(alloc: new () => T) {
    this.alloc = alloc;
  }

  take(): T {
    let out = this.poolfree.pop();
    if (out == null) {
      out = new this.alloc();
    }
    return out;
  }

  release(v: T) {
    //if (this.poolfree.indexOf(v) != -1) throw new Error("Double release");
    this.poolfree.push(v);
  }
}

export const randChoose = <T>(a: Array<T>): T => {
  if (a.length == 0) return null;
  return a[Math.floor(Math.random() * a.length)];
};

export const randRange = (low: number, high: number): number => {
  return Math.random() * (high - low) + low;
};

export const randNormish = (
  center: number,
  range: number,
  samples: number
): number => {
  let run_total = 0; // in range 0 - nsamples
  for (let i = 0; i < samples; i++) run_total += Math.random();
  return center + range * (run_total - samples / 2) / (samples / 2);
};
