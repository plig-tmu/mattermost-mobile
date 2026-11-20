// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Pressable, Text, View} from 'react-native';

import CircleButton from '@agenda/components/circle_button';
import FormattedText from '@components/formatted_text';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import type {CalendarMode} from '@agenda/utils/calendar';

const messages = defineMessages({
    previous: {id: 'agenda.calendar.previous', defaultMessage: 'Previous'},
    next: {id: 'agenda.calendar.next', defaultMessage: 'Next'},
});

const BUTTON_SIZE = 36;

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
    gap: {
        width: 8,
    },
    chip: {
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        paddingHorizontal: 12,
        marginLeft: 8,
        justifyContent: 'center',
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.12),
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.08),
    },
    chipText: {
        color: theme.centerChannelColor,
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
    const intl = useIntl();

    return (
        <View style={styles.container}>
            <Text
                style={styles.title}
                testID='agenda.calendar.title'
                numberOfLines={1}
            >
                {title}
            </Text>
            <CircleButton
                iconName='chevron-left'
                size={BUTTON_SIZE}
                onPress={onPrevious}
                accessibilityLabel={intl.formatMessage(messages.previous)}
                testID='agenda.calendar.previous'
            />
            <View style={styles.gap}/>
            <CircleButton
                iconName='chevron-right'
                size={BUTTON_SIZE}
                onPress={onNext}
                accessibilityLabel={intl.formatMessage(messages.next)}
                testID='agenda.calendar.next'
            />
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
