// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import EventDetails from '@agenda/screens/event_details';
import {useTheme} from '@context/theme';
import {getHeaderOptions, useNavigationHeader} from '@hooks/navigation_header';
import {usePropsFromParams} from '@hooks/props_from_params';

type Props = {eventId: string; occurrenceStart?: number};

export default function EventDetailsRoute() {
    const theme = useTheme();
    const intl = useIntl();
    const props = usePropsFromParams<Props>();

    useNavigationHeader({
        showWhenPushed: true,
        headerOptions: {
            headerTitle: intl.formatMessage({id: 'agenda.event.title', defaultMessage: 'Event'}),
            ...getHeaderOptions(theme),
        },
    });

    return <EventDetails {...props}/>;
}
