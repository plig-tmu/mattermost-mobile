// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages, type IntlShape} from 'react-intl';

import {isErrorWithStatusCode} from '@utils/errors';

// The plugin answers with {error: "..."} but the core ClientError reads only {message}, so the
// server text is not available here. Map the status codes the plugin documents instead.
const messages = defineMessages({
    unauthorized: {id: 'agenda.error.unauthorized', defaultMessage: 'Your session has expired. Please log in again.'},
    forbidden: {id: 'agenda.error.forbidden', defaultMessage: "You don't have permission to do that."},
    notFound: {id: 'agenda.error.not_found', defaultMessage: 'This item no longer exists or you no longer have access to it.'},
    invalid: {id: 'agenda.error.invalid', defaultMessage: 'The server rejected the request. Check the values and try again.'},
    conflict: {id: 'agenda.error.conflict', defaultMessage: 'The item changed, please try again.'},
    generic: {id: 'agenda.error.generic', defaultMessage: 'Something went wrong. Please try again.'},
});

export function agendaErrorMessage(intl: IntlShape, error: unknown): string {
    const status = isErrorWithStatusCode(error) ? error.status_code : undefined;
    switch (status) {
        case 401:
            return intl.formatMessage(messages.unauthorized);
        case 403:
            return intl.formatMessage(messages.forbidden);
        case 404:
            return intl.formatMessage(messages.notFound);
        case 400:
            return intl.formatMessage(messages.invalid);
        case 409:
            return intl.formatMessage(messages.conflict);
        default:
            return intl.formatMessage(messages.generic);
    }
}
