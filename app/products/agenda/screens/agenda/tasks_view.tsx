// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';
import {FlatList, Pressable, RefreshControl, Text, View, type ListRenderItemInfo} from 'react-native';

import {fetchAgendaTasks, setAgendaTaskStatus, taskQueryForScope} from '@agenda/actions/remote';
import AgendaItemRow, {type AgendaItem} from '@agenda/components/agenda_item_row';
import {useAgendaNames} from '@agenda/hooks/use_agenda_names';
import {mergeTask, scopeKey} from '@agenda/hooks/use_agenda_range';
import {emitAgendaChanged, useAgendaRequest} from '@agenda/hooks/use_agenda_request';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import {ListState, useToggleTask} from './list_state';

import type {AgendaScope, TaskStatus, TaskSummary} from '@agenda/types';

export const TASK_FILTERS = {
    open: ['todo', 'in_progress'] as TaskStatus[],
    done: ['done'] as TaskStatus[],
    all: [] as TaskStatus[],
};
export type TaskFilter = keyof typeof TASK_FILTERS;
const FILTER_KEYS = Object.keys(TASK_FILTERS) as TaskFilter[];

const messages = defineMessages({
    open: {id: 'agenda.tasks.filter.open', defaultMessage: 'Open'},
    done: {id: 'agenda.tasks.filter.done', defaultMessage: 'Completed'},
    all: {id: 'agenda.tasks.filter.all', defaultMessage: 'All'},
});

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
    },
    filters: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    chip: {
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginRight: 8,
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.16),
    },
    chipSelected: {
        backgroundColor: changeOpacity(theme.buttonBg, 0.08),
        borderColor: theme.buttonBg,
    },
    chipText: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
        ...typography('Body', 75, 'SemiBold'),
    },
    chipTextSelected: {
        color: theme.buttonBg,
    },
    pressed: {
        opacity: 0.72,
    },
}));

type Props = {
    scope: AgendaScope;
    onPressEvent: (eventId: string, occurrenceStart?: number) => void;
    onPressTask: (taskId: string) => void;
    teammateNameDisplay?: string;
};

// TasksView lists tasks of the scope. In the My scope this is "My Tasks": tasks assigned to the
// user across their teams and channels, plus their private tasks.
const TasksView = ({scope, onPressEvent, onPressTask, teammateNameDisplay}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const styles = getStyleSheet(theme);
    const [filter, setFilter] = useState<TaskFilter>('open');

    const load = useCallback(() => fetchAgendaTasks(serverUrl, {
        ...taskQueryForScope(scope),
        statuses: TASK_FILTERS[filter],
        sortBy: 'due',
        direction: 'asc',
    }), [serverUrl, scope, filter]);
    const {data, loading, refreshing, error, refresh, setData} = useAgendaRequest<TaskSummary[]>(`${serverUrl}|${scopeKey(scope)}|${filter}`, load);
    const names = useAgendaNames(serverUrl, data ?? []);

    const toggle = useCallback(async (task: TaskSummary) => {
        const result = await setAgendaTaskStatus(serverUrl, task.id, task.status === 'done' ? 'todo' : 'done');
        if (result.data) {
            const updated = result.data;
            setData((tasks) => (tasks ? mergeTask(tasks, updated) : tasks));
            emitAgendaChanged();
        }
        return result;
    }, [serverUrl, setData]);
    const onToggleTask = useToggleTask(toggle);

    const items = useMemo<AgendaItem[]>(() => (data ?? []).map((task) => ({
        kind: 'task',
        key: task.id,
        occurrence: {task, dueAt: task.dueAt ?? 0, dateKey: ''},
    })), [data]);

    const renderItem = useCallback(({item}: ListRenderItemInfo<AgendaItem>) => (
        <AgendaItemRow
            item={item}
            names={names}
            teammateNameDisplay={teammateNameDisplay}
            showDate={true}
            onPressEvent={onPressEvent}
            onPressTask={onPressTask}
            onToggleTask={onToggleTask}
        />
    ), [names, onPressEvent, onPressTask, onToggleTask, teammateNameDisplay]);

    return (
        <View
            style={styles.container}
            testID='agenda.tasks'
        >
            <View style={styles.filters}>
                {FILTER_KEYS.map((key) => (
                    <FilterChip
                        key={key}
                        filter={key}
                        selected={filter === key}
                        label={intl.formatMessage(messages[key])}
                        onSelect={setFilter}
                    />
                ))}
            </View>
            <FlatList
                data={items}
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
                        emptyMessage={defineMessage({id: 'agenda.tasks.empty', defaultMessage: 'No tasks'})}
                    />
                }
                testID='agenda.tasks.list'
            />
        </View>
    );
};

type ChipProps = {
    filter: TaskFilter;
    selected: boolean;
    label: string;
    onSelect: (filter: TaskFilter) => void;
};

const FilterChip = ({filter, selected, label, onSelect}: ChipProps) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);
    const handlePress = useCallback(() => onSelect(filter), [filter, onSelect]);
    return (
        <Pressable
            onPress={handlePress}
            style={({pressed}) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            testID={`agenda.tasks.filter.${filter}`}
            accessibilityState={{selected}}
        >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </Pressable>
    );
};

const keyExtractor = (item: AgendaItem) => item.key;

export default TasksView;
