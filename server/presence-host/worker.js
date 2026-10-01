import { Container } from "@cloudflare/containers";
/** One room/one container, never one VM per caller-supplied path or room ID.
 * Native Container forwards HTTP and WebSocket upgrades and owns idle sleep.
 * https://developers.cloudflare.com/containers/examples/websocket/
 * https://developers.cloudflare.com/containers/platform/pricing/
 */
export class PresenceContainer extends Container {
  defaultPort = 2577;
  sleepAfter = "90s";
  envVars = { ASHEN_PRESENCE_HOST: "0.0.0.0", ASHEN_PRESENCE_PORT: "2577" };
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (
      path != "/presence" &&
      !path.startsWith("/matchmake/") &&
      !/^\/[\w-]+\/[\w-]+$/.test(path)
    )
      return new Response("Not found", { status: 404 });
    return env.PRESENCE.getByName("ashen-reach-v1").fetch(request);
  },
};
