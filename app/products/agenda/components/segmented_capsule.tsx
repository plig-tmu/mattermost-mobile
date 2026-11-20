// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {type MessageDescriptor, useIntl} from 'react-intl';
import {Pressable, Text, View} from 'react-native';

import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

const HEIGHT = 44;

// Same shape as the Oxide tab bar: a soft capsule with the selected option on a darker pill.
const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    capsule: {
        flexDirection: 'row',
        height: HEIGHT,
        borderRadius: HEIGHT / 2,
        padding: 4,
        marginHorizontal: 16,
        marginVertical: 8,
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.12),
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.08),
    },
    option: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: (HEIGHT - 8) / 2,
    },
    selected: {
        backgroundColor: theme.centerChannelBg,
    },
    text: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
        ...typography('Body', 100, 'SemiBold'),
    },
    textSelected: {
        color: theme.centerChannelColor,
    },
    pressed: {
        opacity: 0.72,
    },
}));

export type SegmentOption<T extends string> = {id: T; name: MessageDescriptor};

type Props<T extends string> = {
    options: Array<SegmentOption<T>>;
    selected: T;
    onSelect: (id: T) => void;
    testID: string;
};

function SegmentedCapsule<T extends string>({options, selected, onSelect, testID}: Props<T>) {
    const theme = useTheme();
    const styles = getStyleSheet(theme);

    return (
        <View
            style={styles.capsule}
            accessibilityRole='tablist'
            testID={testID}
        >
            {options.map((option) => (
                <Segment
                    key={option.id}
                    option={option}
                    selected={option.id === selected}
                    onSelect={onSelect}
                    testID={`${testID}.${option.id}`}
                />
            ))}
        </View>
    );
}

type SegmentProps<T extends string> = {
    option: SegmentOption<T>;
    selected: boolean;
    onSelect: (id: T) => void;
    testID: string;
};

function Segment<T extends string>({option, selected, onSelect, testID}: SegmentProps<T>) {
    const theme = useTheme();
    const intl = useIntl();
    const styles = getStyleSheet(theme);
    const handlePress = useCallback(() => onSelect(option.id), [onSelect, option.id]);

    return (
        <Pressable
            onPress={handlePress}
            style={({pressed}) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
            accessibilityRole='tab'
            accessibilityState={{selected}}
            testID={testID}
        >
            <Text
                style={[styles.text, selected && styles.textSelected]}
                numberOfLines={1}
            >
                {intl.formatMessage(option.name)}
            </Text>
        </Pressable>
    );
}

export default SegmentedCapsule;
