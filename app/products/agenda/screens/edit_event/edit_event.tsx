// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Alert, ScrollView, View} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';

import {createAgendaEvent, fetchAgendaConfig, fetchAgendaEvent, updateAgendaEvent} from '@agenda/actions/remote';
import {DetailButton} from '@agenda/components/detail_parts';
import {ChipGroup, DateField, Field, FormError, getFormStyles, Input, ToggleRow, combineDateAndTime} from '@agenda/components/form_parts';
import {emitAgendaChanged} from '@agenda/hooks/use_agenda_request';
import {ListState} from '@agenda/screens/agenda/list_state';
import {formMessages} from '@agenda/screens/edit_task/edit_task';
import {taskMessages} from '@agenda/screens/task_details/task_details';
import {agendaErrorMessage} from '@agenda/utils/errors';
import {
    buildCreateEvent,
    buildEventPatch,
    dateOfStored,
    MAX_DESCRIPTION_LENGTH,
    MAX_TITLE_LENGTH,
    validateEventTimes,
    validateTitle,
    type EventForm,
} from '@agenda/utils/form';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {navigateBack} from '@screens/navigation';

import type {AgendaEvent, AgendaVisibility} from '@agenda/types';

const EDGES: Edge[] = ['bottom', 'left', 'right'];
const FALLBACK_DURATION_MINUTES = 60;

const messages = defineMessages({
    location: {id: 'agenda.form.location', defaultMessage: 'Location'},
    allDay: {id: 'agenda.form.all_day', defaultMessage: 'All day'},
    starts: {id: 'agenda.form.starts', defaultMessage: 'Starts'},
    ends: {id: 'agenda.form.ends', defaultMessage: 'Ends'},
    endBeforeStart: {id: 'agenda.form.end_before_start', defaultMessage: 'The event must end after it starts.'},
    seriesNote: {id: 'agenda.form.series_note', defaultMessage: 'Changes apply to every occurrence of this repeating event.'},
});

type Props = {
    eventId?: string;
    teamId?: string;
    channelId?: string;
    day?: number;
    currentUserId: string;
    currentTeamId: string;
};

function initialForm(teamId: string, channelId: string | undefined, day: number | undefined, minutes: number): EventForm {
    const start = day ? new Date(day) : new Date();
    start.setHours(day ? 9 : start.getHours() + 1, 0, 0, 0);
    return {
        title: '',
        description: '',
        location: '',
        visibility: channelId ? 'channel' : 'team',
        teamId,
        channelId,
        allDay: false,
        start,
        end: new Date(start.getTime() + (minutes * 60000)),
    };
}

function withDuration(minutes: number) {
    return (form: EventForm): EventForm => ({...form, end: new Date(form.start.getTime() + (minutes * 60000))});
}

function formFromEvent(event: AgendaEvent): EventForm {
    return {
        title: event.title,
        description: event.description ?? '',
        location: event.location ?? '',
        visibility: event.visibility,
        teamId: event.teamId,
        channelId: event.channelId,
        allDay: Boolean(event.allDay),
        start: dateOfStored(event.startAt, Boolean(event.allDay)),

        // All-day ends are exclusive; the form shows the last day.
        end: event.allDay ? dateOfStored(event.endAt - 1, true) : new Date(event.endAt),
    };
}

const EditEvent = ({eventId, teamId, channelId, day, currentUserId, currentTeamId}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const styles = getFormStyles(theme);
    const [event, setEvent] = useState<AgendaEvent>();
    const [loadError, setLoadError] = useState<unknown>();
    const [form, setForm] = useState<EventForm>(() => initialForm(teamId || currentTeamId, channelId, day, FALLBACK_DURATION_MINUTES));
    const [saving, setSaving] = useState(false);
    const [problem, setProblem] = useState<string>();

    useEffect(() => {
        if (eventId) {
            fetchAgendaEvent(serverUrl, eventId).then((result) => {
                if (result.data) {
                    setEvent(result.data);
                    setForm(formFromEvent(result.data));
                } else {
                    setLoadError(result.error);
                }
            });
            return;
        }

        // New events use the admin-configured default length, like the webapp.
        fetchAgendaConfig(serverUrl).then((result) => {
            const minutes = result.data?.defaultEventDurationMinutes;
            if (minutes && minutes > 0) {
                setForm(withDuration(minutes));
            }
        });
    }, [eventId, serverUrl]);

    const update = useCallback(<K extends keyof EventForm>(key: K) => (value: EventForm[K]) => setForm((f) => ({...f, [key]: value})), []);
    const setters = useMemo(() => ({
        title: update('title'),
        description: update('description'),
        location: update('location'),
        visibility: update('visibility'),
        allDay: update('allDay'),

        // Moving the start keeps the duration, as calendar apps do.
        startDay: (date: Date) => setForm((f) => {
            const start = combineDateAndTime(date, f.start);
            return {...f, start, end: new Date(start.getTime() + (f.end.getTime() - f.start.getTime()))};
        }),
        startTime: (time: Date) => setForm((f) => {
            const start = combineDateAndTime(f.start, time);
            return {...f, start, end: new Date(start.getTime() + (f.end.getTime() - f.start.getTime()))};
        }),
        endDay: (date: Date) => setForm((f) => ({...f, end: combineDateAndTime(date, f.end)})),
        endTime: (time: Date) => setForm((f) => ({...f, end: combineDateAndTime(f.end, time)})),
    }), [update]);

    const save = useCallback(async () => {
        if (!validateTitle(form.title)) {
            setProblem(intl.formatMessage(formMessages.titleRequired));
            return;
        }
        if (!validateEventTimes(form)) {
            setProblem(intl.formatMessage(messages.endBeforeStart));
            return;
        }
        setProblem(undefined);
        const timezone = moment.tz.guess();
        setSaving(true);
        let error: unknown;
        if (event) {
            const patch = buildEventPatch(event, form, timezone);
            if (Object.keys(patch).length) {
                error = (await updateAgendaEvent(serverUrl, event.id, patch)).error;
            }
        } else {
            error = (await createAgendaEvent(serverUrl, buildCreateEvent(form, currentUserId, timezone))).error;
        }
        setSaving(false);
        if (error) {
            Alert.alert(intl.formatMessage(formMessages.saveFailed), agendaErrorMessage(intl, error));
            return;
        }
        emitAgendaChanged();
        navigateBack();
    }, [currentUserId, event, form, intl, serverUrl]);

    if (eventId && !event) {
        return (
            <SafeAreaView
                edges={EDGES}
                style={styles.container}
            >
                <ListState
                    loading={!loadError}
                    error={loadError}
                    onRetry={navigateBack}
                    emptyMessage={{id: 'agenda.event.not_found', defaultMessage: 'Event not found'}}
                />
            </SafeAreaView>
        );
    }

    const visibilityOptions: Array<{value: AgendaVisibility; label: string}> = [
        {value: 'private', label: intl.formatMessage(formMessages.private)},
        {value: 'team', label: intl.formatMessage(formMessages.team)},
        ...(form.channelId ? [{value: 'channel' as const, label: intl.formatMessage(formMessages.channel)}] : []),
    ];

    return (
        <SafeAreaView
            edges={EDGES}
            style={styles.container}
            testID='agenda.edit_event'
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps='handled'
            >
                {Boolean(event?.recurrence) && <FormError text={intl.formatMessage(messages.seriesNote)}/>}
                <Field label={intl.formatMessage(formMessages.title)}>
                    <Input
                        value={form.title}
                        onChangeText={setters.title}
                        maxLength={MAX_TITLE_LENGTH}
                        testID='agenda.edit_event.title'
                    />
                </Field>
                {!event && (
                    <Field label={intl.formatMessage(formMessages.visibility)}>
                        <ChipGroup
                            options={visibilityOptions}
                            value={form.visibility}
                            onChange={setters.visibility}
                            testID='agenda.edit_event.visibility'
                        />
                    </Field>
                )}
                <ToggleRow
                    label={intl.formatMessage(messages.allDay)}
                    value={form.allDay}
                    onValueChange={setters.allDay}
                    testID='agenda.edit_event.all_day'
                />
                <Field label={intl.formatMessage(messages.starts)}>
                    <View style={styles.row}>
                        <DateField
                            value={form.start}
                            mode='date'
                            onChange={setters.startDay}
                            testID='agenda.edit_event.start_date'
                        />
                        {!form.allDay && (
                            <DateField
                                value={form.start}
                                mode='time'
                                onChange={setters.startTime}
                                testID='agenda.edit_event.start_time'
                            />
                        )}
                    </View>
                </Field>
                <Field label={intl.formatMessage(messages.ends)}>
                    <View style={styles.row}>
                        <DateField
                            value={form.end}
                            mode='date'
                            onChange={setters.endDay}
                            testID='agenda.edit_event.end_date'
                        />
                        {!form.allDay && (
                            <DateField
                                value={form.end}
                                mode='time'
                                onChange={setters.endTime}
                                testID='agenda.edit_event.end_time'
                            />
                        )}
                    </View>
                </Field>
                <Field label={intl.formatMessage(messages.location)}>
                    <Input
                        value={form.location}
                        onChangeText={setters.location}
                        testID='agenda.edit_event.location'
                    />
                </Field>
                <Field label={intl.formatMessage(formMessages.description)}>
                    <Input
                        value={form.description}
                        onChangeText={setters.description}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        multiline={true}
                        testID='agenda.edit_event.description'
                    />
                </Field>
                {problem ? <FormError text={problem}/> : null}
                <DetailButton
                    label={intl.formatMessage(formMessages.save)}
                    onPress={save}
                    variant='primary'
                    disabled={saving}
                    testID='agenda.edit_event.save'
                />
                <DetailButton
                    label={intl.formatMessage(taskMessages.cancel)}
                    onPress={navigateBack}
                    testID='agenda.edit_event.cancel'
                />
            </ScrollView>
        </SafeAreaView>
    );
};

export default EditEvent;
