# Agenda plugin: live API checks with mobile-style auth

Run date: 2026-11-20. Every check passed.

## Environment

- Server: `mattermost/mattermost-enterprise-edition:11.7.0`, unlicensed (so it runs with team-edition features). Build number 25394005513.
- Database: `postgres:15-alpine`
- Plugin: `com.github.3tty0n.mattermost-agenda` v0.2.0, built from the local source with `make dist` (Go 1.27.4, Node 24.15.0). The webapp built with no errors (3 webpack warnings).
- Installed with `POST /api/v4/plugins` and enabled with `POST /api/v4/plugins/{id}/enable`, both as system admin. The plugin status afterwards was `state: 2` (running).

## Steps

```sh
docker network create agenda-net
docker run -d --name agenda-pg --network agenda-net -e POSTGRES_USER=mmuser \
  -e POSTGRES_PASSWORD=<throwaway> -e POSTGRES_DB=mattermost postgres:15-alpine
docker run -d --name agenda-mm --network agenda-net -p 8065:8065 \
  -e MM_SQLSETTINGS_DRIVERNAME=postgres \
  -e "MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:<throwaway>@agenda-pg:5432/mattermost?sslmode=disable&connect_timeout=10" \
  -e MM_PLUGINSETTINGS_ENABLEUPLOADS=true -e MM_PLUGINSETTINGS_ENABLE=true \
  -e MM_SERVICESETTINGS_SITEURL=http://localhost:8065 -e MM_TEAMSETTINGS_ENABLEOPENSERVER=true \
  mattermost/mattermost-enterprise-edition:11.7.0
```

1. Created `admin`, `usera` and `userb` with `POST /api/v4/users`. As the first user, `admin` became system admin.
2. As admin, created open team T and added A and B to it. Created public channel P with A and B as members. Created private channel X, added A, then removed admin, so A is X's only member.
3. Uploaded and enabled the plugin as admin.
4. Logged in A and B with `POST /api/v4/users/login` and took the session token from the `Token` response header.
5. Called `/plugins/com.github.3tty0n.mattermost-agenda/api/v1/...` with curl. Each request carried only `Authorization: Bearer <token>` and `X-Requested-With: XMLHttpRequest`, plus `Content-Type: application/json` when there was a body. No cookies and no CSRF token were sent. All updates used `POST`.

Fixed times (UTC):
- Timed team event: 2026-11-23 10:00–11:00.
- Weekly event in channel P: Mondays 12:00–12:30, `recurrence {frequency:"weekly", weekdays:[1]}`.
- Daily task: `dueAt` 2026-11-21 00:00 (1795219200000), `dueHasTime:false`, `recurrence {frequency:"daily", timezone:"UTC"}`.
- Event query window: `from=1794787200000` (2026-11-16) to `to=1797206400000` (2026-12-14), `include_recurring=true`.

## Results

| # | Check | Expected | Actual |
|---|-------|----------|--------|
| a | `GET /tasks?scope=my` with no Authorization header | 401 | **401** `Not authorized` |
| b1 | A creates a task in X (`visibility:"channel"`) | 201 | **201** status `todo`, version 1 |
| b2 | A creates a team task assigned to B | 201 | **201** `assigneeIds:[B]` |
| b3 | A creates a private task | 201 | **201**. The server set `assigneeIds:[A]` automatically. |
| b4 | A creates a timed event in T | 201 | **201** |
| b5 | A creates a weekly recurring event with `channelId:P`, `visibility:"channel"` | 201 | **201**. The server normalised recurrence to `{frequency:"weekly", interval:1, weekdays:[1]}`. |
| b6 | A creates a daily recurring task with a date-only due | 201 | **201** `dueAt:1795219200000`. The server filled in recurrence `startDate:"2026-11-21"` and `interval:1`. `dueHasTime` was left out of the response because it is false and the field is omitempty. |
| c1 | A `scope=my` | A's tasks | **200**, 1 item: "A private task" |
| c2 | A `scope=team&team_id=T` | everything A can see | **200**, 4 items: X task, team task for B, private task, daily chore |
| c3 | A `scope=channel&channel_id=X` | X task | **200**, 1 item: X task |
| c4 | B `scope=my` | team task for B | **200**, 1 item: "Team task for B" |
| c5 | B `scope=team&team_id=T` | no X task, no A private task | **200**, 2 items: "Team task for B" and "Daily chore". Neither the X task nor the private task appears. |
| c6 | B `scope=channel&channel_id=X` | 403 | **403** `You don't have permission to do that` |
| d1 | A events `scope=my` | both events | **200**, 2 items: "Team sync" and "Weekly P standup" |
| d2 | A events `scope=team` | both events | **200**, 2 items |
| d3 | B events `scope=my` | none (B isn't assigned to either) | **200**, 0 items |
| d4 | B events `scope=team` | both events (B is in P) | **200**, 2 items |
| e1 | B (assignee) `POST /tasks/{teamTask}` `{"status":"done"}` | 200 | **200** `status:"done"`, `completedAt` set, version 2 |
| e2 | B `POST /tasks/{teamTask}` `{"title":"hijacked"}` | 403 | **403** |
| f | A `POST /tasks/{daily}` `{"status":"done"}` | status `todo`, later `dueAt` | **200** `status:"todo"`, `dueAt` 1795219200000 → **1795305600000** (2026-11-21 → 2026-11-22 00:00 UTC), version 2, no `completedAt` |
| g | `POST /tasks/{id}` `{"status":"done","id":"x"}` | 400 | **400** `Invalid request body` |
| h1 | B `GET /tasks/{X task}` | 404 | **404** `Not found` |
| h2 | B `GET /tasks/{A private task}` (extra check) | 404 | **404** |
| h3 | A `GET /tasks/{X task}` (control) | 200 | **200** |

## Mismatches and things to know on the client side

There were no mismatches. These details matter for the mobile client:

- `scope=my` returns tasks *assigned* to the caller, not tasks the caller created. A created "Daily chore" with no assignee, and it does not appear in A's `scope=my`. A private task is assigned to its creator automatically.
- List responses (`/tasks`, `/events`) have the shape `{items,total,page,perPage,hasMore}`. Items in a list have no `version` field. Single-item responses (create, update, get) include `version`.
- `GET /events` with `include_recurring=true` returns each recurring series once, with its `recurrence` object. It does not expand the series into separate occurrences, so the client has to expand them itself.
- Fields that are false or empty are left out of responses (`dueHasTime`, `channelId`, `completedAt`, and others). The client should treat a missing field as false or empty.
- A series event visible to B through channel P shows up in B's `scope=team` results but not in B's `scope=my` results.

## Reproduction scripts

The scripts are kept outside the repo, in the session scratchpad: `setup.sh` (users, team, channels, plugin install) and `checks.sh` (all of the checks above).
