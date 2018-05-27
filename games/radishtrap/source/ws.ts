const qualifyPath = (path: string): string => {
  if (path.startsWith("https://")) {
    return path;
  }
  return "https://" + window.location.host + path;
};

type resolveType = (any) => void;
type rejectType = (Error) => void;

class PromisePair {
  resolve: resolveType;
  reject: rejectType;
}

export class AsyncWebsockets {
  ws: WebSocket;
  promises: Array<PromisePair>;
  messages: Array<Response>;
  openPromise: Promise<any>;
  constructor(path) {
    this.ws = new WebSocket(path);
    this.promises = [];
    this.messages = [];
    this.openPromise = new Promise(
      (resolve: resolveType, reject: rejectType) => {
        this.promises.push({
          resolve: resolve,
          reject: reject
        });
      }
    );
    this.ws.onopen = () => {
      this.promises.shift().resolve(this);
    };
    this.ws.onmessage = event => {
      let message = JSON.parse(event.data);
      let promise = this.promises.shift();
      if (promise !== null) {
        this._processMessage(promise.resolve, promise.reject, message);
      } else {
        this.messages.push(message);
      }
    };
    this.ws.onerror = _ => {
      for (let i = 0; i < this.promises.length; ++i) {
        this.promises[i].reject(new Error("Unknown error in connection"));
      }
    };
    this.ws.onclose = _ => {
      for (let i = 0; i < this.promises.length; ++i) {
        this.promises[i].reject(new Error("Connection unexpectedly closed"));
      }
    };
  }

  _processMessage(resolve: resolveType, reject: rejectType, message: any) {
    if (message.hasOwnProperty("error")) {
      const e = new Error(message.error.message);
      reject(e);
      return;
    }
    resolve(message);
  }

  close() {
    this.ws.close();
  }

  send(body) {
    this.ws.send(JSON.stringify(body));
  }

  read(): any {
    return new Promise((resolve, reject) => {
      if (this.messages.length > 0) {
        let message = this.messages[0];
        this.messages.splice(0, 1);
        this._processMessage(resolve, reject, message);
      } else {
        this.promises.push({
          resolve: resolve,
          reject: reject
        });
      }
    });
  }
}

export const myWs = uri => {
  //let out = new AsyncWebsockets(
  //  qualifyPath(path).replace(/^http(s?:.*)/, "ws$1")
  //);
  let out = new AsyncWebsockets(uri);
  return out.openPromise;
};
