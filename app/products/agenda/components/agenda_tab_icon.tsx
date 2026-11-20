// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CompassIcon from '@components/compass_icon';
import {BOTTOM_TAB_ICON_SIZE} from '@constants/view';
import {changeOpacity} from '@utils/theme';

type Props = {
    isFocused: boolean;
    theme: Theme;
}

const AgendaTabIcon = ({isFocused, theme}: Props) => (
    <CompassIcon
        size={BOTTOM_TAB_ICON_SIZE}
        name='calendar-outline'
        color={isFocused ? theme.centerChannelColor : changeOpacity(theme.centerChannelColor, 0.72)}
    />
);

export default AgendaTabIcon;
