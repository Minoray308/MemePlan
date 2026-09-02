# App optimization implementation plan

Goal: Remove the Android launch image and reduce verified redundant work while preserving existing user data and the requested overlay changes.

Architecture: Keep Expo 57 and the existing native modules. Apply launch styles through a config plugin so prebuild and release builds retain the fix. Share pure category/search helpers and test their behavior.

- [x] Add regression coverage for category search, counts and traversal.
- [x] Replace the launch image with a plain background via an idempotent Android config plugin.
- [x] Optimize search/sort, tag statistics, batch membership checks, selection and toast updates; remove confirmed unused code and duplicate thumbnail builders.
- [x] Run strict unused-code/type checks, regression tests, Expo config/prebuild validation and an Android bundle export. Report device/build limitations.

Verification results:
- TypeScript with noUnusedLocals/noUnusedParameters: passed.
- New app logic tests: 6 passed; existing category flow and update logic tests passed.
- Expo Android prebuild: passed twice; generated startup styles are plain and not duplicated; launcher icon unchanged.
- Android production JavaScript export: passed.
- Icon import optimization: font assets 19 -> 1; bundle 2,711,162 -> 2,516,929 bytes; referenced assets 4,083,139 -> 1,313,959 bytes. Total exported payload reduced by 2,963,413 bytes (uncompressed, not an APK size measurement).
- Device launch/overlay interaction and full native APK compilation have not been tested in this environment. Startup and overlay changes require a newly built APK.

The previous requested overlay defaults, empty state and wording remain included in the working tree. No release was published.

Independent review: fixed the drag-selection cache regression identified during review; the reviewer confirmed the fix. Final Android JavaScript export passed again. Continuous dragging and startup appearance still require phone verification.
