# grunt-azureblob

Grunt task for copying html assets to azure blob/cdn storage.

Azure SDK uses by default the environment variables AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY.
Custom connection arguments can be set in service.
* I've had great success with grunt-env to manage the these settings as a task

## Options and default values
```javascript
{
  serviceOptions: [], // custom arguments to azure.createBlobService
  containerName: null, // container name, required
  containerDelete: false, // deletes container if it exists
  containerOptions: {publicAccessLevel: "blob"}, // container options
  copySimulation: false,
  destPrefix: '', // prefix to use for blob name e.g. 'v0.0.1/'
  maskBaseDir: '',  // mask off directory portion to map files to root in storage container
  metadata: {cacheControl: 'public, max-age=31556926'}, // file metadata properties
  gzip: false // gzip files
};
```

## Gruntfile example
```javascript
grunt.initConfig({
  'azureblob': {
    options: { // set global value
      destPrefix: 'v0.1.2/'
    },
    assets: options: {
      containerName: 'assets',
      gzip: true,
      maskBaseDir: '../web/assets/' 
    },
    src: '../web/assets/**/*'
  }
});
```
