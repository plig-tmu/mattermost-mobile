// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {Pressable, View} from 'react-native';

import {
    getStyleSheet as getChannelItemStyleSheet,
    ROW_HEIGHT,
    textStyle as channelItemTextStyle,
} from '@components/channel_item/channel_item';
import CompassIcon from '@components/compass_icon';
import FormattedText from '@components/formatted_text';
import {Screens} from '@constants';
import {HOME_PADDING} from '@constants/view';
import {useTheme} from '@context/theme';
import {usePreventDoubleTap} from '@hooks/utils';
import {navigateToScreen} from '@screens/navigation';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        ...HOME_PADDING,
        minHeight: ROW_HEIGHT,
    },
    icon: {
        color: changeOpacity(theme.sidebarText, 0.5),
        fontSize: 24,
        marginRight: 12,
    },
    text: {
        flex: 1,
    },
    pressed: {
        opacity: 0.72,
    },
}));

const AgendaButton = () => {
    const theme = useTheme();
    const channelItemStyles = getChannelItemStyleSheet(theme);
    const styles = getStyleSheet(theme);

    const handlePress = usePreventDoubleTap(useCallback(() => {
        navigateToScreen(Screens.AGENDA);
    }, []));

    return (
        <Pressable
            onPress={handlePress}
            testID='channel_list.agenda.button'
            style={({pressed}) => pressed && styles.pressed}
        >
            <View style={[channelItemStyles.container, styles.container]}>
                <CompassIcon
                    name='calendar-outline'
                    style={styles.icon}
                />
                <FormattedText
                    id='agenda.home_button.title'
                    defaultMessage='Agenda'
                    style={[styles.text, channelItemTextStyle.regular, channelItemStyles.text]}
                />
            </View>
        </Pressable>
    );
};

export default React.memo(AgendaButton);
