// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Alert, ScrollView, Text, View} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';

import {showPermalink} from '@actions/remote/permalink';
import {deleteAgendaTask, fetchAgendaTask, setAgendaTaskStatus} from '@agenda/actions/remote';
import {DetailButton, DetailRow, getDetailStyles} from '@agenda/components/detail_parts';
import {useAgendaNames} from '@agenda/hooks/use_agenda_names';
import {emitAgendaChanged, useAgendaRequest} from '@agenda/hooks/use_agenda_request';
import {ListState} from '@agenda/screens/agenda/list_state';
import {agendaErrorMessage} from '@agenda/utils/errors';
import {assigneeLabel, formatDue, formatRecurrence, scopeLabel} from '@agenda/utils/format';
import {Screens} from '@constants';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {navigateBack, navigateToScreen} from '@screens/navigation';

import type {Task} from '@agenda/types';

const EDGES: Edge[] = ['bottom', 'left', 'right'];

export const taskMessages = defineMessages({
    statusTodo: {id: 'agenda.task.status.todo', defaultMessage: 'To do'},
    statusInProgress: {id: 'agenda.task.status.in_progress', defaultMessage: 'In progress'},
    statusDone: {id: 'agenda.task.status.done', defaultMessage: 'Done'},
    priority: {id: 'agenda.task.priority', defaultMessage: 'Priority: {priority}'},
    complete: {id: 'agenda.task.complete', defaultMessage: 'Mark complete'},
    reopen: {id: 'agenda.task.reopen', defaultMessage: 'Reopen'},
    openPost: {id: 'agenda.task.open_post', defaultMessage: 'Open post'},
    edit: {id: 'agenda.edit', defaultMessage: 'Edit'},
    delete: {id: 'agenda.delete', defaultMessage: 'Delete'},
    cancel: {id: 'agenda.cancel', defaultMessage: 'Cancel'},
    deleteTitle: {id: 'agenda.task.delete_title', defaultMessage: 'Delete task?'},
    deleteBody: {id: 'agenda.task.delete_body', defaultMessage: 'This task will be deleted for everyone.'},
    failed: {id: 'agenda.task.update_failed', defaultMessage: 'Could not update the task'},
    priorityLow: {id: 'agenda.task.priority.low', defaultMessage: 'Low'},
    priorityNormal: {id: 'agenda.task.priority.normal', defaultMessage: 'Normal'},
    priorityHigh: {id: 'agenda.task.priority.high', defaultMessage: 'High'},
    priorityUrgent: {id: 'agenda.task.priority.urgent', defaultMessage: 'Urgent'},
});

export const STATUS_MESSAGES = {
    todo: taskMessages.statusTodo,
    in_progress: taskMessages.statusInProgress,
    done: taskMessages.statusDone,
};

export const PRIORITY_MESSAGES = {
    low: taskMessages.priorityLow,
    normal: taskMessages.priorityNormal,
    high: taskMessages.priorityHigh,
    urgent: taskMessages.priorityUrgent,
};

type Props = {
    taskId: string;
    currentUserId: string;
    teammateNameDisplay?: string;
};

const TaskDetails = ({taskId, currentUserId, teammateNameDisplay}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const styles = getDetailStyles(theme);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => fetchAgendaTask(serverUrl, taskId), [serverUrl, taskId]);
    const {data: task, loading, error, refresh, setData} = useAgendaRequest<Task>(`${serverUrl}|task|${taskId}`, load);
    const names = useAgendaNames(serverUrl, useMemo(() => (task ? [task] : []), [task]));

    const showError = useCallback((err: unknown) => {
        Alert.alert(intl.formatMessage(taskMessages.failed), agendaErrorMessage(intl, err));
    }, [intl]);

    const toggle = useCallback(async () => {
        if (!task) {
            return;
        }
        setBusy(true);
        const result = await setAgendaTaskStatus(serverUrl, task.id, task.status === 'done' ? 'todo' : 'done');
        setBusy(false);
        if (result.error) {
            showError(result.error);
            return;
        }
        setData(() => result.data);
        emitAgendaChanged();
    }, [serverUrl, setData, showError, task]);

    const openPost = useCallback(() => {
        if (task?.sourcePostId) {
            showPermalink(serverUrl, names.teams[task.teamId]?.name ?? '', task.sourcePostId);
        }
    }, [names.teams, serverUrl, task]);

    const edit = useCallback(() => {
        navigateToScreen(Screens.AGENDA_EDIT_TASK, {taskId});
    }, [taskId]);

    const remove = useCallback(() => {
        Alert.alert(intl.formatMessage(taskMessages.deleteTitle), intl.formatMessage(taskMessages.deleteBody), [
            {text: intl.formatMessage(taskMessages.cancel), style: 'cancel'},
            {
                text: intl.formatMessage(taskMessages.delete),
                style: 'destructive',
                onPress: async () => {
                    const result = await deleteAgendaTask(serverUrl, taskId);
                    if (result.error) {
                        showError(result.error);
                        return;
                    }
                    emitAgendaChanged();
                    navigateBack();
                },
            },
        ]);
    }, [intl, serverUrl, showError, taskId]);

    if (!task) {
        return (
            <SafeAreaView
                edges={EDGES}
                style={styles.container}
            >
                <ListState
                    loading={loading}
                    error={error}
                    onRetry={refresh}
                    emptyMessage={{id: 'agenda.task.not_found', defaultMessage: 'Task not found'}}
                />
            </SafeAreaView>
        );
    }

    const done = task.status === 'done';

    // The server enforces permissions; the UI only hides actions that would be refused.
    const canChangeStatus = task.creatorId === currentUserId || task.assigneeIds.includes(currentUserId);
    const canEdit = task.creatorId === currentUserId;
    const priority = task.priority === 'none' ? undefined : intl.formatMessage(taskMessages.priority, {priority: intl.formatMessage(PRIORITY_MESSAGES[task.priority])});

    return (
        <SafeAreaView
            edges={EDGES}
            style={styles.container}
            testID='agenda.task_details'
        >
            <ScrollView contentContainerStyle={styles.content}>
                <Text
                    style={styles.title}
                    testID='agenda.task_details.title'
                >
                    {task.title}
                </Text>
                <DetailRow
                    icon={done ? 'check-circle' : 'circle-outline'}
                    text={intl.formatMessage(STATUS_MESSAGES[task.status])}
                    testID='agenda.task_details.status'
                />
                <DetailRow
                    icon='clock-outline'
                    text={formatDue(intl, task)}
                />
                <DetailRow
                    icon='refresh'
                    text={formatRecurrence(intl, task.recurrence)}
                />
                <DetailRow
                    icon='alert-circle-outline'
                    text={priority}
                />
                <DetailRow
                    icon='account-outline'
                    text={assigneeLabel(task.assigneeIds, names, intl.locale, teammateNameDisplay)}
                />
                <DetailRow
                    icon='globe'
                    text={scopeLabel(intl, task, names)}
                />
                {Boolean(task.description) && <Text style={styles.description}>{task.description}</Text>}
                <View style={styles.actions}>
                    {canChangeStatus && (
                        <DetailButton
                            label={intl.formatMessage(done ? taskMessages.reopen : taskMessages.complete)}
                            onPress={toggle}
                            variant='primary'
                            disabled={busy}
                            testID='agenda.task_details.toggle'
                        />
                    )}
                    {Boolean(task.sourcePostId) && (
                        <DetailButton
                            label={intl.formatMessage(taskMessages.openPost)}
                            onPress={openPost}
                            testID='agenda.task_details.open_post'
                        />
                    )}
                    {canEdit && (
                        <DetailButton
                            label={intl.formatMessage(taskMessages.edit)}
                            onPress={edit}
                            testID='agenda.task_details.edit'
                        />
                    )}
                    {canEdit && (
                        <DetailButton
                            label={intl.formatMessage(taskMessages.delete)}
                            onPress={remove}
                            variant='danger'
                            testID='agenda.task_details.delete'
                        />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default TaskDetails;
