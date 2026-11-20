// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Port of the Agenda webapp's calendar_utils.ts. Keep the semantics identical so mobile and
// web show the same days for the same data.

import type {TaskSummary} from '@agenda/types';

export type CalendarMode = 'week' | 'month';

export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type CalendarRange = {
    days: Date[];
    start: Date;
    end: Date;
};

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

export function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addLocalMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function localDateKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function utcDateKey(value: number): string {
    const date = new Date(value);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function dateFromKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function startOfWeek(date: Date, weekStart: number): Date {
    const day = startOfLocalDay(date);
    const offset = ((day.getDay() - weekStart) + 7) % 7;
    return addLocalDays(day, -offset);
}

function makeRange(start: Date, end: Date): CalendarRange {
    const days: Date[] = [];
    for (let day = start; day.getTime() <= end.getTime(); day = addLocalDays(day, 1)) {
        days.push(day);
    }
    return {days, start, end};
}

// calendarRange returns the visible days: one week, or the full weeks covering a month.
export function calendarRange(mode: CalendarMode, cursor: Date, weekStart: number): CalendarRange {
    if (mode === 'week') {
        const start = startOfWeek(cursor, weekStart);
        return makeRange(start, addLocalDays(start, 6));
    }

    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const start = startOfWeek(first, weekStart);
    const end = addLocalDays(startOfWeek(last, weekStart), 6);
    return makeRange(start, end);
}

// calendarQueryBounds widens the visible range by a day on each side. Date-only values are
// stored at UTC midnight while timed values use local time, so raw timestamps differ by time
// zone; the calendar filters the returned items by their displayed day.
export function calendarQueryBounds(start: Date, end: Date): {from: number; to: number} {
    return {
        from: Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - DAY_IN_MS,
        to: Date.UTC(end.getFullYear(), end.getMonth(), end.getDate() + 1) + DAY_IN_MS,
    };
}

// dueDateKey returns the calendar day a task belongs to. A date-only task is the same day for
// every member of a team, so it is read in UTC; a timed task belongs to the viewer's local day.
export function dueDateKey(task: Pick<TaskSummary, 'dueAt' | 'dueHasTime'>): string | undefined {
    if (!task.dueAt || task.dueAt <= 0) {
        return undefined;
    }
    if (task.dueHasTime) {
        return localDateKey(new Date(task.dueAt));
    }
    return utcDateKey(task.dueAt);
}
