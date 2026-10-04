/** Optional online entry: no SDK or remote assets in the offline startup graph.
 * Room/state authority stays in the lazy adapter; native DOM controls only.
 * https://docs.colyseus.io/client
 */
import { sceneLifetime } from "../ashen-reach/scene-lifetime.js";
import "./entry.css";
const node = (tag, text) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  return el;
};
export function createPresenceEntry(game) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const endpoint = local
    ? "http://127.0.0.1:2577"
    : import.meta.env.VITE_PRESENCE_URL;
  // Public entry ships only alongside a verified compatible backend.
  if (!endpoint) return { endpoint: null, available: false, dispose() {} };
  const section = node("details");
  section.id = "presence-entry";
  const title = node("summary", "Shared region");
  section.append(title);
  const note = node(
    "p",
    "Explore together with up to eight players. Encounters remain solo.",
  );
  const status = node("p", "Solo");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const join = node("button", "Join"),
    leave = node("button", "Leave");
  leave.disabled = true;
  const fit = node("select");
  fit.setAttribute("aria-label", "Shared outfit");
  for (const [id, name] of [
    ["wayfarer", "Wayfarer"],
    ["warden", "Warden"],
  ]) {
    const o = node("option", name);
    o.value = id;
    fit.append(o);
  }
  const height = node("input"),
    build = node("input");
  for (const [el, label, min, max, value] of [
    [height, "Height", 0.9, 1.15, 1],
    [build, "Build", -0.95, 0.95, 0],
  ]) {
    el.type = "number";
    el.min = min;
    el.max = max;
    el.step = 0.05;
    el.value = value;
    el.setAttribute("aria-label", label);
  }
  const fields = node("fieldset");
  fields.disabled = true;
  for (const [label, control] of [
    ["Outfit", fit],
    ["Height", height],
    ["Build", build],
  ]) {
    const row = node("label", label);
    row.append(control);
    fields.append(row);
  }
  const apply = node("button", "Apply character");
  fields.append(apply);
  const peers = node("select");
  peers.setAttribute("aria-label", "Inspect player");
  const inspect = node("label", "Inspect player");
  inspect.append(peers);
  fields.append(inspect);
  section.append(note, status, join, leave, fields);
  document.body.append(section);
  let busy = false,
    disposed = false;
  function sync() {
    if (disposed) return;
    const api = game.presence,
      active = api && !api.closed,
      connected = active && api.connected;
    join.disabled = busy || active;
    leave.disabled = !active;
    fields.disabled = busy || !connected;
    const armory = document.querySelector("#armory");
    for (const el of armory?.querySelectorAll(
      "[data-race],[data-equipment],[data-outfit],.creator-section input,.creator-section select,.creator-actions button",
    ) || []) {
      if (active) {
        if (!el.hasAttribute("data-presence-disabled")) {
          el.dataset.presenceDisabled = String(el.disabled);
          el.disabled = true;
        }
      } else if (el.hasAttribute("data-presence-disabled")) {
        el.disabled = el.dataset.presenceDisabled === "true";
        delete el.dataset.presenceDisabled;
      }
    }
    const ids = [...(api?.room?.state?.players?.keys() || [])].filter(
      (id) => id !== api.room.sessionId,
    );
    if (peers.dataset.ids !== ids.join(",")) {
      peers.replaceChildren(node("option", "Automatic detail"));
      peers.firstChild.value = "";
      for (const id of ids) {
        const o = node("option", `Player ${id.slice(0, 4)}`);
        o.value = id;
        peers.append(o);
      }
      peers.dataset.ids = ids.join(",");
      peers.value = api?.target || "";
    }
  }
  const onStatus = (value) => {
    status.textContent =
      {
        joining: "Joining…",
        shared: "Shared region",
        reconnecting: "Reconnecting…",
        solo: "Solo",
      }[value] || value;
    sync();
  };
  join.onclick = async () => {
    busy = true;
    status.textContent = "Joining…";
    sync();
    try {
      const { joinPresence } = await import("./client.js");
      await joinPresence(game, endpoint, { onStatus });
      const recipe = game.getAppearance();
      height.value = recipe.shape.height;
      build.value = recipe.shape.build;
      fit.value =
        recipe.equipment.torso === "graveweaverTop" ? "warden" : "wayfarer";
    } catch (e) {
      status.textContent = e.message;
    } finally {
      busy = false;
      sync();
    }
  };
  leave.onclick = async () => {
    await game.presence?.leave();
    sync();
  };
  apply.onclick = async () => {
    busy = true;
    sync();
    try {
      const { presenceAppearance } = await import("./protocol.js");
      await game.presence.changeAppearance(
        presenceAppearance(
          fit.value,
          Number(height.value),
          Number(build.value),
        ),
      );
      status.textContent = "Character shared";
    } catch (e) {
      status.textContent =
        game.presence?.closed &&
        (e.name === "AbortError" || e.message === "Shared region closed")
          ? "Solo"
          : e.message;
    } finally {
      busy = false;
      sync();
    }
  };
  peers.onchange = () => {
    if (game.presence) game.presence.target = peers.value || null;
  };
  const timer = setInterval(sync, 250);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    section.remove();
  };
  sceneLifetime(game.scene).addEventListener("abort", dispose, { once: true });
  sync();
  return { element: section, endpoint, dispose };
}
