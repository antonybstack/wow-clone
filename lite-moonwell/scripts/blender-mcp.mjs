import net from "node:net";

const DEFAULT_HOST = process.env.BLENDER_HOST || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.BLENDER_PORT || 9876);

export function blenderCommand(type, params = {}, options = {}) {
    const host = options.host || DEFAULT_HOST;
    const port = options.port || DEFAULT_PORT;
    const timeoutMs = options.timeoutMs ?? 180_000;

    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port });
        let buf = Buffer.alloc(0);
        let settled = false;

        const finish = (err, value) => {
            if (settled) {
                return;
            }
            settled = true;
            socket.destroy();
            if (err) {
                reject(err);
            } else {
                resolve(value);
            }
        };

        socket.setTimeout(timeoutMs);
        socket.on("timeout", () => finish(new Error(`Blender MCP timed out after ${timeoutMs}ms (${type})`)));
        socket.on("error", (err) => {
            if (err.code === "ECONNREFUSED") {
                finish(new Error(`Blender MCP is not listening on ${host}:${port}. In Blender: MCP for Blender → Start / Connect.`));
                return;
            }
            finish(err);
        });
        socket.on("connect", () => {
            socket.write(JSON.stringify({ type, params }));
        });
        socket.on("data", (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            try {
                const parsed = JSON.parse(buf.toString("utf8"));
                if (parsed.status === "error") {
                    finish(new Error(parsed.message || `Blender error (${type})`));
                    return;
                }
                finish(null, parsed.result ?? parsed);
            } catch {
                // incomplete JSON
            }
        });
        socket.on("end", () => {
            if (!settled) {
                finish(new Error(`Blender closed the connection before a complete JSON reply (${type})`));
            }
        });
    });
}

export function executeBlender(code, options) {
    return blenderCommand("execute_code", { code }, options);
}

export function pingBlender(options) {
    return blenderCommand("ping", {}, { timeoutMs: 8_000, ...options });
}
