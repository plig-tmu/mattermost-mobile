// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {buildCreateEvent, buildCreateTask, buildEventPatch, buildTaskPatch, validateEventTimes, type EventForm, type TaskForm} from './form';

import type {AgendaEvent, Task} from '@agenda/types';

// jest.config.js pins TZ=UTC.
const taskForm: TaskForm = {
    title: '  Ship release  ',
    description: '',
    visibility: 'team',
    teamId: 'team1',
    hasDue: true,
    dueDate: new Date(2026, 10, 20, 15, 30),
    dueHasTime: false,
    priority: 'high',
    status: 'todo',
    assignToMe: true,
};

const task: Task = {
    id: 'task1',
    teamId: 'team1',
    visibility: 'team',
    creatorId: 'me',
    title: 'Ship release',
    status: 'todo',
    priority: 'high',
    assigneeIds: ['me'],
    dueAt: Date.UTC(2026, 10, 20),
    createdAt: 1,
    updatedAt: 1,
    version: 3,
};

describe('task form mapping', () => {
    it('should create a date-only task at UTC midnight with only accepted fields', () => {
        const input = buildCreateTask(taskForm, 'me', 'Asia/Tokyo');
        expect(input).toEqual({
            teamId: 'team1',
            channelId: undefined,
            visibility: 'team',
            title: 'Ship release',
            description: undefined,
            priority: 'high',
            assigneeIds: ['me'],
            dueAt: Date.UTC(2026, 10, 20),
            dueHasTime: false,
            timezone: 'Asia/Tokyo',
        });
    });

    it('should assign a private task to its creator even when not requested', () => {
        expect(buildCreateTask({...taskForm, visibility: 'private', assignToMe: false}, 'me', 'UTC').assigneeIds).toEqual(['me']);
    });

    it('should patch only changed fields and never echo server-owned fields', () => {
        expect(buildTaskPatch(task, taskForm, 'UTC')).toEqual({});

        const patch = buildTaskPatch(task, {...taskForm, status: 'done', dueHasTime: true}, 'Europe/Paris');
        expect(patch).toEqual({status: 'done', dueAt: new Date(2026, 10, 20, 15, 30).getTime(), dueHasTime: true, timezone: 'Europe/Paris'});
        expect(patch).not.toHaveProperty('id');
        expect(patch).not.toHaveProperty('version');
    });

    it('should clear the due date with zero', () => {
        expect(buildTaskPatch(task, {...taskForm, hasDue: false}, 'UTC')).toEqual({dueAt: 0, dueHasTime: false, timezone: 'UTC'});
    });
});

describe('event form mapping', () => {
    const eventForm: EventForm = {
        title: 'Offsite',
        description: '',
        location: '',
        visibility: 'channel',
        teamId: 'team1',
        channelId: 'ch1',
        allDay: true,
        start: new Date(2026, 10, 23, 9),
        end: new Date(2026, 10, 24, 9),
    };

    it('should store all-day events as UTC midnights with an exclusive end', () => {
        const input = buildCreateEvent(eventForm, 'me', 'UTC');
        expect(input.startAt).toBe(Date.UTC(2026, 10, 23));
        expect(input.endAt).toBe(Date.UTC(2026, 10, 25));
        expect(input.channelId).toBe('ch1');
        expect(input.allDay).toBe(true);
    });

    it('should reject a timed event that ends before it starts', () => {
        expect(validateEventTimes({allDay: false, start: new Date(2026, 10, 23, 10), end: new Date(2026, 10, 23, 9)})).toBe(false);

        // A single all-day day is valid because the end is exclusive.
        expect(validateEventTimes({allDay: true, start: new Date(2026, 10, 23), end: new Date(2026, 10, 23)})).toBe(true);
    });

    it('should send the full interval when the time changes', () => {
        const event: AgendaEvent = {
            id: 'e1',
            teamId: 'team1',
            channelId: 'ch1',
            visibility: 'channel',
            creatorId: 'me',
            assigneeIds: ['me'],
            title: 'Offsite',
            startAt: Date.UTC(2026, 10, 23),
            endAt: Date.UTC(2026, 10, 25),
            allDay: true,
            timezone: 'UTC',
            createdAt: 1,
            updatedAt: 1,
            version: 1,
        };
        expect(buildEventPatch(event, eventForm, 'UTC')).toEqual({});
        expect(buildEventPatch(event, {...eventForm, end: new Date(2026, 10, 25)}, 'UTC')).toEqual({
            startAt: Date.UTC(2026, 10, 23),
            endAt: Date.UTC(2026, 10, 26),
            allDay: true,
            timezone: 'UTC',
        });
    });
});
