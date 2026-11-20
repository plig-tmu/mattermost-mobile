// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import TaskDetails from '@agenda/screens/task_details';
import {useTheme} from '@context/theme';
import {getHeaderOptions, useNavigationHeader} from '@hooks/navigation_header';
import {usePropsFromParams} from '@hooks/props_from_params';

type Props = {taskId: string};

export default function TaskDetailsRoute() {
    const theme = useTheme();
    const intl = useIntl();
    const props = usePropsFromParams<Props>();

    useNavigationHeader({
        showWhenPushed: true,
        headerOptions: {
            headerTitle: intl.formatMessage({id: 'agenda.task.title', defaultMessage: 'Task'}),
            ...getHeaderOptions(theme),
        },
    });

    return <TaskDetails {...props}/>;
}
