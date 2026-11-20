// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';
import {Alert, View} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';

import ScopeBar from '@agenda/components/scope_bar';
import NavigationHeader from '@components/navigation_header';
import RoundedHeaderContext from '@components/rounded_header_context';
import {Screens} from '@constants';
import {useTheme} from '@context/theme';
import useAndroidHomeTabBackHandler from '@hooks/android_home_tab_back_handler';
import {useDefaultHeaderHeight} from '@hooks/header';
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

const messages = defineMessages({
    title: {id: 'agenda.title', defaultMessage: 'Agenda'},
    create: {id: 'agenda.create', defaultMessage: 'Create'},
    newEvent: {id: 'agenda.create.event', defaultMessage: 'New event'},
    newTask: {id: 'agenda.create.task', defaultMessage: 'New task'},
    cancel: {id: 'agenda.cancel', defaultMessage: 'Cancel'},
});

// The bottom tab bar owns the bottom inset; the header owns the top one.
const EDGES: Edge[] = ['left', 'right'];

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.centerChannelBg,
    },
    content: {
        flex: 1,
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

    const intl = useIntl();
    const headerHeight = useDefaultHeaderHeight();
    useAndroidHomeTabBackHandler(Screens.AGENDA);

    const onCreate = useCallback(() => {
        const params = scope.kind === 'my' ? {} : {teamId: scope.teamId, channelId: scope.kind === 'channel' ? scope.channelId : undefined};
        Alert.alert(intl.formatMessage(messages.create), undefined, [
            {text: intl.formatMessage(messages.newEvent), onPress: () => navigateToScreen(Screens.AGENDA_EDIT_EVENT, params)},
            {text: intl.formatMessage(messages.newTask), onPress: () => navigateToScreen(Screens.AGENDA_EDIT_TASK, params)},
            {text: intl.formatMessage(messages.cancel), style: 'cancel'},
        ]);
    }, [intl, scope]);

    const rightButtons = useMemo(() => [{
        iconName: 'plus' as const,
        onPress: onCreate,
        accessibilityLabel: intl.formatMessage(messages.create),
        testID: 'agenda.create',
    }], [intl, onCreate]);
    const contentStyle = useMemo(() => [styles.content, {marginTop: headerHeight}], [styles.content, headerHeight]);

    const viewProps = {scope, onPressEvent, onPressTask, teammateNameDisplay};

    return (
        <SafeAreaView
            edges={EDGES}
            style={styles.container}
            testID='agenda.screen'
        >
            <NavigationHeader
                showBackButton={false}
                title={intl.formatMessage(messages.title)}
                rightButtons={rightButtons}
            />
            <View style={contentStyle}>
                <RoundedHeaderContext/>
                <ScopeBar
                    scope={scope}
                    defaultTeamId={currentTeamId}
                    onChange={setScope}
                />
                <Tabs {...tabsProps}/>
                {tab === 'calendar' && <CalendarView {...viewProps}/>}
                {tab === 'tasks' && <TasksView {...viewProps}/>}
                {tab === 'list' && <ListView {...viewProps}/>}
            </View>
        </SafeAreaView>
    );
};

export default Agenda;
