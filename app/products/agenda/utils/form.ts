// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Pure helpers turning form state into API inputs. Only fields the server's request structs
// accept are produced (the server rejects unknown fields), and edits send only changed fields.

import type {AgendaEvent, AgendaVisibility, CreateEventInput, CreateTaskInput, Task, TaskPriority, TaskStatus, UpdateEventInput, UpdateTaskInput} from '@agenda/types';

export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 8000;

export type TaskForm = {
    title: string;
    description: string;
    visibility: AgendaVisibility;
    teamId: string;
    channelId?: string;
    hasDue: boolean;
    dueDate: Date;
    dueHasTime: boolean;
    priority: TaskPriority;
    status: TaskStatus;
    assignToMe: boolean;
};

export type EventForm = {
    title: string;
    description: string;
    location: string;
    visibility: AgendaVisibility;
    teamId: string;
    channelId?: string;
    allDay: boolean;
    start: Date;
    end: Date;
};

// Date-only values are UTC midnight of the picked calendar day; timed values are the instant.
export function dueFromForm(form: Pick<TaskForm, 'hasDue' | 'dueDate' | 'dueHasTime'>): number {
    if (!form.hasDue) {
        return 0;
    }
    const d = form.dueDate;
    return form.dueHasTime ? d.getTime() : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export function validateTitle(title: string): boolean {
    const trimmed = title.trim();
    return trimmed.length > 0 && trimmed.length <= MAX_TITLE_LENGTH;
}

export function buildCreateTask(form: TaskForm, currentUserId: string, timezone: string): CreateTaskInput {
    const dueAt = dueFromForm(form);
    return {
        teamId: form.teamId,
        channelId: form.visibility === 'channel' ? form.channelId : undefined,
        visibility: form.visibility,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        assigneeIds: form.visibility === 'private' || form.assignToMe ? [currentUserId] : [],
        dueAt: dueAt || undefined,
        dueHasTime: dueAt ? form.dueHasTime : undefined,
        timezone,
    };
}

export function buildTaskPatch(task: Task, form: TaskForm, timezone: string): UpdateTaskInput {
    const patch: UpdateTaskInput = {};
    const title = form.title.trim();
    const description = form.description.trim();
    if (title !== task.title) {
        patch.title = title;
    }
    if (description !== (task.description ?? '')) {
        patch.description = description;
    }
    if (form.priority !== task.priority) {
        patch.priority = form.priority;
    }
    if (form.status !== task.status) {
        patch.status = form.status;
    }
    const dueAt = dueFromForm(form);
    const dueHasTime = dueAt ? form.dueHasTime : false;
    if (dueAt !== (task.dueAt ?? 0) || dueHasTime !== Boolean(task.dueHasTime)) {
        patch.dueAt = dueAt;
        patch.dueHasTime = dueHasTime;
        patch.timezone = timezone;
    }
    return patch;
}

// eventTimes converts the form to the stored interval: all-day events are UTC midnights with an
// exclusive end; timed events are instants.
export function eventTimes(form: Pick<EventForm, 'allDay' | 'start' | 'end'>): {startAt: number; endAt: number} {
    if (form.allDay) {
        const s = form.start;
        const e = form.end;
        return {
            startAt: Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()),
            endAt: Date.UTC(e.getFullYear(), e.getMonth(), e.getDate() + 1),
        };
    }
    return {startAt: form.start.getTime(), endAt: form.end.getTime()};
}

export function validateEventTimes(form: Pick<EventForm, 'allDay' | 'start' | 'end'>): boolean {
    const {startAt, endAt} = eventTimes(form);
    return endAt > startAt;
}

export function buildCreateEvent(form: EventForm, currentUserId: string, timezone: string): CreateEventInput {
    return {
        teamId: form.teamId,
        channelId: form.visibility === 'channel' ? form.channelId : undefined,
        visibility: form.visibility,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        assigneeIds: [currentUserId],
        ...eventTimes(form),
        allDay: form.allDay,
        timezone,
    };
}

// buildEventPatch edits the series. Changing the start of a recurring series moves every
// occurrence, exactly as editing the series does in the webapp.
export function buildEventPatch(event: AgendaEvent, form: EventForm, timezone: string): UpdateEventInput {
    const patch: UpdateEventInput = {};
    const title = form.title.trim();
    if (title !== event.title) {
        patch.title = title;
    }
    if (form.description.trim() !== (event.description ?? '')) {
        patch.description = form.description.trim();
    }
    if (form.location.trim() !== (event.location ?? '')) {
        patch.location = form.location.trim();
    }
    const {startAt, endAt} = eventTimes(form);
    if (startAt !== event.startAt || endAt !== event.endAt || form.allDay !== Boolean(event.allDay)) {
        patch.startAt = startAt;
        patch.endAt = endAt;
        patch.allDay = form.allDay;
        patch.timezone = form.allDay ? event.timezone ?? timezone : timezone;
    }
    return patch;
}

// Form initialisers from stored records. Date-only/all-day values are read in UTC.
export function dateOfStored(value: number, utcDay: boolean): Date {
    const d = new Date(value);
    return utcDay ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 9) : d;
}
