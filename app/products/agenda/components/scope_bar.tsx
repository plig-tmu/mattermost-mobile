// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDatabase} from '@nozbe/watermelondb/react';
import React, {useCallback, useEffect, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {ScrollView} from 'react-native';

import {getAgendaChannels, getAgendaNames, getAgendaTeams, type NamedOption} from '@agenda/queries';
import {Screens} from '@constants';
import {navigateToScreen} from '@screens/navigation';
import SettingsStore from '@store/settings_store';

import Pill from './pill';

import type {AgendaScope} from '@agenda/types';
import type {Selection} from '@components/autocomplete_selector';

const messages = defineMessages({
    my: {id: 'agenda.scope.my', defaultMessage: 'My'},
    team: {id: 'agenda.scope.team', defaultMessage: 'Team'},
    channel: {id: 'agenda.scope.channel', defaultMessage: 'Channel'},
    selectTeam: {id: 'agenda.scope.select_team', defaultMessage: 'Select a team'},
    selectChannel: {id: 'agenda.scope.select_channel', defaultMessage: 'Select a channel'},
});

const KINDS = ['my', 'team', 'channel'] as const;

const CONTENT_STYLE = {paddingHorizontal: 16, paddingVertical: 8};

// A horizontal ScrollView grows vertically by default; keep it at the pills' height.
const SCROLL_STYLE = {flexGrow: 0};

type Props = {
    scope: AgendaScope;
    defaultTeamId: string;
    onChange: (scope: AgendaScope) => void;
};

function openSelector(title: string, options: NamedOption[], selected: string | undefined, onSelect: (id: string) => void) {
    SettingsStore.setIntegrationsSelectCallback((selection?: Selection) => {
        if (selection && !Array.isArray(selection) && 'value' in selection) {
            onSelect(selection.value);
        }
    });
    navigateToScreen(Screens.INTEGRATION_SELECTOR, {
        title,
        dataSource: '',
        options: options.map((o) => ({text: o.displayName, value: o.id})),
        selected,
        isMultiselect: false,
    });
}

// ScopeBar switches between My, Team and Channel calendars. Teams and channels come from the
// server database through the app's existing selection screen.
const ScopeBar = ({scope, defaultTeamId, onChange}: Props) => {
    const intl = useIntl();
    const database = useDatabase();
    const [label, setLabel] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLabel('');
        if (scope.kind === 'my') {
            return undefined;
        }
        const channelIds = scope.kind === 'channel' ? [scope.channelId] : [];
        getAgendaNames(database, [scope.teamId], channelIds, []).then((names) => {
            if (cancelled) {
                return;
            }
            const team = names.teams[scope.teamId]?.displayName ?? '';
            setLabel(scope.kind === 'channel' ? `~${names.channels[scope.channelId]?.displayName ?? ''}` : team);
        });
        return () => {
            cancelled = true;
        };
    }, [database, scope]);

    const pickChannel = useCallback(async (teamId: string) => {
        const channels = await getAgendaChannels(database, teamId);
        openSelector(intl.formatMessage(messages.selectChannel), channels, scope.kind === 'channel' ? scope.channelId : undefined, (channelId) => {
            onChange({kind: 'channel', teamId, channelId});
        });
    }, [database, intl, onChange, scope]);

    const pickTeam = useCallback(async () => {
        const teams = await getAgendaTeams(database);
        const currentTeam = scope.kind === 'my' ? defaultTeamId : scope.teamId;
        openSelector(intl.formatMessage(messages.selectTeam), teams, currentTeam, (teamId) => {
            if (scope.kind === 'channel') {
                pickChannel(teamId);
                return;
            }
            onChange({kind: 'team', teamId});
        });
    }, [database, defaultTeamId, intl, onChange, pickChannel, scope]);

    // A channel calendar re-picks within its team; switch to Team first to change the team.
    const openPicker = useCallback(() => {
        if (scope.kind === 'channel') {
            pickChannel(scope.teamId);
        } else {
            pickTeam();
        }
    }, [pickChannel, pickTeam, scope]);

    // Tapping the selected Team or Channel pill re-opens its picker.
    const selectKind = useCallback((kind: typeof KINDS[number]) => {
        if (kind === scope.kind) {
            if (kind !== 'my') {
                openPicker();
            }
            return;
        }
        const teamId = scope.kind === 'my' ? defaultTeamId : scope.teamId;
        if (kind === 'my') {
            onChange({kind: 'my'});
        } else if (kind === 'team') {
            onChange({kind: 'team', teamId});
        } else {
            pickChannel(teamId);
        }
    }, [defaultTeamId, onChange, openPicker, pickChannel, scope]);

    return (
        <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            style={SCROLL_STYLE}
            contentContainerStyle={CONTENT_STYLE}
            accessibilityRole='tablist'
            testID='agenda.scope'
        >
            {KINDS.map((kind) => {
                const selected = scope.kind === kind;
                return (
                    <Pill
                        key={kind}
                        value={kind}
                        selected={selected}
                        label={selected && label ? label : intl.formatMessage(messages[kind])}
                        rightIcon={kind === 'my' ? undefined : 'chevron-down'}
                        onPress={selectKind}
                        testID={`agenda.scope.${kind}`}
                    />
                );
            })}
        </ScrollView>
    );
};

export default ScopeBar;
