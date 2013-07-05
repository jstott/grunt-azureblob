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
        gzip: false, // gzip files
        maxNumberOfConcurrentUploads: 10 // Maximum number of concurrent uploads
      }),
      blobService = azure.createBlobService(),
      done = this.async(),
      self = this;

    grunt.verbose.writeflags(options,'options');
    //tmp.setGracefulCleanup(); //cleanup the temporary files even when an uncaught exception occurs.

    // execute task
    deleteContainer()
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
        files = self.files.filter(fileExistsAndIsWellFormed); // filesSrc can include dir's, not just files

      grunt.verbose.writeln(util.format('\tprocess (%s) files', files.length));

      // Iterate over all specified file groups, <options.maxNumberOfConcurrentUploads> files at a time
      grunt.util.async.forEachLimit(files, options.maxNumberOfConcurrentUploads, copyFile, function(err){
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

      if (options.containerDelete && !options.copySimulation) {
        grunt.log.writeln(util.format('%s - deleting container [%s] ...', self.nameArgs, options.containerName));
        blobService.deleteContainer(options.containerName, {timeoutIntervalInMs:25000}, function(err){
            /* // ignore errors for now - just move on
            if (err) {
              grunt.log.writeln(err);
              deferred.reject(err);
            }
            */
            grunt.log.ok();
        });
        deferred.resolve();
      } else {
        deferred.resolve();
      }
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

      options.containerOptions.timeoutIntervalInMs = options.containerOptions.timeoutIntervalInMs || 15000; // 15sec
      grunt.log.write(util.format('%s - Create blob containter [%s] ...', self.nameArgs, options.containerName));

      if(options.copySimulation){
        completed = true;
        tryCallback();
      } else {
        grunt.util.async.whilst(continueAttempts, tryCreate, tryCallback);
      }

      return deferred.promise;

      function continueAttempts() {
        return ((count < maxTry) && !completed); // sync truth test before each execution of fn
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

    // Iterator called from grunt.util.async.forEachLimit - for each source file in task
    function copyFile(file, callback) {
      var source = file.src,
          destination = file.dest,
          meta = options.metadata,
          srcFile = path.basename(source),
          gzip = options.gzip,
          fileExt = path.extname(source),
          fnCopyToBlob;

      // only create gzip copies for css and js files
      if (fileExt !== '.js' && fileExt !== '.css') {
          gzip = false;
      }

      // configure proper azure metadata for file
      meta.contentType = mime.lookup(source);
      meta.contentTypeHeader =  mime.lookup(source);
      meta.contentEncoding =  gzip ? 'gzip': null;

      var logMessage = util.format('\tCopy %s => %s/%s ', srcFile, options.containerName, destination);

      if(options.copySimulation){
        grunt.log.write(logMessage);
        grunt.log.ok('skip copy ok');
        callback();
        return;
      }

      fnCopyToBlob = gzip ? compressFileToBlobStorage : copyFileToBlobStorage; // use correct fn to pre-compress

      Q.when(fnCopyToBlob(options.containerName, destination, source, meta))
        .then(function(){
            grunt.log.write(logMessage); // We have to save logging about the file upload until here since
                                         // we are iterating over many files concurrently. Otherwise the
                                         // log output becomes interleaved and therefore unintelligible.
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
        deferred.reject(err);
      });

      tmp.tmpName({ template: 'tmp-XXXXXX' + fileExt }, function(err, tempFile) {
        if (err) {
          deferred.reject(err);
        }

        inp = fs.createReadStream(source);

        out = fs.createWriteStream(tempFile);
        out.on('close', function() {
          deferred.resolve(tempFile); // once file closes, file is written and available.
        });
        inp.pipe(gzip).pipe(out);
        //inp.pipe(out); // test to just copy file
      });
      return deferred.promise;
    }

    function fileExistsAndIsWellFormed(file) {
      if (file.src.length !== 1) {
        grunt.fail.warn('File mapping must contain exactly one source to one destination.');
      }

      file.src = file.src[0];

      return fs.statSync(file.src).isFile() && fs.existsSync(file.src);
    }

  });
};
