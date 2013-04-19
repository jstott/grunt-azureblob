# grunt-azureblob

Grunt task for copying html assets to azure blob/cdn storage.

Azure SDK uses by default the environment variables AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY.
Custom connection arguments can be set in service.

## Options and default values
```javascript
{
  serviceOptions: [], // custom arguments to azure.createBlobService
  containerName: null, // container name, required
  containerDelete: false, // deletes container if it exists
  containerOptions: {publicAccessLevel: "blob"}, // container options
  copySimulation: false,
  folderPrefix: '', // prefix to use for blob name e.g. '0.0.1'
  maskBaseDir: '',  // mask off directory portion to map files to root in storage container
  metadata: {cacheControl: 'public, max-age=31556926'}, // file metadata properties
  gzip: false // gzip files
};
```

## Gruntfile example
```javascript
grunt.initConfig({
  'azureblob': {
    options: { // override default values at each target level
      folderPrefix: 'v0.1.2/'
    },
    assets: options: {
      containerName: 'assets',
      gzip: true,
      maskBaseDir: '../cdn/' 
    },
    src: 'assets/**/*'
  }
});
```
