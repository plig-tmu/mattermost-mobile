// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import {AGENDA_PLUGIN_ID} from '@agenda/constants';
import {agendaErrorMessage} from '@agenda/utils/errors';
import NetworkManager from '@managers/network_manager';

import {
    fetchAgendaEvents,
    fetchAgendaTasks,
    fetchIsAgendaEnabled,
    resetAgendaEnabledCache,
    setAgendaTaskStatus,
} from './remote';

const serverUrl = 'https://server.example.com';

const mockClient = {
    getAgendaEvents: jest.fn(),
    getAgendaTasks: jest.fn(),
    updateAgendaTask: jest.fn(),
    getPluginsManifests: jest.fn(),
};

const event = (id: string, channelId?: string) => ({id, channelId, teamId: 'team1', title: id, startAt: 1, endAt: 2});

beforeAll(() => {
    jest.spyOn(NetworkManager, 'getClient').mockReturnValue(mockClient as unknown as ReturnType<typeof NetworkManager.getClient>);
});

beforeEach(() => {
    jest.clearAllMocks();
    resetAgendaEnabledCache();
});

describe('fetchAgendaEvents', () => {
    it('should request the my scope with the range and recurring series', async () => {
        mockClient.getAgendaEvents.mockResolvedValueOnce({items: [event('a')], hasMore: false});
        const result = await fetchAgendaEvents(serverUrl, {kind: 'my'}, 10, 20);
        expect(result.data).toHaveLength(1);
        expect(mockClient.getAgendaEvents).toHaveBeenCalledWith({scope: 'my', teamId: undefined, from: 10, to: 20, includeRecurring: true, page: 0, perPage: 100});
    });

    it('should query the team and keep only the channel events for a channel scope', async () => {
        mockClient.getAgendaEvents.mockResolvedValueOnce({items: [event('a', 'ch1'), event('b', 'ch2'), event('c')], hasMore: false});
        const result = await fetchAgendaEvents(serverUrl, {kind: 'channel', teamId: 'team1', channelId: 'ch1'}, 10, 20);
        expect(mockClient.getAgendaEvents).toHaveBeenCalledWith(expect.objectContaining({scope: 'team', teamId: 'team1'}));
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0].id).toBe('a');
    });

    it('should follow hasMore up to the page cap', async () => {
        mockClient.getAgendaEvents.mockResolvedValue({items: [event('x')], hasMore: true});
        const result = await fetchAgendaEvents(serverUrl, {kind: 'team', teamId: 'team1'}, 10, 20);
        expect(mockClient.getAgendaEvents).toHaveBeenCalledTimes(5);
        expect(result.data).toHaveLength(5);
    });

    it('should return the error when the request fails', async () => {
        const error = {status_code: 403, message: 'forbidden'};
        mockClient.getAgendaEvents.mockRejectedValueOnce(error);
        const result = await fetchAgendaEvents(serverUrl, {kind: 'team', teamId: 'team1'}, 10, 20);
        expect(result.data).toBeUndefined();
        expect(result.error).toBe(error);
    });
});

describe('fetchAgendaTasks', () => {
    it('should pass scope filters and paging to the client', async () => {
        mockClient.getAgendaTasks.mockResolvedValueOnce({items: [{id: 't1'}], hasMore: false});
        const result = await fetchAgendaTasks(serverUrl, {scope: 'channel', channelId: 'ch1', statuses: ['todo']});
        expect(result.data).toHaveLength(1);
        expect(mockClient.getAgendaTasks).toHaveBeenCalledWith({scope: 'channel', channelId: 'ch1', statuses: ['todo'], page: 0, perPage: 100});
    });
});

describe('setAgendaTaskStatus', () => {
    it('should send a status-only patch and return the server task', async () => {
        // A completed recurring task comes back reopened with its next due date.
        const reopened = {id: 't1', status: 'todo', dueAt: 99};
        mockClient.updateAgendaTask.mockResolvedValueOnce(reopened);
        const result = await setAgendaTaskStatus(serverUrl, 't1', 'done');
        expect(mockClient.updateAgendaTask).toHaveBeenCalledWith('t1', {status: 'done'});
        expect(result.data).toBe(reopened);
    });
});

describe('fetchIsAgendaEnabled', () => {
    it('should detect the plugin and cache the answer per server', async () => {
        mockClient.getPluginsManifests.mockResolvedValueOnce([{id: AGENDA_PLUGIN_ID}]);
        expect(await fetchIsAgendaEnabled(serverUrl, AGENDA_PLUGIN_ID)).toBe(true);
        expect(await fetchIsAgendaEnabled(serverUrl, AGENDA_PLUGIN_ID)).toBe(true);
        expect(mockClient.getPluginsManifests).toHaveBeenCalledTimes(1);

        mockClient.getPluginsManifests.mockResolvedValueOnce([{id: 'other'}]);
        expect(await fetchIsAgendaEnabled('https://other.example.com', AGENDA_PLUGIN_ID)).toBe(false);
    });

    it('should not cache a failed detection', async () => {
        mockClient.getPluginsManifests.mockRejectedValueOnce(new Error('offline'));
        expect(await fetchIsAgendaEnabled(serverUrl, AGENDA_PLUGIN_ID)).toBe(false);
        mockClient.getPluginsManifests.mockResolvedValueOnce([{id: AGENDA_PLUGIN_ID}]);
        expect(await fetchIsAgendaEnabled(serverUrl, AGENDA_PLUGIN_ID)).toBe(true);
    });
});

describe('agendaErrorMessage', () => {
    const intl = createIntl({locale: 'en', messages: {}});

    it('should map authentication and permission failures to distinct messages', () => {
        expect(agendaErrorMessage(intl, {status_code: 401})).toBe('Your session has expired. Please log in again.');
        expect(agendaErrorMessage(intl, {status_code: 403})).toBe("You don't have permission to do that.");
        expect(agendaErrorMessage(intl, new Error('network'))).toBe('Something went wrong. Please try again.');
    });
});
