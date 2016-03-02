"use strict";
const JavaScript = require('./src/parsers/javascript');
const TypeScript = require('./src/parsers/typescript');
class Parser {
    constructor(config) {
        this.config = config;
    }
    factory() {
        switch (this.config.language) {
            case 'javascript':
                return new JavaScript(this.config.version, this.config.parser);
            case 'typescript':
                return new TypeScript(this.config.version);
        }
    }
}
module.exports = Parser;
//# sourceMappingURL=index.js.map