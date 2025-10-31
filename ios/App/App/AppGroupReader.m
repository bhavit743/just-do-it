#import <Capacitor/Capacitor.h>

// Log once when the shim is loaded (helps debug registration)
__attribute__((constructor))
static void _agr_shim_loaded(void) {
  NSLog(@"[AppGroupReader.m] shim loaded");
}

CAP_PLUGIN(AppGroupReader, "AppGroupReader",
  CAP_PLUGIN_METHOD(list, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(read, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(remove, CAPPluginReturnPromise);
)
