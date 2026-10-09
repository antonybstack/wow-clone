import { regionProgressLabel } from './region-progress.js';

/** Keep the starting area usable while the rest of the region arrives. */
export function showBackgroundLoading() {
  const root = document.createElement("div");
  root.id = "region-loading";
  root.setAttribute("role", "status");
  root.style.cssText =
    "position:fixed;left:50%;bottom:100px;transform:translateX(-50%);padding:9px 14px;background:#181811dc;color:#ddd2a2;font:13px Georgia,serif;border:1px solid #766c4a;z-index:12;text-align:center;max-width:80vw;pointer-events:none";
  root.textContent = "Opening the paths beyond the churchyard…";
  document.body.append(root);
  let retryReject = null, routesReady = false, mode='loading', phase=null, bar, count;
  const loadingText=()=>routesReady ? 'Adding region details…' : 'Opening the paths beyond the churchyard…';
  return {
    progress(value) {
      if(mode!=='loading')return;
      if(value.phase!==phase||!bar||!root.contains(bar)) {
        phase=value.phase;
        const label=document.createElement('span');label.textContent=regionProgressLabel(value);
        const details=document.createElement('div');details.setAttribute('aria-live','off');
        // Native progress exposes determinate/indeterminate state without invented
        // download percentages: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/progress
        bar=document.createElement('progress');bar.setAttribute('aria-label',label.textContent);
        bar.style.cssText='display:block;width:100%;height:7px;margin:7px 0 4px;accent-color:#e8bb72';
        count=document.createElement('span');count.setAttribute('aria-hidden','true');count.style.cssText='font:11px monospace';
        details.append(bar,count);root.replaceChildren(label,details);
      }
      if(value.total>0) {
        bar.max=value.total;bar.value=value.processed;
        count.textContent=`${value.processed} / ${value.total} ${value.phase==='supports'?'supports':'ranges'} processed`;
      } else {
        bar.removeAttribute('value');count.textContent=routesReady?'The regional routes remain open.':'You can keep exploring the starting area.';
      }
    },
    navigationReady() {
      routesReady=true;
      root.textContent=loadingText();
    },
    done() {
      mode='done';
      root.remove();
    },
    retry(error) {
      mode='retry';phase=null;
      root.replaceChildren(
        document.createTextNode(
          routesReady ? "Some region details could not load. The routes remain open. "
            : "The paths could not open. You can keep exploring here. ",
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
          mode='loading';
          root.textContent = loadingText();
          resolve();
        };
      });
    },
    dispose() {
      mode='disposed';
      retryReject?.(Error("Scene disposed during retry"));
      root.remove();
    },
    fail() {
      mode='failed';
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
