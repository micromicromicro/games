import { server as WSS, connection as WSConnection } from "websocket";
import * as http from "http";
import * as process from "process";
import fetch from "node-fetch";

process.on("uncaughtException", function(error: Error) {
  console.error(error.stack);
});

const port = parseInt(process.env.PORT);
const env_origin = process.env.ORIGIN;
const env_auth = process.env.AUTH;
const env_micro_host = process.env.MICROMICRO_HOST;
const env_micro_user = process.env.MICROMICRO_USER;
const env_micro_token = process.env.MICROMICRO_TOKEN;

class Game {
  name: string;
  price: number;
  constructor(name: string, price: number) {
    this.name = name;
    this.price = price;
  }
}

const games = new Map<string, Game>();
games.set("radish", new Game("Radish Trap", 10));

class Token {
  created: Date;
  connection: WSConnection;

  constructor(connection: WSConnection) {
    this.created = new Date();
    this.connection = connection;
  }
}

const tokens = new Map<string, Token>();

let rate = 1;

const safe = (inner: any) => {
  try {
    return inner();
  } catch (e) {
    console.log(e.message);
  }
};

const asafe = async (inner: () => Promise<any>) => {
  try {
    return await inner();
  } catch (e) {
    console.error(e.stack);
  }
};

const updateRates = async () =>
  asafe(async () => {
    const rates = await (await fetch(
      "https://api." + env_micro_host + "/v1/rates"
    )).json();
    rate = rates["usd"];
    console.log("rate " + rate);
  });

updateRates();
setInterval(updateRates, 24 * 60 * 60 * 1000);

var httpServer = http.createServer((request, response) =>
  asafe(async () => {
    if (request.url.endsWith("/health")) {
      response.write(200);
      response.write("salut");
      response.end();
      return;
    }
    if (!request.url.endsWith("/" + env_auth)) {
      response.writeHead(400);
      response.end();
      return;
    }
    let body = "";
    request.on("data", data => {
      body += data;
      if (body.length > 1024 * 1024) request.connection.destroy();
    });
    request.on("end", () => {
      response.writeHead(200);
      response.end();
      const data = JSON.parse(body);
      if (data.testing) {
        response.writeHead(200);
        response.end();
        return;
      }
      console.log(data);
      const token = tokens.get(JSON.parse(data.message).id);
      if (!token) {
        console.log(
          new Date() +
            " " +
            request.connection.address() +
            ": Received payment for unknown address " +
            data.address
        );
        return;
      }
      tokens.delete(data.address);
      token.connection.sendUTF(JSON.stringify({ event: "paid" }));
      token.connection.close();
    });
  })
);

httpServer.listen(port, () => {
  console.log("Started on " + port);
});

const wsServer = new WSS({
  httpServer: httpServer,
  autoAcceptConnections: false
});

let reqidCounter = 0;

wsServer.on("request", request => {
  if (request.origin != env_origin) {
    console.log("bad origin", request.origin);
    request.reject();
    return;
  }

  var connection = request.accept(null, request.origin);
  connection.on("message", async message => {
    try {
      const mdata = JSON.parse(message.utf8Data);
      const game = games.get(mdata.game);
      if (!game) {
        throw new Error("Unknown game " + mdata.game);
      }
      const reqid = (++reqidCounter).toFixed(0);
      const addr = await (await fetch(
        "https://api." + env_micro_host + "/v1/new_in",
        {
          method: "POST",
          body: JSON.stringify({
            username: env_micro_user,
            token: env_micro_token,
            tos: "latest",
            slow: true,
            single_use: true,
            expire: Date.now() + 1 * 60 * 60 * 1000,
            receiver_message: JSON.stringify({ id: reqid }),
            sender_message: "1 token for " + game.name,
            amount: rate * 10
          })
        }
      )).json();
      if (addr.error) {
        console.log(
          new Date() + " Address creation error: " + JSON.stringify(addr.error)
        );
        throw new Error("Internal error");
      }
      tokens.set(reqid, new Token(connection));
      connection.sendUTF(
        JSON.stringify({
          address: "https://" + env_micro_host + "/app/#in/" + addr.id
        })
      );
    } catch (e) {
      console.log(new Date() + " Error: " + e.message);
      connection.sendUTF(JSON.stringify({ error: "Internal error" }));
      connection.close();
    }
  });
});
