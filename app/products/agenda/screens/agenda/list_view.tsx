// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {defineMessage, useIntl} from 'react-intl';
import {RefreshControl, SectionList, Text, View, type SectionListRenderItemInfo} from 'react-native';

import AgendaItemRow, {type AgendaItem} from '@agenda/components/agenda_item_row';
import {useAgendaNames} from '@agenda/hooks/use_agenda_names';
import {useAgendaRange} from '@agenda/hooks/use_agenda_range';
import {addLocalDays, dateFromKey, startOfLocalDay} from '@agenda/utils/calendar';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import {ListState, useToggleTask} from './list_state';

import type {AgendaScope} from '@agenda/types';

// The agenda list shows the next four weeks, fetched as one bounded range.
export const AGENDA_LIST_DAYS = 28;

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    header: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.04),
    },
    headerText: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
        ...typography('Body', 75, 'SemiBold'),
    },
}));

type Section = {key: string; title: string; data: AgendaItem[]};

type Props = {
    scope: AgendaScope;
    onPressEvent: (eventId: string, occurrenceStart?: number) => void;
    onPressTask: (taskId: string) => void;
    teammateNameDisplay?: string;
};

const ListView = ({scope, onPressEvent, onPressTask, teammateNameDisplay}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const styles = getStyleSheet(theme);

    const today = startOfLocalDay(new Date()).getTime();
    const days = useMemo(() => Array.from({length: AGENDA_LIST_DAYS}, (_, i) => addLocalDays(new Date(today), i)), [today]);
    const {itemsByDay, data, loading, refreshing, error, refresh, toggleTask} = useAgendaRange(serverUrl, scope, days);
    const names = useAgendaNames(serverUrl, useMemo(() => [...(data?.events ?? []), ...(data?.tasks ?? [])], [data]));
    const onToggleTask = useToggleTask(toggleTask);

    const sections = useMemo<Section[]>(() => {
        const result: Section[] = [];
        itemsByDay.forEach((items, key) => {
            if (items.length) {
                result.push({key, title: intl.formatDate(dateFromKey(key), {weekday: 'long', month: 'long', day: 'numeric'}), data: items});
            }
        });
        return result;
    }, [itemsByDay, intl]);

    const renderItem = useCallback(({item}: SectionListRenderItemInfo<AgendaItem, Section>) => (
        <AgendaItemRow
            item={item}
            names={names}
            teammateNameDisplay={teammateNameDisplay}
            onPressEvent={onPressEvent}
            onPressTask={onPressTask}
            onToggleTask={onToggleTask}
        />
    ), [names, onPressEvent, onPressTask, onToggleTask, teammateNameDisplay]);

    const renderSectionHeader = useCallback((info: {section: Section}) => (
        <View
            style={styles.header}
            testID={`agenda.list.section.${info.section.key}`}
        >
            <Text style={styles.headerText}>{info.section.title}</Text>
        </View>
    ), [styles]);

    return (
        <SectionList
            sections={sections}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={keyExtractor}
            stickySectionHeadersEnabled={true}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refresh}
                    tintColor={theme.centerChannelColor}
                />
            }
            ListEmptyComponent={
                <ListState
                    loading={loading}
                    error={error}
                    onRetry={refresh}
                    emptyMessage={defineMessage({id: 'agenda.list.empty', defaultMessage: 'Nothing scheduled in the next four weeks'})}
                />
            }
            testID='agenda.list'
        />
    );
};

const keyExtractor = (item: AgendaItem) => item.key;

export default ListView;
