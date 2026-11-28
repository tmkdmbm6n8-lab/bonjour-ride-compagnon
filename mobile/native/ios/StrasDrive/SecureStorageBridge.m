#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(StrasDriveEncryptedStorage, NSObject)
RCT_EXTERN_METHOD(read:(NSString *)account key:(NSString *)key resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(write:(NSString *)account key:(NSString *)key value:(NSString *)value resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(purgeAccount:(NSString *)account resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
