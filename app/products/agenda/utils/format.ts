// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages, type IntlShape} from 'react-intl';

import {displayUsername} from '@utils/user';

import type {AgendaNames} from '@agenda/queries';
import type {AgendaEvent, EventRecurrence, EventSummary, TaskRecurrence, TaskSummary} from '@agenda/types';

const messages = defineMessages({
    allDay: {id: 'agenda.event.all_day', defaultMessage: 'All day'},
    noDue: {id: 'agenda.task.no_due', defaultMessage: 'No due date'},
    personal: {id: 'agenda.scope.personal', defaultMessage: 'Private'},
    daily: {id: 'agenda.recurrence.daily', defaultMessage: '{count, plural, one {Every day} other {Every # days}}'},
    weekly: {id: 'agenda.recurrence.weekly', defaultMessage: '{count, plural, one {Every week} other {Every # weeks}}'},
    monthly: {id: 'agenda.recurrence.monthly', defaultMessage: '{count, plural, one {Every month} other {Every # months}}'},
    yearly: {id: 'agenda.recurrence.yearly', defaultMessage: '{count, plural, one {Every year} other {Every # years}}'},
    until: {id: 'agenda.recurrence.until', defaultMessage: '{rule} until {date}'},
});

// localDateOfUtcDay turns a date-only value (UTC midnight) into a local Date on the same calendar
// day, so it can be formatted without a timeZone option.
export function localDateOfUtcDay(value: number): Date {
    const date = new Date(value);
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function formatEventTime(intl: IntlShape, event: Pick<EventSummary, 'allDay' | 'startAt' | 'endAt'>): string {
    if (event.allDay) {
        return intl.formatMessage(messages.allDay);
    }
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const startLabel = intl.formatTime(start, {hour: 'numeric', minute: '2-digit'});
    const endLabel = intl.formatTime(end, {hour: 'numeric', minute: '2-digit'});
    if (start.toDateString() === end.toDateString()) {
        return `${startLabel} – ${endLabel}`;
    }
    return `${intl.formatDate(start, {month: 'short', day: 'numeric'})} ${startLabel} – ${intl.formatDate(end, {month: 'short', day: 'numeric'})} ${endLabel}`;
}

export function formatEventRange(intl: IntlShape, event: Pick<AgendaEvent, 'allDay' | 'startAt' | 'endAt'>): string {
    if (event.allDay) {
        const start = localDateOfUtcDay(event.startAt);

        // All-day ends are exclusive.
        const last = localDateOfUtcDay(event.endAt - 1);
        const startLabel = intl.formatDate(start, {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'});
        if (start.toDateString() === last.toDateString()) {
            return startLabel;
        }
        return `${startLabel} – ${intl.formatDate(last, {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}`;
    }
    const date = intl.formatDate(new Date(event.startAt), {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'});
    return `${date}, ${formatEventTime(intl, event)}`;
}

// formatDue formats a due value; with dueAt overridden for a recurring occurrence.
export function formatDue(intl: IntlShape, task: Pick<TaskSummary, 'dueAt' | 'dueHasTime'>, withDate = true): string {
    if (!task.dueAt) {
        return intl.formatMessage(messages.noDue);
    }
    if (task.dueHasTime) {
        const date = new Date(task.dueAt);
        const time = intl.formatTime(date, {hour: 'numeric', minute: '2-digit'});
        return withDate ? `${intl.formatDate(date, {month: 'short', day: 'numeric'})} ${time}` : time;
    }
    return withDate ? intl.formatDate(localDateOfUtcDay(task.dueAt), {month: 'short', day: 'numeric'}) : intl.formatMessage(messages.allDay);
}

export function formatRecurrence(intl: IntlShape, recurrence?: TaskRecurrence | EventRecurrence): string | undefined {
    if (!recurrence || recurrence.frequency === 'none') {
        return undefined;
    }
    const rule = intl.formatMessage(messages[recurrence.frequency], {count: recurrence.interval ?? 1});
    let untilDate: Date | undefined;
    if (typeof recurrence.until === 'number' && recurrence.until) {
        untilDate = localDateOfUtcDay(recurrence.until);
    } else if (typeof recurrence.until === 'string' && recurrence.until) {
        const [y, m, d] = recurrence.until.split('-').map(Number);
        untilDate = new Date(y, m - 1, d);
    }
    if (!untilDate) {
        return rule;
    }
    return intl.formatMessage(messages.until, {rule, date: intl.formatDate(untilDate, {month: 'short', day: 'numeric', year: 'numeric'})});
}

// scopeLabel shows where a record lives: "Team / ~channel", the team, or Private.
export function scopeLabel(intl: IntlShape, record: {teamId: string; channelId?: string; visibility: string}, names: AgendaNames): string {
    if (record.visibility === 'private') {
        return intl.formatMessage(messages.personal);
    }
    const team = names.teams[record.teamId]?.displayName;
    const channel = record.channelId ? names.channels[record.channelId]?.displayName : undefined;
    return [team, channel && `~${channel}`].filter(Boolean).join(' / ');
}

export function assigneeLabel(ids: string[], names: AgendaNames, locale: string, teammateNameDisplay?: string): string {
    return ids.
        map((id) => names.users[id]).
        filter(Boolean).
        map((user) => displayUsername(user, locale, teammateNameDisplay)).
        join(', ');
}
