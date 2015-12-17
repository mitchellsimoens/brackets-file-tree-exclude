define(function (require, exports, module) {
    'use strict';

    // Get our Brackets modules
    var _                  = brackets.getModule('thirdparty/lodash'),
        Commands           = brackets.getModule('command/Commands'),
        CommandManager     = brackets.getModule('command/CommandManager'),
        FileSystem         = brackets.getModule('filesystem/FileSystem'),
        FileSystemImpl     = FileSystem._FileSystem,
        ProjectManager     = brackets.getModule('project/ProjectManager'),
        PreferencesManager = brackets.getModule('preferences/PreferencesManager'),
        PackageJson        = JSON.parse(require('text!./package.json')),
        StateManager       = PreferencesManager.stateManager;

    // Get the preferences for this extension
    var preferences = PreferencesManager.getExtensionPrefs(PackageJson.name),
        prefKey     = 'excludeList',
        _oldFilter  = FileSystemImpl.prototype._indexFilter;

    var reTest = /\/(.+)\/(i?)$/,   // detects if the exclude settings are a regexp string
        defaultExcludeList = [      // Default excludes
            '.git',
            'dist',
            'bower_components',
            'node_modules'
        ],
        excludeList, projectPath;

    preferences.definePreference(prefKey, 'array', defaultExcludeList);

    // Check if the extension has been updated
    if (PackageJson.version !== StateManager.get(PackageJson.name + '.version')) {
        StateManager.set(PackageJson.name + '.version', PackageJson.version);

        preferences.set(prefKey, defaultExcludeList);
    }

    function toRegexp(text) {
        var match = text.match(reTest);

        return match ? new RegExp(match[1], match[2]) : new RegExp(text);
    }

    function fetchVariables(forceRefresh) {
        var projectRoot = ProjectManager.getProjectRoot();

        projectPath = projectRoot ? projectRoot.fullPath : null;

        excludeList = preferences
            .get(prefKey, {
                //not sure why need this for brackets to see it
                path : projectPath + '.brackets.json'
            })
            .map(toRegexp);

        if (forceRefresh === true) {
            CommandManager.execute(Commands.FILE_REFRESH);
        }
    }

    function clearVariables() {
        excludeList = projectPath = null;
    }

    // attach events
    ProjectManager.on('projectOpen',        function () { fetchVariables(true); });
    ProjectManager.on('projectRefresh',     function () { fetchVariables(true); });
    ProjectManager.on('beforeProjectClose', function () { clearVariables();     });

    FileSystem.on('change', function (event, entry, added, removed) {
        // entry === null when manual refresh is done
        if (entry === null) {
            fetchVariables();
        }
    });

    // Filter itself
    FileSystemImpl.prototype._indexFilter = function (path, name) {
        if (!excludeList || !projectPath) {
            fetchVariables();

            if (!excludeList || !projectPath) {
                return _oldFilter.apply(this, arguments);
            }
        }

        var relativePath = path.slice(projectPath.length),
            excluded     = _.any(excludeList, function (re) {
                return re.test(relativePath);
            });

        return excluded ? false : _oldFilter.apply(this, arguments);
    };

});
