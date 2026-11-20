// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fetchAgendaTasks} from '@agenda/actions/remote';
import DatabaseManager from '@database/manager';
import {fireEvent, renderWithEverything, waitFor} from '@test/intl-test-helper';

import TasksView from './tasks_view';

import type {TaskSummary} from '@agenda/types';
import type {Database} from '@nozbe/watermelondb';

jest.mock('@agenda/actions/remote', () => ({
    ...jest.requireActual('@agenda/actions/remote'),
    fetchAgendaTasks: jest.fn(),
}));

const serverUrl = 'https://agenda.example.com';

const task: TaskSummary = {
    id: 'task1',
    teamId: 'team1',
    channelId: 'channel1',
    visibility: 'channel',
    creatorId: 'user1',
    title: 'Channel task',
    status: 'todo',
    priority: 'high',
    assigneeIds: [],
    createdAt: 1,
    updatedAt: 1,
};

describe('TasksView', () => {
    let database: Database;
    const handlers = {onPressEvent: jest.fn(), onPressTask: jest.fn()};

    beforeEach(async () => {
        await DatabaseManager.init([serverUrl]);
        database = DatabaseManager.getServerDatabaseAndOperator(serverUrl).database;
        jest.mocked(fetchAgendaTasks).mockResolvedValue({data: [task]});
    });

    afterEach(async () => {
        await DatabaseManager.destroyServerDatabase(serverUrl);
        jest.clearAllMocks();
    });

    it('should list open tasks for My Tasks and refetch when the filter changes', async () => {
        const {getByTestId, getByText} = renderWithEverything(
            <TasksView
                scope={{kind: 'my'}}
                {...handlers}
            />,
            {database, serverUrl},
        );
        await waitFor(() => expect(getByText('Channel task')).toBeTruthy());
        expect(fetchAgendaTasks).toHaveBeenLastCalledWith(serverUrl, {scope: 'my', statuses: ['todo', 'in_progress'], sortBy: 'due', direction: 'asc'});

        fireEvent.press(getByTestId('agenda.tasks.filter.done'));
        await waitFor(() => expect(fetchAgendaTasks).toHaveBeenLastCalledWith(serverUrl, expect.objectContaining({statuses: ['done']})));

        fireEvent.press(getByTestId('agenda.item.task.task1'));
        expect(handlers.onPressTask).toHaveBeenCalledWith('task1');
    });

    it('should clear rows and refetch with the channel scope when the scope changes', async () => {
        const {getByText, queryByText, rerender} = renderWithEverything(
            <TasksView
                scope={{kind: 'my'}}
                {...handlers}
            />,
            {database, serverUrl},
        );
        await waitFor(() => expect(getByText('Channel task')).toBeTruthy());

        jest.mocked(fetchAgendaTasks).mockReturnValueOnce(new Promise(() => undefined));
        rerender(
            <TasksView
                scope={{kind: 'channel', teamId: 'team1', channelId: 'channel1'}}
                {...handlers}
            />,
        );

        // Rows of the previous scope are not shown while the new scope loads.
        await waitFor(() => expect(queryByText('Channel task')).toBeNull());
        expect(fetchAgendaTasks).toHaveBeenLastCalledWith(serverUrl, expect.objectContaining({scope: 'channel', channelId: 'channel1'}));
    });
});
