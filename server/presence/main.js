/** A Node Colyseus process; Pages remains the independently deployable client.
 * https://docs.colyseus.io/deployment
 * https://docs.colyseus.io/server/transport/ws
 */
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { PresenceRoom, currentPresenceRoom } from "./room.js";
import { PRESENCE_ROOM } from "../../src/multiplayer/protocol.js";
const port = Number(process.env.ASHEN_PRESENCE_PORT || 2577);
const host = process.env.ASHEN_PRESENCE_HOST || "127.0.0.1";
const server = new Server({
  greet: false,
  transport: new WebSocketTransport({ maxPayload: 16384 }),
  express: (app) => {
    app.get("/presence", (_req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      const room = currentPresenceRoom();
      if (!room?.physics) return res.status(503).json({ ready: false });
      res
        .set("Cache-Control", "no-store")
        .json({ ready: true, ...room.diagnostics() });
    });
  },
});
server.define(PRESENCE_ROOM, PresenceRoom);
await server.listen(port, host);
await matchMaker.createRoom(PRESENCE_ROOM, {});
console.log(
  JSON.stringify({
    service: "ashen-presence",
    port,
    host,
    ready: true,
    roomId: currentPresenceRoom().roomId,
  }),
);
