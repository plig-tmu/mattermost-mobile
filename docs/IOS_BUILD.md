# Building and Installing on an iPhone

This fork builds like upstream Mattermost Mobile. The Agenda feature is pure JS/TS and adds no
native modules and no pods. The steps below take you from a clean Mac to the app on a physical
iPhone. See also [CLAUDE-IOS-SIMULATOR.md](../CLAUDE-IOS-SIMULATOR.md) for simulator and
CocoaPods troubleshooting.

> Verification status: the Agenda code was type-checked, linted and unit-tested on Linux, and its
> API calls were checked against a live server. **No iOS build was run.** That needs macOS with
> Xcode.

## 1. Requirements

- macOS with a current Xcode (16 or newer, since the iOS deployment target is 18.0) and its command line tools
  (`xcode-select --install`).
- Node `^22.11.0 || ^24.15.0` (`.nvmrc` pins 24.15.0) and npm 10 or 11.
- Ruby 3.3 with Bundler (for CocoaPods and Fastlane), Watchman is recommended.
- An Apple ID added in Xcode → Settings → Accounts. A free personal team can install on your
  own device; App Groups and push need a paid Apple Developer Program membership (see §5).

## 2. Install dependencies

```bash
nvm use                        # or any Node 22/24
npm ci                         # runs patch-package via postinstall
npm run ios-gems               # bundle install (CocoaPods, Fastlane)
npm run pod-install            # cd ios && RCT_NEW_ARCH_ENABLED=1 pod install
```

Always open `ios/Mattermost.xcworkspace`, never the `.xcodeproj`.

## 3. Set your own bundle identifiers

The upstream identifiers (`com.mattermost.rnbeta*`) belong to Mattermost's Apple team, so you
cannot sign with them. Three targets must be renamed together:

| Target | Upstream ID | Example |
|---|---|---|
| Mattermost (app) | `com.mattermost.rnbeta` | `com.example.mattermost` |
| MattermostShare (share extension) | `com.mattermost.rnbeta.MattermostShare` | `com.example.mattermost.MattermostShare` |
| NotificationService | `com.mattermost.rnbeta.NotificationService` | `com.example.mattermost.NotificationService` |

They also share the App Group `group.com.mattermost.rnbeta`, the keychain group and an iCloud
container. These appear in `Info.plist` (`CFBundleIdentifier` and `AppGroupIdentifier`, which
are literal values, not `$(PRODUCT_BUNDLE_IDENTIFIER)`), in the `.entitlements` files and in
`project.pbxproj`.

**Recommended: the repository's Fastlane lane** `ios update_settings` rewrites all of them
(Info.plist values, `project.pbxproj`, entitlements, App Group, iCloud container, keychain group
and, optionally, the team). Fastlane has its own Gemfile in `fastlane/`, separate from the root
one that `npm run ios-gems` installs:

```bash
cd fastlane
bundle install                 # fastlane + plugins from fastlane/Pluginfile
MAIN_APP_IDENTIFIER=com.example.mattermost \
EXTENSION_APP_IDENTIFIER=com.example.mattermost.MattermostShare \
NOTIFICATION_SERVICE_IDENTIFIER=com.example.mattermost.NotificationService \
IOS_APP_GROUP=group.com.example.mattermost \
IOS_ICLOUD_CONTAINER=iCloud.com.example.mattermost \
FASTLANE_TEAM_ID=<your 10-character Apple team ID> \
APP_NAME="Mattermost Agenda" \
bundle exec fastlane ios update_settings
```

Notes from reading the lane (it was **not run** in this environment, which has no macOS):

- In `project.pbxproj` the lane first replaces every `com.mattermost.rnbeta` with
  `MAIN_APP_IDENTIFIER`, so the extension IDs there always become
  `<MAIN_APP_IDENTIFIER>.MattermostShare` and `<MAIN_APP_IDENTIFIER>.NotificationService`. Set
  `EXTENSION_APP_IDENTIFIER` and `NOTIFICATION_SERVICE_IDENTIFIER` to exactly those values, as
  above, so the Info.plist and project settings agree.
- `FASTLANE_TEAM_ID` is optional; without it, pick the team in Xcode (§4).
- Leave `INTUNE_ENABLED` unset.
- The lane runs locally without Apple credentials. `CI=true` would trigger `setup_ci`.
- Check the result with `git diff ios/` before building.

Don't commit these local signing changes if you want to keep merging from upstream easily (see
`docs/UPSTREAM_MAINTENANCE.md`). Keep them on a local branch, or re-run the lane after each
merge.

To do it by hand instead, change the values listed above in Xcode, under each target's
**Signing & Capabilities** tab and in the three `Info.plist` files.

## 4. Configure signing in Xcode

For **each** of the three targets (Mattermost, MattermostShare, NotificationService):

1. Select the target → **Signing & Capabilities**.
2. Check **Automatically manage signing** and pick your **Team**. The project ships with
   Mattermost's team ID; replace it.
3. Confirm the bundle identifier from §3.
4. Under **App Groups**, use your group (`group.com.example.mattermost`) on all three targets.
   The share and notification extensions read the server database and credentials through it.
5. If you have no paid account, remove the capabilities a personal team cannot use (Push
   Notifications, iCloud, Time Sensitive/Communication Notifications, and App Groups if Xcode
   refuses them). The app still runs, but the share extension and notification service lose
   access to shared data and push won't work.

## 5. Build and install on the device

1. Connect the iPhone by USB (or pair it over Wi-Fi), unlock it and trust the Mac.
2. On iOS 16+, enable **Settings → Privacy & Security → Developer Mode** and restart.
3. In Xcode choose the **Mattermost** scheme and your iPhone as the destination.
4. Development build: start Metro with `npm start`, then press **Run** (⌘R). The phone must
   reach the Mac's Metro server on the same network.
   Standalone build without Metro: **Product → Scheme → Edit Scheme → Run → Build
   Configuration = Release**, then Run. JS is bundled into the app
   (`ios/bundleReactNative.sh`).
5. On first launch with a personal team, trust the developer under **Settings → General → VPN &
   Device Management**.

The command-line equivalent for a development build is `npm run ios -- --device "<iPhone name>"`.
`npm run build:ios` (Fastlane `ipa`) produces an `.ipa`, but needs a provisioning setup through
match or env vars (see `fastlane/env_vars_example`).

## 6. Connect to your server and open Agenda

1. Launch the app, enter your Mattermost server URL (11.7.0 or newer with the Agenda plugin
   enabled) and log in as usual.
2. An **Agenda** tab (calendar icon) appears in the bottom tab bar once the app detects the
   plugin (`/api/v4/plugins/webapp`). Tap it.
3. Use **My / Team / Channel** to choose the scope, the **Calendar / Tasks / Agenda** tabs to
   switch views, and **+** to create an event or task.

## 7. Limits of self-built apps

- **Push notifications** don't work out of the box. Mattermost's hosted push proxy only accepts
  apps signed by Mattermost. A self-built app needs its own
  [Mattermost Push Notification Service](https://github.com/mattermost/mattermost-push-proxy)
  with your APNs key, and the server's push settings must point to it. Agenda itself doesn't
  use push.
- Self-signed TLS certificates aren't supported, as upstream.
- Apps signed with a free personal team expire after 7 days and must be reinstalled from Xcode.
- iCloud, App Groups and Communication Notifications capabilities need a paid team.
