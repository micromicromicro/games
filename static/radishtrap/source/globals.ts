import * as pixi from "pixi.js";
import { hsv2rgb } from "./pixihelp";
import { V } from "./math";

export let app: PIXI.Application;
{
  const body = document.getElementsByTagName("body").item(0);
  const ratio = body.clientWidth / body.clientHeight;
  app = new PIXI.Application({
    width: 640 * ratio,
    height: 640
  });
}
const appBg = new pixi.Graphics();
appBg.beginFill(hsv2rgb(260, 0.4, 0.2), 1);
appBg.moveTo(-app.renderer.width, -app.renderer.height);
appBg.lineTo(app.renderer.width, -app.renderer.height);
appBg.lineTo(app.renderer.width, app.renderer.height);
appBg.lineTo(-app.renderer.width, app.renderer.height);
appBg.endFill();
app.stage.addChild(appBg);

Array.prototype.forEach.call(
  document.getElementsByClassName("_view_tag"),
  (e: Element) => {
    e.remove();
  }
);
app.view.classList.add("_view_tag");
document.body.appendChild(app.view);

const keystate = {};
document.onkeydown = e => {
  keystate[e.key] = true;
};
document.onkeyup = e => {
  keystate[e.key] = false;
};
export const key_left = () => keystate["ArrowLeft"];
export const key_right = () => keystate["ArrowRight"];
export const key_up = () => keystate["ArrowUp"];
export const key_down = () => keystate["ArrowDown"];
export const key_enter = () => keystate["Enter"];
export const key_space = () => keystate["Space"];
export const key_escape = () => keystate["Escape"];
export const touches: Map<number | null, V> = new Map();

app.stage.interactive = true;
app.stage.on("pointerdown", (e: pixi.interaction.InteractionEvent) => {
  if (e.data.pointerType == "mouse") {
    const found = touches.get(e.data.identifier);
    if (found) {
      touches.delete(e.data.identifier);
      return;
    }
  }
  touches.set(e.data.identifier, new V().set(e.data.global.x, e.data.global.y));
});
app.stage.on("pointermove", (e: pixi.interaction.InteractionEvent) => {
  const found = touches.get(e.data.identifier);
  if (!found) return;
  found.set(e.data.global.x, e.data.global.y);
});
const pointerup = (e: pixi.interaction.InteractionEvent) => {
  if (e.data.pointerType == "mouse") return;
  touches.delete(e.data.identifier);
};
app.stage.on("pointerup", pointerup);
app.stage.on("pointerupoutside", pointerup);
