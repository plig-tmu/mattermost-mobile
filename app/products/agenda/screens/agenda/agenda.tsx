// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';
import {Alert, Pressable, View} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';

import ScopeBar from '@agenda/components/scope_bar';
import CompassIcon from '@components/compass_icon';
import {Screens} from '@constants';
import {useTheme} from '@context/theme';
import useTabs, {type TabDefinition} from '@hooks/use_tabs';
import Tabs from '@hooks/use_tabs/tabs';
import {navigateToScreen} from '@screens/navigation';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

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
    create: {id: 'agenda.create', defaultMessage: 'Create'},
    newEvent: {id: 'agenda.create.event', defaultMessage: 'New event'},
    newTask: {id: 'agenda.create.task', defaultMessage: 'New task'},
    cancel: {id: 'agenda.cancel', defaultMessage: 'Cancel'},
});

const HIT_SLOP = {top: 8, bottom: 8, left: 8, right: 8};

const EDGES: Edge[] = ['bottom', 'left', 'right'];

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.centerChannelBg,
    },
    tabs: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 16,
    },
    createIcon: {
        color: changeOpacity(theme.centerChannelColor, 0.64),
        fontSize: 24,
    },
    pressed: {
        opacity: 0.72,
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
    const onCreate = useCallback(() => {
        const params = scope.kind === 'my' ? {} : {teamId: scope.teamId, channelId: scope.kind === 'channel' ? scope.channelId : undefined};
        Alert.alert(intl.formatMessage(messages.create), undefined, [
            {text: intl.formatMessage(messages.newEvent), onPress: () => navigateToScreen(Screens.AGENDA_EDIT_EVENT, params)},
            {text: intl.formatMessage(messages.newTask), onPress: () => navigateToScreen(Screens.AGENDA_EDIT_TASK, params)},
            {text: intl.formatMessage(messages.cancel), style: 'cancel'},
        ]);
    }, [intl, scope]);

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
                <Pressable
                    onPress={onCreate}
                    hitSlop={HIT_SLOP}
                    style={({pressed}) => pressed && styles.pressed}
                    accessibilityRole='button'
                    accessibilityLabel={intl.formatMessage(messages.create)}
                    testID='agenda.create'
                >
                    <CompassIcon
                        name='plus'
                        style={styles.createIcon}
                    />
                </Pressable>
            </View>
            {tab === 'calendar' && <CalendarView {...viewProps}/>}
            {tab === 'tasks' && <TasksView {...viewProps}/>}
            {tab === 'list' && <ListView {...viewProps}/>}
        </SafeAreaView>
    );
};

export default Agenda;
