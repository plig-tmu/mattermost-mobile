// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {DeviceEventEmitter, Pressable, Text, View} from 'react-native';
import Animated, {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

import AgendaTabIcon from '@agenda/components/agenda_tab_icon';
import {useAgendaEnabled} from '@agenda/hooks/use_agenda_enabled';
import {Events, Navigation as NavigationConstants, Screens, View as ViewConstants} from '@constants';
import {useServerUrl} from '@context/server';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {typography} from '@utils/typography';

import Account from './account';
import Home from './home';
import Mentions from './mentions';
import SavedMessages from './saved_messages';
import Search from './search';

import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        backgroundColor: theme.centerChannelBg,
        alignContent: 'center',
        flexDirection: 'row',
        height: ViewConstants.BOTTOM_TAB_HEIGHT,
        justifyContent: 'center',
    },
    outerContainer: {
        backgroundColor: theme.centerChannelBg,
        boxShadow: '0px -4px 4px rgba(61, 60, 64, 0.08)',
    },
    item: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.72,
    },
    separator: {
        borderTopColor: changeOpacity(theme.centerChannelColor, 0.08),
        borderTopWidth: 0.5,
    },

    // Slack-style tab: the selected icon sits on a tinted pill with a label underneath.
    pill: {
        width: 56,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillSelected: {
        backgroundColor: changeOpacity(theme.buttonBg, 0.12),
    },
    label: {
        marginTop: 2,
        color: changeOpacity(theme.centerChannelColor, 0.64),
        ...typography('Body', 25, 'SemiBold'),
    },
    labelSelected: {
        color: theme.buttonBg,
    },
}));

const labels = defineMessages({
    [Screens.CHANNEL_LIST]: {id: 'tab_bar.home', defaultMessage: 'Home'},
    [Screens.SEARCH]: {id: 'tab_bar.search', defaultMessage: 'Search'},
    [Screens.MENTIONS]: {id: 'tab_bar.mentions', defaultMessage: 'Activity'},
    [Screens.SAVED_MESSAGES]: {id: 'tab_bar.saved', defaultMessage: 'Saved'},
    [Screens.AGENDA]: {id: 'tab_bar.agenda', defaultMessage: 'Agenda'},
    [Screens.ACCOUNT]: {id: 'tab_bar.account', defaultMessage: 'You'},
});

const TabComponents: Record<string, any> = {
    [Screens.ACCOUNT]: Account,
    [Screens.AGENDA]: AgendaTabIcon,
    [Screens.CHANNEL_LIST]: Home,
    [Screens.MENTIONS]: Mentions,
    [Screens.SAVED_MESSAGES]: SavedMessages,
    [Screens.SEARCH]: Search,
};

function TabBar({state, descriptors, navigation, theme}: BottomTabBarProps & {theme: Theme}) {
    const [visible, setVisible] = useState<boolean|undefined>();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const agendaEnabled = useAgendaEnabled(serverUrl);
    const tabs = useMemo(() => state.routes.filter((route) => route.name !== 'index' && (agendaEnabled || route.name !== Screens.AGENDA)), [state.routes, agendaEnabled]);
    const focusedKey = state.routes[state.index]?.key;
    const focusedIndex = Math.max(0, tabs.findIndex((r) => r.key === focusedKey));
    const style = getStyleSheet(theme);
    const safeareaInsets = useSafeAreaInsets();

    useEffect(() => {
        const event = DeviceEventEmitter.addListener(Events.TAB_BAR_VISIBLE, (show) => {
            setVisible(show);
        });

        return () => event.remove();
    }, []);

    useEffect(() => {
        const listner = DeviceEventEmitter.addListener(NavigationConstants.NAVIGATION_HOME, () => {
            navigation.navigate(Screens.HOME);
        });

        return () => listner.remove();
    });

    useEffect(() => {
        const listner = DeviceEventEmitter.addListener(NavigationConstants.NAVIGATE_TO_TAB, ({screen, params = {}}: {screen: string; params: any}) => {
            const lastTab = state.history[state.history.length - 1];
            // eslint-disable-next-line max-nested-callbacks
            const routeIndex = state.routes.findIndex((r) => r.name === screen);
            const route = state.routes[routeIndex];
            // eslint-disable-next-line max-nested-callbacks
            const lastIndex = state.routes.findIndex((r) => r.key === lastTab.key);
            const direction = lastIndex < routeIndex ? 'right' : 'left';
            const event = navigation.emit({
                type: 'tabPress',
                target: screen,
                canPreventDefault: true,
            });

            if (!event.defaultPrevented) {
                // The `merge: true` option makes sure that the params inside the tab screen are preserved
                navigation.navigate({params: {direction, ...params}, name: route.name, merge: false});
            }
        });

        return () => listner.remove();
    }, [navigation, state]);

    const animatedStyle = useAnimatedStyle(() => {
        if (visible === undefined) {
            return {transform: [{translateY: 0}]};
        }

        const height = visible ? withTiming(0, {duration: 200}) : withTiming(ViewConstants.BOTTOM_TAB_HEIGHT + safeareaInsets.bottom, {duration: 150});
        return {
            transform: [{translateY: height}],
        };
    }, [visible, safeareaInsets.bottom]);

    return (
        <SafeAreaView edges={['bottom']}>
            <Animated.View style={style.outerContainer}>
                <Animated.View style={[style.container, style.separator, animatedStyle]}>
                    {tabs.map((route, index) => {
                        const {options} = descriptors[route.key];

                        const isFocused = focusedIndex === index;

                        const onPress = () => {
                            const lastTab = state.history[state.history.length - 1];
                            const lastIndex = tabs.findIndex((r) => r.key === lastTab.key);
                            const direction = lastIndex < index ? 'right' : 'left';
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });
                            DeviceEventEmitter.emit(NavigationConstants.TAB_PRESSED);
                            if (!isFocused && !event.defaultPrevented) {
                            // The `merge: true` option makes sure that the params inside the tab screen are preserved
                                navigation.navigate({params: {direction}, name: route.name, merge: false});
                            }
                        };

                        const onLongPress = () => {
                            navigation.emit({
                                type: 'tabLongPress',
                                target: route.key,
                            });
                        };

                        const renderOption = () => {
                        // Route names now match screen constants directly
                            const Component = TabComponents[route.name];
                            const props = {isFocused, theme};
                            if (Component) {
                                return <Component {...props}/>;
                            }

                            return null;
                        };

                        const label = route.name in labels ? intl.formatMessage(labels[route.name as keyof typeof labels]) : options.title;

                        return (
                            <Pressable
                                key={route.name}
                                accessibilityRole='button'
                                accessibilityState={isFocused ? {selected: true} : {}}
                                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                                testID={options.tabBarButtonTestID}
                                onPress={onPress}
                                onLongPress={onLongPress}
                                style={({pressed}) => [style.item, pressed && style.pressed]}
                            >
                                <View style={[style.pill, isFocused && style.pillSelected]}>
                                    {renderOption()}
                                </View>
                                <Text
                                    style={[style.label, isFocused && style.labelSelected]}
                                    numberOfLines={1}
                                >
                                    {label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </Animated.View>
            </Animated.View>
        </SafeAreaView>

    );
}

export default TabBar;
