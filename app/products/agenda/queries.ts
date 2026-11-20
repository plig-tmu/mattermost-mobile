// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from '@constants';
import {queryChannelsById, queryMyChannelsByTeam} from '@queries/servers/channel';
import {getCurrentUserId, getCurrentTeamId} from '@queries/servers/system';
import {queryMyTeams, queryTeamsById} from '@queries/servers/team';
import {queryUsersById} from '@queries/servers/user';

import type {Database} from '@nozbe/watermelondb';
import type UserModel from '@typings/database/models/servers/user';

// Scope pickers and labels read teams, channels and users from the existing server database;
// Agenda keeps no copy of membership data.

export type NamedOption = {id: string; displayName: string; name: string};

export async function getAgendaTeams(database: Database): Promise<NamedOption[]> {
    const myTeams = await queryMyTeams(database).fetch();
    const teams = await queryTeamsById(database, myTeams.map((t) => t.id)).fetch();
    return teams.
        map((t) => ({id: t.id, displayName: t.displayName, name: t.name})).
        sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// Agenda records only belong to public or private channels (not DMs/GMs).
export async function getAgendaChannels(database: Database, teamId: string): Promise<NamedOption[]> {
    const myChannels = await queryMyChannelsByTeam(database, teamId).fetch();
    const channels = await queryChannelsById(database, myChannels.map((c) => c.id)).fetch();
    return channels.
        filter((c) => c.type === General.OPEN_CHANNEL || c.type === General.PRIVATE_CHANNEL).
        map((c) => ({id: c.id, displayName: c.displayName, name: c.name})).
        sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type AgendaNames = {
    teams: Record<string, NamedOption>;
    channels: Record<string, NamedOption>;
    users: Record<string, UserModel>;
};

export async function getAgendaNames(database: Database, teamIds: string[], channelIds: string[], userIds: string[]): Promise<AgendaNames> {
    const [teams, channels, users] = await Promise.all([
        teamIds.length ? queryTeamsById(database, teamIds).fetch() : [],
        channelIds.length ? queryChannelsById(database, channelIds).fetch() : [],
        userIds.length ? queryUsersById(database, userIds).fetch() : [],
    ]);
    return {
        teams: Object.fromEntries(teams.map((t) => [t.id, {id: t.id, displayName: t.displayName, name: t.name}])),
        channels: Object.fromEntries(channels.map((c) => [c.id, {id: c.id, displayName: c.displayName, name: c.name}])),
        users: Object.fromEntries(users.map((u) => [u.id, u])),
    };
}

export async function getAgendaContext(database: Database) {
    const [currentUserId, currentTeamId] = await Promise.all([getCurrentUserId(database), getCurrentTeamId(database)]);
    return {currentUserId, currentTeamId};
}
