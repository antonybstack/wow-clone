/** Keep the starting area usable while the rest of the region arrives. */
export function showBackgroundLoading() {
  const root = document.createElement("div");
  root.id = "region-loading";
  root.setAttribute("role", "status");
  root.style.cssText =
    "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:9px 14px;background:#181811dc;color:#ddd2a2;font:13px Georgia,serif;border:1px solid #766c4a;z-index:12;text-align:center;max-width:80vw;pointer-events:none";
  root.textContent = "Opening the paths beyond the churchyard…";
  document.body.append(root);
  let retryReject = null;
  return {
    done() {
      root.remove();
    },
    retry(error) {
      root.replaceChildren(
        document.createTextNode(
          "The paths could not open. You can keep exploring here. ",
        ),
      );
      const button = document.createElement("button");
      button.style.pointerEvents="auto";
      button.textContent = "Retry loading";
      root.append(button);
      return new Promise((resolve, reject) => {
        retryReject = reject;
        button.onclick = () => {
          retryReject = null;
          root.textContent = "Opening the paths beyond the churchyard…";
          resolve();
        };
      });
    },
    dispose() {
      retryReject?.(Error("Scene disposed during retry"));
      root.remove();
    },
    fail() {
      root.replaceChildren(
        document.createTextNode("The rest of the region could not load. "),
      );
      const button = document.createElement("button");
      button.style.pointerEvents="auto";
      button.textContent = "Reload game";
      button.onclick = () => location.reload();
      root.append(button);
    },
  };
}
