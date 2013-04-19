'use strict';

module.exports = function(grunt) {
  var azure = require('azure'),
      Q = require('q'),
      util = require('util'),
      path = require('path'),
      zlib = require('zlib'),
      mime = require('mime'),
      fs = require('fs'),
      tmp = require('tmp');


  grunt.registerMultiTask('azureblob', 'Copy html assets to azure blob/cdn storage', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
        serviceOptions: [], // custom arguments to azure.createBlobService
        containerName: null, // container name, required
        containerDelete: false, // deletes container if it exists
        containerOptions: {publicAccessLevel: "blob"}, // container options
        metadata: {cacheControl: 'public, max-age=31556926'}, // file metadata properties
        copySimulation: false,
        destPrefix: '', // detination path prefix to use for blob name e.g. 'v0.0.1/'
        maskBaseDir: '',
        gzip: false // gzip files
      }), 
      blobService = azure.createBlobService(),
      done = this.async(),
      self = this;

    grunt.verbose.writeflags(options,'options');
    //tmp.setGracefulCleanup(); //cleanup the temporary files even when an uncaught exception occurs.

    // execute task
    Q.when(deleteContainer)
      .then(createContainer)
      .then(iterateFiles)
      .then(function(count) {
        grunt.log.write(util.format('blobStorage copy completed (%s) files...',count)).ok();
          done(true); // mark async done completed
        }, function(error) {
         // handle any error from deleteContainer, createContainer or processFiles
         grunt.log.error(util.format('Error processing %s', self.nameArgs));
         grunt.fail.fatal(error);
        })
      .done();

    // Iterate each of the defined files and copy to Blob Storage
    // returns a q promise
    function iterateFiles() {
      var deferred = Q.defer(),
        files = self.filesSrc.filter(fileExists); // filesSrc can include dir's, not just files

        grunt.verbose.writeln(util.format('\tprocess (%s) files',files.length));

        // Iterate over all specified file groups.
        grunt.util.async.forEachSeries(files, copyFile, function(err){
          if (err) {
            deferred.reject(err);
          }
          deferred.resolve(files.length);
        });

      return deferred.promise;
    }   

    // When optioned, delete blob container
    // returns q promise
    function deleteContainer() {
      var deferred = Q.defer();
      if (options.containerDelete) { 
        blobService.deleteContainer(options.containerName, function(err){
          if (err) {
            deferred.reject(err);
          }
          grunt.log.ok();
          deferred.resolve();
        });
      } else {
        deferred.resolve();
      }
      return deferred.promise;
    }

    // Creates Blob container name in options.containerName, if it doesn't already exist
    // returns q promise
    function createContainer() {
      var deferred = Q.defer();
      grunt.verbose.write(util.format('Create blob containter [%s] ...', options.containerName));
      blobService.createContainerIfNotExists(options.containerName, options.containerOptions, function(error){
          if (error) {
            if (error.code === 'ContainerBeingDeleted') {
              grunt.log.writeln(util.format('Blob Container [%s] being deleted, retrying in 10 seconds', options.containerName));
              return setTimeout(function() {
                createContainer();
              }, 10000);
            } else {
              deferred.reject(error);
            }
        }
        grunt.verbose.ok();
        deferred.resolve();
      });

      return deferred.promise;
    } 

    // Iterator called from grunt.util.async.forEachSeries - for each source file in task
    function copyFile(source, callback) {

      var destination = source.replace(options.maskBaseDir,options.destPrefix),  
          meta = options.metadata,
          srcFile = path.basename(source),
          gzip = options.gzip,
          fileExt = path.extname(source),
          fnCopyToBlob;

      // only create gzip copies for css and js files 
      if (fileExt != '.js' && fileExt != '.css') {
          gzip = false;
      }
      // ensure trailing slash is present in destination
      if (destination.length > 0 && destination.substr(-1) != '/') {
        destination += '/';
      }
      // configure proper azure metadata for file
      meta.contentType = meta.contentType || mime.lookup(source);
      meta.contentTypeHeader = meta.contentTypeHeader || mime.lookup(source);
      meta.ContentEncoding = meta.ContentEncoding || gzip ? 'gzip': null;

      grunt.log.write(util.format('\tCopy %s => %s/%s ', srcFile, options.containerName, destination));
      
      if(options.copySimulation){
        grunt.log.ok('sim');
        callback();
        return;
      }

      fnCopyToBlob = gzip ? compressFileToBlobStorage : copyFileToBlobStorage;

      Q.when(fnCopyToBlob(options.containerName, destination, source, meta))
        .then(function(){
            grunt.log.ok();
            callback();
        }).done();
    }

    function compressFileToBlobStorage(containerName, destFileName, sourceFile, metadata) {
      return gzipFile(sourceFile)
              .then(function(tmpFile) {
                return copyFileToBlobStorage(containerName, destFileName, tmpFile, metadata)
                        .finally(function(){fs.unlinkSync(tmpFile);
                }); 
            });
    }

    function copyFileToBlobStorage(containerName, destFileName, sourceFile, metadata) {
      var deferred = Q.defer();
      blobService.createBlockBlobFromFile(containerName, destFileName, sourceFile, metadata, function(err) {
        if (err) {
          grunt.log.error(err);
          deferred.reject(err);
        }
        deferred.resolve();
      });
      return deferred.promise;
    }

    function gzipFile(source, compress){
      var deferred = Q.defer(),
        gzip = zlib.createGzip(),
        fileExt = path.extname(source),
        inp,
        out;
          
      gzip.on('error', function(err) {
        grunt.log.error(err);
        grunt.fail.warn('Gziping failed.');
        def.reject(err);
      });

      tmp.tmpName({ template: 'tmp-XXXXXX' + fileExt }, function(err, tempFile) {
        if (err) def.reject(err);

        inp = fs.createReadStream(source);
        inp.on('close', function() {
          //grunt.log.writeln(util.format('inp stream:close = %s', s));
          //deferred.resolve(tempFile);
        });
        
        out = fs.createWriteStream(tempFile);
        out.on('close', function() {
          //grunt.log.writeln(util.format('out stream:close = %s', tempFile));
          deferred.resolve(tempFile);
        });
        inp.pipe(gzip).pipe(out);
        //inp.pipe(out); // test to just copy file
      });
      return deferred.promise;
    }

    function fileExists (dest) {

      if (fs.statSync(dest).isFile && fs.existsSync(dest) ) {
          return true;
      }
      return false;
    }
    
  });
};
