// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {defineMessage} from 'react-intl';
import {View} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';

import ScopeBar from '@agenda/components/scope_bar';
import {Screens} from '@constants';
import {useTheme} from '@context/theme';
import useTabs, {type TabDefinition} from '@hooks/use_tabs';
import Tabs from '@hooks/use_tabs/tabs';
import {navigateToScreen} from '@screens/navigation';
import {makeStyleSheetFromTheme} from '@utils/theme';

import CalendarView from './calendar_view';
import ListView from './list_view';
import TasksView from './tasks_view';

import type {AgendaScope} from '@agenda/types';

type AgendaTab = 'calendar' | 'tasks' | 'list';

const TABS: Array<TabDefinition<AgendaTab>> = [
    {id: 'calendar', name: defineMessage({id: 'agenda.tab.calendar', defaultMessage: 'Calendar'})},
    {id: 'tasks', name: defineMessage({id: 'agenda.tab.tasks', defaultMessage: 'Tasks'})},
    {id: 'list', name: defineMessage({id: 'agenda.tab.list', defaultMessage: 'Agenda'})},
];

const EDGES: Edge[] = ['bottom', 'left', 'right'];

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.centerChannelBg,
    },
    tabs: {
        flexDirection: 'row',
    },
}));

type Props = {
    currentTeamId: string;
    teammateNameDisplay?: string;
};

const Agenda = ({currentTeamId, teammateNameDisplay}: Props) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);
    const [scope, setScope] = useState<AgendaScope>({kind: 'my'});
    const [tab, tabsProps] = useTabs<AgendaTab>('calendar', TABS, undefined, 'agenda.tabs');

    const onPressEvent = useCallback((eventId: string, occurrenceStart?: number) => {
        navigateToScreen(Screens.AGENDA_EVENT, {eventId, occurrenceStart});
    }, []);
    const onPressTask = useCallback((taskId: string) => {
        navigateToScreen(Screens.AGENDA_TASK, {taskId});
    }, []);

    const viewProps = {scope, onPressEvent, onPressTask, teammateNameDisplay};

    return (
        <SafeAreaView
            edges={EDGES}
            style={styles.container}
            testID='agenda.screen'
        >
            <ScopeBar
                scope={scope}
                defaultTeamId={currentTeamId}
                onChange={setScope}
            />
            <View style={styles.tabs}>
                <Tabs {...tabsProps}/>
            </View>
            {tab === 'calendar' && <CalendarView {...viewProps}/>}
            {tab === 'tasks' && <TasksView {...viewProps}/>}
            {tab === 'list' && <ListView {...viewProps}/>}
        </SafeAreaView>
    );
};

export default Agenda;
