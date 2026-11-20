// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Pressable, Text, View} from 'react-native';

import CompassIcon, {type CompassIconName} from '@components/compass_icon';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

export const getDetailStyles = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.centerChannelBg,
    },
    content: {
        padding: 16,
    },
    title: {
        color: theme.centerChannelColor,
        marginBottom: 12,
        ...typography('Heading', 400),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
    },
    rowIcon: {
        color: changeOpacity(theme.centerChannelColor, 0.56),
        fontSize: 20,
        width: 28,
    },
    rowText: {
        flex: 1,
        color: theme.centerChannelColor,
        ...typography('Body', 200),
    },
    description: {
        color: theme.centerChannelColor,
        marginTop: 12,
        ...typography('Body', 200),
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 20,
        gap: 8,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: changeOpacity(theme.buttonBg, 0.08),
    },
    buttonPrimary: {
        backgroundColor: theme.buttonBg,
    },
    buttonDanger: {
        backgroundColor: changeOpacity(theme.errorTextColor, 0.08),
    },
    buttonText: {
        color: theme.buttonBg,
        ...typography('Body', 100, 'SemiBold'),
    },
    buttonTextPrimary: {
        color: theme.buttonColor,
    },
    buttonTextDanger: {
        color: theme.errorTextColor,
    },
    pressed: {
        opacity: 0.72,
    },
}));

export const DetailRow = ({icon, text, testID}: {icon: CompassIconName; text?: string; testID?: string}) => {
    const theme = useTheme();
    const styles = getDetailStyles(theme);
    if (!text) {
        return null;
    }
    return (
        <View
            style={styles.row}
            testID={testID}
        >
            <CompassIcon
                name={icon}
                style={styles.rowIcon}
            />
            <Text style={styles.rowText}>{text}</Text>
        </View>
    );
};

type ButtonProps = {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'danger' | 'default';
    disabled?: boolean;
    testID?: string;
};

export const DetailButton = ({label, onPress, variant = 'default', disabled, testID}: ButtonProps) => {
    const theme = useTheme();
    const styles = getDetailStyles(theme);
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({pressed}) => [
                styles.button,
                variant === 'primary' && styles.buttonPrimary,
                variant === 'danger' && styles.buttonDanger,
                (pressed || disabled) && styles.pressed,
            ]}
            testID={testID}
        >
            <Text
                style={[
                    styles.buttonText,
                    variant === 'primary' && styles.buttonTextPrimary,
                    variant === 'danger' && styles.buttonTextDanger,
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
};
