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

const CAPSULE_HEIGHT = 64;

// Oxide layout: the tabs sit in a floating capsule with the selected tab on a darker pill, and
// Search is a separate round button next to it.
const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    outerContainer: {
        backgroundColor: theme.centerChannelBg,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        height: ViewConstants.BOTTOM_TAB_HEIGHT,
        paddingHorizontal: 16,
    },
    capsule: {
        flex: 1,
        flexDirection: 'row',
        height: CAPSULE_HEIGHT,
        borderRadius: CAPSULE_HEIGHT / 2,
        padding: 4,
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.12),
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.08),
    },
    item: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: (CAPSULE_HEIGHT - 8) / 2,
    },
    itemSelected: {
        backgroundColor: theme.centerChannelBg,
    },
    search: {
        width: CAPSULE_HEIGHT,
        height: CAPSULE_HEIGHT,
        borderRadius: CAPSULE_HEIGHT / 2,
        marginLeft: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.12),
        borderWidth: 1,
        borderColor: changeOpacity(theme.centerChannelColor, 0.08),
    },
    searchSelected: {
        backgroundColor: theme.centerChannelBg,
        borderColor: changeOpacity(theme.centerChannelColor, 0.16),
    },
    pressed: {
        opacity: 0.72,
    },
    label: {
        color: changeOpacity(theme.centerChannelColor, 0.72),
        ...typography('Body', 50, 'SemiBold'),
    },
    labelSelected: {
        color: theme.centerChannelColor,
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

    const renderTab = (route: typeof tabs[number], index: number) => {
        const {options} = descriptors[route.key];
        const isFocused = focusedIndex === index;
        const isSearch = route.name === Screens.SEARCH;

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

        // Route names match screen constants directly
        const Component = TabComponents[route.name];
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
                style={({pressed}) => (isSearch ? [style.search, isFocused && style.searchSelected, pressed && style.pressed] : [style.item, isFocused && style.itemSelected, pressed && style.pressed])}
            >
                {Component ? (
                    <Component
                        isFocused={isFocused}
                        theme={theme}
                    />
                ) : null}
                {!isSearch && (
                    <Text
                        style={[style.label, isFocused && style.labelSelected]}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                )}
            </Pressable>
        );
    };

    const searchIndex = tabs.findIndex((r) => r.name === Screens.SEARCH);

    return (
        <SafeAreaView
            edges={['bottom']}
            style={style.outerContainer}
        >
            <Animated.View style={[style.container, animatedStyle]}>
                <View style={style.capsule}>
                    {tabs.map((route, index) => (index === searchIndex ? null : renderTab(route, index)))}
                </View>
                {searchIndex >= 0 && renderTab(tabs[searchIndex], searchIndex)}
            </Animated.View>
        </SafeAreaView>
    );
}

export default TabBar;
