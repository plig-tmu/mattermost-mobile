// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Screens} from '@constants';
import {bottomSheet, navigateToScreen} from '@screens/navigation';
import {act, fireEvent, renderWithIntlAndTheme} from '@test/intl-test-helper';

import Agenda from './agenda';

import type {AgendaScope} from '@agenda/types';

jest.mock('@screens/navigation', () => ({
    bottomSheet: jest.fn(),
    dismissBottomSheet: jest.fn(() => Promise.resolve()),
    navigateToScreen: jest.fn(),
}));
jest.mock('./calendar_view', () => () => null);
jest.mock('./tasks_view', () => () => null);
jest.mock('./list_view', () => () => null);
jest.mock('@agenda/components/scope_bar', () => {
    const {Pressable: MockPressable} = jest.requireActual('react-native');
    const MockScopeBar = ({onChange}: {onChange: (scope: AgendaScope) => void}) => (
        <MockPressable
            testID='scope.channel'
            onPress={() => onChange({kind: 'channel', teamId: 'team1', channelId: 'channel1'})}
        />
    );
    return MockScopeBar;
});

describe('Agenda', () => {
    it('should create a task in the selected channel from the floating button sheet', async () => {
        const {getByTestId} = renderWithIntlAndTheme(<Agenda currentTeamId='team1'/>);
        fireEvent.press(getByTestId('scope.channel'));
        fireEvent.press(getByTestId('agenda.create'));

        expect(bottomSheet).toHaveBeenCalledTimes(1);
        const renderContent = jest.mocked(bottomSheet).mock.calls[0][0];
        const sheet = renderWithIntlAndTheme(<>{renderContent()}</>);
        await act(async () => {
            fireEvent.press(sheet.getByTestId('agenda.create.task'));
        });
        expect(navigateToScreen).toHaveBeenCalledWith(Screens.AGENDA_EDIT_TASK, {teamId: 'team1', channelId: 'channel1'});
    });
});
