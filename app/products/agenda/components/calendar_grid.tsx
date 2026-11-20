// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {Pressable, Text, View} from 'react-native';

import {localDateKey} from '@agenda/utils/calendar';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

const CELL_SIZE = 36;
const DOT_SIZE = 5;

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    row: {
        flexDirection: 'row',
    },
    weekday: {
        flex: 1,
        textAlign: 'center',
        color: changeOpacity(theme.centerChannelColor, 0.64),
        paddingVertical: 4,
        ...typography('Body', 75, 'SemiBold'),
    },
    cell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 2,
    },
    circle: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: CELL_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleSelected: {
        backgroundColor: theme.buttonBg,
    },
    dayText: {
        color: theme.centerChannelColor,
        ...typography('Body', 100),
    },
    dayOutside: {
        color: changeOpacity(theme.centerChannelColor, 0.32),
    },
    dayToday: {
        color: theme.buttonBg,
        ...typography('Body', 100, 'SemiBold'),
    },
    daySelected: {
        color: theme.buttonColor,
        ...typography('Body', 100, 'SemiBold'),
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        marginTop: 2,
        backgroundColor: theme.buttonBg,
    },
    dotHidden: {
        backgroundColor: 'transparent',
    },
    pressed: {
        opacity: 0.72,
    },
}));

type DayProps = {
    date: Date;
    dateKey: string;
    selected: boolean;
    today: boolean;
    outside: boolean;
    marked: boolean;
    onSelect: (key: string) => void;
};

const Day = React.memo(({date, dateKey, selected, today, outside, marked, onSelect}: DayProps) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);
    const handlePress = useCallback(() => onSelect(dateKey), [dateKey, onSelect]);

    return (
        <Pressable
            onPress={handlePress}
            style={({pressed}) => [styles.cell, pressed && styles.pressed]}
            testID={`agenda.calendar.day.${dateKey}`}
            accessibilityRole='button'
            accessibilityState={{selected}}
        >
            <View style={[styles.circle, selected && styles.circleSelected]}>
                <Text
                    style={[
                        styles.dayText,
                        outside && styles.dayOutside,
                        today && styles.dayToday,
                        selected && styles.daySelected,
                    ]}
                >
                    {date.getDate()}
                </Text>
            </View>
            <View
                style={[styles.dot, !marked && styles.dotHidden]}
                testID={marked ? `agenda.calendar.day.${dateKey}.marker` : undefined}
            />
        </Pressable>
    );
});
Day.displayName = 'AgendaCalendarDay';

type Props = {
    days: Date[];

    // Month (0-11) whose days are emphasised; days of other months are dimmed. Omit for weeks.
    month?: number;
    selectedKey: string;
    todayKey: string;
    markedKeys: Set<string>;
    onSelect: (key: string) => void;
};

// CalendarGrid renders a week (7 days) or a month grid (whole weeks) of selectable days, with a
// dot on days that have events or tasks.
const CalendarGrid = ({days, month, selectedKey, todayKey, markedKeys, onSelect}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const styles = getStyleSheet(theme);

    const weekdays = useMemo(() => days.slice(0, 7).map((day) => intl.formatDate(day, {weekday: 'narrow'})), [days, intl]);
    const weeks = useMemo(() => {
        const result: Date[][] = [];
        for (let i = 0; i < days.length; i += 7) {
            result.push(days.slice(i, i + 7));
        }
        return result;
    }, [days]);

    return (
        <View testID='agenda.calendar.grid'>
            <View style={styles.row}>
                {weekdays.map((label, i) => (
                    <Text

                        // Weekday labels can repeat (e.g. "T"), so the position is the key.
                        // eslint-disable-next-line react/no-array-index-key
                        key={i}
                        style={styles.weekday}
                    >
                        {label}
                    </Text>
                ))}
            </View>
            {weeks.map((week) => (
                <View
                    key={localDateKey(week[0])}
                    style={styles.row}
                >
                    {week.map((date) => {
                        const key = localDateKey(date);
                        return (
                            <Day
                                key={key}
                                date={date}
                                dateKey={key}
                                selected={key === selectedKey}
                                today={key === todayKey}
                                outside={month !== undefined && date.getMonth() !== month}
                                marked={markedKeys.has(key)}
                                onSelect={onSelect}
                            />
                        );
                    })}
                </View>
            ))}
        </View>
    );
};

export default CalendarGrid;
