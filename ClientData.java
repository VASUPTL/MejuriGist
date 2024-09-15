import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import android.content.res.AssetManager;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

public class ClientData extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public ClientData(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "ClientData";
    }

    // Method to read JSON from the assets folder
    @ReactMethod
    public void readAssetData(Promise promise) {
        try {
            // Get the ReactApplicationContext
            ReactApplicationContext reactContext = getReactApplicationContext();

            // Get the AssetManager
            AssetManager assetManager = reactContext.getAssets();

            // Open the JSON file
            InputStream inputStream = assetManager.open("ClientData.json");

            // Read the contents of the JSON file
            BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(inputStream));
            StringBuilder stringBuilder = new StringBuilder();
            String line;
            while ((line = bufferedReader.readLine()) != null) {
                stringBuilder.append(line);
            }

            // Close the InputStream and BufferedReader
            inputStream.close();
            bufferedReader.close();

            // Resolve the Promise with the JSON content as a String
            promise.resolve(stringBuilder.toString());
        } catch (IOException e) {
            // If an error occurs, reject the Promise with the error message
            promise.reject(e);
        }
    }
}