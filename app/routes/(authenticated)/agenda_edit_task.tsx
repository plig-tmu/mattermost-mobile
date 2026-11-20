// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import EditTask from '@agenda/screens/edit_task';
import {useTheme} from '@context/theme';
import {getHeaderOptions, useNavigationHeader} from '@hooks/navigation_header';
import {usePropsFromParams} from '@hooks/props_from_params';

type Props = {taskId?: string; teamId?: string; channelId?: string; day?: number};

export default function EditTaskRoute() {
    const theme = useTheme();
    const intl = useIntl();
    const props = usePropsFromParams<Props>();

    useNavigationHeader({
        showWhenPushed: true,
        headerOptions: {
            headerTitle: props.taskId ? intl.formatMessage({id: 'agenda.task.edit_title', defaultMessage: 'Edit task'}) : intl.formatMessage({id: 'agenda.task.new_title', defaultMessage: 'New task'}),
            ...getHeaderOptions(theme),
        },
    });

    return <EditTask {...props}/>;
}
