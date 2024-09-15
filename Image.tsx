const PREFIX_FOR_IMAGE_METADATA = '@ImageMetadata:';

async function storeImage(key: string, uri: string, expiryDurationInMinutes: number = 43200): Promise<void> {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const base64Data = await new Promise<string>((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = () => resolve(fileReader.result as string);
            fileReader.onerror = reject;
            fileReader.readAsDataURL(blob);
        });

        const chunkSize = 1.5 * 1024 * 1024; // 1.5 MB
        const dataChunks: string[] = [];

        for (let offset = 0; offset < base64Data.length; offset += chunkSize) {
            const chunk = base64Data.slice(offset, offset + chunkSize);
            dataChunks.push(chunk);
        }

        await AsyncStorage.setItem(`${PREFIX_FOR_IMAGE_METADATA}${key}_metadata`, JSON.stringify({
            numberOfChunks: dataChunks.length,
            expirationTime: Date.now() + expiryDurationInMinutes * 60 * 1000
        }));

        for (let index = 0; index < dataChunks.length; index++) {
            await AsyncStorage.setItem(`${PREFIX_FOR_IMAGE_METADATA}${key}_chunk_${index}`, dataChunks[index]);
        }
    } catch (error) {
        console.warn('Error occurred while saving image', error);
    }
}

async function retrieveImage(key: string): Promise<string | null> {
    try {
        const metadata = await AsyncStorage.getItem(`${PREFIX_FOR_IMAGE_METADATA}${key}_metadata`);
        if (!metadata) return null;

        const { numberOfChunks, expirationTime } = JSON.parse(metadata);
        if (Date.now() > expirationTime) {
            await this.deleteImage(key);
            return null;
        }

        let completeBase64Data = '';
        for (let index = 0; index < numberOfChunks; index++) {
            const chunk = await AsyncStorage.getItem(`${PREFIX_FOR_IMAGE_METADATA}${key}_chunk_${index}`);
            if (chunk) {
                completeBase64Data += chunk;
            } else {
                console.warn(`Missing chunk ${index} for image ${key}`);
                return null;
            }
        }

        return completeBase64Data;
    } catch (error) {
        console.warn('Error occurred while retrieving image', error);
        return null;
    }
}

async function deleteImage(key: string): Promise<void> {
    try {
        const metadata = await AsyncStorage.getItem(`${PREFIX_FOR_IMAGE_METADATA}${key}_metadata`);
        if (!metadata) return;

        const { numberOfChunks } = JSON.parse(metadata);

        for (let index = 0; index < numberOfChunks; index++) {
            await AsyncStorage.removeItem(`${PREFIX_FOR_IMAGE_METADATA}${key}_chunk_${index}`);
        }

        await AsyncStorage.removeItem(`${PREFIX_FOR_IMAGE_METADATA}${key}_metadata`);
    } catch (error) {
        console.warn('Error occurred while deleting image', error);
    }
}

/***
 * RemoveAllImages the function is getting called in the App.tsx root file,
 * whenever the app opens. 
 */
async function removeAllImages(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const imageKeys = allKeys.filter(key => key.startsWith(PREFIX_FOR_IMAGE_METADATA));
        await AsyncStorage.multiRemove(imageKeys);
    } catch (error) {
        console.warn('Error occurred while removing all images', error);
    }
}

async function purgeExpiredImages(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const imageKeys = allKeys.filter(key => key.startsWith(PREFIX_FOR_IMAGE_METADATA));

        for (const key of imageKeys) {
            const cleanKey = key.replace(PREFIX_FOR_IMAGE_METADATA, '');
            await this.retrieveImage(cleanKey);
        }
    } catch (error) {
        console.warn('Error occurred while purging expired images', error);
    }
}


export const cacheImageAsync = async (
    uri: string,
    expiryDurationInMinutes: number = 43200
): Promise<string> => {
    if (!uri) {
        throw new Error('URI is required');
    }

    try {
        const cacheKey = uri;
        let cachedUri = await retrieveImage(cacheKey);

        if (!cachedUri) {
            await storeImage(cacheKey, uri, expiryDurationInMinutes);
            cachedUri = await retrieveImage(cacheKey);
        }

        return cachedUri || uri;
    } catch (error) {
        return uri;
    }
};

export const useImageCache = (
    images: ImageSource | ImageSource[],
    expiryDurationInMinutes: number = 10080
) => {
    const [cachedImages, setCachedImages] = useState<ImageSource | ImageSource[]>(images);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const cacheImages = async () => {
            setLoading(true);

            const processImage = async (image: ImageSource): Promise<ImageSource> => {
                if (typeof image === 'number' || !image.uri) {
                    return image;
                }

                try {
                    const uri = await cacheImageAsync(image.uri, expiryDurationInMinutes);
                    return { ...image, uri };
                } catch (error) {
                    return { ...image };
                }
            };

            if (Array.isArray(images)) {
                const updatedImages = await Promise.all(images.map(processImage));
                setCachedImages(updatedImages);
            } else {
                const updatedImage = await processImage(images);
                setCachedImages(updatedImage);
            }

            setLoading(false);
        };

        cacheImages();
    }, [images, expiryDurationInMinutes]);

    return { cachedImages, loading };
};

export interface ImageProps extends IImageProps {
    uri?: string;
    nonClickable?: boolean;
    width?: string;
    height?: string;
    borderRadius?: number;
    disableCache?: boolean;
    cacheExpirationTime?: number;
}

const ImageComponent = ({ uri, cacheExpirationTime, disableCache, ...props }: ImageProps) => {

    const [isImageVisible, setImageVisibility] = useState(false);
    const [isLoading, setLoading] = useState(true);
    const [isAsyncStorageLoading, setAsyncStorageLoading] = useState(true);
    const [hasError, setError] = useState(false);
    const [reloadCounter, setReloadCounter] = useState(0);
    const [localUri, setLocalUri] = useState<string | null>(null);



    useEffect(() => {
        const loadImage = async () => {
            setAsyncStorageLoading(true);
            if (uri && !disableCache) {
                let cachedUri = await cacheImageAsync(uri, cacheExpirationTime);
                setLocalUri(cachedUri);
            } else if (disableCache && uri) {
                setLocalUri(uri);
            }
            setAsyncStorageLoading(false);
        };

        loadImage();
    }, [uri]);

    const handleImageLoad = () => {
        setLoading(false);
        setError(false);
    };

    const handleImageError = () => {
        setLoading(false);
        setError(true);
    };

    const handleReload = () => {
        setLoading(true);
        setError(false);
        setReloadCounter(prevCounter => prevCounter + 1);
    };

    useEffect(() => {
        if (hasError && isImageVisible) {
            handleReload();
        }
    }, [isImageVisible]);

    return (
        <VisibilitySensor onChange={(isVisible) => isVisible && setImageVisibility(isVisible)}>
            <View
                minH={props.minH || props.height} minW={props.width}
                display='flex'
                flexDirection='row'
                justifyContent={'center'}
                alignItems={'center'}
                {...props.containerProps}
            >
                {(isLoading || isAsyncStorageLoading) && (
                    <View
                        position='absolute'
                        top={0}
                        bottom={0}
                        left={0}
                        right={0}
                        justifyContent='center'
                        alignItems='center'
                    >
                        <Loader />
                    </View>
                )}
                {hasError && !(isLoading || isAsyncStorageLoading) ? (
                    <View onTouchEnd={(event) => event.stopPropagation()}>
                        <Text mb={2}>Image load failed.</Text>
                        <Button onPress={handleReload} style={{ alignItems: 'center' }}>
                            <FontAwesomeIcon
                                icon={faRotateRight}
                                color={buttonBackground}
                                size={30}
                            />
                        </Button>
                    </View>
                ) : ((uri || localUri) && isImageVisible && !isAsyncStorageLoading) &&
                <Image
                    alt={props.alt || 'Alt Text'}
                    key={reloadCounter}
                    source={{ uri: localUri || uri }}
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                />
                }
            </View>
        </VisibilitySensor>
    );
};
