// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDatabase} from '@nozbe/watermelondb/react';
import {useEffect, useState} from 'react';

import {fetchMissingProfilesByIds} from '@actions/remote/user';
import {getAgendaNames, type AgendaNames} from '@agenda/queries';
import {getFullErrorMessage} from '@utils/errors';
import {logDebug} from '@utils/log';

const EMPTY: AgendaNames = {teams: {}, channels: {}, users: {}};

type Record = {teamId: string; channelId?: string; assigneeIds: string[]; creatorId?: string};

// useAgendaNames resolves team, channel and user labels from the server database, fetching
// only user profiles the database does not have yet.
export function useAgendaNames(serverUrl: string, records: Record[]): AgendaNames {
    const database = useDatabase();
    const [names, setNames] = useState<AgendaNames>(EMPTY);

    const teamIds = [...new Set(records.map((r) => r.teamId).filter(Boolean))].sort();
    const channelIds = [...new Set(records.map((r) => r.channelId).filter((id): id is string => Boolean(id)))].sort();
    const userIds = [...new Set(records.flatMap((r) => [...r.assigneeIds, ...(r.creatorId ? [r.creatorId] : [])]))].sort();
    const idsKey = `${teamIds.join(',')}|${channelIds.join(',')}|${userIds.join(',')}`;

    useEffect(() => {
        let cancelled = false;
        const [teams, channels, users] = idsKey.split('|').map((part) => (part ? part.split(',') : []));
        const resolve = async () => {
            const initial = await getAgendaNames(database, teams, channels, users);
            if (cancelled) {
                return;
            }
            setNames(initial);
            const missing = users.filter((id) => !initial.users[id]);
            if (missing.length) {
                await fetchMissingProfilesByIds(serverUrl, missing);
                if (!cancelled) {
                    setNames(await getAgendaNames(database, teams, channels, users));
                }
            }
        };
        resolve().catch((error) => logDebug('error on useAgendaNames', getFullErrorMessage(error)));
        return () => {
            cancelled = true;
        };
    }, [database, idsKey, serverUrl]);

    return names;
}
