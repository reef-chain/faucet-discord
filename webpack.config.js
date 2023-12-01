// module.exports = require('./webpack/' + process.env.NODE_ENV)();

var webpack = require('webpack');
    // { merge } = require('webpack-merge'),    
    

module.exports = (env, argv) => {

    console.log("Webpack args: ", argv);

    var configs = [
        require('./webpack/server'),
        // require('./webpack/wap')        
    ];

    configs.forEach(config => {
        if (argv.mode === 'development') {
            //config = merge(config, { devtool: 'source-map' });
            config.devtool = 'source-map';
        }

        if (argv.mode === 'production') {
            config.plugins.push(new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("production"),
            "process.env.MNEMONIC":JSON.stringify("control employ home citizen film salmon divorce cousin illegal episode certain olympic"),
            "process.env.DISCORD_TOKEN":JSON.stringify("MTE1MzY1NjM4NTEwODcwNTM1MQ.GrB3Is.xjT--UBOc2sXdJHPDDGOy62kepQsUjpt571krQ"),
            "process.env.DISCORD_CLIENT_ID":JSON.stringify("1153656385108705351")
        }));
        }

    });

    return configs;
};