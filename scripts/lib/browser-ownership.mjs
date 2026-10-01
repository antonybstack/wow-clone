/** CDP reports the actual OS processes; avoid stale hard-coded browser PIDs
 * after a controlled harness restart. No new tab or renderer is created.
 * https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/#method-getProcessInfo
 */
export async function browserOwnership(
  browser,
  { cdpPort, url, purpose, renderingClients },
) {
  const session = await browser.newBrowserCDPSession();
  try {
    const { processInfo } = await session.send("SystemInfo.getProcessInfo");
    const browserPid = Number(
      processInfo.find((p) => p.type === "browser")?.id,
    );
    if (!Number.isSafeInteger(browserPid) || browserPid < 1)
      throw Error("Cannot account for the owned browser PID");
    return {
      owner: "root",
      browserPid,
      gpuHelperPids: processInfo
        .filter((p) => p.type === "GPU")
        .map((p) => Number(p.id)),
      cdpPort: Number(cdpPort),
      url,
      purpose,
      renderingClients,
      active: true,
    };
  } finally {
    await session.detach();
  }
}
