// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import AgendaScreen from '@agenda/screens/agenda';
import {useTheme} from '@context/theme';
import {getHeaderOptions, useNavigationHeader} from '@hooks/navigation_header';

export default function AgendaRoute() {
    const theme = useTheme();
    const intl = useIntl();

    useNavigationHeader({
        showWhenPushed: true,
        headerOptions: {
            headerTitle: intl.formatMessage({id: 'agenda.title', defaultMessage: 'Agenda'}),
            ...getHeaderOptions(theme),
        },
    });

    return <AgendaScreen/>;
}
