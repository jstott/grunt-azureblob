# grunt-azureblob

Grunt task for copying html assets to azure blob/cdn storage.

# Installation
Install npm package next to your projects gruntfile.js file
```
npm install grunt-azureblob
```
Add this line to your projects gruntfile.js
```
grunt.loadNpmTasks('grunt-azureblob');
```
# Environment Requirment
+ Azure SDK provides Node.js package for access to Azure Table Storage.  By default, this library uses the following environment variables for authentication (set as required as global, user, or with a task).  I've had great success with grunt-env to manage the these settings as a task (sample usage shown below).  _These environment variables must be set to your appropriate values!_
  + AZURE_STORAGE_ACCOUNT 
  + AZURE_STORAGE_ACCESS_KEY   


## AzureBlob Options and default values
grunt-azureblob is a multi task that implicity iterates over all of its name sub-properties (targets).  In addition to the default properties , task specific properties are also available inside each task function.  Options are essentially available globaly (across tasks), but can be overridden / set at each task level as needed.

````javascript
{
  serviceOptions: [], // custom arguments to azure.createBlobService
  containerName: null, // container name, required
  containerDelete: false, // deletes container if it exists
  containerOptions: {publicAccessLevel: "blob", timeoutIntervalInMs: 10000}, // container options
  copySimulation: false, // do everything but physically touch storage blob when true
  destPrefix: '', // prefix to use for blob name e.g. 'v0.0.1/'
  maskBaseDir: '',  // mask off directory portion to map files to root in storage container
  metadata: {cacheControl: 'public, max-age=31556926'}, // file metadata properties
  gzip: false // gzip files (when true: only js / css will be gzip'd)
};
````

## Example gruntfile.js 
```javascript
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
        copySimulation: true,  // set true: only dry-run what copy would look like
        destPrefix: '<%= pkg.version %>/'
      },
      css :{
        options: {
          maskBaseDir: '../web/Content/'  // strip off this prefix from files
        },
        src: ['../web/Content/**/*','!../web/Content/themes/**/*'] // copy all files from Content (exclude theams dir)
      },
      js :{
        options: {
          containerDelete: false,
          maskBaseDir: '../web/scripts/'
        },
        src: ['../web/scripts/vendor*.js']
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
```
## Sample Run (from Sample/build/gruntfile.js)
```console
c:/sample>grunt blob  

Running "env:configCDN" (env) task

Running "azureblob:css" (azureblob) task
azureblob:css - Create blob containter [assets] ...OK
        Copy index.css => assets/0.2.1/index.css >> skip copy ok
        Copy jquery.ui.all.css => assets/0.2.1/themes/jquery.ui.all.css >> skip copy ok
blobStorage copy completed (2) files...OK

Running "azureblob:js" (azureblob) task
azureblob:js - Create blob containter [assets] ...OK
        Copy amplify.min.js => assets/0.2.1/amplify.min.js >> skip copy ok
        Copy knockout-2.2.1.js => assets/0.2.1/knockout-2.2.1.js >> skip copy ok
        Copy q.min.js => assets/0.2.1/q.min.js >> skip copy ok
blobStorage copy completed (3) files...OK

Done, without errors.
```
## Release History
* 2013-04-19   v0.0.1  Initial release
* 2013-05-07   v0.0.2  Release to npm


### Optional Ideas (specifically for .net web projects)
Currently working on a HtmlHelperExtension class for simple read of the project.json file to extract the version number, and supply Razor syntax helper for CDN/BLOB storage url (and/or local url for debug).
```c#
<link href="//netdna.bootstrapcdn.com/font-awesome/3.0.2/css/font-awesome.css" rel="stylesheet" />
    
@Html.CdnLinkTag("player.all.css")

<script src="//cdnjs.cloudflare.com/ajax/libs/modernizr/2.6.2/modernizr.min.js"></script>
````
The HtmlHelperExtension starting off as:
```c#
namespace System.Web.Mvc
{
  public static class HtmlHelperExtension
  {
    const string cdnAssetUrl = "//xxx.vo.msecnd.net/assets/";
    private const string verFile = "~/content/project.json"; // contains the version / build info for project
    static string ver = "";
    const bool forceLocal = false;
    public static string Version
    {
      get
      {
        if (string.IsNullOrEmpty(ver))
        {
          string filePath = HttpContext.Current.Server.MapPath(verFile);
          if (File.Exists(filePath))
          {
            ProjectJson spa = JsonConvert.DeserializeObject<ProjectJson>(File.ReadAllText(filePath));
            ver = spa.version;
          }
          else
          {
            ver = "0.1.8"; // fallback
          }
        }
        return ver;
      }
    }
    public static HtmlString CdnStyleUrl(this HtmlHelper helper)
    {
      string url = string.Concat(cdnAssetUrl, Version, "/");;

      if (helper.ViewContext.HttpContext.IsDebuggingEnabled || forceLocal)
        url = "/content/";
      return MvcHtmlString.Create(url);
    }
    public static HtmlString CdnLinkTag(this HtmlHelper helper, string target)
    {
      var minCss = target.Replace(".css", ".min.css");
      var link = new TagBuilder("link");
      link.Attributes["rel"] = "stylesheet";

      if (helper.ViewContext.HttpContext.IsDebuggingEnabled || forceLocal)
        link.Attributes["href"] = string.Concat("/content/", target);
      else
        link.Attributes["href"] = string.Concat(cdnAssetUrl, Version, "/", minCss);

      return MvcHtmlString.Create(link.ToString(TagRenderMode.SelfClosing));
    }
    ...
```


#### Mentions
Thanks to litek/grunt-azure-storage for insiration and my first experience with grunt and azure storage.