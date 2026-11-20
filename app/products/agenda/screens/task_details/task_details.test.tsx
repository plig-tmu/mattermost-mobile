// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {showPermalink} from '@actions/remote/permalink';
import {fetchAgendaTask, setAgendaTaskStatus} from '@agenda/actions/remote';
import DatabaseManager from '@database/manager';
import {act, fireEvent, renderWithEverything, waitFor} from '@test/intl-test-helper';

import TaskDetails from './task_details';

import type {Task} from '@agenda/types';
import type {Database} from '@nozbe/watermelondb';

jest.mock('@agenda/actions/remote', () => ({
    ...jest.requireActual('@agenda/actions/remote'),
    fetchAgendaTask: jest.fn(),
    setAgendaTaskStatus: jest.fn(),
}));
jest.mock('@actions/remote/permalink', () => ({showPermalink: jest.fn()}));

const serverUrl = 'https://agenda.example.com';

const task: Task = {
    id: 'task1',
    teamId: 'team1',
    visibility: 'team',
    creatorId: 'creator',
    title: 'Review contract',
    status: 'todo',
    priority: 'urgent',
    assigneeIds: ['assignee'],
    sourcePostId: 'post1',
    description: 'Check clause 4',
    createdAt: 1,
    updatedAt: 1,
    version: 1,
};

describe('TaskDetails', () => {
    let database: Database;

    beforeEach(async () => {
        await DatabaseManager.init([serverUrl]);
        database = DatabaseManager.getServerDatabaseAndOperator(serverUrl).database;
        jest.mocked(fetchAgendaTask).mockResolvedValue({data: task});
    });

    afterEach(async () => {
        await DatabaseManager.destroyServerDatabase(serverUrl);
        jest.clearAllMocks();
    });

    it('should let an assignee complete the task but not edit it', async () => {
        jest.mocked(setAgendaTaskStatus).mockResolvedValueOnce({data: {...task, status: 'done', version: 2}});
        const {getByTestId, getByText, queryByTestId} = renderWithEverything(
            <TaskDetails
                taskId='task1'
                currentUserId='assignee'
            />,
            {database, serverUrl},
        );
        await waitFor(() => expect(getByText('Review contract')).toBeTruthy());
        expect(getByText('Check clause 4')).toBeTruthy();
        expect(getByText('Priority: Urgent')).toBeTruthy();
        expect(queryByTestId('agenda.task_details.edit')).toBeNull();
        expect(queryByTestId('agenda.task_details.delete')).toBeNull();

        // The screen reloads after a change; the server now has the task done.
        jest.mocked(fetchAgendaTask).mockResolvedValue({data: {...task, status: 'done', version: 2}});
        await act(async () => {
            fireEvent.press(getByTestId('agenda.task_details.toggle'));
        });

        expect(setAgendaTaskStatus).toHaveBeenCalledWith(serverUrl, 'task1', 'done');
        await waitFor(() => expect(getByText('Reopen')).toBeTruthy());
        expect(getByText('Done')).toBeTruthy();
    });

    it('should hide status changes from users who are neither creator nor assignee', async () => {
        const {getByText, queryByTestId} = renderWithEverything(
            <TaskDetails
                taskId='task1'
                currentUserId='viewer'
            />,
            {database, serverUrl},
        );
        await waitFor(() => expect(getByText('Review contract')).toBeTruthy());
        expect(queryByTestId('agenda.task_details.toggle')).toBeNull();
    });

    it('should open the originating post', async () => {
        const {getByTestId, getByText} = renderWithEverything(
            <TaskDetails
                taskId='task1'
                currentUserId='creator'
            />,
            {database, serverUrl},
        );
        await waitFor(() => expect(getByText('Review contract')).toBeTruthy());
        expect(getByTestId('agenda.task_details.edit')).toBeTruthy();

        fireEvent.press(getByTestId('agenda.task_details.open_post'));
        expect(showPermalink).toHaveBeenCalledWith(serverUrl, '', 'post1');
    });

    it('should show the access error when the task is not visible', async () => {
        jest.mocked(fetchAgendaTask).mockResolvedValue({error: {status_code: 404}});
        const {getByText} = renderWithEverything(
            <TaskDetails
                taskId='task1'
                currentUserId='viewer'
            />,
            {database, serverUrl},
        );
        await waitFor(() => expect(getByText('This item no longer exists or you no longer have access to it.')).toBeTruthy());
    });
});
