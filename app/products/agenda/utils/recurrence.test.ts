// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {calendarRange, localDateKey} from './calendar';
import {eventOccurrencesForDays, taskOccurrencesForDays} from './recurrence';

import type {EventSummary, TaskSummary} from '@agenda/types';

const baseEvent: EventSummary = {
    id: 'event1',
    teamId: 'team1',
    visibility: 'team',
    creatorId: 'user1',
    assigneeIds: [],
    title: 'Standup',
    startAt: 0,
    endAt: 0,
    createdAt: 1,
    updatedAt: 1,
};

const baseTask: TaskSummary = {
    id: 'task1',
    teamId: 'team1',
    visibility: 'team',
    creatorId: 'user1',
    title: 'Report',
    status: 'todo',
    priority: 'none',
    assigneeIds: [],
    createdAt: 1,
    updatedAt: 1,
};

// Week of Mon 2 Nov – Sun 8 Nov 2026; America/New_York leaves DST on 1 Nov 2026.
const novWeek = calendarRange('week', new Date(2026, 10, 4), 1).days;

describe('eventOccurrencesForDays', () => {
    it('should keep the wall-clock time in the event time zone across a DST change', () => {
        // Mon 26 Oct 2026 09:00 in New York is 13:00 UTC (EDT).
        const event: EventSummary = {
            ...baseEvent,
            startAt: Date.UTC(2026, 9, 26, 13),
            endAt: Date.UTC(2026, 9, 26, 13, 30),
            timezone: 'America/New_York',
            recurrence: {frequency: 'weekly'},
        };
        const occurrences = eventOccurrencesForDays(event, novWeek);
        expect(occurrences).toHaveLength(1);

        // Mon 2 Nov 09:00 EST is 14:00 UTC.
        expect(occurrences[0].startAt).toBe(Date.UTC(2026, 10, 2, 14));
        expect(occurrences[0].endAt).toBe(Date.UTC(2026, 10, 2, 14, 30));
        expect(occurrences[0].dateKey).toBe(localDateKey(new Date(Date.UTC(2026, 10, 2, 14))));
        expect(occurrences[0].originalStart).toBe(Date.UTC(2026, 10, 2, 14));
    });

    it('should expand selected weekdays and stop after the inclusive until date', () => {
        const event: EventSummary = {
            ...baseEvent,
            startAt: Date.UTC(2026, 10, 2, 9),
            endAt: Date.UTC(2026, 10, 2, 10),
            timezone: 'UTC',
            recurrence: {frequency: 'weekly', weekdays: [1, 3, 5], until: '2026-11-04'},
        };
        const keys = eventOccurrencesForDays(event, novWeek).map((o) => o.dateKey);
        expect(keys).toEqual(['2026-11-02', '2026-11-04']);
    });

    it('should apply cancelled and moved overrides', () => {
        const event: EventSummary = {
            ...baseEvent,
            startAt: Date.UTC(2026, 10, 2, 9),
            endAt: Date.UTC(2026, 10, 2, 10),
            timezone: 'UTC',
            recurrence: {frequency: 'daily'},
            overrides: [
                {originalStart: Date.UTC(2026, 10, 3, 9), cancelled: true},

                // A small move keeps the occurrence on the same local day from UTC-9 to UTC+14.
                {originalStart: Date.UTC(2026, 10, 4, 9), startAt: Date.UTC(2026, 10, 4, 9, 30), endAt: Date.UTC(2026, 10, 4, 9, 45)},
            ],
        };
        const occurrences = eventOccurrencesForDays(event, novWeek);
        expect(occurrences.map((o) => o.originalStart)).not.toContain(Date.UTC(2026, 10, 3, 9));
        const moved = occurrences.find((o) => o.originalStart === Date.UTC(2026, 10, 4, 9));
        expect(moved?.startAt).toBe(Date.UTC(2026, 10, 4, 9, 30));
        expect(moved?.originalStart).toBe(Date.UTC(2026, 10, 4, 9));
    });

    it('should place a multi-day all-day event on each day using an exclusive end', () => {
        const event: EventSummary = {
            ...baseEvent,
            allDay: true,
            startAt: Date.UTC(2026, 10, 3),
            endAt: Date.UTC(2026, 10, 5),
        };
        expect(eventOccurrencesForDays(event, novWeek).map((o) => o.dateKey)).toEqual(['2026-11-03', '2026-11-04']);
    });
});

describe('taskOccurrencesForDays', () => {
    it('should show the current due date and following recurrences', () => {
        const task: TaskSummary = {
            ...baseTask,
            dueAt: Date.UTC(2026, 10, 3),
            recurrence: {frequency: 'daily', interval: 2, startDate: '2026-11-03'},
        };
        expect(taskOccurrencesForDays(task, novWeek).map((o) => o.dateKey)).toEqual(['2026-11-03', '2026-11-05', '2026-11-07']);
    });

    it('should show a done recurring task only on its due date', () => {
        const task: TaskSummary = {
            ...baseTask,
            status: 'done',
            dueAt: Date.UTC(2026, 10, 3),
            recurrence: {frequency: 'daily', startDate: '2026-11-03'},
        };
        expect(taskOccurrencesForDays(task, novWeek).map((o) => o.dateKey)).toEqual(['2026-11-03']);
    });

    it('should return nothing for tasks without a due date', () => {
        expect(taskOccurrencesForDays(baseTask, novWeek)).toHaveLength(0);
    });
});
