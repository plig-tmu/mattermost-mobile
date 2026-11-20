// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import EditEvent from '@agenda/screens/edit_event';
import {useTheme} from '@context/theme';
import {getHeaderOptions, useNavigationHeader} from '@hooks/navigation_header';
import {usePropsFromParams} from '@hooks/props_from_params';

type Props = {eventId?: string; teamId?: string; channelId?: string; day?: number};

export default function EditEventRoute() {
    const theme = useTheme();
    const intl = useIntl();
    const props = usePropsFromParams<Props>();

    useNavigationHeader({
        showWhenPushed: true,
        headerOptions: {
            headerTitle: props.eventId ? intl.formatMessage({id: 'agenda.event.edit_title', defaultMessage: 'Edit event'}) : intl.formatMessage({id: 'agenda.event.new_title', defaultMessage: 'New event'}),
            ...getHeaderOptions(theme),
        },
    });

    return <EditEvent {...props}/>;
}
