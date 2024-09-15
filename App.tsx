import React, { useEffect, useState } from 'react';
import DeviceInfo from 'react-native-device-info';
import Crashlytics from '@react-native-firebase/crashlytics';
import Analytics from '@react-native-firebase/analytics';
import codePush from 'react-native-code-push';
import { ActivityIndicator, Dimensions, NativeModules, View } from 'react-native';
import {
    ThemeProvider,
    MultiProvider,
    I18nProvider,
    AppSettingsProvider,
    api,
    ThemeOverrides,
    CONFIG_URL,
    ClientType
} from '@shared';
import Theme from './../../configs/theme/index';
import ErrorBoundary from './shared/components/ErrorBoundary';
import RootStack from './routes';
import './utils/events';
import { ModalProvider } from './routes/ModalProvider';
import { ImageCacheManager } from './shared/components/Image';

const App = () => {

    const [settings, setSettings] = useState<any>();
    const [languageEdit, setLanguageEdit] = useState<any>();
    const [client, setClient] = useState<ClientType>();
    const [theme, setTheme] = useState<ThemeOverrides>();
    const [language, setLanguage] = useState<any>();
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const NativeModule = NativeModules.ClientData;

    useEffect(() => {

        NativeModule && NativeModule.readAssetData()
            .then((jsonString: any) => {

                const json = JSON.parse(jsonString);
                json.client_name && setClient(json.client_name);

            })
            .catch((error: any) => {

                console.error('Error:', error);
            });

        Analytics().setAnalyticsCollectionEnabled;
        codePush.sync();

    }, []);

    const loadData = async () => {

        try {

            if (client) {
                const BASE_URL = `${CONFIG_URL}/${client.toLowerCase()}`;

                setIsLoading(true);
                const _settings = await fetch(`${BASE_URL}/settings.json`);
                const _theme = await fetch(`${BASE_URL}/colors.json`);
                const _language = await fetch(`${BASE_URL}/language.json`);
                const _languageEdit = await fetch(`${BASE_URL}/languageEdit.json`);

                const themeJson = await _theme.json();
                const settingsJson = await _settings.json();
                const languageJson = await _language.json();
                const languageEditJson = await _languageEdit.json();


                setIsLoading(false);

                setTheme(Theme(themeJson.dark, themeJson.light, themeJson.colors));
                setSettings(settingsJson);
                setLanguageEdit(languageEditJson as any);
                setLanguage(languageJson as any);
            }
        }
        catch (error) {
            console.error('Error loading JSON:', error, client);
        }
    };

    useEffect(() => {

        loadData();
    }, [client]);

    useEffect(() => {

        settings?.merchantOrg && Crashlytics().setAttribute('native-app-name', settings?.merchantOrg);
        api.setStore({
            merchantOrg: settings?.merchantOrg,
            appVersion: DeviceInfo.getReadableVersion(),
            deviceManufacturer: DeviceInfo.getBrand(),
            deviceModel: DeviceInfo.getModel()
        });
    }, [settings]);

    useEffect(() => {
        ImageCacheManager.cleanupExpiredImages();
    }, []);


    const windowHeight = Dimensions.get('window').height;

    if (!settings || !languageEdit || !theme || !language || isLoading) {

        return (<View style={{ height: windowHeight, display: 'flex', justifyContent: 'center' }}>
            <ActivityIndicator size={'large'} />
        </View>);
    }


    return (
        <ErrorBoundary isQaAgent={isQaAgent}>
            <MultiProvider
                providers={[
                    <ThemeProvider themeConfig={theme} />,
                    <I18nProvider language={language} languagesEdit={languageEdit.languageEdit || {}} />,
                    <AppSettingsProvider {...settings} />,
                    <ModalProvider theme={theme} />,
                ]}
            >
                <RootStack />
            </MultiProvider>
        </ErrorBoundary>

    );
};

export default App;
