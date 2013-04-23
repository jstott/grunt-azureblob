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
        containerOptions: {publicAccessLevel: "blob", timeoutIntervalInMs: 10000}, // container options
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
    Q.fcall(deleteContainer)
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
     
      if (!options.containerDelete) {
        return true;
      } 
      grunt.log.write(util.format('%s - deleting container [%s] ...', self.nameArgs, options.containerName));
      blobService.deleteContainer(options.containerName, {timeoutIntervalInMs:25000}, function(err){
        /* // ignore errors for now - just move on 
        if (err) {
          grunt.log.writeln(err);
          deferred.reject(err);
        }
        */
        grunt.log.ok();
        deferred.resolve();
      });
      return deferred.promise;
    }

    // Creates Blob container name in options.containerName, if it doesn't already exist
    // returns q promise
    function createContainer() {
      var deferred = Q.defer(),
          completed = false,
          count = 0,
          waitMs = 100,
          maxTry = 10;

      options.containerOptions.timeoutIntervalInMs = options.containerOptions.timeoutIntervalInMs || 15000; // 10sec
      grunt.log.write(util.format('%s - Create blob containter [%s] ...', self.nameArgs, options.containerName));
      
      grunt.util.async.whilst(continueAttempts, tryCreate, tryCallback);
      
      return deferred.promise;

      function continueAttempts() {
        return  ((count < maxTry) && !completed); // sync truth test before each execution of fn
      }
      function tryCreate(callback) {
        count++;
        setTimeout(function() {
              grunt.log.write('.');
              blobService.createContainerIfNotExists(options.containerName, options.containerOptions, function(error){
                  if (error) {
                    if (error.code !== 'ContainerBeingDeleted') {
                      callback(error); // error - abort
                    } else {
                      callback();
                    }
                  } else {
                    completed = true;
                    callback(); // success
                  }
              });
            },waitMs);
         waitMs = 10000; // up the wait-time after the initial attempt
      }
      function tryCallback(err){
        if (completed) {
            grunt.log.ok();
            deferred.resolve();
          } else {
            grunt.log.writeln('createContainer not completed - deferred.rejected');
            grunt.log.error(err);
            deferred.reject(err);
          }
      }
    } 

    // Iterator called from grunt.util.async.forEachSeries - for each source file in task
    function copyFile(source, callback) {

      var destination,  
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
      if (options.maskBaseDir) {
        destination = source.replace(options.maskBaseDir,'');
      }
      if (options.destPrefix && options.destPrefix.length > 0 && options.destPrefix.substr(-1) != '/') {
        options.destPrefix += '/';
      }
      if (options.destPrefix) {
        destination = options.destPrefix + destination;
      }

      // configure proper azure metadata for file
      meta.contentType = mime.lookup(source);
      meta.contentTypeHeader =  mime.lookup(source);
      meta.contentEncoding =  gzip ? 'gzip': null;

      grunt.log.write(util.format('\tCopy %s => %s/%s ', srcFile, options.containerName, destination));

      if(options.copySimulation){
          grunt.log.ok('sim');
          callback();
          return;
      }

      fnCopyToBlob = gzip ? compressFileToBlobStorage : copyFileToBlobStorage; // use correct fn to pre-compress

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
                        .finally(function(){
                          fs.unlinkSync(tmpFile);
                          }); 
            });
    }

    function copyFileToBlobStorage(containerName, destFileName, sourceFile, metadata) {
      var deferred = Q.defer();
      blobService.createBlockBlobFromFile(containerName, destFileName, sourceFile, metadata, function(err) {
          if (err) {
            grunt.log.error(err);
            deferred.reject(err);
          } else {
            deferred.resolve();
          }
      });
      return deferred.promise;
    }

    function gzipFile(source){
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
                
        out = fs.createWriteStream(tempFile);
        out.on('close', function() {
          deferred.resolve(tempFile); // once file closes, file is writen and avail.
        });
        inp.pipe(gzip).pipe(out);
        //inp.pipe(out); // test to just copy file
      });
      return deferred.promise;
    }

    function fileExists (dest) {
      if (fs.statSync(dest).isFile() && fs.existsSync(dest) ) {
          return true;
      }
      return false;
    }
    
  });
};
