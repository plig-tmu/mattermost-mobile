// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Pressable, Text, View} from 'react-native';

import CompassIcon from '@components/compass_icon';
import FormattedText from '@components/formatted_text';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import type {CalendarMode} from '@agenda/utils/calendar';

const HIT_SLOP = {top: 8, bottom: 8, left: 8, right: 8};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    title: {
        flex: 1,
        color: theme.centerChannelColor,
        ...typography('Heading', 200),
    },
    iconButton: {
        padding: 4,
    },
    icon: {
        color: changeOpacity(theme.centerChannelColor, 0.64),
        fontSize: 24,
    },
    chip: {
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginLeft: 8,
        backgroundColor: changeOpacity(theme.buttonBg, 0.08),
    },
    chipText: {
        color: theme.buttonBg,
        ...typography('Body', 75, 'SemiBold'),
    },
    pressed: {
        opacity: 0.72,
    },
}));

type Props = {
    title: string;
    mode: CalendarMode;
    onPrevious: () => void;
    onNext: () => void;
    onToday: () => void;
    onToggleMode: () => void;
};

const CalendarHeader = ({title, mode, onPrevious, onNext, onToday, onToggleMode}: Props) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);

    return (
        <View style={styles.container}>
            <Text
                style={styles.title}
                testID='agenda.calendar.title'
                numberOfLines={1}
            >
                {title}
            </Text>
            <Pressable
                onPress={onPrevious}
                hitSlop={HIT_SLOP}
                style={({pressed}) => [styles.iconButton, pressed && styles.pressed]}
                testID='agenda.calendar.previous'
                accessibilityRole='button'
            >
                <CompassIcon
                    name='chevron-left'
                    style={styles.icon}
                />
            </Pressable>
            <Pressable
                onPress={onNext}
                hitSlop={HIT_SLOP}
                style={({pressed}) => [styles.iconButton, pressed && styles.pressed]}
                testID='agenda.calendar.next'
                accessibilityRole='button'
            >
                <CompassIcon
                    name='chevron-right'
                    style={styles.icon}
                />
            </Pressable>
            <Pressable
                onPress={onToday}
                style={({pressed}) => [styles.chip, pressed && styles.pressed]}
                testID='agenda.calendar.today'
            >
                <FormattedText
                    id='agenda.calendar.today'
                    defaultMessage='Today'
                    style={styles.chipText}
                />
            </Pressable>
            <Pressable
                onPress={onToggleMode}
                style={({pressed}) => [styles.chip, pressed && styles.pressed]}
                testID='agenda.calendar.mode'
            >
                {mode === 'month' ? (
                    <FormattedText
                        id='agenda.calendar.week'
                        defaultMessage='Week'
                        style={styles.chipText}
                    />
                ) : (
                    <FormattedText
                        id='agenda.calendar.month'
                        defaultMessage='Month'
                        style={styles.chipText}
                    />
                )}
            </Pressable>
        </View>
    );
};

export default CalendarHeader;
