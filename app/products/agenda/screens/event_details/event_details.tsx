// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo} from 'react';
import {defineMessage, defineMessages, useIntl} from 'react-intl';
import {Alert, ScrollView, Text, View} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';

import {deleteAgendaEvent, fetchAgendaEvent} from '@agenda/actions/remote';
import {DetailButton, DetailRow, getDetailStyles} from '@agenda/components/detail_parts';
import {useAgendaNames} from '@agenda/hooks/use_agenda_names';
import {emitAgendaChanged, useAgendaRequest} from '@agenda/hooks/use_agenda_request';
import {ListState} from '@agenda/screens/agenda/list_state';
import {taskMessages} from '@agenda/screens/task_details/task_details';
import {agendaErrorMessage} from '@agenda/utils/errors';
import {assigneeLabel, formatEventRange, formatRecurrence, scopeLabel} from '@agenda/utils/format';
import {Screens} from '@constants';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {navigateBack, navigateToScreen} from '@screens/navigation';

import type {AgendaEvent} from '@agenda/types';

const EDGES: Edge[] = ['bottom', 'left', 'right'];

const messages = defineMessages({
    deleteTitle: {id: 'agenda.event.delete_title', defaultMessage: 'Delete event?'},
    deleteBody: {id: 'agenda.event.delete_body', defaultMessage: 'This event will be deleted for everyone.'},
    deleteSeriesBody: {id: 'agenda.event.delete_series_body', defaultMessage: 'This deletes every occurrence of the repeating event for everyone.'},
    failed: {id: 'agenda.event.update_failed', defaultMessage: 'Could not update the event'},
    timezone: {id: 'agenda.event.timezone', defaultMessage: 'Time zone: {timezone}'},
});

type Props = {
    eventId: string;

    // Start of the tapped occurrence of a recurring series.
    occurrenceStart?: number;
    currentUserId: string;
    teammateNameDisplay?: string;
};

const EventDetails = ({eventId, occurrenceStart, currentUserId, teammateNameDisplay}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const styles = getDetailStyles(theme);

    const load = useCallback(() => fetchAgendaEvent(serverUrl, eventId), [serverUrl, eventId]);
    const {data: event, loading, error, refresh} = useAgendaRequest<AgendaEvent>(`${serverUrl}|event|${eventId}`, load);
    const names = useAgendaNames(serverUrl, useMemo(() => (event ? [event] : []), [event]));

    // Show the tapped occurrence's times; a moved occurrence keeps its override times.
    const shown = useMemo(() => {
        if (!event || !occurrenceStart || !event.recurrence) {
            return event;
        }
        const override = event.overrides?.find((o) => o.originalStart === occurrenceStart);
        if (override?.startAt && override.endAt) {
            return {...event, startAt: override.startAt, endAt: override.endAt};
        }
        return {...event, startAt: occurrenceStart, endAt: occurrenceStart + (event.endAt - event.startAt)};
    }, [event, occurrenceStart]);

    const edit = useCallback(() => {
        navigateToScreen(Screens.AGENDA_EDIT_EVENT, {eventId});
    }, [eventId]);

    const remove = useCallback(() => {
        const body = event?.recurrence ? messages.deleteSeriesBody : messages.deleteBody;
        Alert.alert(intl.formatMessage(messages.deleteTitle), intl.formatMessage(body), [
            {text: intl.formatMessage(taskMessages.cancel), style: 'cancel'},
            {
                text: intl.formatMessage(taskMessages.delete),
                style: 'destructive',
                onPress: async () => {
                    const result = await deleteAgendaEvent(serverUrl, eventId);
                    if (result.error) {
                        Alert.alert(intl.formatMessage(messages.failed), agendaErrorMessage(intl, result.error));
                        return;
                    }
                    emitAgendaChanged();
                    navigateBack();
                },
            },
        ]);
    }, [event?.recurrence, eventId, intl, serverUrl]);

    if (!shown) {
        return (
            <SafeAreaView
                edges={EDGES}
                style={styles.container}
            >
                <ListState
                    loading={loading}
                    error={error}
                    onRetry={refresh}
                    emptyMessage={defineMessage({id: 'agenda.event.not_found', defaultMessage: 'Event not found'})}
                />
            </SafeAreaView>
        );
    }

    // Only the creator (or an admin, which the server checks) may edit an event.
    const canEdit = shown.creatorId === currentUserId;
    const deviceZone = moment.tz.guess();
    const zone = !shown.allDay && shown.timezone && shown.timezone !== deviceZone ? intl.formatMessage(messages.timezone, {timezone: shown.timezone}) : undefined;

    return (
        <SafeAreaView
            edges={EDGES}
            style={styles.container}
            testID='agenda.event_details'
        >
            <ScrollView contentContainerStyle={styles.content}>
                <Text
                    style={styles.title}
                    testID='agenda.event_details.title'
                >
                    {shown.title}
                </Text>
                <DetailRow
                    icon='clock-outline'
                    text={formatEventRange(intl, shown)}
                    testID='agenda.event_details.time'
                />
                <DetailRow
                    icon='globe'
                    text={zone}
                />
                <DetailRow
                    icon='refresh'
                    text={formatRecurrence(intl, shown.recurrence)}
                />
                <DetailRow
                    icon='map-marker-outline'
                    text={shown.location}
                />
                <DetailRow
                    icon='account-multiple-outline'
                    text={assigneeLabel(shown.assigneeIds, names, intl.locale, teammateNameDisplay)}
                />
                <DetailRow
                    icon='lock-outline'
                    text={scopeLabel(intl, shown, names)}
                />
                {Boolean(shown.description) && <Text style={styles.description}>{shown.description}</Text>}
                {canEdit && (
                    <View style={styles.actions}>
                        <DetailButton
                            label={intl.formatMessage(taskMessages.edit)}
                            onPress={edit}
                            testID='agenda.event_details.edit'
                        />
                        <DetailButton
                            label={intl.formatMessage(taskMessages.delete)}
                            onPress={remove}
                            variant='danger'
                            testID='agenda.event_details.delete'
                        />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default EventDetails;
