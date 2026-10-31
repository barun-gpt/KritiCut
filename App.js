import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const DEFAULT_URL = 'http://192.168.1.68:8080';

export default function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [webUrl, setWebUrl] = useState(DEFAULT_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const canLoad = useMemo(() => {
    return /^https?:\/\/[^/:\s]+(?::\d+)?(?:\/.*)?$/i.test(url.trim());
  }, [url]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#08090b" />
      <View style={styles.header}>
        <Text style={styles.title}>KritiCut Expo</Text>
        <Text style={styles.subtitle}>Open the current web app on your phone over the same Wi‑Fi.</Text>
      </View>

      <View style={styles.configBox}>
        <Text style={styles.label}>Web app URL</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          style={styles.input}
          placeholder="http://192.168.1.10:8080"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Pressable
          style={[styles.button, !canLoad && styles.buttonDisabled]}
          onPress={() => {
            setLoadError('');
            setWebUrl(url.trim());
            setReloadKey((key) => key + 1);
          }}
          disabled={!canLoad}
        >
          <Text style={styles.buttonText}>Load app</Text>
        </Pressable>
      </View>

      {!canLoad ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>Enter a valid URL like http://YOUR-PC-IP:8080</Text>
        </View>
      ) : (
        <View style={styles.webContainer}>
          <WebView
            key={reloadKey}
            source={{ uri: webUrl }}
            originWhitelist={['*']}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            onLoadStart={() => {
              setIsLoading(true);
              setLoadError('');
            }}
            onLoadEnd={() => setIsLoading(false)}
            onError={(event) => {
              setIsLoading(false);
              const { code, description } = event.nativeEvent;
              setLoadError(
                `Could not load ${webUrl}.\n${description || 'Check the address and network.'} (${code ?? 'network error'})`,
              );
            }}
            onHttpError={(event) => {
              const { statusCode } = event.nativeEvent;
              setLoadError(`The web server responded with HTTP ${statusCode}.`);
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
          {isLoading || loadError ? (
            <View style={styles.loaderOverlay}>
              {loadError ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>KritiCut did not load</Text>
                  <Text style={styles.errorText}>{loadError}</Text>
                  <Text style={styles.errorHint}>
                    Keep the web server running on your computer, use its current Wi-Fi IP, and connect your phone to the same network.
                  </Text>
                  <Pressable
                    style={styles.button}
                    onPress={() => {
                      setLoadError('');
                      setIsLoading(true);
                      setReloadKey((key) => key + 1);
                    }}
                  >
                    <Text style={styles.buttonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <ActivityIndicator size="large" color="#c8ff3d" />
              )}
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08090b',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: '#101318',
    borderBottomWidth: 1,
    borderBottomColor: '#1e242d',
  },
  title: {
    color: '#eef1f5',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9aa5b1',
    fontSize: 13,
    marginTop: 8,
  },
  configBox: {
    padding: 16,
    backgroundColor: '#121821',
    borderBottomWidth: 1,
    borderBottomColor: '#1e242d',
  },
  label: {
    color: '#dfe6ee',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0c1014',
    borderColor: '#2c3440',
    borderWidth: 1,
    borderRadius: 10,
    color: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    marginTop: 12,
    backgroundColor: '#c8ff3d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#0b0d10',
    fontSize: 15,
    fontWeight: '700',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#08090b',
  },
  webView: {
    flex: 1,
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#08090b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    width: '100%',
    maxWidth: 440,
    padding: 18,
    backgroundColor: '#14171c',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#343b45',
  },
  errorTitle: {
    color: '#eef1f5',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  errorText: {
    color: '#ff9aa4',
    fontSize: 14,
    lineHeight: 20,
  },
  errorHint: {
    color: '#aeb7c2',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  noticeBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#08090b',
  },
  noticeText: {
    color: '#eef1f5',
    fontSize: 15,
    textAlign: 'center',
  },
});
