// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase, withObservables} from '@nozbe/watermelondb/react';

import {observeCurrentTeamId, observeCurrentUserId} from '@queries/servers/system';
import {observeTeammateNameDisplay} from '@queries/servers/user';

import type {WithDatabaseArgs} from '@typings/database/database';
import type {ComponentType} from 'react';

type Injected = {currentUserId: string; currentTeamId: string; teammateNameDisplay: string};

// withAgendaUser injects the current user, team and name display setting from the server DB.
export function withAgendaUser<P extends Partial<Injected>>(Component: ComponentType<P>) {
    const enhanced = withObservables([], ({database}: WithDatabaseArgs) => ({
        currentUserId: observeCurrentUserId(database),
        currentTeamId: observeCurrentTeamId(database),
        teammateNameDisplay: observeTeammateNameDisplay(database),
    }));
    return withDatabase(enhanced(Component as ComponentType<unknown>)) as unknown as ComponentType<Omit<P, keyof Injected>>;
}
