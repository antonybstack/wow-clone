/** Observe native CDP failures without wrapping fetch or Response promises.
 * A preload's HTTP 200 is not evidence that the application consumed its body.
 * Preserve failures even when their request ID has no requestWillBeSent row.
 * https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-loadingFailed
 * https://chromedevtools.github.io/devtools-protocol/tot/Log/#event-entryAdded
 */
export async function installNetworkFailureProbe(cdp, requests) {
  const transportFailures = [], browserLog = [], browserIssues = [];
  cdp.on('Network.loadingFailed', e => {
    const failure = {
      requestId: e.requestId, at: e.timestamp, type: e.type,
      errorText: e.errorText, canceled: e.canceled ?? false,
      blockedReason: e.blockedReason ?? null,
      corsErrorStatus: e.corsErrorStatus ?? null,
    };
    transportFailures.push(failure);
    const request = requests.get(e.requestId);
    if (request) request.failure = failure;
  });
  cdp.on('Log.entryAdded', ({entry}) => {
    if (!['network', 'security'].includes(entry.source)) return;
    // Keep useful native reasons and correlation, excluding headers, cookies,
    // arguments and stack frames from the full protocol LogEntry.
    browserLog.push({
      source: entry.source, level: entry.level, text: entry.text,
      url: entry.url ?? null, timestamp: entry.timestamp,
      networkRequestId: entry.networkRequestId ?? null,
    });
  });
  // A CSP-blocked fetch can reject before Chrome emits a network request or
  // loadingFailed. Observe its native policy issue rather than inferring that
  // an empty transport list means successful loading.
  // https://chromedevtools.github.io/devtools-protocol/tot/Audits/#event-issueAdded
  cdp.on('Audits.issueAdded', ({issue}) => {
    const policy=issue.details?.contentSecurityPolicyIssueDetails;
    if(!policy) return;
    browserIssues.push({code:issue.code,blockedURL:policy.blockedURL??null,
      violatedDirective:policy.violatedDirective,isReportOnly:policy.isReportOnly,
      violationType:policy.contentSecurityPolicyViolationType});
  });
  await cdp.send('Log.enable');
  await cdp.send('Audits.enable');
  return {
    snapshot() {
      return {
        transportFailures: transportFailures.map(failure => {
          const request = requests.get(failure.requestId);
          return {...failure, trackedRequest: !!request,
            url: request?.url ?? null, responseStatus: request?.response?.status ?? null};
        }),
        browserLog: browserLog.map(entry => ({...entry})),
        browserIssues: browserIssues.map(issue => ({...issue})),
      };
    },
  };
}
