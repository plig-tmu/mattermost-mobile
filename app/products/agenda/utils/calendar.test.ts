// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {calendarQueryBounds, calendarRange, DAY_IN_MS, dueDateKey, localDateKey} from './calendar';

// jest.config.js pins TZ=UTC, so local and UTC days coincide unless noted.
describe('agenda calendar utils', () => {
    it('should cover whole weeks around a month starting on the given weekday', () => {
        // November 2026 starts on a Sunday and ends on a Monday.
        const sunday = calendarRange('month', new Date(2026, 10, 15), 0);
        expect(localDateKey(sunday.start)).toBe('2026-11-01');
        expect(localDateKey(sunday.end)).toBe('2026-12-05');
        expect(sunday.days).toHaveLength(35);

        const monday = calendarRange('month', new Date(2026, 10, 15), 1);
        expect(localDateKey(monday.start)).toBe('2026-10-26');
        expect(localDateKey(monday.end)).toBe('2026-12-06');
        expect(monday.days).toHaveLength(42);
    });

    it('should return seven days for the week containing the cursor', () => {
        const range = calendarRange('week', new Date(2026, 10, 20), 1);
        expect(range.days).toHaveLength(7);
        expect(localDateKey(range.start)).toBe('2026-11-16');
        expect(localDateKey(range.end)).toBe('2026-11-22');
    });

    it('should widen query bounds by one day on each side, with an exclusive end', () => {
        const {from, to} = calendarQueryBounds(new Date(2026, 10, 16), new Date(2026, 10, 22));
        expect(from).toBe(Date.UTC(2026, 10, 16) - DAY_IN_MS);
        expect(to).toBe(Date.UTC(2026, 10, 23) + DAY_IN_MS);
    });

    it('should read date-only due dates in UTC and timed ones in local time', () => {
        expect(dueDateKey({dueAt: Date.UTC(2026, 10, 20)})).toBe('2026-11-20');
        expect(dueDateKey({dueAt: Date.UTC(2026, 10, 20, 23, 30), dueHasTime: true})).toBe('2026-11-20');
        expect(dueDateKey({dueAt: 0})).toBeUndefined();
    });
});
