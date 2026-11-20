// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Pressable} from 'react-native';

import CompassIcon, {type CompassIconName} from '@components/compass_icon';
import {useTheme} from '@context/theme';
import {makeStyleSheetFromTheme} from '@utils/theme';

type Props = {
    iconName: CompassIconName;
    onPress: () => void;
    accessibilityLabel: string;
    testID?: string;
};

const SIZE = 56;

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    button: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: SIZE,
        height: SIZE,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.buttonBg,
        boxShadow: '0px 6px 14px rgba(0, 0, 0, 0.16)',
    },
    pressed: {
        opacity: 0.84,
        transform: [{scale: 0.96}],
    },
}));

// FloatingActionButton is the round primary action pinned to the bottom right of a tab screen,
// as in the Slack-style home layout. The parent must be the positioned container.
const FloatingActionButton = ({iconName, onPress, accessibilityLabel, testID}: Props) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);

    return (
        <Pressable
            onPress={onPress}
            style={({pressed}) => [styles.button, pressed && styles.pressed]}
            accessibilityRole='button'
            accessibilityLabel={accessibilityLabel}
            testID={testID}
        >
            <CompassIcon
                name={iconName}
                size={24}
                color={theme.buttonColor}
            />
        </Pressable>
    );
};

export default FloatingActionButton;
