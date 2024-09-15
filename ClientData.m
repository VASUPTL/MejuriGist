#import "ClientData.h"

@implementation ClientData

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(readAssetData:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    // Get the file path of the asset "data.json"
    NSString *filePath = [[NSBundle mainBundle] pathForResource:@"ascendCannabis" ofType:@"json"];
    
    if (filePath) {
        // Read the contents of the file
        NSError *error;
        NSString *jsonString = [NSString stringWithContentsOfFile:filePath encoding:NSUTF8StringEncoding error:&error];
        
        if (!error) {
            // Resolve the promise with the JSON content
            resolve(jsonString);
        } else {
            // Reject the promise with the error
            reject(@"read_error", @"Error reading asset file", error);
        }
    } else {
        // Reject the promise if the file path is nil
        reject(@"file_not_found", @"Asset file not found", nil);
    }
}

@end
