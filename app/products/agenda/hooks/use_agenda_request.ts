// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef, useState} from 'react';
import {DeviceEventEmitter} from 'react-native';

export const AGENDA_CHANGED_EVENT = 'agenda_changed';

// Tells open Agenda lists to reload after a create/update/delete elsewhere.
export function emitAgendaChanged() {
    DeviceEventEmitter.emit(AGENDA_CHANGED_EVENT);
}

type State<T> = {
    data?: T;
    error?: unknown;
    loading: boolean;
    refreshing: boolean;
};

type Loader<T> = () => Promise<{data?: T; error?: unknown}>;

// useAgendaRequest loads data for a key (server URL + query). A new key clears the previous
// data, so rows from another server or scope are never shown while loading. Responses that
// arrive after a newer request started are dropped: the native network client has no abort.
export function useAgendaRequest<T>(key: string, load: Loader<T>) {
    const [state, setState] = useState<State<T>>({loading: true, refreshing: false});
    const sequence = useRef(0);
    const loadRef = useRef(load);
    loadRef.current = load;

    const run = useCallback(async (mode: 'reset' | 'refresh' | 'silent') => {
        const current = ++sequence.current;
        setState((previous) => {
            if (mode === 'reset') {
                return {loading: true, refreshing: false};
            }
            return {...previous, refreshing: mode === 'refresh', error: undefined};
        });
        const result = await loadRef.current();
        if (current !== sequence.current) {
            return;
        }
        setState((previous) => ({
            data: result.error ? previous.data : result.data,
            error: result.error,
            loading: false,
            refreshing: false,
        }));
    }, []);

    useEffect(() => {
        run('reset');
    }, [key, run]);

    useEffect(() => {
        const listener = DeviceEventEmitter.addListener(AGENDA_CHANGED_EVENT, () => run('silent'));
        return () => listener.remove();
    }, [run]);

    const refresh = useCallback(() => run('refresh'), [run]);

    // setData applies a local change (for example the task returned by a status update).
    const setData = useCallback((updater: (data: T | undefined) => T | undefined) => {
        setState((previous) => ({...previous, data: updater(previous.data)}));
    }, []);

    return {...state, refresh, setData};
}
