// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {Pressable, Text, View} from 'react-native';

import {assigneeLabel, formatDue, formatEventTime, scopeLabel} from '@agenda/utils/format';
import CompassIcon from '@components/compass_icon';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import type {AgendaNames} from '@agenda/queries';
import type {TaskSummary} from '@agenda/types';
import type {EventOccurrence, TaskOccurrence} from '@agenda/utils/recurrence';

export type AgendaItem =
    | {kind: 'event'; key: string; occurrence: EventOccurrence}
    | {kind: 'task'; key: string; occurrence: TaskOccurrence};

const HIT_SLOP = {top: 6, bottom: 6, left: 6, right: 6};
const TILE_SIZE = 36;

const PRIORITY_COLORS: Record<string, keyof Theme> = {
    urgent: 'errorTextColor',
    high: 'dndIndicator',
    normal: 'buttonBg',
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },

    // Slack-style leading tile: an event shows its color, a task tile is the completion toggle.
    tile: {
        width: TILE_SIZE,
        height: TILE_SIZE,
        borderRadius: 8,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskTile: {
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.08),
    },
    taskTileDone: {
        backgroundColor: changeOpacity(theme.onlineIndicator, 0.16),
    },
    checkboxIcon: {
        fontSize: 22,
        color: changeOpacity(theme.centerChannelColor, 0.56),
    },
    checkboxDone: {
        color: theme.onlineIndicator,
    },
    body: {
        flex: 1,
    },
    title: {
        color: theme.centerChannelColor,
        ...typography('Body', 200, 'SemiBold'),
    },
    titleDone: {
        textDecorationLine: 'line-through',
        color: changeOpacity(theme.centerChannelColor, 0.56),
    },
    meta: {
        color: changeOpacity(theme.centerChannelColor, 0.64),
        marginTop: 2,
        ...typography('Body', 75),
    },
    priority: {
        width: 4,
        alignSelf: 'stretch',
        borderRadius: 2,
        marginLeft: 8,
    },
    pressed: {
        opacity: 0.72,
    },
}));

type RowProps = {
    item: AgendaItem;
    names: AgendaNames;
    teammateNameDisplay?: string;
    showDate?: boolean;
    onPressEvent: (eventId: string, occurrenceStart?: number) => void;
    onPressTask: (taskId: string) => void;
    onToggleTask: (task: TaskSummary) => void;
};

const AgendaItemRow = ({item, names, teammateNameDisplay, showDate = false, onPressEvent, onPressTask, onToggleTask}: RowProps) => {
    const theme = useTheme();
    const intl = useIntl();
    const styles = getStyleSheet(theme);

    const handlePress = useCallback(() => {
        if (item.kind === 'event') {
            onPressEvent(item.occurrence.event.id, item.occurrence.originalStart);
        } else {
            onPressTask(item.occurrence.task.id);
        }
    }, [item, onPressEvent, onPressTask]);

    const handleToggle = useCallback(() => {
        if (item.kind === 'task') {
            onToggleTask(item.occurrence.task);
        }
    }, [item, onToggleTask]);

    if (item.kind === 'event') {
        const {event, startAt, endAt} = item.occurrence;
        const meta = [
            formatEventTime(intl, {allDay: event.allDay, startAt, endAt}),
            event.location,
            scopeLabel(intl, event, names),
        ].filter(Boolean).join(' · ');
        const color = event.color || theme.buttonBg;
        return (
            <Pressable
                onPress={handlePress}
                style={({pressed}) => [styles.row, pressed && styles.pressed]}
                testID={`agenda.item.event.${event.id}`}
            >
                <View style={[styles.tile, {backgroundColor: changeOpacity(color, 0.16)}]}>
                    <CompassIcon
                        name='calendar-outline'
                        size={20}
                        color={color}
                    />
                </View>
                <View style={styles.body}>
                    <Text
                        style={styles.title}
                        numberOfLines={2}
                    >
                        {event.title}
                    </Text>
                    <Text
                        style={styles.meta}
                        numberOfLines={2}
                    >
                        {meta}
                    </Text>
                </View>
            </Pressable>
        );
    }

    const {task, dueAt} = item.occurrence;
    const done = task.status === 'done';
    const assignees = assigneeLabel(task.assigneeIds, names, intl.locale, teammateNameDisplay);
    const meta = [
        formatDue(intl, {dueAt, dueHasTime: task.dueHasTime}, showDate),
        scopeLabel(intl, task, names),
        assignees,
    ].filter(Boolean).join(' · ');
    const priorityColor = PRIORITY_COLORS[task.priority];

    return (
        <Pressable
            onPress={handlePress}
            style={({pressed}) => [styles.row, pressed && styles.pressed]}
            testID={`agenda.item.task.${task.id}`}
        >
            <Pressable
                onPress={handleToggle}
                hitSlop={HIT_SLOP}
                style={({pressed}) => [styles.tile, styles.taskTile, done && styles.taskTileDone, pressed && styles.pressed]}
                testID={`agenda.item.task.${task.id}.toggle`}
                accessibilityRole='checkbox'
                accessibilityState={{checked: done}}
            >
                <CompassIcon
                    name={done ? 'check' : 'circle-outline'}
                    style={[styles.checkboxIcon, done && styles.checkboxDone]}
                />
            </Pressable>
            <View style={styles.body}>
                <Text
                    style={[styles.title, done && styles.titleDone]}
                    numberOfLines={2}
                >
                    {task.title}
                </Text>
                <Text
                    style={styles.meta}
                    numberOfLines={2}
                >
                    {meta}
                </Text>
            </View>
            {Boolean(priorityColor) && !done && (
                <View style={[styles.priority, {backgroundColor: theme[priorityColor] as string}]}/>
            )}
        </Pressable>
    );
};

export default React.memo(AgendaItemRow);
