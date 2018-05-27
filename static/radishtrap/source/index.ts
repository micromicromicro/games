import "babel-polyfill";
import * as pixi from "pixi.js";

import { myWs, AsyncWebsockets } from "./ws";
import { imgElement as qrMicroImgElement } from "micromicroqr";
import { Layer } from "./layer";
import { app, key_enter, key_escape, set_do_game_over } from "./globals";
import {
  rgb2num,
  createText,
  createHeadText,
  createNoteText
} from "./pixihelp";
import { setGuppyTexture } from "./entityguppy";
import { setMinnowTexture } from "./entityminnow";
import { setJellyTextures } from "./entityjellies";
import { DemoLayer } from "./layerdemo";
import { GameLayer } from "./layergame";

// Generate initial room

const createButtons = (
  left: [string, () => void],
  right: [string, () => void]
) => {
  const createInner = (b: [string, () => void]) => {
    const cont = new pixi.Container();
    const text = createText(b[0], 28);
    text.position.set(
      Math.floor(app.renderer.width / 4 - text.width / 2),
      Math.floor(50 - text.height / 2)
    );
    cont.addChild(text);
    const bg = new pixi.Graphics();
    cont.addChild(bg);
    cont.interactive = true;
    const drawBg = () => {
      bg.moveTo(0, 0);
      bg.lineTo(app.renderer.width / 2, 0);
      bg.lineTo(app.renderer.width / 2, 100);
      bg.lineTo(0, 100);
      bg.closePath();
    };
    cont.on("pointerover", () => {
      bg.clear();
      bg.beginFill(pixi.utils.rgb2hex([1, 1, 1]), 0.2);
      drawBg();
      bg.endFill();
    });
    cont.on("pointerout", () => {
      bg.clear();
      bg.beginFill(pixi.utils.rgb2hex([1, 1, 1]), 0);
      drawBg();
      bg.endFill();
    });
    cont.on("pointerdown", () => {
      bg.clear();
      bg.beginFill(pixi.utils.rgb2hex([1, 1, 1]), 0);
      drawBg();
      bg.endFill();
    });
    cont.on("pointerup", () => b[1]());
    bg.beginFill(pixi.utils.rgb2hex([1, 1, 1]), 0);
    drawBg();
    bg.endFill();
    return cont;
  };
  const cont = new pixi.Container();
  cont.position.y = app.renderer.height - 100;
  if (left) {
    const b = createInner(left);
    cont.addChild(b);
  }
  if (right) {
    const b = createInner(right);
    b.position.x = app.renderer.width / 2;
    cont.addChild(b);
  }
  const bg = new pixi.Graphics();
  bg.lineStyle(2, pixi.utils.rgb2hex([1, 1, 1]), 1);
  bg.moveTo(app.renderer.width / 2, 10);
  bg.lineTo(app.renderer.width / 2, 90);
  cont.addChild(bg);
  return cont;
};

class TitleLayer extends Layer {
  constructor(bg: Layer) {
    super();
    const title = createHeadText("RADISH TRAP");
    title.position.set(Math.min(50, title.position.x), 10);
    this.graphics.addChild(title);
    const price = createText("10¢ per play", 28);
    price.position.set(50, 70);
    this.graphics.addChild(price);
    const buttons = createButtons(
      [
        "kind of hard",
        () => {
          removeLayer(this);
          //addLayer(new CoinLayer(1, bg));
          addLayer(new GoLayer(1, bg));
        }
      ],
      [
        "normal",
        () => {
          removeLayer(this);
          //addLayer(new CoinLayer(0, bg));
          addLayer(new GoLayer(0, bg));
        }
      ]
    );
    this.graphics.addChild(buttons);
  }
}

class CoinLayer extends Layer {
  addrBody: any = null;
  addrBox: pixi.Container;
  bg: Layer;
  constructor(diff: number, bg: Layer) {
    super();
    this.bg = bg;
    (async () => {
      try {
        const ws: AsyncWebsockets = await myWs("ws://localhost:29231");
        ws.send({ game: "radish" });
        this.addrBody = (await ws.read()).address;
        const event = await ws.read();
        if (event.event == "paid") {
          removeLayer(this);
          addLayer(new GoLayer(diff, bg));
        }
      } catch (e) {
        console.log("Failed to get coin addr", e);
      }
    })();
    const title = createHeadText(diff == 0 ? "NORMAL" : "KIND OF HARD");
    title.position.set(Math.min(50, title.position.x), 50);
    this.graphics.addChild(title);
    const note = createNoteText("Play for 10¢ via micromicro");
    note.position.set(50, 110);
    this.graphics.addChild(note);
    this.graphics.addChild(createButtons(["< Back", () => this.back()], null));
    this.addrBox = new pixi.Container();
    this.addrBox.position.set(40, 140);
    const white = new pixi.Graphics();
    white.beginFill(rgb2num(1, 1, 1), 0.8);
    white.drawRect(0, 0, 400, 400);
    white.endFill();
    this.addrBox.addChild(white);
    this.graphics.addChild(this.addrBox);
  }

  back() {
    removeLayer(this);
    addLayer(new TitleLayer(this.bg));
  }

  update(delta: number) {
    if (key_escape()) {
      this.back();
      return;
    }
    if (this.addrBody != null) {
      const qr = qrMicroImgElement(this.addrBody, { enabled: false });
      qr.width = 380;
      qr.height = 380;
      window.setImmediate(() => {
        const sprite = pixi.Sprite.from(qr);
        sprite.width = 380;
        sprite.height = 380;
        sprite.position.set(10, 10);
        this.addrBox.addChild(sprite);
        this.addrBody = null;
      });
    }
  }
}

class GoLayer extends Layer {
  bg: Layer;
  diff: number;
  constructor(diff: number, bg: Layer) {
    super();
    this.diff = diff;
    this.bg = bg;
    const title = createHeadText("ARE YOU READY!");
    title.position.set(Math.min(50, title.position.x), 50);
    this.graphics.addChild(title);
    this.graphics.addChild(
      createButtons(["NO", () => this.back()], ["GO", () => this.go()])
    );
  }
  back() {
    removeLayer(this);
    addLayer(new TitleLayer(this.bg));
  }
  go() {
    removeLayer(this.bg);
    removeLayer(this);
    addLayer(new GameLayer(this.diff));
  }
  update(delta: number) {
    if (key_enter()) this.go();
    else if (key_escape()) this.back();
  }
}

class GameOverLayer extends Layer {
  diff: number;
  bg: GameLayer;
  constructor(bg: GameLayer, diff: number, score: number) {
    super();
    this.bg = bg;
    this.diff = diff;

    const scoreBox = new pixi.Container();
    this.graphics.addChild(scoreBox);
    const title = createHeadText("THE END");
    title.position.set(0, 0);
    scoreBox.addChild(title);
    const scoreLabel = createText("Score:", 28);
    scoreLabel.position.set(0, 70);
    scoreBox.addChild(scoreLabel);
    const scoreText = createText("" + Math.floor(score), 70);
    scoreText.position.set(100, 70);
    scoreBox.addChild(scoreText);
    scoreBox.position.set(
      app.renderer.width / 2 - scoreBox.width / 2,
      app.renderer.height / 2 - scoreBox.height / 2
    );

    const buttons = createButtons(
      ["title", () => this.back()],
      ["retry", () => this.go()]
    );
    this.graphics.addChild(buttons);
  }
  back() {
    removeLayer(this.bg);
    removeLayer(this);
    const demoLayer = new DemoLayer();
    addLayer(demoLayer);
    addLayer(new TitleLayer(demoLayer));
  }
  go() {
    removeLayer(this.bg);
    removeLayer(this);
    const demoLayer = new DemoLayer();
    addLayer(demoLayer);
    addLayer(new GoLayer(this.diff, demoLayer));
  }
  update(delta: number) {
    if (key_enter()) this.go();
    else if (key_escape()) this.back();
  }
}

const layers = [];

const addLayer = (l: Layer) => {
  app.stage.addChild(l.graphics);
  layers.push(l);
};

const removeLayer = (l: Layer) => {
  app.stage.removeChild(l.graphics);
  layers.splice(layers.indexOf(l), 1);
};

set_do_game_over((context: any, diff: number, score: number) => {
  addLayer(new GameOverLayer(<GameLayer>context, diff, score));
});

const main = () => {
  setGuppyTexture(PIXI.Texture.fromFrame("guppy"));
  setMinnowTexture(PIXI.Texture.fromFrame("minnow"));
  const bigJellyFrames = [];
  for (let i = 0; i < 4; ++i) {
    bigJellyFrames.push(PIXI.Texture.fromFrame("bigjelly000" + i));
  }
  setJellyTextures(
    PIXI.Texture.fromFrame("smallleg"),
    PIXI.Texture.fromFrame("jelly"),
    PIXI.Texture.fromFrame("bigleg"),
    bigJellyFrames
  );

  const demoLayer = new DemoLayer();
  addLayer(demoLayer);
  addLayer(new TitleLayer(demoLayer));

  app.ticker.add((_: number) => {
    for (let layer of layers) layer.update(app.ticker.elapsedMS / 1000);
    //console.log(vpool.poolfree.length);
  });
};

PIXI.loader.add("sprites.json").load(main);
