// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Types mirror the Agenda plugin's API models (server/model/task.go, event.go,
// event_recurrence.go, event_override.go, recurrence.go). Do not add fields the server
// does not send.

export type AgendaVisibility = 'private' | 'team' | 'channel';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'none' | 'low' | 'normal' | 'high' | 'urgent';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none';

export type TaskRecurrence = {
    frequency: RecurrenceFrequency;
    interval?: number;
    startDate?: string;
    until?: number;
    timezone?: string;
};

export type EventRecurrence = {
    frequency: RecurrenceFrequency;
    interval?: number;

    // 0 = Sunday … 6 = Saturday, weekly series only.
    weekdays?: number[];

    // Inclusive "YYYY-MM-DD".
    until?: string;
};

export type EventOverride = {
    originalStart: number;
    startAt?: number;
    endAt?: number;
    cancelled?: boolean;
};

export type TaskSummary = {
    id: string;
    teamId: string;
    channelId?: string;
    visibility: AgendaVisibility;
    creatorId: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeIds: string[];
    dueAt?: number;
    dueHasTime?: boolean;
    timezone?: string;
    recurrence?: TaskRecurrence;
    reminders?: number[];
    position?: number;
    createdAt: number;
    updatedAt: number;
};

export type Task = TaskSummary & {
    description?: string;
    sourcePostId?: string;
    parentTaskId?: string;
    completedAt?: number;
    version: number;
};

export type EventSummary = {
    id: string;
    teamId: string;
    channelId?: string;
    visibility: AgendaVisibility;
    creatorId: string;
    assigneeIds: string[];
    title: string;
    location?: string;
    color?: string;
    startAt: number;
    endAt: number;
    allDay?: boolean;
    timezone?: string;
    recurrence?: EventRecurrence;
    overrides?: EventOverride[];
    reminders?: number[];
    createdAt: number;
    updatedAt: number;
};

export type AgendaEvent = EventSummary & {
    description?: string;
    version: number;
};

export type ListResult<T> = {
    items: T[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
};

export type TaskQuery = {
    scope: 'my' | 'team' | 'channel' | 'all';
    teamId?: string;
    channelId?: string;
    statuses?: TaskStatus[];
    hasDue?: boolean;
    includeRecurring?: boolean;
    dueAfter?: number;
    dueBefore?: number;
    sortBy?: 'due' | 'created' | 'priority' | 'manual';
    direction?: 'asc' | 'desc';
    page?: number;
    perPage?: number;
};

export type EventQuery = {
    scope: 'my' | 'team';
    teamId?: string;
    from: number;
    to: number;
    includeRecurring?: boolean;
    page?: number;
    perPage?: number;
};

// Create/patch inputs list only the fields the server's request structs accept; the server
// decodes with DisallowUnknownFields.
export type CreateTaskInput = {
    teamId: string;
    channelId?: string;
    visibility: AgendaVisibility;
    title: string;
    description?: string;
    assigneeIds?: string[];
    status?: TaskStatus;
    priority?: TaskPriority;
    dueAt?: number;
    dueHasTime?: boolean;
    timezone?: string;
};

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'teamId'>> & {teamId?: string};

export type CreateEventInput = {
    teamId: string;
    channelId?: string;
    visibility: AgendaVisibility;
    title: string;
    description?: string;
    location?: string;
    assigneeIds?: string[];
    startAt: number;
    endAt: number;
    allDay?: boolean;
    timezone?: string;
};

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'teamId'>> & {teamId?: string};

export type AgendaConfig = {
    defaultEventDurationMinutes: number;
};

// Scope selected in the mobile UI. Channel calendars carry the channel's team because the
// events API has no channel scope and is queried per team.
export type AgendaScope =
    | {kind: 'my'}
    | {kind: 'team'; teamId: string}
    | {kind: 'channel'; teamId: string; channelId: string};
