// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const AGENDA_PLUGIN_ID = 'com.github.3tty0n.mattermost-agenda';

// The server caps per_page at 100. include_recurring returns every series regardless of the
// range, so a list may need more than one page; MAX_PAGES bounds that.
export const AGENDA_PAGE_SIZE = 100;
export const AGENDA_MAX_PAGES = 5;

export const AGENDA = 'agenda';
export const AGENDA_TASK = 'agenda_task';
export const AGENDA_EVENT = 'agenda_event';
export const AGENDA_EDIT_TASK = 'agenda_edit_task';
export const AGENDA_EDIT_EVENT = 'agenda_edit_event';

export const AGENDA_SCREENS = {
    AGENDA,
    AGENDA_TASK,
    AGENDA_EVENT,
    AGENDA_EDIT_TASK,
    AGENDA_EDIT_EVENT,
} as const;
