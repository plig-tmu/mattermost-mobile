// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo} from 'react';

import {fetchAgendaEvents, fetchAgendaTasks, setAgendaTaskStatus, taskQueryForScope} from '@agenda/actions/remote';
import {calendarQueryBounds, localDateKey} from '@agenda/utils/calendar';
import {compareEventOccurrences, compareTaskOccurrences, eventOccurrencesForDays, taskOccurrencesForDays} from '@agenda/utils/recurrence';

import {emitAgendaChanged, useAgendaRequest} from './use_agenda_request';

import type {AgendaItem} from '@agenda/components/agenda_item_row';
import type {AgendaScope, EventSummary, Task, TaskSummary} from '@agenda/types';

type RangeData = {events: EventSummary[]; tasks: TaskSummary[]};

export function scopeKey(scope: AgendaScope) {
    switch (scope.kind) {
        case 'team':
            return `team:${scope.teamId}`;
        case 'channel':
            return `channel:${scope.channelId}`;
        default:
            return 'my';
    }
}

// buildItemsByDay groups event and task occurrences by local day key, events first.
export function buildItemsByDay(data: RangeData | undefined, days: Date[]): Map<string, AgendaItem[]> {
    const byDay = new Map<string, AgendaItem[]>();
    for (const day of days) {
        byDay.set(localDateKey(day), []);
    }
    if (!data) {
        return byDay;
    }
    const eventOccurrences = data.events.flatMap((event) => eventOccurrencesForDays(event, days)).sort(compareEventOccurrences);
    for (const occurrence of eventOccurrences) {
        byDay.get(occurrence.dateKey)?.push({kind: 'event', key: `e:${occurrence.event.id}:${occurrence.startAt}:${occurrence.dateKey}`, occurrence});
    }
    const taskOccurrences = data.tasks.flatMap((task) => taskOccurrencesForDays(task, days)).sort(compareTaskOccurrences);
    for (const occurrence of taskOccurrences) {
        byDay.get(occurrence.dateKey)?.push({kind: 'task', key: `t:${occurrence.task.id}:${occurrence.dateKey}`, occurrence});
    }
    return byDay;
}

export function mergeTask(tasks: TaskSummary[], updated: Task): TaskSummary[] {
    return tasks.map((task) => (task.id === updated.id ? {...task, ...updated} : task));
}

// useAgendaRange fetches the events and due tasks of the visible days (widened by a day on each
// side, like the webapp) for one scope.
export function useAgendaRange(serverUrl: string, scope: AgendaScope, days: Date[]) {
    const first = days[0];
    const last = days[days.length - 1];
    const bounds = useMemo(() => calendarQueryBounds(first, last), [first, last]);
    const key = `${serverUrl}|${scopeKey(scope)}|${bounds.from}|${bounds.to}`;

    const load = useCallback(async () => {
        const [events, tasks] = await Promise.all([
            fetchAgendaEvents(serverUrl, scope, bounds.from, bounds.to),
            fetchAgendaTasks(serverUrl, {
                ...taskQueryForScope(scope),
                hasDue: true,
                includeRecurring: true,
                dueAfter: bounds.from,
                dueBefore: bounds.to,
                sortBy: 'due',
                direction: 'asc',
            }),
        ]);
        const error = events.error ?? tasks.error;
        if (error) {
            return {error};
        }
        return {data: {events: events.data ?? [], tasks: tasks.data ?? []}};
    }, [serverUrl, scope, bounds]);

    const request = useAgendaRequest<RangeData>(key, load);
    const itemsByDay = useMemo(() => buildItemsByDay(request.data, days), [request.data, days]);

    const {setData} = request;
    const toggleTask = useCallback(async (task: TaskSummary) => {
        const result = await setAgendaTaskStatus(serverUrl, task.id, task.status === 'done' ? 'todo' : 'done');
        if (result.data) {
            const updated = result.data;
            setData((data) => (data ? {...data, tasks: mergeTask(data.tasks, updated)} : data));
            emitAgendaChanged();
        }
        return result;
    }, [serverUrl, setData]);

    return {...request, itemsByDay, toggleTask};
}
