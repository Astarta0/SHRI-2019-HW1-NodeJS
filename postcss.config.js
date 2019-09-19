module.exports = {
    plugins: [
        require('autoprefixer'),
        require('postcss-import')({ root: __dirname }),
        require('postcss-nested'),
        require('postcss-advanced-variables')
    ]
};
