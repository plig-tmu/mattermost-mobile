# Agenda API Integration

How Mattermost Mobile talks to the Agenda plugin (`com.github.3tty0n.mattermost-agenda`,
tested with v0.2.0 on Mattermost 11.7.0).

## Result: no server change needed

The Agenda plugin accepts the mobile app's existing authentication as is. **No patch to the
Agenda plugin or the Mattermost server is required**, and the browser CSRF protection is
unchanged.

## How a request is authenticated

1. The user logs in with the normal Mattermost login. The app stores the session token in its
   existing credential store. Agenda adds no storage and never sees a password.
2. `NetworkManager.getClient(serverUrl)` returns the per-server `Client`. Agenda calls are
   methods of `ClientAgendaMix` (`app/products/agenda/client/rest.ts`) and go through the shared
   `doFetch`, which adds `Authorization: Bearer <token>`.
3. The Mattermost server validates the token, then forwards the request to the plugin with a
   `Mattermost-User-ID` header that only the server sets.
4. The plugin's `MattermostAuthorizationRequired` middleware rejects requests without that header
   (401). Every handler takes the acting user from that header only. The mobile client never
   sends a user ID for authentication.
5. Mattermost checks CSRF only for tokens that come from a cookie. A header token is not
   affected. The webapp keeps sending `X-CSRF-Token` with its cookie session, so browser
   protection stays as it was.

Server URLs come from the active server (`useServerUrl()`), so nothing is hardcoded.

## Endpoints used

Base path: `/plugins/com.github.3tty0n.mattermost-agenda/api/v1`

| Mobile function (`actions/remote.ts`) | Request |
|---|---|
| `fetchAgendaEvents` | `GET /events?scope=my\|team&team_id&from&to&include_recurring=true&page&per_page=100` |
| `fetchAgendaTasks` | `GET /tasks?scope=my\|team\|channel&team_id&channel_id&status&has_due&include_recurring&due_after&due_before&sort&direction&page&per_page=100` |
| `fetchAgendaTask` / `fetchAgendaEvent` | `GET /tasks/{id}`, `GET /events/{id}` |
| `setAgendaTaskStatus` | `POST /tasks/{id}` `{"status": ...}` |
| `createAgendaTask` / `updateAgendaTask` / `deleteAgendaTask` | `POST /tasks`, `POST /tasks/{id}`, `DELETE /tasks/{id}` |
| `createAgendaEvent` / `updateAgendaEvent` / `deleteAgendaEvent` | `POST /events`, `POST /events/{id}`, `DELETE /events/{id}` |
| `fetchAgendaConfig` | `GET /config` (default event length) |
| `fetchIsAgendaEnabled` | `GET /api/v4/plugins/webapp` (core API, finds the plugin manifest) |

- **Updates use POST.** The server registers POST as an alias for PATCH because some proxies
  block PATCH. The webapp uses POST for the same reason.
- **Request bodies list only accepted fields.** The server rejects unknown fields with 400
  (`DisallowUnknownFields`), so `utils/form.ts` builds create inputs and patches from a
  whitelist, and a patch contains only changed fields. Server-owned fields (`id`, `version`,
  `createdAt`, ...) are never sent.
- **Paging.** Lists are fetched 100 items at a time. The client follows `hasMore` for up to
  5 pages (`AGENDA_MAX_PAGES`). This matters because `include_recurring=true` returns every
  recurring series regardless of the date range.

## Scope semantics (as implemented by the server)

| Mobile scope | Events | Tasks |
|---|---|---|
| My | `scope=my`: events I created or take part in (private only if mine) | `scope=my`: tasks **assigned to me** that I can still see, plus my private tasks |
| Team | `scope=team`: non-private events of the team I can view | `scope=team`: shared tasks of the team, plus my private tasks in it |
| Channel | `scope=team` for the channel's team, then filtered on the client to `channelId == channel` | `scope=channel`: channel-visibility tasks (needs read access) |

The events API has no channel scope. The channel filter only narrows events the server already
returned for the user, so it cannot show anything the user may not see.

"My Tasks" in the Tasks tab is `scope=my`. A task I created but did not assign to anyone (and
that is not private) is not in My scope. It shows up in the Team or Channel scope instead.

## Permissions in the UI

The server enforces every rule. The UI only hides actions the server would refuse:

- **Complete or reopen:** shown to the task's creator or its assignees. A status-only patch is
  allowed for them.
- **Edit or delete a task or event:** shown to the creator. Admins can do it on the server but
  don't get the buttons.
- **A 403 or 404 from any call** shows a localized message. Leaving a team or channel, or losing
  access, therefore shows up on the next fetch. Every scope change and every
  create/update/delete triggers a fetch.

## Errors

Agenda returns errors as `{"error": "..."}`. The core `ClientError` only reads `message`, so the
plugin's text isn't available. `utils/errors.ts` maps status codes to messages instead:
401 session expired, 403 no permission, 404 gone or no access, 400 invalid input, 409 changed
concurrently, anything else a generic message. Logs contain only the function name and
`getFullErrorMessage(error)`, never tokens or record contents.

## Time zones and recurrence

- Date-only task dues and all-day events are stored at UTC midnight. All-day ends are
  exclusive. The client reads them in UTC so every user sees the same calendar day.
- Timed values are epoch milliseconds shown in the device's local time. New records send the
  device's IANA zone (`moment.tz.guess()`) as `timezone`, as the webapp does with the browser
  zone.
- The server stores recurring series unexpanded. `utils/recurrence.ts` is a port of the
  webapp's `event_utils.ts`/`recurrence_utils.ts`, so both clients show the same occurrences.
  Event occurrences keep their wall-clock time in the event's zone across DST changes.
  Overrides move or cancel single occurrences. The only difference from the webapp:
  wall-clock conversion uses `moment-timezone` instead of `Intl.DateTimeFormat#formatToParts`,
  because Hermes doesn't guarantee time-zone support for that API.
- When a recurring task is completed, the server returns it reopened (`status: "todo"`) with
  the next `dueAt`. The client always shows the returned task.

## Caching and server switching

Agenda data is not persisted. Each list keeps its last result in React state under the key
`serverUrl|scope|range`. A new key clears the old rows before loading. A response that arrives
after a newer request has started is dropped (sequence guard). The native network client has no
abort, so this guard replaces request cancellation. Switching servers remounts the whole
authenticated tree, so no rows from another server can appear. Plugin detection is cached in
memory per server URL. Only a positive or negative answer is cached; if the manifest request
fails (for example offline at startup), the Agenda tab stays hidden until the home tabs
mount again (server switch or app restart), and detection is retried then.

## Verification

- Unit and component tests: `npx jest app/products/agenda`.
- Live run against Mattermost 11.7.0 with Agenda 0.2.0 in Docker, using only the Bearer header:
  see [agenda_integration_results.md](./agenda_integration_results.md). It covers auth (401
  without a token), private channel isolation, the assignee-only status change, the recurring
  task advancing, unknown-field rejection and 404 for invisible records. The query strings built
  by `ClientAgendaMix` for all three scopes were also sent to that server and all returned 200.
