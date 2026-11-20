// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {Pressable, Text} from 'react-native';

import CompassIcon, {type CompassIconName} from '@components/compass_icon';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 32,
        borderRadius: 16,
        paddingHorizontal: 14,
        marginRight: 8,
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.16),
        maxWidth: 220,
    },
    selected: {
        backgroundColor: theme.buttonBg,
        borderColor: theme.buttonBg,
    },
    text: {
        flexShrink: 1,
        color: theme.centerChannelColor,
        ...typography('Body', 100, 'SemiBold'),
    },
    textSelected: {
        color: theme.buttonColor,
    },
    icon: {
        marginLeft: 4,
        color: changeOpacity(theme.centerChannelColor, 0.64),
    },
    pressed: {
        opacity: 0.72,
    },
}));

type Props<T extends string> = {
    value: T;
    label: string;
    selected: boolean;
    onPress: (value: T) => void;
    rightIcon?: CompassIconName;
    testID?: string;
};

// Pill is the rounded filter chip used across Agenda (Slack-style filters).
function Pill<T extends string>({value, label, selected, onPress, rightIcon, testID}: Props<T>) {
    const theme = useTheme();
    const styles = getStyleSheet(theme);
    const handlePress = useCallback(() => onPress(value), [onPress, value]);

    return (
        <Pressable
            onPress={handlePress}
            style={({pressed}) => [styles.pill, selected && styles.selected, pressed && styles.pressed]}
            accessibilityRole='button'
            accessibilityState={{selected}}
            testID={testID}
        >
            <Text
                style={[styles.text, selected && styles.textSelected]}
                numberOfLines={1}
            >
                {label}
            </Text>
            {rightIcon ? (
                <CompassIcon
                    name={rightIcon}
                    size={16}
                    style={[styles.icon, selected && styles.textSelected]}
                />
            ) : null}
        </Pressable>
    );
}

export default Pill;
