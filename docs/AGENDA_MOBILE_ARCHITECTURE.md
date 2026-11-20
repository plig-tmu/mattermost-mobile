# Agenda in Mattermost Mobile: Architecture

This document records what was found in both codebases and how native Agenda support plugs
into Mattermost Mobile. It is the Phase 1 deliverable.

## 1. Versions inspected

| Component | Version / revision |
|-----------|--------------------|
| Mattermost Mobile | `2.46.0` (`package.json`), base commit `350e1eb30` |
| React Native | `0.83.9`, New Architecture enabled |
| Navigation | `expo-router` `55.0.14` (file based, `app/routes/`) |
| Local DB | WatermelonDB `0.28.1-0` (one app DB + one DB per server) |
| HTTP | `@mattermost/react-native-network-client` `1.11.7` |
| Date libs already installed | `moment-timezone` `0.6.4`, `@react-native-community/datetimepicker` `9.1.0` |
| Mattermost Agenda plugin | `com.github.3tty0n.mattermost-agenda` `0.2.0`, commit `c976fbf` |
| Agenda minimum server | `11.7.0` (`plugin.json`) |

## 2. Mattermost Mobile: relevant findings

### Entry points and navigation
- `app/routes/_layout.tsx` is the expo-router root; `app/routes/(authenticated)/_layout.tsx` is a
  native `Stack` wrapped in `withServerDatabase`, so **the whole authenticated tree remounts when
  the active server changes** (new DB, server URL and theme providers).
- Any file in `app/routes/(authenticated)/` is a pushable stack screen.
  `navigateToScreen(screen, props)` (`app/screens/navigation.ts`) maps a `Screens` constant to
  `/(authenticated)/<screen>` and serialises props as JSON route params
  (`usePropsFromParams` reads them back).
- Bottom tabs (`app/routes/(authenticated)/(home)/_layout.tsx`) use a **custom** `TabBar`
  (`app/screens/home/tab_bar`) with a fixed set of icons. Agenda is a tab there, between
  Saved and Account, so it sits with the other top-level destinations of the current
  Mattermost mobile UI. The tab bar hides it unless the server has the plugin enabled.
- Products also add rows at the top of the channel list (Threads, Drafts, Agents, Playbooks).
  An earlier Agenda version used such a row; it moved to the tab bar.

### Authentication and HTTP
- `NetworkManager` (`app/managers/network_manager.ts`) creates one `Client` per server.
- `Client` is composed with the ClientMix pattern (`app/client/rest/index.ts`); products
  contribute mixins (`@playbooks/client/rest`, `@agents/client/rest`).
- `ClientTracking.setClientCredentials` (`app/client/rest/tracking.ts`) sets
  `Authorization: Bearer <session token>` on every request. The token is the regular Mattermost
  session token stored by the app's credential store; nothing new is stored.
- `doFetch` returns the parsed JSON or throws `ClientError` with `status_code` and `message`
  (from the body's `message` field). Plugin routes are just relative paths
  (`/plugins/<id>/...`), exactly as Playbooks does with `/plugins/playbooks/api/v0`.
- `client.getPluginsManifests()` (`GET /api/v4/plugins/webapp`) lists enabled plugins; Agents
  and Playbooks use it to detect their plugin.

### State and data
- WatermelonDB holds teams, channels, memberships, users and the current team
  (`@queries/servers/team`, `@queries/servers/channel`, `@queries/servers/user`,
  `@queries/servers/system`). Agenda reuses these for scope pickers and display names; no
  membership data is duplicated.
- `fetchMissingProfilesByIds` (`@actions/remote/user`) loads unknown user profiles into the
  server DB.
- `showPermalink(serverUrl, teamName, postId)` opens a post.
- Theme: `useTheme()`, `makeStyleSheetFromTheme`, `changeOpacity`, `typography()`.
- There is no existing calendar component in the app. `@react-native-community/datetimepicker`
  is already a dependency (used by `DateTimeSelector` and Playbooks due dates).

### iOS project
- `ios/Mattermost.xcworkspace` (CocoaPods). Bundle IDs in `project.pbxproj`:
  `com.mattermost.rnbeta` (app), `com.mattermost.rnbeta.MattermostShare` (share extension),
  `com.mattermost.rnbeta.NotificationService` (notification service extension). The app and
  extensions share the App Group `group.com.mattermost.rnbeta`. See `docs/IOS_BUILD.md`.

## 3. Mattermost Agenda: relevant findings

### Routes (`server/api/api.go`)
All routes live under `/plugins/com.github.3tty0n.mattermost-agenda/api/v1` and pass through
`MattermostAuthorizationRequired`.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/tasks` | `scope=my|team|channel|all`, `team_id`, `channel_id`, `status` (csv), `assignee_id`, `priority`, `due_before`, `due_after`, `has_due`, `include_recurring`, `sort=due|created|priority|manual`, `direction`, `page`, `per_page` (≤100) |
| POST | `/tasks` | create |
| GET | `/tasks/{id}` | full task incl. description, `sourcePostId` |
| PATCH/POST | `/tasks/{id}` | partial update (pointer fields). POST is an alias for proxies that block PATCH |
| DELETE | `/tasks/{id}` | |
| GET | `/events` | `scope=my|team` only, `team_id`, **required** `from`/`to` (ms), `include_recurring`, `page`, `per_page` |
| POST, GET, PATCH/POST, DELETE | `/events`, `/events/{id}` | as for tasks; PATCH supports `occurrenceStartAt` + `occurrenceCancelled` for single occurrences |
| GET | `/config` | `defaultEventDurationMinutes` |
| GET | `/assignees` | eligible users for a team/channel |
| GET/PUT | `/me/calendar-colors` | per-user colors |

List responses are `{items, total, page, perPage, hasMore}`. Errors are `{error: "..."}` with
404/403/400/409/500.

Request bodies are decoded with `DisallowUnknownFields`, so a client must send only the
documented input fields (never echo `id`, `version`, `createdAt`, ...). The mobile client
whitelists fields for create and patch.

### Authentication and CSRF
- The plugin trusts only the `Mattermost-User-ID` header, which the Mattermost server sets after
  it authenticated the request. Requests without it get 401. The plugin never reads a user ID
  from the body or query for authentication.
- Mattermost applies CSRF checks only when the session token came from a **cookie**. The
  webapp therefore sends `X-CSRF-Token` from `MMCSRF`. Requests authenticated with an
  `Authorization: Bearer` header are not subject to the cookie CSRF check.
- The plugin's own integration tests (`server/api/integration_test.go`, `pluginRequest`) call
  every route with `Authorization: Bearer <token>`. This is the same mechanism the mobile client
  uses, so **the existing Agenda API accepts mobile requests unchanged and no server patch is
  required**. Browser CSRF protection is untouched.

### Authorization (`server/access/access.go`, services)
- Team records require `PermissionViewTeam`; channel records require `PermissionReadChannel`.
  Assignment is never a substitute for channel access. Only open/private channels are valid.
- `private` visibility: only the creator sees it.
- Task list scopes:
  - `my`: tasks assigned to the user that they can still view, plus their own private tasks.
  - `team`: shared tasks of that team the user can view, plus the user's private tasks in it.
  - `channel`: `channel`-visibility tasks of that channel (requires read access).
  - `all`: shared tasks of all the user's teams plus own private tasks.
- Event list scopes:
  - `my`: events the user created or is a participant of (private only if creator).
  - `team`: non-private events of the team the user can view.
  - **There is no channel scope for events.** The mobile Channel calendar uses the `team`
    event scope and keeps events whose `channelId` equals the channel. This is a filter over
    data the server already authorized, so it cannot widen access.
- Update rules: a status-only patch is allowed for the creator, assignees and admins; other task
  edits need creator/admin. Events: creator/admin only. The server enforces all of this; the
  mobile UI only hides actions it knows will fail.
- Permission changes (leaving a team/channel) are applied server side on every request. The
  mobile client refetches on every scope or range change and after every create/update/delete
  (an in-app `agenda_changed` event), and shows 403/404 as errors.

### Models (`server/model/task.go`, `event.go`)
Task: `id, teamId, channelId?, visibility, title, description?, creatorId, assigneeIds, status
(todo|in_progress|done), priority (none|low|normal|high|urgent), dueAt? (ms), dueHasTime?,
timezone?, recurrence? {frequency, interval, startDate, until, timezone}, reminders?, position?,
sourcePostId?, parentTaskId?, createdAt, updatedAt, completedAt?, version`. List rows are
`TaskSummary` (no description, sourcePostId, parentTaskId, completedAt).

Event: `id, teamId, channelId?, visibility, creatorId, assigneeIds, title, description?,
location?, color?, startAt, endAt, allDay?, timezone?, recurrence? {frequency, interval,
weekdays?, until? (YYYY-MM-DD)}, overrides? [{originalStart, startAt, endAt, cancelled?}],
reminders?, createdAt, updatedAt, version`. List rows omit `description`.

### Time zones and recurrence
- All-day events are stored at UTC midnight with an exclusive end; date-only task due dates are
  UTC midnight and mean the same calendar day for everyone. Timed values are epoch ms shown in
  the viewer's local time.
- The server returns recurring series (with `include_recurring=true`) but **does not expand
  them**; the webapp expands occurrences client side (`webapp/src/event_utils.ts`,
  `recurrence_utils.ts`, `calendar_utils.ts`). Event occurrences keep their wall-clock time in
  the event's `timezone`; overrides move/cancel single occurrences.
- Completing a recurring task (`{status: "done"}` on a task whose status was not done) is
  handled in `tasks.Service.Update`: if `Recurrence.NextDueAt` finds a next date, the server
  stores and **returns the task with `status: "todo"`, the advanced `dueAt` and
  `completedAt: 0`**. The mobile client always replaces its row with the returned task.
- Event recurrence (`server/model/event_recurrence.go`): `{frequency, interval (1–99),
  weekdays (0–6, weekly only), until ("YYYY-MM-DD", inclusive)}`. Overrides
  (`event_override.go`) are keyed by the slot's original start instant.
- The webapp queries the visible calendar range widened by one day on each side
  (`calendarQueryBounds`) with `per_page=100`.

## 4. Integration architecture

### Placement
All Agenda code lives in `app/products/agenda/` with the `@agenda/*` alias, following the
Playbooks/Agents product layout:

```text
app/products/agenda/
  client/rest.ts          ClientAgendaMix (all Agenda HTTP calls)
  constants.ts            plugin id, screen names, page size
  types.ts                types copied from the plugin's API models
  actions/remote.ts       fetch/create/update/delete wrappers returning {data}|{error}, paging
  queries.ts              team/channel/user lookups in the existing server DB
  utils/calendar.ts       range/day-key helpers (port of webapp calendar_utils)
  utils/recurrence.ts     occurrence expansion (port of webapp event_utils/recurrence_utils,
                          zoned math via moment-timezone)
  utils/format.ts         date/time/scope/assignee labels
  utils/form.ts           form state -> whitelisted create/patch inputs
  utils/errors.ts         HTTP status -> localized message
  hooks/                  use_agenda_request (keyed loader + stale-response guard),
                          use_agenda_range (events+tasks of visible days), use_agenda_names,
                          use_agenda_enabled
  components/             agenda_tab_icon, pill, calendar_grid (month and week), calendar_header,
                          agenda_item_row, scope_bar, detail_parts, form_parts
  screens/                agenda (calendar/tasks/list views), task_details, event_details,
                          edit_task, edit_event
```

Route files are thin wrappers, as for Playbooks: the tab is `app/routes/(authenticated)/(home)/agenda.tsx`;
details and editors are stack routes `app/routes/(authenticated)/agenda_*.tsx`.

### Slack-style shell

The app shell and Agenda follow a Slack-like mobile layout. There is no design reference for
"Mattermost Oxide" in the repo, so this is a best-effort interpretation:

- **Bottom tabs** show a label under each icon (Home, Search, Activity, Saved, Agenda, You) and a
  tinted pill behind the selected icon instead of the old sliding bar.
- **Home** has a floating **New message** button (phones) that opens Create Direct Message.
- **Agenda tab:** a large title header with today's date as the subtitle, the rounded
  `RoundedHeaderContext` top edge, scope and task filters as pills (`components/pill.tsx`),
  rows with a leading tile (event color, or the task's completion toggle), bold day headers in
  the list, and a floating **+** that opens a bottom sheet (New event / New task).
  `useAndroidHomeTabBackHandler` handles the Android back button.

All colors come from the theme, so light, dark and custom themes apply.

### Core changes (kept minimal)
1. `app/client/rest/index.ts`: add `ClientAgenda` to the mixin list.
2. `app/constants/screens.ts`: spread `AGENDA_SCREENS`.
3. `app/screens/home/tab_bar/index.tsx`: Agenda tab icon, hidden unless `useAgendaEnabled`; the
   selection highlight follows the focused tab's position among the visible tabs.
   `app/routes/(authenticated)/(home)/_layout.tsx`: the `Tabs.Screen` entry.
4. `tsconfig.json`, `babel.config.js`: `@agenda/*` alias; `eslint.config.mjs`: `@agenda` in the
   import-order path group.
5. Route wrapper files (`app/routes/(authenticated)/agenda_*.tsx`, `(home)/agenda.tsx`) and `assets/base/i18n/en.json`
   strings (generated by `npm run i18n-extract`).

### Data flow
- Requests go through `NetworkManager.getClient(serverUrl)` and the Agenda mixin, so they carry
  the existing Bearer token. No URLs or tokens are hardcoded; `serverUrl` comes from
  `useServerUrl()`.
- Agenda data is **not** persisted. Hooks hold fetched lists in React state keyed by
  `serverUrl` + query. Because the authenticated tree remounts on server switch and the key
  includes `serverUrl`, data from one server can never be shown for another. No new database
  or state library is introduced.
- Calendar views fetch only the visible range (month grid or week, ±1 day), matching the
  webapp. Tasks with due dates are fetched with the same bounds and `include_recurring=true`;
  the task list uses scope filters and pagination.
- The core `ClientError` takes its message from a `message` body field; Agenda uses `error`, so
  the mobile layer maps HTTP status codes (400/401/403/404/409) to localized messages instead
  of patching core error handling.
- List requests follow `hasMore` up to a small page cap (`include_recurring=true` returns every
  recurring series regardless of range, and `per_page` is capped at 100).
- Stale responses are dropped with a request sequence guard (the native network client does
  not expose fetch abort signals).
- Plugin detection: `useAgendaEnabled` calls `getPluginsManifests()` once per server and caches
  the result in memory for that server URL.

### Scope mapping

| Mobile scope | Events request | Tasks request |
|--------------|----------------|---------------|
| My Calendar | `scope=my` | `scope=my` |
| Team Calendar | `scope=team&team_id=<team>` | `scope=team&team_id=<team>` |
| Channel Calendar | `scope=team&team_id=<channel team>`, filter `channelId == channel` | `scope=channel&channel_id=<channel>` |
| My Tasks (Tasks tab) | n/a | `scope=my`, sorted by due date |

`scope=my` for tasks means **assigned to me** (plus my private tasks), confirmed against a live
server. A shared task I created without assigning it appears under Team/Channel, not My.

The team picker lists the user's teams from the server DB (current team by default); the channel
picker lists the user's open/private channels in that team from the DB.

### UI
A single `agenda` screen with a segmented control: **Calendar** (month/week toggle, Today,
prev/next, day selection, day list), **Tasks** (status filter, pull to refresh, toggle
completion) and **Agenda** (chronological list of the next 28 days grouped by day, fetched as one
bounded range). Detail
screens show tasks/events; edit screens support create/edit within the fields the API accepts.
All styling uses the theme, `typography()` and CompassIcon.

### Known limitations
- Events have no server-side channel scope; channel filtering is client side (see above).
- Recurring series are expanded client side with a port of the webapp logic so both clients
  show identical occurrences. Zoned wall-clock math uses the already-installed
  `moment-timezone` instead of `Intl.DateTimeFormat#formatToParts`, whose time-zone support on
  Hermes is not guaranteed.
- Offline support is out of scope; Agenda data is fetched live.
