import * as pixi from "pixi.js";
import { pmod } from "./help";

export const rgb2num = (r: number, g: number, b: number): number => {
  return pixi.utils.rgb2hex([r, g, b]);
};

export const hsv2rgb = (h: number, s: number, v: number): number => {
  let r: number;
  let g: number;
  let b: number;
  const hh = pmod(h, 360) / 60;
  const i = Math.floor(hh);
  const ff = hh - i;
  const p = v * (1.0 - s);
  const q = v * (1.0 - s * ff);
  const t = v * (1.0 - s * (1.0 - ff));

  switch (i) {
    case 0:
      return rgb2num(v, t, p);
    case 1:
      return rgb2num(q, v, p);
    case 2:
      return rgb2num(p, v, t);
    case 3:
      return rgb2num(p, q, v);
    case 4:
      return rgb2num(t, p, v);
    case 5:
    default:
      return rgb2num(v, p, q);
  }
};

export const createText = (text: string, size: number) => {
  return new pixi.Text(text, {
    fontSize: size,
    fill: rgb2num(1, 1, 1)
  });
};

export const createHeadText = (text: string) => {
  return createText(text, 45);
};

export const createNoteText = (text: string) => {
  return createText(text, 20);
};
