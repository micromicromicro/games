export type roomType = {
  distance: number;
  spawns: Array<[number, number]>;
  walls: [number, number, number, number];
  doors: [string, number, number, number, number];
};

export type mapType = {
  start: string;
  rooms: {
    [s: string]: roomType;
  };
};
