// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDatabase} from '@nozbe/watermelondb/react';
import React, {useCallback, useEffect, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Pressable, Text, View} from 'react-native';

import {getAgendaChannels, getAgendaNames, getAgendaTeams, type NamedOption} from '@agenda/queries';
import CompassIcon from '@components/compass_icon';
import {Screens} from '@constants';
import {useTheme} from '@context/theme';
import {navigateToScreen} from '@screens/navigation';
import SettingsStore from '@store/settings_store';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

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

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    segments: {
        flexDirection: 'row',
        borderRadius: 4,
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.08),
        padding: 2,
    },
    segment: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: 4,
    },
    segmentSelected: {
        backgroundColor: theme.centerChannelBg,
    },
    segmentText: {
        color: changeOpacity(theme.centerChannelColor, 0.64),
        ...typography('Body', 100, 'SemiBold'),
    },
    segmentTextSelected: {
        color: theme.centerChannelColor,
    },
    picker: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    pickerText: {
        flex: 1,
        color: theme.buttonBg,
        ...typography('Body', 100, 'SemiBold'),
    },
    pickerIcon: {
        color: theme.buttonBg,
        fontSize: 18,
    },
    pressed: {
        opacity: 0.72,
    },
}));

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
    const theme = useTheme();
    const intl = useIntl();
    const database = useDatabase();
    const styles = getStyleSheet(theme);
    const [label, setLabel] = useState('');

    useEffect(() => {
        let cancelled = false;
        if (scope.kind === 'my') {
            setLabel('');
            return undefined;
        }
        const channelIds = scope.kind === 'channel' ? [scope.channelId] : [];
        getAgendaNames(database, [scope.teamId], channelIds, []).then((names) => {
            if (cancelled) {
                return;
            }
            const team = names.teams[scope.teamId]?.displayName ?? '';
            setLabel(scope.kind === 'channel' ? `${team} / ~${names.channels[scope.channelId]?.displayName ?? ''}` : team);
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

    const selectKind = useCallback((kind: typeof KINDS[number]) => {
        if (kind === scope.kind) {
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
    }, [defaultTeamId, onChange, pickChannel, scope]);

    return (
        <View style={styles.container}>
            <View
                style={styles.segments}
                accessibilityRole='tablist'
            >
                {KINDS.map((kind) => (
                    <Segment
                        key={kind}
                        kind={kind}
                        selected={scope.kind === kind}
                        label={intl.formatMessage(messages[kind])}
                        onSelect={selectKind}
                    />
                ))}
            </View>
            {scope.kind !== 'my' && (
                <Pressable
                    onPress={openPicker}
                    style={({pressed}) => [styles.picker, pressed && styles.pressed]}
                    testID='agenda.scope.picker'
                >
                    <Text
                        style={styles.pickerText}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                    <CompassIcon
                        name='chevron-down'
                        style={styles.pickerIcon}
                    />
                </Pressable>
            )}
        </View>
    );
};

type SegmentProps = {
    kind: typeof KINDS[number];
    selected: boolean;
    label: string;
    onSelect: (kind: typeof KINDS[number]) => void;
};

const Segment = ({kind, selected, label, onSelect}: SegmentProps) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);
    const handlePress = useCallback(() => onSelect(kind), [kind, onSelect]);
    return (
        <Pressable
            onPress={handlePress}
            style={({pressed}) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}
            testID={`agenda.scope.${kind}`}
            accessibilityRole='tab'
            accessibilityState={{selected}}
        >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
        </Pressable>
    );
};

export default ScopeBar;
