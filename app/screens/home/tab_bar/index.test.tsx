// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useAgendaEnabled} from '@agenda/hooks/use_agenda_enabled';
import {Preferences, Screens} from '@constants';
import {renderWithIntlAndTheme} from '@test/intl-test-helper';

import TabBar from './index';

import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';

jest.mock('@agenda/hooks/use_agenda_enabled', () => ({useAgendaEnabled: jest.fn()}));
jest.mock('./account', () => () => null);

const names = [Screens.CHANNEL_LIST, Screens.SEARCH, Screens.AGENDA, Screens.ACCOUNT];

function props(index: number) {
    const routes = names.map((name) => ({key: `${name}-key`, name}));
    const descriptors = Object.fromEntries(routes.map((r) => [r.key, {options: {tabBarButtonTestID: `tab.${r.name}`}}]));
    return {
        state: {index, routes, history: [routes[index]]},
        descriptors,
        navigation: {emit: jest.fn(() => ({})), navigate: jest.fn()},
        theme: Preferences.THEMES.denim,
    } as unknown as BottomTabBarProps & {theme: Theme};
}

describe('TabBar', () => {
    it('should hide the Agenda tab unless the plugin is enabled', () => {
        jest.mocked(useAgendaEnabled).mockReturnValue(false);
        const {queryByTestId, rerender} = renderWithIntlAndTheme(<TabBar {...props(3)}/>);
        expect(queryByTestId(`tab.${Screens.AGENDA}`)).toBeNull();
        expect(queryByTestId(`tab.${Screens.ACCOUNT}`)?.props.accessibilityState).toEqual({selected: true});

        jest.mocked(useAgendaEnabled).mockReturnValue(true);
        rerender(<TabBar {...props(2)}/>);
        expect(queryByTestId(`tab.${Screens.AGENDA}`)?.props.accessibilityState).toEqual({selected: true});
    });
});
