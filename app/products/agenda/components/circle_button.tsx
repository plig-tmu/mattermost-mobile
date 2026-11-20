// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Pressable} from 'react-native';

import CompassIcon, {type CompassIconName} from '@components/compass_icon';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

type Props = {
    iconName: CompassIconName;
    onPress: () => void;
    accessibilityLabel: string;
    size?: number;
    testID?: string;
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.12),
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.08),
    },
    pressed: {
        opacity: 0.72,
    },
}));

// CircleButton is the round, softly filled icon button of the Oxide header and controls.
const CircleButton = ({iconName, onPress, accessibilityLabel, size = 48, testID}: Props) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);

    return (
        <Pressable
            onPress={onPress}
            style={({pressed}) => [styles.button, {width: size, height: size, borderRadius: size / 2}, pressed && styles.pressed]}
            accessibilityRole='button'
            accessibilityLabel={accessibilityLabel}
            testID={testID}
        >
            <CompassIcon
                name={iconName}
                size={size / 2}
                color={theme.centerChannelColor}
            />
        </Pressable>
    );
};

export default CircleButton;
