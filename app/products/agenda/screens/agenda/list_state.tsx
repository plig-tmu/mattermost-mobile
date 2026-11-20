// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl, type MessageDescriptor} from 'react-intl';
import {Alert, Pressable, Text, View} from 'react-native';

import {agendaErrorMessage} from '@agenda/utils/errors';
import FormattedText from '@components/formatted_text';
import Loading from '@components/loading';
import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import type {TaskSummary} from '@agenda/types';

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
    },
    text: {
        color: changeOpacity(theme.centerChannelColor, 0.64),
        textAlign: 'center',
        ...typography('Body', 100),
    },
    error: {
        color: theme.errorTextColor,
        textAlign: 'center',
        ...typography('Body', 100),
    },
    retry: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 4,
        backgroundColor: changeOpacity(theme.buttonBg, 0.08),
    },
    retryText: {
        color: theme.buttonBg,
        ...typography('Body', 100, 'SemiBold'),
    },
    pressed: {
        opacity: 0.72,
    },
}));

type Props = {
    loading: boolean;
    error?: unknown;
    onRetry: () => void;
    emptyMessage: MessageDescriptor & {id: string; defaultMessage: string};
};

// ListState is the empty component of Agenda lists: loading, error with retry, or empty.
export const ListState = ({loading, error, onRetry, emptyMessage}: Props) => {
    const theme = useTheme();
    const intl = useIntl();
    const styles = getStyleSheet(theme);

    if (loading) {
        return (
            <View
                style={styles.container}
                testID='agenda.list.loading'
            >
                <Loading/>
            </View>
        );
    }
    if (error) {
        return (
            <View
                style={styles.container}
                testID='agenda.list.error'
            >
                <Text style={styles.error}>{agendaErrorMessage(intl, error)}</Text>
                <Pressable
                    onPress={onRetry}
                    style={({pressed}) => [styles.retry, pressed && styles.pressed]}
                    testID='agenda.list.retry'
                >
                    <FormattedText
                        id='agenda.list.retry'
                        defaultMessage='Try again'
                        style={styles.retryText}
                    />
                </Pressable>
            </View>
        );
    }
    return (
        <View
            style={styles.container}
            testID='agenda.list.empty'
        >
            <FormattedText
                {...emptyMessage}
                style={styles.text}
            />
        </View>
    );
};

// useToggleTask wraps a status toggle with an error alert.
export function useToggleTask(toggle: (task: TaskSummary) => Promise<{error?: unknown}>) {
    const intl = useIntl();
    return useCallback(async (task: TaskSummary) => {
        const result = await toggle(task);
        if (result.error) {
            Alert.alert(
                intl.formatMessage({id: 'agenda.task.update_failed', defaultMessage: 'Could not update the task'}),
                agendaErrorMessage(intl, result.error),
            );
        }
    }, [intl, toggle]);
}
