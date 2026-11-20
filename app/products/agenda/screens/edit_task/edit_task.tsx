// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Alert, ScrollView, View} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';

import {createAgendaTask, fetchAgendaTask, updateAgendaTask} from '@agenda/actions/remote';
import {DetailButton} from '@agenda/components/detail_parts';
import {ChipGroup, DateField, Field, FormError, getFormStyles, Input, ToggleRow, combineDateAndTime} from '@agenda/components/form_parts';
import {emitAgendaChanged} from '@agenda/hooks/use_agenda_request';
import {ListState} from '@agenda/screens/agenda/list_state';
import {PRIORITY_MESSAGES, STATUS_MESSAGES, taskMessages} from '@agenda/screens/task_details/task_details';
import {agendaErrorMessage} from '@agenda/utils/errors';
import {buildCreateTask, buildTaskPatch, dateOfStored, MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, validateTitle, type TaskForm} from '@agenda/utils/form';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {navigateBack} from '@screens/navigation';

import type {AgendaVisibility, Task, TaskPriority, TaskStatus} from '@agenda/types';

const EDGES: Edge[] = ['bottom', 'left', 'right'];

export const formMessages = defineMessages({
    title: {id: 'agenda.form.title', defaultMessage: 'Title'},
    description: {id: 'agenda.form.description', defaultMessage: 'Description'},
    visibility: {id: 'agenda.form.visibility', defaultMessage: 'Visible to'},
    private: {id: 'agenda.form.visibility.private', defaultMessage: 'Only me'},
    team: {id: 'agenda.form.visibility.team', defaultMessage: 'Team'},
    channel: {id: 'agenda.form.visibility.channel', defaultMessage: 'Channel'},
    save: {id: 'agenda.form.save', defaultMessage: 'Save'},
    titleRequired: {id: 'agenda.form.title_required', defaultMessage: 'Enter a title (up to 200 characters).'},
    saveFailed: {id: 'agenda.form.save_failed', defaultMessage: 'Could not save'},
    hasDue: {id: 'agenda.form.has_due', defaultMessage: 'Due date'},
    hasTime: {id: 'agenda.form.has_time', defaultMessage: 'Set a time'},
    priority: {id: 'agenda.form.priority', defaultMessage: 'Priority'},
    status: {id: 'agenda.form.status', defaultMessage: 'Status'},
    assignToMe: {id: 'agenda.form.assign_to_me', defaultMessage: 'Assign to me'},
    none: {id: 'agenda.form.priority.none', defaultMessage: 'None'},
});

type Props = {
    taskId?: string;

    // Create defaults: the scope the user was looking at and the selected day.
    teamId?: string;
    channelId?: string;
    day?: number;
    currentUserId: string;
    currentTeamId: string;
};

const PRIORITIES: TaskPriority[] = ['none', 'low', 'normal', 'high', 'urgent'];
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];

function initialForm(teamId: string, channelId: string | undefined, day: number | undefined): TaskForm {
    const dueDate = day ? new Date(day) : new Date();
    dueDate.setHours(9, 0, 0, 0);
    return {
        title: '',
        description: '',
        visibility: channelId ? 'channel' : 'team',
        teamId,
        channelId,
        hasDue: Boolean(day),
        dueDate,
        dueHasTime: false,
        priority: 'none',
        status: 'todo',
        assignToMe: true,
    };
}

function formFromTask(task: Task): TaskForm {
    return {
        title: task.title,
        description: task.description ?? '',
        visibility: task.visibility,
        teamId: task.teamId,
        channelId: task.channelId,
        hasDue: Boolean(task.dueAt),
        dueDate: task.dueAt ? dateOfStored(task.dueAt, !task.dueHasTime) : new Date(),
        dueHasTime: Boolean(task.dueHasTime),
        priority: task.priority,
        status: task.status,
        assignToMe: task.assigneeIds.length > 0,
    };
}

const EditTask = ({taskId, teamId, channelId, day, currentUserId, currentTeamId}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const styles = getFormStyles(theme);
    const [task, setTask] = useState<Task>();
    const [loadError, setLoadError] = useState<unknown>();
    const [form, setForm] = useState<TaskForm>(() => initialForm(teamId || currentTeamId, channelId, day));
    const [saving, setSaving] = useState(false);
    const [invalid, setInvalid] = useState(false);

    useEffect(() => {
        if (!taskId) {
            return;
        }
        fetchAgendaTask(serverUrl, taskId).then((result) => {
            if (result.data) {
                setTask(result.data);
                setForm(formFromTask(result.data));
            } else {
                setLoadError(result.error);
            }
        });
    }, [serverUrl, taskId]);

    const update = useCallback(<K extends keyof TaskForm>(key: K) => (value: TaskForm[K]) => setForm((f) => ({...f, [key]: value})), []);
    const setters = useMemo(() => ({
        title: update('title'),
        description: update('description'),
        visibility: update('visibility'),
        hasDue: update('hasDue'),
        dueHasTime: update('dueHasTime'),
        priority: update('priority'),
        status: update('status'),
        assignToMe: update('assignToMe'),
        dueDay: (date: Date) => setForm((f) => ({...f, dueDate: combineDateAndTime(date, f.dueDate)})),
        dueTime: (time: Date) => setForm((f) => ({...f, dueDate: combineDateAndTime(f.dueDate, time)})),
    }), [update]);

    const save = useCallback(async () => {
        if (!validateTitle(form.title)) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        const timezone = moment.tz.guess();
        setSaving(true);
        let error: unknown;
        if (task) {
            const patch = buildTaskPatch(task, form, timezone);
            if (Object.keys(patch).length) {
                error = (await updateAgendaTask(serverUrl, task.id, patch)).error;
            }
        } else {
            error = (await createAgendaTask(serverUrl, buildCreateTask(form, currentUserId, timezone))).error;
        }
        setSaving(false);
        if (error) {
            Alert.alert(intl.formatMessage(formMessages.saveFailed), agendaErrorMessage(intl, error));
            return;
        }
        emitAgendaChanged();
        navigateBack();
    }, [currentUserId, form, intl, serverUrl, task]);

    if (taskId && !task) {
        return (
            <SafeAreaView
                edges={EDGES}
                style={styles.container}
            >
                <ListState
                    loading={!loadError}
                    error={loadError}
                    onRetry={navigateBack}
                    emptyMessage={{id: 'agenda.task.not_found', defaultMessage: 'Task not found'}}
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
            testID='agenda.edit_task'
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps='handled'
            >
                <Field label={intl.formatMessage(formMessages.title)}>
                    <Input
                        value={form.title}
                        onChangeText={setters.title}
                        maxLength={MAX_TITLE_LENGTH}
                        testID='agenda.edit_task.title'
                    />
                </Field>
                <Field label={intl.formatMessage(formMessages.description)}>
                    <Input
                        value={form.description}
                        onChangeText={setters.description}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        multiline={true}
                        testID='agenda.edit_task.description'
                    />
                </Field>
                {!task && (
                    <Field label={intl.formatMessage(formMessages.visibility)}>
                        <ChipGroup
                            options={visibilityOptions}
                            value={form.visibility}
                            onChange={setters.visibility}
                            testID='agenda.edit_task.visibility'
                        />
                    </Field>
                )}
                {!task && form.visibility !== 'private' && (
                    <ToggleRow
                        label={intl.formatMessage(formMessages.assignToMe)}
                        value={form.assignToMe}
                        onValueChange={setters.assignToMe}
                        testID='agenda.edit_task.assign_to_me'
                    />
                )}
                <ToggleRow
                    label={intl.formatMessage(formMessages.hasDue)}
                    value={form.hasDue}
                    onValueChange={setters.hasDue}
                    testID='agenda.edit_task.has_due'
                />
                {form.hasDue && (
                    <View style={styles.row}>
                        <DateField
                            value={form.dueDate}
                            mode='date'
                            onChange={setters.dueDay}
                            testID='agenda.edit_task.due_date'
                        />
                        {form.dueHasTime && (
                            <DateField
                                value={form.dueDate}
                                mode='time'
                                onChange={setters.dueTime}
                                testID='agenda.edit_task.due_time'
                            />
                        )}
                    </View>
                )}
                {form.hasDue && (
                    <ToggleRow
                        label={intl.formatMessage(formMessages.hasTime)}
                        value={form.dueHasTime}
                        onValueChange={setters.dueHasTime}
                        testID='agenda.edit_task.has_time'
                    />
                )}
                <Field label={intl.formatMessage(formMessages.priority)}>
                    <ChipGroup
                        options={PRIORITIES.map((p) => ({value: p, label: intl.formatMessage(p === 'none' ? formMessages.none : PRIORITY_MESSAGES[p])}))}
                        value={form.priority}
                        onChange={setters.priority}
                        testID='agenda.edit_task.priority'
                    />
                </Field>
                {Boolean(task) && (
                    <Field label={intl.formatMessage(formMessages.status)}>
                        <ChipGroup
                            options={STATUSES.map((s) => ({value: s, label: intl.formatMessage(STATUS_MESSAGES[s])}))}
                            value={form.status}
                            onChange={setters.status}
                            testID='agenda.edit_task.status'
                        />
                    </Field>
                )}
                {invalid && (
                    <FormError text={intl.formatMessage(formMessages.titleRequired)}/>
                )}
                <DetailButton
                    label={intl.formatMessage(formMessages.save)}
                    onPress={save}
                    variant='primary'
                    disabled={saving}
                    testID='agenda.edit_task.save'
                />
                <DetailButton
                    label={intl.formatMessage(taskMessages.cancel)}
                    onPress={navigateBack}
                    testID='agenda.edit_task.cancel'
                />
            </ScrollView>
        </SafeAreaView>
    );
};

export default EditTask;
