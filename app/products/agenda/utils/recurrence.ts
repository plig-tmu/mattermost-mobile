// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Port of the Agenda webapp's event_utils.ts and recurrence_utils.ts. The server stores
// recurring series unexpanded; both clients expand them with this logic. Zoned wall-clock
// conversions use moment-timezone instead of Intl.DateTimeFormat#formatToParts, whose time
// zone support on Hermes is not guaranteed.

import moment from 'moment-timezone';

import {DAY_IN_MS, dueDateKey, localDateKey, utcDateKey} from './calendar';

import type {EventRecurrence, EventSummary, TaskRecurrence, TaskSummary} from '@agenda/types';

type CivilDate = {year: number; month: number; day: number};

export type EventOccurrence = {
    event: EventSummary;
    startAt: number;
    endAt: number;
    dateKey: string;

    // The start the series gives this slot; identifies the occurrence for edits.
    originalStart?: number;
};

export type TaskOccurrence = {
    task: TaskSummary;
    dueAt: number;
    dateKey: string;
};

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

function civilKey(date: CivilDate): string {
    return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(date: CivilDate, days: number): CivilDate {
    const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
    return {year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate()};
}

function compareDate(a: CivilDate, b: CivilDate): number {
    return civilKey(a).localeCompare(civilKey(b));
}

function weekdayOf(date: CivilDate): number {
    return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function utcDay(date: CivilDate): number {
    return Date.UTC(date.year, date.month - 1, date.day);
}

export function zonedParts(value: number, timeZone: string) {
    const m = moment.tz(value, timeZone);
    return {year: m.year(), month: m.month() + 1, day: m.date(), hour: m.hour(), minute: m.minute()};
}

export function zonedWallToEpoch(date: CivilDate, hour: number, minute: number, timeZone: string): number {
    return moment.tz({year: date.year, month: date.month - 1, date: date.day, hour, minute}, timeZone).valueOf();
}

function matchesEventRecurrence(date: CivilDate, anchor: CivilDate, recurrence: EventRecurrence): boolean {
    const key = civilKey(date);
    const anchorKey = civilKey(anchor);
    if (key < anchorKey) {
        return false;
    }
    if (key === anchorKey) {
        return true;
    }
    const interval = Math.min(99, Math.max(1, recurrence.interval ?? 1));
    const dayDiff = Math.round((utcDay(date) - utcDay(anchor)) / DAY_IN_MS);
    switch (recurrence.frequency) {
        case 'daily':
            return dayDiff % interval === 0;
        case 'weekly': {
            const selected = recurrence.weekdays?.length ? recurrence.weekdays : [weekdayOf(anchor)];
            if (!selected.includes(weekdayOf(date))) {
                return false;
            }
            const anchorWeek = addDays(anchor, -weekdayOf(anchor));
            const weekDiff = Math.round((utcDay(date) - utcDay(anchorWeek)) / (7 * DAY_IN_MS));
            return weekDiff >= 0 && weekDiff % interval === 0;
        }
        case 'monthly': {
            const monthDiff = ((date.year - anchor.year) * 12) + (date.month - anchor.month);
            return monthDiff >= 0 &&
                monthDiff % interval === 0 &&
                date.day === Math.min(anchor.day, daysInMonth(date.year, date.month));
        }
        case 'yearly':
            return date.year >= anchor.year &&
                (date.year - anchor.year) % interval === 0 &&
                date.month === anchor.month &&
                date.day === Math.min(anchor.day, daysInMonth(date.year, date.month));
        default:
            return false;
    }
}

function civilOfEvent(event: EventSummary, value: number, timeZone: string): CivilDate {
    if (event.allDay) {
        const date = new Date(value);
        return {year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate()};
    }
    const parts = zonedParts(value, timeZone);
    return {year: parts.year, month: parts.month, day: parts.day};
}

// expandEvent turns a series into concrete intervals around the visible days (with a two-day
// margin so events in another time zone land on the right local day). Overrides move or
// cancel single occurrences.
function expandEvent(event: EventSummary, days: Date[]): Array<{event: EventSummary; originalStart?: number}> {
    const recurrence = event.recurrence;
    if (!recurrence || recurrence.frequency === 'none' || days.length === 0) {
        return [{event}];
    }
    const timeZone = event.timezone || 'UTC';
    const anchor = civilOfEvent(event, event.startAt, timeZone);
    const anchorClock = event.allDay ? {hour: 0, minute: 0} : zonedParts(event.startAt, timeZone);
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const from = addDays({year: firstDay.getFullYear(), month: firstDay.getMonth() + 1, day: firstDay.getDate()}, -2);
    const to = addDays({year: lastDay.getFullYear(), month: lastDay.getMonth() + 1, day: lastDay.getDate()}, 2);
    const duration = event.endAt - event.startAt;
    const overrides = new Map((event.overrides ?? []).map((override) => [override.originalStart, override]));
    const handled = new Set<number>();
    const result: Array<{event: EventSummary; originalStart?: number}> = [];

    for (let date = from; compareDate(date, to) <= 0; date = addDays(date, 1)) {
        if (compareDate(date, anchor) < 0) {
            continue;
        }
        if (recurrence.until && civilKey(date) > recurrence.until) {
            break;
        }
        if (!matchesEventRecurrence(date, anchor, recurrence)) {
            continue;
        }
        const startAt = event.allDay ? utcDay(date) : zonedWallToEpoch(date, anchorClock.hour, anchorClock.minute, timeZone);
        const override = overrides.get(startAt);
        if (override) {
            handled.add(startAt);
            if (!override.cancelled && override.startAt && override.endAt) {
                result.push({event: {...event, startAt: override.startAt, endAt: override.endAt}, originalStart: startAt});
            }
            continue;
        }
        result.push({event: {...event, startAt, endAt: startAt + duration}, originalStart: startAt});
    }

    // Occurrences moved into the window from slots the day scan cannot see.
    for (const override of event.overrides ?? []) {
        if (override.cancelled || handled.has(override.originalStart) || !override.startAt || !override.endAt) {
            continue;
        }
        const date = civilOfEvent(event, override.startAt, timeZone);
        if (compareDate(date, from) < 0 || compareDate(date, to) > 0) {
            continue;
        }
        result.push({event: {...event, startAt: override.startAt, endAt: override.endAt}, originalStart: override.originalStart});
    }
    return result;
}

// eventOccurrencesForDays puts an event (or each occurrence of a series) on every visible day
// it overlaps. All-day events use UTC dates with an exclusive end; timed events use local dates.
export function eventOccurrencesForDays(event: EventSummary, days: Date[]): EventOccurrence[] {
    if (event.endAt <= event.startAt) {
        return [];
    }
    const occurrences: EventOccurrence[] = [];
    for (const concrete of expandEvent(event, days)) {
        const series = concrete.event;
        if (series.endAt <= series.startAt) {
            continue;
        }
        const startKey = series.allDay ? utcDateKey(series.startAt) : localDateKey(new Date(series.startAt));
        const endKey = series.allDay ? utcDateKey(series.endAt - 1) : localDateKey(new Date(series.endAt - 1));
        for (const day of days) {
            const key = localDateKey(day);
            if (key < startKey || key > endKey) {
                continue;
            }
            occurrences.push({event: series, startAt: series.startAt, endAt: series.endAt, dateKey: key, originalStart: concrete.originalStart});
        }
    }
    return occurrences;
}

export function compareEventOccurrences(a: EventOccurrence, b: EventOccurrence): number {
    if (Boolean(a.event.allDay) !== Boolean(b.event.allDay)) {
        return a.event.allDay ? -1 : 1;
    }
    if (a.startAt !== b.startAt) {
        return a.startAt - b.startAt;
    }
    return a.event.title.localeCompare(b.event.title);
}

type DateParts = {year: number; month: number; day: number};

function taskStartParts(recurrence: TaskRecurrence, dueAt: number, hasTime: boolean): DateParts {
    const match = recurrence.startDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return {year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3])};
    }
    const date = new Date(dueAt);
    if (hasTime) {
        return {year: date.getFullYear(), month: date.getMonth(), day: date.getDate()};
    }
    return {year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate()};
}

function matchesTaskCadence(parts: DateParts, start: DateParts, recurrence: TaskRecurrence, interval: number): boolean {
    const diffDays = Math.round((Date.UTC(parts.year, parts.month, parts.day) - Date.UTC(start.year, start.month, start.day)) / DAY_IN_MS);
    if (diffDays < 0) {
        return false;
    }
    const monthDays = new Date(parts.year, parts.month + 1, 0).getDate();
    switch (recurrence.frequency) {
        case 'daily':
            return diffDays % interval === 0;
        case 'weekly':
            return diffDays % (7 * interval) === 0;
        case 'monthly': {
            const monthDiff = ((parts.year - start.year) * 12) + (parts.month - start.month);
            return monthDiff >= 0 && monthDiff % interval === 0 && parts.day === Math.min(start.day, monthDays);
        }
        case 'yearly': {
            const yearDiff = parts.year - start.year;
            return yearDiff >= 0 && yearDiff % interval === 0 && parts.month === start.month && parts.day === Math.min(start.day, monthDays);
        }
        default:
            return false;
    }
}

// taskOccurrencesForDays expands a task into the visible days. The current due date is always
// an occurrence; later dates follow the recurrence. Done tasks show only their due date.
export function taskOccurrencesForDays(task: TaskSummary, days: Date[]): TaskOccurrence[] {
    const currentKey = dueDateKey(task);
    if (!task.dueAt || !currentKey) {
        return [];
    }
    const recurrence = task.recurrence;
    if (!recurrence || recurrence.frequency === 'none' || task.status === 'done') {
        return days.some((day) => localDateKey(day) === currentKey) ? [{task, dueAt: task.dueAt, dateKey: currentKey}] : [];
    }

    const start = taskStartParts(recurrence, task.dueAt, Boolean(task.dueHasTime));
    const untilKey = recurrence.until ? utcDateKey(recurrence.until) : undefined;
    const interval = Math.min(99, Math.max(1, recurrence.interval ?? 1));
    const anchor = new Date(task.dueAt);
    const occurrences: TaskOccurrence[] = [];
    for (const day of days) {
        const key = localDateKey(day);
        if (key < currentKey || (untilKey && key > untilKey)) {
            continue;
        }
        const parts = {year: day.getFullYear(), month: day.getMonth(), day: day.getDate()};
        if (key !== currentKey && !matchesTaskCadence(parts, start, recurrence, interval)) {
            continue;
        }
        const dueAt = task.dueHasTime ? new Date(parts.year, parts.month, parts.day, anchor.getHours(), anchor.getMinutes(), anchor.getSeconds(), anchor.getMilliseconds()).getTime() : Date.UTC(parts.year, parts.month, parts.day);
        occurrences.push({task, dueAt, dateKey: key});
    }
    return occurrences;
}

export function compareTaskOccurrences(a: TaskOccurrence, b: TaskOccurrence): number {
    const aDone = a.task.status === 'done';
    const bDone = b.task.status === 'done';
    if (aDone !== bDone) {
        return aDone ? 1 : -1;
    }
    if (a.dueAt !== b.dueAt) {
        return a.dueAt - b.dueAt;
    }
    return a.task.createdAt - b.task.createdAt;
}
