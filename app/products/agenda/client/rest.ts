// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AGENDA_PLUGIN_ID} from '@agenda/constants';
import {buildQueryString} from '@utils/helpers';

import type {
    AgendaConfig,
    AgendaEvent,
    CreateEventInput,
    CreateTaskInput,
    EventQuery,
    EventSummary,
    ListResult,
    Task,
    TaskQuery,
    TaskSummary,
    UpdateEventInput,
    UpdateTaskInput,
} from '@agenda/types';
import type ClientBase from '@client/rest/base';

export interface ClientAgendaMix {
    getAgendaRoute: () => string;
    getAgendaTasks: (query: TaskQuery) => Promise<ListResult<TaskSummary>>;
    getAgendaTask: (taskId: string) => Promise<Task>;
    createAgendaTask: (input: CreateTaskInput) => Promise<Task>;
    updateAgendaTask: (taskId: string, patch: UpdateTaskInput) => Promise<Task>;
    deleteAgendaTask: (taskId: string) => Promise<void>;
    getAgendaEvents: (query: EventQuery) => Promise<ListResult<EventSummary>>;
    getAgendaEvent: (eventId: string) => Promise<AgendaEvent>;
    createAgendaEvent: (input: CreateEventInput) => Promise<AgendaEvent>;
    updateAgendaEvent: (eventId: string, patch: UpdateEventInput) => Promise<AgendaEvent>;
    deleteAgendaEvent: (eventId: string) => Promise<void>;
    getAgendaConfig: () => Promise<AgendaConfig>;
}

// Requests go through doFetch, which carries the user's existing Mattermost session as an
// Authorization: Bearer header. The server authenticates it and passes the plugin only the
// Mattermost-User-ID header; no user ID is ever sent by this client.
const ClientAgenda = <TBase extends Constructor<ClientBase>>(superclass: TBase) => class extends superclass {
    getAgendaRoute = () => {
        return `/plugins/${AGENDA_PLUGIN_ID}/api/v1`;
    };

    getAgendaTasks = async (query: TaskQuery) => {
        const params = buildQueryString({
            scope: query.scope,
            team_id: query.teamId,
            channel_id: query.channelId,
            status: query.statuses?.length ? query.statuses.join(',') : undefined,
            has_due: query.hasDue,
            include_recurring: query.includeRecurring,
            due_after: query.dueAfter,
            due_before: query.dueBefore,
            sort: query.sortBy,
            direction: query.direction,
            page: query.page,
            per_page: query.perPage,
        });
        return this.doFetch(`${this.getAgendaRoute()}/tasks${params}`, {method: 'get'});
    };

    getAgendaTask = async (taskId: string) => {
        return this.doFetch(`${this.getAgendaRoute()}/tasks/${encodeURIComponent(taskId)}`, {method: 'get'});
    };

    createAgendaTask = async (input: CreateTaskInput) => {
        return this.doFetch(`${this.getAgendaRoute()}/tasks`, {method: 'post', body: input});
    };

    // POST is the server's documented alias for PATCH; the webapp uses it too because some
    // proxies reject PATCH.
    updateAgendaTask = async (taskId: string, patch: UpdateTaskInput) => {
        return this.doFetch(`${this.getAgendaRoute()}/tasks/${encodeURIComponent(taskId)}`, {method: 'post', body: patch});
    };

    deleteAgendaTask = async (taskId: string) => {
        await this.doFetch(`${this.getAgendaRoute()}/tasks/${encodeURIComponent(taskId)}`, {method: 'delete'});
    };

    getAgendaEvents = async (query: EventQuery) => {
        const params = buildQueryString({
            scope: query.scope,
            team_id: query.teamId,
            from: query.from,
            to: query.to,
            include_recurring: query.includeRecurring,
            page: query.page,
            per_page: query.perPage,
        });
        return this.doFetch(`${this.getAgendaRoute()}/events${params}`, {method: 'get'});
    };

    getAgendaEvent = async (eventId: string) => {
        return this.doFetch(`${this.getAgendaRoute()}/events/${encodeURIComponent(eventId)}`, {method: 'get'});
    };

    createAgendaEvent = async (input: CreateEventInput) => {
        return this.doFetch(`${this.getAgendaRoute()}/events`, {method: 'post', body: input});
    };

    updateAgendaEvent = async (eventId: string, patch: UpdateEventInput) => {
        return this.doFetch(`${this.getAgendaRoute()}/events/${encodeURIComponent(eventId)}`, {method: 'post', body: patch});
    };

    deleteAgendaEvent = async (eventId: string) => {
        await this.doFetch(`${this.getAgendaRoute()}/events/${encodeURIComponent(eventId)}`, {method: 'delete'});
    };

    getAgendaConfig = async () => {
        return this.doFetch(`${this.getAgendaRoute()}/config`, {method: 'get'});
    };
};

export default ClientAgenda;
