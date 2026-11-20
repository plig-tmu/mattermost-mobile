// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AGENDA_MAX_PAGES, AGENDA_PAGE_SIZE} from '@agenda/constants';
import NetworkManager from '@managers/network_manager';
import {getFullErrorMessage} from '@utils/errors';
import {logDebug} from '@utils/log';

import type {
    AgendaConfig,
    AgendaEvent,
    AgendaScope,
    CreateEventInput,
    CreateTaskInput,
    EventSummary,
    ListResult,
    Task,
    TaskQuery,
    TaskStatus,
    TaskSummary,
    UpdateEventInput,
    UpdateTaskInput,
} from '@agenda/types';

type Result<T> = {data: T; error?: undefined} | {data?: undefined; error: unknown};

async function run<T>(name: string, fn: () => Promise<T>): Promise<Result<T>> {
    try {
        return {data: await fn()};
    } catch (error) {
        logDebug(`error on ${name}`, getFullErrorMessage(error));
        return {error};
    }
}

// fetchAllPages follows hasMore up to AGENDA_MAX_PAGES. include_recurring returns every
// recurring series regardless of range, so one page may not be enough.
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<ListResult<T>>): Promise<T[]> {
    const items: T[] = [];
    for (let page = 0; page < AGENDA_MAX_PAGES; page++) {
        // Pages depend on each other's hasMore, so they are fetched sequentially.
        // eslint-disable-next-line no-await-in-loop
        const result = await fetchPage(page);
        items.push(...(result?.items ?? []));
        if (!result?.hasMore) {
            break;
        }
    }
    return items;
}

// fetchAgendaEvents lists events overlapping [from, to). The events API only has my/team
// scopes, so a channel calendar requests its team and keeps that channel's events. This only
// narrows data the server already authorized.
export function fetchAgendaEvents(serverUrl: string, scope: AgendaScope, from: number, to: number) {
    return run('fetchAgendaEvents', async () => {
        const client = NetworkManager.getClient(serverUrl);
        const items = await fetchAllPages<EventSummary>((page) => client.getAgendaEvents({
            scope: scope.kind === 'my' ? 'my' : 'team',
            teamId: scope.kind === 'my' ? undefined : scope.teamId,
            from,
            to,
            includeRecurring: true,
            page,
            perPage: AGENDA_PAGE_SIZE,
        }));
        if (scope.kind === 'channel') {
            return items.filter((event) => event.channelId === scope.channelId);
        }
        return items;
    });
}

export function taskQueryForScope(scope: AgendaScope): Pick<TaskQuery, 'scope' | 'teamId' | 'channelId'> {
    switch (scope.kind) {
        case 'team':
            return {scope: 'team', teamId: scope.teamId};
        case 'channel':
            return {scope: 'channel', channelId: scope.channelId};
        default:
            return {scope: 'my'};
    }
}

export function fetchAgendaTasks(serverUrl: string, query: Omit<TaskQuery, 'page' | 'perPage'>) {
    return run('fetchAgendaTasks', async () => {
        const client = NetworkManager.getClient(serverUrl);
        return fetchAllPages<TaskSummary>((page) => client.getAgendaTasks({...query, page, perPage: AGENDA_PAGE_SIZE}));
    });
}

export function fetchAgendaTask(serverUrl: string, taskId: string): Promise<Result<Task>> {
    return run('fetchAgendaTask', () => NetworkManager.getClient(serverUrl).getAgendaTask(taskId));
}

export function fetchAgendaEvent(serverUrl: string, eventId: string): Promise<Result<AgendaEvent>> {
    return run('fetchAgendaEvent', () => NetworkManager.getClient(serverUrl).getAgendaEvent(eventId));
}

// setAgendaTaskStatus sends a status-only patch, which the server allows for assignees as
// well as the creator. Completing a recurring task returns it reopened with the next due date,
// so callers must use the returned task.
export function setAgendaTaskStatus(serverUrl: string, taskId: string, status: TaskStatus): Promise<Result<Task>> {
    return run('setAgendaTaskStatus', () => NetworkManager.getClient(serverUrl).updateAgendaTask(taskId, {status}));
}

export function createAgendaTask(serverUrl: string, input: CreateTaskInput): Promise<Result<Task>> {
    return run('createAgendaTask', () => NetworkManager.getClient(serverUrl).createAgendaTask(input));
}

export function updateAgendaTask(serverUrl: string, taskId: string, patch: UpdateTaskInput): Promise<Result<Task>> {
    return run('updateAgendaTask', () => NetworkManager.getClient(serverUrl).updateAgendaTask(taskId, patch));
}

export function deleteAgendaTask(serverUrl: string, taskId: string): Promise<Result<void>> {
    return run('deleteAgendaTask', () => NetworkManager.getClient(serverUrl).deleteAgendaTask(taskId));
}

export function createAgendaEvent(serverUrl: string, input: CreateEventInput): Promise<Result<AgendaEvent>> {
    return run('createAgendaEvent', () => NetworkManager.getClient(serverUrl).createAgendaEvent(input));
}

export function updateAgendaEvent(serverUrl: string, eventId: string, patch: UpdateEventInput): Promise<Result<AgendaEvent>> {
    return run('updateAgendaEvent', () => NetworkManager.getClient(serverUrl).updateAgendaEvent(eventId, patch));
}

export function deleteAgendaEvent(serverUrl: string, eventId: string): Promise<Result<void>> {
    return run('deleteAgendaEvent', () => NetworkManager.getClient(serverUrl).deleteAgendaEvent(eventId));
}

export function fetchAgendaConfig(serverUrl: string): Promise<Result<AgendaConfig>> {
    return run('fetchAgendaConfig', () => NetworkManager.getClient(serverUrl).getAgendaConfig());
}

// Plugin detection is cached per server URL for the session; a new server URL never reuses
// another server's answer.
const enabledByServer = new Map<string, boolean>();

export async function fetchIsAgendaEnabled(serverUrl: string, pluginId: string): Promise<boolean> {
    const cached = enabledByServer.get(serverUrl);
    if (cached !== undefined) {
        return cached;
    }
    try {
        const manifests = await NetworkManager.getClient(serverUrl).getPluginsManifests();
        const enabled = manifests.some((manifest) => manifest.id === pluginId);
        enabledByServer.set(serverUrl, enabled);
        return enabled;
    } catch (error) {
        // Not cached, so the next mount retries.
        logDebug('error on fetchIsAgendaEnabled', getFullErrorMessage(error));
        return false;
    }
}

export function resetAgendaEnabledCache() {
    enabledByServer.clear();
}
