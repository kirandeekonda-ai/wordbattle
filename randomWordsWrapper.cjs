const randomWords = require('random-words');
module.exports = (num, min, max) => randomWords({ exactly: num, minLength: min, maxLength: max });