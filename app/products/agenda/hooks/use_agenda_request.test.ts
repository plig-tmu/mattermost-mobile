// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook, waitFor} from '@testing-library/react-native';

import {emitAgendaChanged, useAgendaRequest} from './use_agenda_request';

type Deferred = {promise: Promise<{data?: string}>; resolve: (value: {data?: string}) => void};

function deferred(): Deferred {
    let resolve!: Deferred['resolve'];
    const promise = new Promise<{data?: string}>((r) => {
        resolve = r;
    });
    return {promise, resolve};
}

describe('useAgendaRequest', () => {
    it('should clear data on a new key and drop a response from the previous key', async () => {
        const first = deferred();
        const second = deferred();
        const load = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        const {result, rerender} = renderHook(({key}) => useAgendaRequest<string>(key, load), {initialProps: {key: 'server-a|my'}});
        expect(result.current.loading).toBe(true);

        // Switching server: the old request is still in flight.
        rerender({key: 'server-b|my'});
        await act(async () => {
            second.resolve({data: 'server-b rows'});
        });
        expect(result.current.data).toBe('server-b rows');

        // The stale response from server A arrives late and must be ignored.
        await act(async () => {
            first.resolve({data: 'server-a rows'});
        });
        expect(result.current.data).toBe('server-b rows');
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('should keep the previous data and expose the error when a reload fails', async () => {
        const load = jest.fn().
            mockResolvedValueOnce({data: 'rows'}).
            mockResolvedValueOnce({error: {status_code: 403}});
        const {result} = renderHook(() => useAgendaRequest<string>('key', load));
        await waitFor(() => expect(result.current.data).toBe('rows'));

        await act(async () => {
            emitAgendaChanged();
        });
        expect(result.current.error).toEqual({status_code: 403});
        expect(result.current.data).toBe('rows');
    });
});
