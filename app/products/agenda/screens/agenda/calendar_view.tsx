// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {FlatList, RefreshControl, View, type ListRenderItemInfo} from 'react-native';

import AgendaItemRow, {type AgendaItem} from '@agenda/components/agenda_item_row';
import CalendarGrid from '@agenda/components/calendar_grid';
import CalendarHeader from '@agenda/components/calendar_header';
import {useAgendaNames} from '@agenda/hooks/use_agenda_names';
import {useAgendaRange} from '@agenda/hooks/use_agenda_range';
import {
    addLocalDays,
    addLocalMonths,
    calendarRange,
    dateFromKey,
    localDateKey,
    startOfLocalDay,
    type CalendarMode,
} from '@agenda/utils/calendar';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import {ListState, useToggleTask} from './list_state';

import type {AgendaScope} from '@agenda/types';

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
    },
    grid: {
        paddingHorizontal: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: changeOpacity(theme.centerChannelColor, 0.12),
    },
}));

// weekStartsOn uses moment's locale data (0 = Sunday); unknown locales fall back to Sunday.
export function weekStartsOn(locale: string): number {
    return moment.localeData(locale)?.firstDayOfWeek() ?? 0;
}

type Props = {
    scope: AgendaScope;
    onPressEvent: (eventId: string, occurrenceStart?: number) => void;
    onPressTask: (taskId: string) => void;
    teammateNameDisplay?: string;
};

const CalendarView = ({scope, onPressEvent, onPressTask, teammateNameDisplay}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const styles = getStyleSheet(theme);

    const [mode, setMode] = useState<CalendarMode>('month');
    const [selectedKey, setSelectedKey] = useState(() => localDateKey(startOfLocalDay(new Date())));
    const todayKey = localDateKey(startOfLocalDay(new Date()));
    const weekStart = useMemo(() => weekStartsOn(intl.locale), [intl.locale]);
    const cursor = useMemo(() => dateFromKey(selectedKey), [selectedKey]);
    const range = useMemo(() => calendarRange(mode, cursor, weekStart), [mode, cursor, weekStart]);

    const {itemsByDay, data, loading, refreshing, error, refresh, toggleTask} = useAgendaRange(serverUrl, scope, range.days);
    const names = useAgendaNames(serverUrl, useMemo(() => [...(data?.events ?? []), ...(data?.tasks ?? [])], [data]));
    const onToggleTask = useToggleTask(toggleTask);

    const markedKeys = useMemo(() => {
        const keys = new Set<string>();
        itemsByDay.forEach((items, key) => {
            if (items.length) {
                keys.add(key);
            }
        });
        return keys;
    }, [itemsByDay]);
    const dayItems = itemsByDay.get(selectedKey) ?? [];

    const title = mode === 'month' ? intl.formatDate(cursor, {month: 'long', year: 'numeric'}) : intl.formatDate(cursor, {weekday: 'long', month: 'long', day: 'numeric'});

    const move = useCallback((direction: 1 | -1) => {
        setSelectedKey((key) => {
            const date = dateFromKey(key);
            if (mode === 'week') {
                return localDateKey(addLocalDays(date, 7 * direction));
            }
            const next = addLocalMonths(date, direction);
            return localDateKey(new Date(next.getFullYear(), next.getMonth(), Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())));
        });
    }, [mode]);
    const onPrevious = useCallback(() => move(-1), [move]);
    const onNext = useCallback(() => move(1), [move]);
    const onToday = useCallback(() => setSelectedKey(localDateKey(startOfLocalDay(new Date()))), []);
    const onToggleMode = useCallback(() => setMode((m) => (m === 'month' ? 'week' : 'month')), []);

    const renderItem = useCallback(({item}: ListRenderItemInfo<AgendaItem>) => (
        <AgendaItemRow
            item={item}
            names={names}
            teammateNameDisplay={teammateNameDisplay}
            onPressEvent={onPressEvent}
            onPressTask={onPressTask}
            onToggleTask={onToggleTask}
        />
    ), [names, onPressEvent, onPressTask, onToggleTask, teammateNameDisplay]);

    return (
        <View
            style={styles.container}
            testID='agenda.calendar'
        >
            <CalendarHeader
                title={title}
                mode={mode}
                onPrevious={onPrevious}
                onNext={onNext}
                onToday={onToday}
                onToggleMode={onToggleMode}
            />
            <View style={styles.grid}>
                <CalendarGrid
                    days={range.days}
                    month={mode === 'month' ? cursor.getMonth() : undefined}
                    selectedKey={selectedKey}
                    todayKey={todayKey}
                    markedKeys={markedKeys}
                    onSelect={setSelectedKey}
                />
            </View>
            <FlatList
                data={dayItems}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor={theme.centerChannelColor}
                    />
                }
                ListEmptyComponent={
                    <ListState
                        loading={loading}
                        error={error}
                        onRetry={refresh}
                        emptyMessage={{id: 'agenda.calendar.empty_day', defaultMessage: 'Nothing scheduled for this day'}}
                    />
                }
                testID='agenda.calendar.day_list'
            />
        </View>
    );
};

const keyExtractor = (item: AgendaItem) => item.key;

export default CalendarView;
