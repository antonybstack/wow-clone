# Developer destinations — October 8, 2026

Implementation **1e7f1f2**. The `?dev` menu exposes 18 existing destinations,
God/Fly, ground-click teleport instructions and copyable `at=` spawn links.
It reuses world metadata, existing player teleport/facing and the current camera.
Fly-off preserves the current position before Havok settles onto collision.
Jump is disabled until the complete region is ready; a spawn link awaits the
same boundary and is inert without boot `?dev`.

[Procedure and rule for future helpers](../../debug-view.md#reproduce-developer-navigation-from-the-ui).
[Actual live menu frame](developer-menu.jpg), [local native receipt](local-report.json).
The menu changes do not regenerate any world/character assets or add per-frame polling.
Prepared content validation and the staged four-flag Pages build pass.
All 18 destination floor checks, native walking, Fly/God, focus and spawn-link
dev gating pass locally and on the [public preview](preview-report.json), with
Havok active, unchanged recovery counts and no runtime/GPU errors.

Sealed preview: **https://375faa2a.fardel.pages.dev/?dev&play**.
Nave: **https://375faa2a.fardel.pages.dev/?dev&play&at=cathedral-nave**.
Undercroft: **https://375faa2a.fardel.pages.dev/?dev&play&at=cathedral-undercroft**.
Seal `1f7d93308af63f41db5bb7de5ab21096a8939ba1e6d501fd017bc5f0103bea4f`:
643 files / 347,217,711 bytes. All 646 served-release checks pass; 320 declared
cache policies are checked, 326 remain observed/unclassified.
Production is unchanged at **5723a4ab / 7d00c56**, confirmed through the canonical
Cloudflare project deployment. This preview does not lift the earlier startup hold.

Root reviewed the entire live MP4 plus native capture frames. Telegram **891**
returns matching 1280×720 metadata. MP4: 15.799352 s, H.264, square pixels,
rotation 0. [Identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/dev-destinations/2026-10-08/menu.mp4)
serves `video/mp4` and a valid 206 range response. Local and public SHA256:
`7f297c8c82927d9cab9f2d5be5c7bf8238341b93dfb697bb03f77d0554abd111`.
Actual Telegram application fullscreen is not claimed by this send.

Conditions: M1 Max, native Chromium, viewport1280×720/DPR1, normal headless
pacing. This is UI/collision/motion verification; no FPS or load-time claim.
User Edge preview1147996014 / PID2931 remained open and was preserved.
Root owned Chrome77579/CDP10037 and Vite77471/listener77546/port5873;
the runner closed each test context and the harness is now stopped after preview checks.
Owned Edge media-review tab1147996025 is closed; unrelated Edge/Orca remain intact.

Raw receipts, exact capture timestamps/frames, build/deploy/seal/serving reports
and browser ownership are under `.cache/dev-destinations-2026-10-08/`.
Independent Grok4.6/high source review found no confirmed defects. Its first
bounded pass exhausted eight turns without a verdict; a focused finish produced
the report. It did not independently run the browser. Device-loss and early
cancellation guards were source-reviewed; failure/death/cancellation races were
not executed as new controls.
