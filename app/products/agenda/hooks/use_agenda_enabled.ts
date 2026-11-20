// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';

import {fetchIsAgendaEnabled} from '@agenda/actions/remote';
import {AGENDA_PLUGIN_ID} from '@agenda/constants';

export function useAgendaEnabled(serverUrl: string) {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setEnabled(false);
        fetchIsAgendaEnabled(serverUrl, AGENDA_PLUGIN_ID).then((value) => {
            if (!cancelled) {
                setEnabled(value);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [serverUrl]);

    return enabled;
}
