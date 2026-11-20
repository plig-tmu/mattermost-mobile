// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Screens} from '@constants';
import DatabaseManager from '@database/manager';
import {navigateToScreen} from '@screens/navigation';
import SettingsStore from '@store/settings_store';
import {act, fireEvent, renderWithEverything, waitFor} from '@test/intl-test-helper';
import TestHelper from '@test/test_helper';

import ScopeBar from './scope_bar';

import type {Database} from '@nozbe/watermelondb';

jest.mock('@screens/navigation', () => ({
    navigateToScreen: jest.fn(),
}));

const serverUrl = 'https://agenda.example.com';

describe('ScopeBar', () => {
    let database: Database;
    const teamId = TestHelper.generateId();

    beforeEach(async () => {
        await DatabaseManager.init([serverUrl]);
        const {database: db, operator} = DatabaseManager.getServerDatabaseAndOperator(serverUrl);
        database = db;
        const channels = [
            TestHelper.fakeChannel({id: 'open1', team_id: teamId, type: 'O', display_name: 'Town Square'}),
            TestHelper.fakeChannel({id: 'priv1', team_id: teamId, type: 'P', display_name: 'Secret'}),
            TestHelper.fakeChannel({id: 'dm1', team_id: '', type: 'D', display_name: 'DM'}),
        ];
        await operator.handleChannel({channels, prepareRecordsOnly: false});
        await operator.handleMyChannel({
            channels,
            myChannels: channels.map((c) => TestHelper.fakeMyChannel({channel_id: c.id})),
            prepareRecordsOnly: false,
        });
    });

    afterEach(async () => {
        await DatabaseManager.destroyServerDatabase(serverUrl);
        jest.clearAllMocks();
    });

    it('should switch to the team scope using the current team', () => {
        const onChange = jest.fn();
        const {getByTestId} = renderWithEverything(
            <ScopeBar
                scope={{kind: 'my'}}
                defaultTeamId={teamId}
                onChange={onChange}
            />,
            {database, serverUrl},
        );

        fireEvent.press(getByTestId('agenda.scope.team'));
        expect(onChange).toHaveBeenCalledWith({kind: 'team', teamId});
    });

    it('should pick a channel among the user\'s public and private channels of the team', async () => {
        const onChange = jest.fn();
        const {getByTestId} = renderWithEverything(
            <ScopeBar
                scope={{kind: 'team', teamId}}
                defaultTeamId={teamId}
                onChange={onChange}
            />,
            {database, serverUrl},
        );

        await act(async () => {
            fireEvent.press(getByTestId('agenda.scope.channel'));
        });

        await waitFor(() => expect(navigateToScreen).toHaveBeenCalled());
        const [screen, params] = jest.mocked(navigateToScreen).mock.calls[0];
        expect(screen).toBe(Screens.INTEGRATION_SELECTOR);
        expect((params as {options: Array<{value: string}>}).options.map((o) => o.value)).toEqual(['priv1', 'open1']);

        act(() => {
            SettingsStore.getIntegrationsSelectCallback()?.({text: 'Secret', value: 'priv1'});
        });
        expect(onChange).toHaveBeenCalledWith({kind: 'channel', teamId, channelId: 'priv1'});
    });
});
