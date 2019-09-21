module.exports = {
    "plugins": [
        require('posthtml-include')({}),
        require('posthtml-cat')({})
    ]
};
