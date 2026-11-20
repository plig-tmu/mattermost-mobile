// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIsFocused} from '@react-navigation/native';
import React, {useCallback, useState} from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';
import {Text, View} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';

import CircleButton from '@agenda/components/circle_button';
import ScopeBar from '@agenda/components/scope_bar';
import SegmentedCapsule, {type SegmentOption} from '@agenda/components/segmented_capsule';
import {emitAgendaChanged} from '@agenda/hooks/use_agenda_request';
import SlideUpPanelItem, {ITEM_HEIGHT} from '@components/slide_up_panel_item';
import {Screens} from '@constants';
import {useTheme} from '@context/theme';
import useAndroidHomeTabBackHandler from '@hooks/android_home_tab_back_handler';
import useDidUpdate from '@hooks/did_update';
import {usePreventDoubleTap} from '@hooks/utils';
import {bottomSheet, dismissBottomSheet, navigateToScreen} from '@screens/navigation';
import {bottomSheetSnapPoint} from '@utils/helpers';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import CalendarView from './calendar_view';
import ListView from './list_view';
import TasksView from './tasks_view';

import type {AgendaScope} from '@agenda/types';

type AgendaTab = 'calendar' | 'tasks' | 'list';

const TABS: Array<SegmentOption<AgendaTab>> = [
    {id: 'calendar', name: defineMessage({id: 'agenda.tab.calendar', defaultMessage: 'Calendar'})},
    {id: 'tasks', name: defineMessage({id: 'agenda.tab.tasks', defaultMessage: 'Tasks'})},
    {id: 'list', name: defineMessage({id: 'agenda.tab.list', defaultMessage: 'Agenda'})},
];

const messages = defineMessages({
    title: {id: 'agenda.title', defaultMessage: 'Agenda'},
    create: {id: 'agenda.create', defaultMessage: 'Create'},
    newEvent: {id: 'agenda.create.event', defaultMessage: 'New event'},
    newTask: {id: 'agenda.create.task', defaultMessage: 'New task'},
});

const SUBTITLE_DATE = {weekday: 'long', month: 'long', day: 'numeric'} as const;

// The bottom tab bar owns the bottom inset.
const EDGES: Edge[] = ['top', 'left', 'right'];

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.centerChannelBg,
    },

    // Oxide header: plain background, title with a subtitle, round action buttons.
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },
    titles: {
        flex: 1,
        marginRight: 12,
    },
    title: {
        color: theme.centerChannelColor,
        ...typography('Heading', 500, 'SemiBold'),
    },
    subtitle: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
        ...typography('Body', 100),
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
    const [tab, setTab] = useState<AgendaTab>('calendar');

    const onPressEvent = useCallback((eventId: string, occurrenceStart?: number) => {
        navigateToScreen(Screens.AGENDA_EVENT, {eventId, occurrenceStart});
    }, []);
    const onPressTask = useCallback((taskId: string) => {
        navigateToScreen(Screens.AGENDA_TASK, {taskId});
    }, []);

    const intl = useIntl();
    useAndroidHomeTabBackHandler(Screens.AGENDA);

    // The tab stays mounted (frozen) while hidden; refetch when the user comes back so changes
    // made on the web or by teammates show up.
    const isFocused = useIsFocused();
    useDidUpdate(() => {
        if (isFocused) {
            emitAgendaChanged();
        }
    }, [isFocused]);

    // New records start in the selected team or channel.
    const onCreate = usePreventDoubleTap(useCallback(() => {
        const params = scope.kind === 'my' ? {} : {teamId: scope.teamId, channelId: scope.kind === 'channel' ? scope.channelId : undefined};
        const create = (screen: typeof Screens.AGENDA_EDIT_EVENT | typeof Screens.AGENDA_EDIT_TASK) => async () => {
            await dismissBottomSheet();
            navigateToScreen(screen, params);
        };
        const renderContent = () => (
            <View>
                <SlideUpPanelItem
                    leftIcon='calendar-outline'
                    text={intl.formatMessage(messages.newEvent)}
                    onPress={create(Screens.AGENDA_EDIT_EVENT)}
                    testID='agenda.create.event'
                />
                <SlideUpPanelItem
                    leftIcon='checkbox-marked-circle-outline'
                    text={intl.formatMessage(messages.newTask)}
                    onPress={create(Screens.AGENDA_EDIT_TASK)}
                    testID='agenda.create.task'
                />
            </View>
        );
        bottomSheet(renderContent, [1, bottomSheetSnapPoint(2, ITEM_HEIGHT)]);
    }, [intl, scope]));

    const viewProps = {scope, onPressEvent, onPressTask, teammateNameDisplay};

    return (
        <SafeAreaView
            edges={EDGES}
            style={styles.container}
            testID='agenda.screen'
        >
            <View style={styles.header}>
                <View style={styles.titles}>
                    <Text
                        style={styles.title}
                        numberOfLines={1}
                    >
                        {intl.formatMessage(messages.title)}
                    </Text>
                    <Text
                        style={styles.subtitle}
                        numberOfLines={1}
                    >
                        {intl.formatDate(Date.now(), SUBTITLE_DATE)}
                    </Text>
                </View>
                <CircleButton
                    iconName='plus'
                    size={52}
                    onPress={onCreate}
                    accessibilityLabel={intl.formatMessage(messages.create)}
                    testID='agenda.create'
                />
            </View>
            <ScopeBar
                scope={scope}
                defaultTeamId={currentTeamId}
                onChange={setScope}
            />
            <SegmentedCapsule<AgendaTab>
                options={TABS}
                selected={tab}
                onSelect={setTab}
                testID='agenda.tabs'
            />
            {tab === 'calendar' && <CalendarView {...viewProps}/>}
            {tab === 'tasks' && <TasksView {...viewProps}/>}
            {tab === 'list' && <ListView {...viewProps}/>}
        </SafeAreaView>
    );
};

export default Agenda;
