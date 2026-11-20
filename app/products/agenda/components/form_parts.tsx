// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import DateTimePicker, {type DateTimePickerEvent} from '@react-native-community/datetimepicker';
import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {Platform, Pressable, Switch, Text, TextInput, View} from 'react-native';

import {useTheme} from '@context/theme';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

export const getFormStyles = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.centerChannelBg,
    },
    content: {
        padding: 16,
        gap: 16,
    },
    label: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
        marginBottom: 6,
        ...typography('Body', 75, 'SemiBold'),
    },
    input: {
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.16),
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: theme.centerChannelColor,
        ...typography('Body', 200),
    },
    multiline: {
        minHeight: 96,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowText: {
        color: theme.centerChannelColor,
        ...typography('Body', 200),
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.16),
    },
    chipSelected: {
        backgroundColor: changeOpacity(theme.buttonBg, 0.08),
        borderColor: theme.buttonBg,
    },
    chipText: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
        ...typography('Body', 100, 'SemiBold'),
    },
    chipTextSelected: {
        color: theme.buttonBg,
    },
    dateButton: {
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.08),
    },
    error: {
        color: theme.errorTextColor,
        ...typography('Body', 100),
    },
    pressed: {
        opacity: 0.72,
    },
}));

export const Field = ({label, children}: {label: string; children: React.ReactNode}) => {
    const theme = useTheme();
    const styles = getFormStyles(theme);
    return (
        <View>
            <Text style={styles.label}>{label}</Text>
            {children}
        </View>
    );
};

type InputProps = {
    value: string;
    onChangeText: (value: string) => void;
    multiline?: boolean;
    maxLength?: number;
    testID?: string;
};

export const Input = ({value, onChangeText, multiline, maxLength, testID}: InputProps) => {
    const theme = useTheme();
    const styles = getFormStyles(theme);
    return (
        <TextInput
            value={value}
            onChangeText={onChangeText}
            multiline={multiline}
            maxLength={maxLength}
            style={[styles.input, multiline && styles.multiline]}
            placeholderTextColor={changeOpacity(theme.centerChannelColor, 0.48)}
            testID={testID}
        />
    );
};

export const ToggleRow = ({label, value, onValueChange, testID}: {label: string; value: boolean; onValueChange: (value: boolean) => void; testID?: string}) => {
    const theme = useTheme();
    const styles = getFormStyles(theme);
    return (
        <View style={styles.row}>
            <Text style={styles.rowText}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{true: theme.buttonBg, false: changeOpacity(theme.centerChannelColor, 0.16)}}
                testID={testID}
            />
        </View>
    );
};

type ChipOption<T extends string> = {value: T; label: string};

export function ChipGroup<T extends string>({options, value, onChange, testID}: {options: Array<ChipOption<T>>; value: T; onChange: (value: T) => void; testID?: string}) {
    const theme = useTheme();
    const styles = getFormStyles(theme);
    return (
        <View style={styles.chips}>
            {options.map((option) => (
                <Chip
                    key={option.value}
                    option={option}
                    selected={option.value === value}
                    onChange={onChange}
                    testID={`${testID}.${option.value}`}
                />
            ))}
        </View>
    );
}

function Chip<T extends string>({option, selected, onChange, testID}: {option: ChipOption<T>; selected: boolean; onChange: (value: T) => void; testID: string}) {
    const theme = useTheme();
    const styles = getFormStyles(theme);
    const handlePress = useCallback(() => onChange(option.value), [onChange, option.value]);
    return (
        <Pressable
            onPress={handlePress}
            style={({pressed}) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            accessibilityState={{selected}}
            testID={testID}
        >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
        </Pressable>
    );
}

type DateFieldProps = {
    value: Date;
    mode: 'date' | 'time';
    onChange: (value: Date) => void;
    testID?: string;
};

// DateField shows the platform picker: inline compact on iOS, a dialog behind a button on Android.
export const DateField = ({value, mode, onChange, testID}: DateFieldProps) => {
    const theme = useTheme();
    const intl = useIntl();
    const styles = getFormStyles(theme);
    const [open, setOpen] = useState(false);

    const handleChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
        setOpen(false);
        if (event.type === 'set' && date) {
            onChange(date);
        }
    }, [onChange]);
    const show = useCallback(() => setOpen(true), []);

    if (Platform.OS === 'ios') {
        return (
            <DateTimePicker
                value={value}
                mode={mode}
                display='compact'
                onChange={handleChange}
                accentColor={theme.buttonBg}
                testID={testID}
            />
        );
    }

    return (
        <>
            <Pressable
                onPress={show}
                style={({pressed}) => [styles.dateButton, pressed && styles.pressed]}
                testID={testID}
            >
                <Text style={styles.rowText}>
                    {mode === 'date' ? intl.formatDate(value, {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'}) : intl.formatTime(value, {hour: 'numeric', minute: '2-digit'})}
                </Text>
            </Pressable>
            {open && (
                <DateTimePicker
                    value={value}
                    mode={mode}
                    onChange={handleChange}
                />
            )}
        </>
    );
};

export const FormError = ({text}: {text: string}) => {
    const theme = useTheme();
    const styles = getFormStyles(theme);
    return (
        <Text
            style={styles.error}
            testID='agenda.form.error'
        >
            {text}
        </Text>
    );
};

// combineDateAndTime takes the calendar day of `date` and the clock time of `time`.
export function combineDateAndTime(date: Date, time: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
}
