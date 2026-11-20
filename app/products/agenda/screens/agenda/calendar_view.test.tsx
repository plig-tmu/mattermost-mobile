// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fetchAgendaEvents, fetchAgendaTasks, setAgendaTaskStatus} from '@agenda/actions/remote';
import DatabaseManager from '@database/manager';
import {act, fireEvent, renderWithEverything, waitFor} from '@test/intl-test-helper';

import CalendarView from './calendar_view';

import type {EventSummary, TaskSummary} from '@agenda/types';
import type {Database} from '@nozbe/watermelondb';

jest.mock('@agenda/actions/remote', () => ({
    ...jest.requireActual('@agenda/actions/remote'),
    fetchAgendaEvents: jest.fn(),
    fetchAgendaTasks: jest.fn(),
    setAgendaTaskStatus: jest.fn(),
}));

const serverUrl = 'https://agenda.example.com';

const event: EventSummary = {
    id: 'event1',
    teamId: 'team1',
    visibility: 'team',
    creatorId: 'user1',
    assigneeIds: [],
    title: 'Planning',
    startAt: Date.UTC(2026, 10, 24, 10),
    endAt: Date.UTC(2026, 10, 24, 11),
    createdAt: 1,
    updatedAt: 1,
};

const task: TaskSummary = {
    id: 'task1',
    teamId: 'team1',
    visibility: 'team',
    creatorId: 'user1',
    title: 'Write report',
    status: 'todo',
    priority: 'none',
    assigneeIds: [],
    dueAt: Date.UTC(2026, 10, 20),
    createdAt: 1,
    updatedAt: 1,
};

describe('CalendarView', () => {
    let database: Database;
    const props = {
        scope: {kind: 'my'} as const,
        onPressEvent: jest.fn(),
        onPressTask: jest.fn(),
    };

    beforeEach(async () => {
        jest.useFakeTimers({doNotFake: ['nextTick']});
        jest.setSystemTime(new Date(2026, 10, 20, 9));
        await DatabaseManager.init([serverUrl]);
        database = DatabaseManager.getServerDatabaseAndOperator(serverUrl).database;
        jest.mocked(fetchAgendaEvents).mockResolvedValue({data: [event]});
        jest.mocked(fetchAgendaTasks).mockResolvedValue({data: [task]});
    });

    afterEach(async () => {
        await DatabaseManager.destroyServerDatabase(serverUrl);
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('should fetch the visible month range and mark days with items', async () => {
        const {getByTestId, getByText} = renderWithEverything(<CalendarView {...props}/>, {database, serverUrl});

        expect(getByTestId('agenda.calendar.title').props.children).toBe('November 2026');
        await waitFor(() => expect(getByText('Write report')).toBeTruthy());

        // Month grid for November 2026 (Sunday start) runs 1 Nov – 5 Dec, widened by a day.
        expect(fetchAgendaEvents).toHaveBeenCalledWith(serverUrl, {kind: 'my'}, Date.UTC(2026, 9, 31), Date.UTC(2026, 11, 7));
        expect(getByTestId('agenda.calendar.day.2026-11-24.marker')).toBeTruthy();
        expect(getByTestId('agenda.calendar.day.2026-11-20.marker')).toBeTruthy();
    });

    it('should show the items of the selected date', async () => {
        const {getByTestId, queryByText, getByText} = renderWithEverything(<CalendarView {...props}/>, {database, serverUrl});
        await waitFor(() => expect(getByText('Write report')).toBeTruthy());
        expect(queryByText('Planning')).toBeNull();

        fireEvent.press(getByTestId('agenda.calendar.day.2026-11-24'));

        expect(getByText('Planning')).toBeTruthy();
        expect(queryByText('Write report')).toBeNull();
        fireEvent.press(getByTestId('agenda.item.event.event1'));
        expect(props.onPressEvent).toHaveBeenCalledWith('event1', undefined);
    });

    it('should navigate months and return to today', async () => {
        const {getByTestId} = renderWithEverything(<CalendarView {...props}/>, {database, serverUrl});
        await waitFor(() => expect(fetchAgendaEvents).toHaveBeenCalledTimes(1));

        fireEvent.press(getByTestId('agenda.calendar.next'));
        expect(getByTestId('agenda.calendar.title').props.children).toBe('December 2026');
        await waitFor(() => expect(fetchAgendaEvents).toHaveBeenCalledTimes(2));

        fireEvent.press(getByTestId('agenda.calendar.previous'));
        fireEvent.press(getByTestId('agenda.calendar.previous'));
        expect(getByTestId('agenda.calendar.title').props.children).toBe('October 2026');

        fireEvent.press(getByTestId('agenda.calendar.today'));
        expect(getByTestId('agenda.calendar.title').props.children).toBe('November 2026');
    });

    it('should switch to a week and move by seven days', async () => {
        const {getByTestId, queryByTestId} = renderWithEverything(<CalendarView {...props}/>, {database, serverUrl});
        await waitFor(() => expect(fetchAgendaEvents).toHaveBeenCalledTimes(1));

        fireEvent.press(getByTestId('agenda.calendar.mode'));
        expect(getByTestId('agenda.calendar.day.2026-11-15')).toBeTruthy();
        expect(getByTestId('agenda.calendar.day.2026-11-21')).toBeTruthy();
        expect(queryByTestId('agenda.calendar.day.2026-11-22')).toBeNull();
        await waitFor(() => expect(fetchAgendaEvents).toHaveBeenLastCalledWith(serverUrl, {kind: 'my'}, Date.UTC(2026, 10, 14), Date.UTC(2026, 10, 23)));

        fireEvent.press(getByTestId('agenda.calendar.next'));
        expect(getByTestId('agenda.calendar.day.2026-11-27')).toBeTruthy();
        expect(queryByTestId('agenda.calendar.day.2026-11-21')).toBeNull();
    });

    it('should complete a task and show the server result', async () => {
        jest.mocked(setAgendaTaskStatus).mockResolvedValueOnce({data: {...task, status: 'done', version: 2}});
        const {getByTestId, getByText} = renderWithEverything(<CalendarView {...props}/>, {database, serverUrl});
        await waitFor(() => expect(getByText('Write report')).toBeTruthy());

        // The view reloads after a change; the server now has the task done.
        jest.mocked(fetchAgendaTasks).mockResolvedValue({data: [{...task, status: 'done'}]});

        await act(async () => {
            fireEvent.press(getByTestId('agenda.item.task.task1.toggle'));
        });

        expect(setAgendaTaskStatus).toHaveBeenCalledWith(serverUrl, 'task1', 'done');
        await waitFor(() => expect(getByTestId('agenda.item.task.task1.toggle').props.accessibilityState).toMatchObject({checked: true}));
    });

    it('should show an empty state for a day without items', async () => {
        jest.mocked(fetchAgendaEvents).mockResolvedValue({data: []});
        jest.mocked(fetchAgendaTasks).mockResolvedValue({data: []});
        const {getByTestId, getByText} = renderWithEverything(<CalendarView {...props}/>, {database, serverUrl});
        expect(getByTestId('agenda.list.loading')).toBeTruthy();
        await waitFor(() => expect(getByText('Nothing scheduled for this day')).toBeTruthy());
    });

    it('should show an error with a retry that refetches', async () => {
        jest.mocked(fetchAgendaEvents).mockResolvedValueOnce({error: {status_code: 403}});
        const {getByTestId, getByText} = renderWithEverything(<CalendarView {...props}/>, {database, serverUrl});
        await waitFor(() => expect(getByText("You don't have permission to do that.")).toBeTruthy());

        await act(async () => {
            fireEvent.press(getByTestId('agenda.list.retry'));
        });
        await waitFor(() => expect(getByText('Write report')).toBeTruthy());
        expect(fetchAgendaEvents).toHaveBeenCalledTimes(2);
    });
});
