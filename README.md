# grunt-azureblob

A Grunt [task] [1] for copying html assets to azure blob/cdn storage.

# Installation
Install npm package next to your projects gruntfile.js file

        npm install grunt-azureblob

Add this line to your projects gruntfile.js

        grunt.loadNpmTasks('grunt-azureblob');

# Environment Requirment
+ The Azure SDK provides a Node.js package for access to the Azure Table Storage.  By default, this library uses the following environment variables for authentication (set as required as global, user, or with a task).  I've had great success with grunt-env to manage the these settings as a task (sample usage shown below).  _These environment variables must be set to your appropriate values!_
  + AZURE_STORAGE_ACCOUNT
  + AZURE_STORAGE_ACCESS_KEY


## AzureBlob Options and default values
grunt-azureblob is a multi task that implicity iterates over all of the named sub-properties (targets).  In addition to the default properties , task specific properties are also available inside each task function.  Options are essentially globally available (across tasks), but can be overridden / set at each task level as needed.

  
        {
          serviceOptions: [], // custom arguments to azure.createBlobService
          containerName: null, // container name, required
          containerDelete: false, // deletes container if it exists
          containerOptions: {publicAccessLevel: "blob", timeoutIntervalInMs: 10000}, // container
          copySimulation: false, // do everything but physically touch storage blob when true
          metadata: {cacheControl: 'public, max-age=31556926'}, // file metadata properties
          gzip: false, // gzip files
          maxNumberOfConcurrentUploads: 10 // Maximum number of concurrent uploads
        };


## Example gruntfile.js

        module.exports = function(grunt) {
          grunt.initConfig({
            pkg: grunt.file.readJSON('insight-spa.jquery.json'),
            env : {
              options : {
               //Shared Options Hash
              },
              configCDN : {
                AZURE_STORAGE_ACCOUNT : 'azure storage account name to use',
                AZURE_STORAGE_ACCESS_KEY : 'your-ssh-access-key-string would go here'
              }
            },
            'azureblob': {
              options: {
                containerName: 'assets',
                containerDelete: false,
                metadata: {cacheControl: 'public, max-age=31556926'}, // max-age 1 year for all entries
                gzip: true,
                copySimulation: true  // set true: dry-run for what copy would look like in output
              },
              css :{
                files: [{
                  expand: true,
                  cwd: 'web/Content',
                  filter: 'isFile',
                  dest: '<%= pkg.version %>/',
                  src: ['**/*', '!themes/**/*'] // copy all files from Content (exclude themes dir)
                }]
              },
              js :{
                options: {
                  containerDelete: false
                },
                files: [{
                  expand: true,
                  cwd: 'web/scripts',
                  filter: 'isFile',
                  dest: '<%= pkg.version %>/',
                  src: ['vendor*.js']
                }]
              }
            }
          });

          // Load the plugin that provides all the pirate magic
          grunt.loadNpmTasks('grunt-env'); // https://npmjs.org/package/grunt-env
          grunt.loadNpmTasks('grunt-azureblob');
          // Default task(s).
          grunt.registerTask('blob', ['env:configCDN', 'azureblob']);

          grunt.event.on('qunit.spawn', function (url) {
          grunt.log.ok("Running test: " + url);
        });
        grunt.event.on('qunit.moduleStart', function (name) {
          grunt.log.ok("Starting module: " + name);
        });

## Sample console run (from sample/build/gruntfile.js)

        c:\sample>grunt blob

        Running "env:configCDN" (env) task

        Running "azureblob:css" (azureblob) task
        azureblob:css - Create blob container [assets] ...OK
                Copy index.css => assets/0.2.1/index.css >> skip copy ok
                Copy ajax-loader.gif => assets/0.2.1/images/ajax-loader.gif >> skip copy ok
        blobStorage copy completed (2) files...OK

        Running "azureblob:js" (azureblob) task
        azureblob:js - Create blob container [assets] ...OK
                Copy amplify.min.js => assets/0.2.1/amplify.min.js >> skip copy ok
                Copy knockout-2.2.1.js => assets/0.2.1/knockout-2.2.1.js >> skip copy ok
                Copy q.min.js => assets/0.2.1/q.min.js >> skip copy ok
        blobStorage copy completed (3) files...OK

        Done, without errors.


## Release History

* 2013-08-24   v0.1.2  Fix #6 - blob "Content Type" meta not not be correct - issue with passing meta object.
* 2013-07-05   v0.1.1  Includes pull-request from [altano][pull5]): Added maxNumberOfConcurrentUploads, remove maskBaseDir and destPrefix options (simplify files options for each task).  Elminate restriction of gzip'd files to [.js, .css]  
As of v0.1.1 - the file option definition has changed.  Each task definition uses Grunt's standardized file mapping utilities.  Consult Grunt's documentation pages at [gruntjs.com/configuring-tasks#files][files] for additional samples if needed.

### Old syntax sample:
      css: {
            options: {
              destPrefix: '<%= pkg.version %>/'
              maskBaseDir: 'web/Content/'
            },
            src: ['web/Content/**/*','!web/Content/themes/**/*']
          }
### New syntax sample: (standardized & straightforward):
      css: {
            files: [{
              expand: true,
              cwd: 'web/Content',
              dest: '<%= pkg.version %>/',
              src: ['**/*', '!themes/**/*']
            }]
          }
* <-- breaking changes -->
* 2013-07-04   v0.0.5  Fix maskBaseDir and destPrefix default to '', which is falsey which doesn't set the destination
* 2013-07-04   v0.0.4  Fix missing 'tmp' dependancy on install
* 2013-07-04   v0.0.3  Fix deleteContainer bug
* 2013-05-07   v0.0.2  Release to npm
* 2013-04-19   v0.0.1  Initial release

### Optional Ideas (specifically for .net web projects)
* [Sample] [2] for .net web projects (SPA) to use BLOB/CDN based on version in project.json file


#### Mentions
Thanks to litek/grunt-azure-storage for inspiration and my first experience with grunt and azure storage.

[1]: https://npmjs.org/package/grunt-azureblob
[2]: ../../wiki/
[files]: http://gruntjs.com/configuring-tasks#files
[pull5]: https://github.com/jstott/grunt-azureblob/pull/5
