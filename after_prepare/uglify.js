#!/usr/bin/env node

/*jshint latedef:nofunc, node:true*/

// Modules
var fs         = require('fs');
var path       = require('path');
var UglifyJS   = require('uglify-js');
var CleanCSS   = require('clean-css');
var ngAnnotate = require('ng-annotate');

// Process
var rootDir      = process.argv[2];
var platformPath = path.join(rootDir, 'platforms');
var platforms    = process.env.CORDOVA_PLATFORMS.split(',');
var cliCommand   = process.env.CORDOVA_CMDLINE;

// Hook configuration
var configFilePath        = path.join(rootDir, 'hooks/uglify-config.json');
var hookConfig            = JSON.parse(fs.readFileSync(configFilePath));
var isRelease             = hookConfig.alwaysRun || (cliCommand.indexOf('--release') > -1);
var recursiveFolderSearch = hookConfig.recursiveFolderSearch; // set this to false to manually indicate the folders to process
var foldersToProcess      = hookConfig.foldersToProcess; // add other www folders in here if needed (ex. js/controllers)
var cssMinifier           = new CleanCSS(hookConfig.cleanCssOptions);

if (!isRelease) {
    return;
}

// Run uglifier
run();

function run() {
    platforms.forEach(function(platform) {
        var wwwPath;
        
        switch (platform) {
            case 'android':
                wwwPath = path.join(platformPath, platform, 'assets', 'www');
                break;
                
            case 'ios': 
            case 'browser':
                wwwPath = path.join(platformPath, platform, 'www');
                break;
                
            default:
                console.log('this hook only supports android, ios, and browser currently');
                return;
        }
 
        processFolders(wwwPath);
    });
}

function processFolders(wwwPath) {
    foldersToProcess.forEach(function(folder) {
        processFiles(path.join(wwwPath, folder));
    });
}

function processFiles(dir) {
    fs.readdir(dir, function (err, list) {
        if (err) {
            console.log('processFiles err: ' + err);
            
            return;
        }
        
        list.forEach(function(file) {
            file = path.join(dir, file);
        
            fs.stat(file, function(err, stat) {
                if (stat.isFile()) {
                    compress(file);
                    
                    return; 
                }
                
                if (recursiveFolderSearch && stat.isDirectory()) {
                    processFiles(file);
                    
                    return;
                }
            });
        });
    });
}

function compress(file) {
    var ext = path.extname(file);
    switch(ext) {
        case '.js':
            console.log('uglifying js file ' + file);
            var res = ngAnnotate(String(fs.readFileSync(file)), { add: true });
            var result = UglifyJS.minify(res.src, hookConfig.uglifyJsOptions);
            fs.writeFileSync(file, result.code, 'utf8'); // overwrite the original unminified file
            break;
        case '.css':
            console.log('minifying css file ' + file);
            var source = fs.readFileSync(file, 'utf8');
            var result = cssMinifier.minify(source);
            fs.writeFileSync(file, result, 'utf8'); // overwrite the original unminified file
            break;
        default:
            console.log('encountered a ' + ext + ' file, not compressing it');
            break;
    }
}
