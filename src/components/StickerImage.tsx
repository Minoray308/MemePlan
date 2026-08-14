import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';

interface Props {
  uri: string;
  style?: object;
  contentFit?: 'cover' | 'contain';
  showIndicator?: boolean;
  autoplay?: boolean;
}

/** Image with a lightweight skeleton placeholder while loading. */
export function StickerImage({ uri, style, contentFit = 'cover', showIndicator = false, autoplay = true }: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Image
        key={autoplay ? 'animated' : 'static'}
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit={contentFit}
        autoplay={autoplay}
        transition={150}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        cachePolicy="memory-disk"
      />
      {loading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.skeleton,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showIndicator ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
      )}
    </View>
  );
}
