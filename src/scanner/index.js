"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const token_1 = require("../token");
const _1 = require("../stream/");
const location_1 = require("../location");
const Match_1 = require("../utils/Match");
const _ = require("lodash");
let _position = 0, _line = 1, _column = 1;
let _stream = "";
let _lexeme, _tokens = [];
let _previousToken;
function isEOF() { return (_position >= _stream.length || Match_1.default.isNullTerminator(current())); }
function current() { return _stream[_position]; }
function next() {
    const ch = _stream[++_position];
    if (Match_1.default.isLineTerminator(ch)) {
        _line++;
        _column = 1;
    }
    else {
        _column++;
    }
    return ch;
}
function previous() {
    const ch = _stream[--_position];
    if (Match_1.default.isLineTerminator(ch)) {
        _line--;
        _column = 1;
    }
    else {
        _column--;
    }
    return ch;
}
function peek(to) { return _stream[_position + to]; }
function consume(to, array) {
    let i = 0;
    while (i < Math.abs(to)) {
        const s = to < 0 ? previous() : accept();
        if (array) {
            array.push(s);
        }
        i++;
    }
}
function accept() { const ch = current(); next(); return ch; }
function scan() {
    _lexeme = [];
    while (Match_1.default.isWhiteSpace(current())) {
        next();
    }
    ;
    if (isEOF()) {
        return new token_1.default('\0', token_1.TokenType.EOF, location_1.location(_position, _line, _column));
    }
    else if (Match_1.default.isLetterOrDigit(current()) || '\'\"[]{}.'.includes(current())) {
        return scanName();
    }
    else if (Match_1.default.isLineTerminator(current())) {
        return scanSimpleChar();
    }
    else if (current() === '@') {
        return scanTag();
    }
    else if (current() === '-') {
        return scanMinus();
    }
    else if (':?|&,'.includes(current())) {
        return scanSimpleChar();
    }
    else if (current() === '=') {
        return scanEqualOrArrow();
    }
    else if ('()'.includes(current())) {
        return scanParenthesis();
    }
    else {
        next();
    }
}
function scanName() {
    const isEnd = (ch) => Match_1.default.isSpace(ch) && Match_1.default.isNullTerminator(ch);
    const filter = (type, ch) => ({
        [token_1.TokenType.Any]: !isEnd(ch) && !'&|,)-='.includes(ch) && !Match_1.default.isSpace(ch),
        [token_1.TokenType.Identifier]: !isEnd(ch) && !'?:)-=,'.includes(ch) && !Match_1.default.isSpace(ch),
        [token_1.TokenType.Initializer]: !isEnd(ch) && !',)-='.includes(ch) && !Match_1.default.isSpace(ch),
        [token_1.TokenType.Description]: !Match_1.default.isLineTerminator(ch) && !Match_1.default.isNullTerminator(ch)
    }[type]);
    const consume = (type) => {
        while (filter(type, current()) && !isEOF()) {
            _lexeme.push(accept());
        }
        const { Any, Ampersand, Pipe, Identifier, LeftParen } = token_1.TokenType;
        if (type === Identifier) {
            // Skip whitespace
            while (Match_1.default.isWhiteSpace(current())) {
                next();
            }
            // ... =>  (... | any) || (... & any )
            if (_previousToken && _previousToken.type === LeftParen) {
                if ('&|'.includes(current())) {
                    type = Any;
                }
            }
            else if (_previousToken && _.includes([Pipe, Ampersand], _previousToken.type)) {
                type = Any;
            }
        }
        return new token_1.default(_lexeme.join(''), type, location_1.location(_position, _line, _column));
    };
    const { Tag, LeftParen, Comma } = token_1.TokenType;
    if (_previousToken && _.includes([Tag, LeftParen, Comma], _previousToken.type)) {
        return consume(token_1.TokenType.Identifier);
    }
    const { Colon, Arrow, Pipe, Ampersand } = token_1.TokenType;
    if (_previousToken && _.includes([Colon, Arrow, Pipe, Ampersand], _previousToken.type)) {
        return consume(token_1.TokenType.Any);
    }
    if (_previousToken && _previousToken.type === token_1.TokenType.Equal) {
        return consume(token_1.TokenType.Initializer);
    }
    return consume(token_1.TokenType.Description);
}
function scanSimpleChar() {
    const ch = accept();
    const type = token_1.getTokenType(ch);
    return new token_1.default(ch, type, location_1.location(_position, _line, _column));
}
function scanTag() {
    while (current() !== ':' && !Match_1.default.isWhiteSpace(current()) && !isEOF()) {
        _lexeme.push(accept());
    }
    return new token_1.default(_lexeme.join(''), token_1.TokenType.Tag, location_1.location(_position, _line, _column));
}
function scanMinus() {
    const isInitializer = _previousToken &&
        _previousToken.type === token_1.TokenType.Equal &&
        current() === '-' && Match_1.default.isDigit(peek(1));
    const isMarkdown = current() + peek(1) + peek(2) === '---';
    let type = token_1.TokenType.None;
    if (isInitializer) {
        _lexeme.push(accept());
        while (Match_1.default.isDigit(current())) {
            _lexeme.push(accept());
        }
        type = token_1.TokenType.Initializer;
    }
    else if (isMarkdown) {
        type = scanMarkdown();
    }
    else {
        _lexeme.push(accept());
        type = token_1.TokenType.Minus;
    }
    return new token_1.default(_lexeme.join(''), type, location_1.location(_position, _line, _column));
}
function scanMarkdown() {
    const isMarkdownTag = (m1, m2, m3) => m1 + m2 + m3 === '---';
    const isCommentStar = (col) => (col === 0 || col === 1) && current() === '*';
    let starEnabled = peek(-1) === '*';
    // Consume the first three lexemes
    consume(3, _lexeme);
    // Keep consuming the lexemes until markdown ends
    while (!isMarkdownTag(current(), peek(1), peek(2))) {
        if (isCommentStar(_column) && starEnabled) {
            next();
        }
        else {
            _lexeme.push(accept());
        }
    }
    // Consume the last three lexemes
    if (isMarkdownTag(current(), peek(1), peek(2))) {
        consume(3, _lexeme);
    }
    return token_1.TokenType.Markdown;
}
function scanEqualOrArrow() {
    const lexeme = peek(1) === '>' ? accept() + accept() : accept();
    return new token_1.default(lexeme, token_1.getTokenType(lexeme), location_1.location(_position, _line, _column));
}
function scanParenthesis() {
    const lexeme = accept();
    const type = lexeme === '(' ? token_1.TokenType.LeftParen : token_1.TokenType.RightParen;
    return new token_1.default(lexeme, type, location_1.location(_position, _line, _column));
}
function Scanner(source) {
    _position = 0;
    _line = _column = 1;
    _stream = source ? `${source}\u{0000}` : '\u{0000}';
    _tokens = [];
    _previousToken = null;
    const getToken = () => { _previousToken = scan(); return _previousToken; };
    return {
        scan: function scan() { return _previousToken = getToken(); },
        toTokenStream: function toTokenStream() {
            let token = getToken();
            while (token.type !== token_1.TokenType.EOF) {
                _tokens.push(token);
                token = getToken();
            }
            _tokens.push(token);
            return new _1.TokenStream(_tokens);
        },
        position: function position() { return _position; },
        line: function line() { return _line; },
        column: function column() { return _column; },
        eof: isEOF
    };
}
exports.default = Scanner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9DQUEwRDtBQUMxRCxpQ0FBeUM7QUFDekMsMENBQXVDO0FBQ3ZDLDBDQUFtQztBQUNuQyw0QkFBNEI7QUFFNUIsSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFHLENBQUMsQ0FBQztBQUMxQyxJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7QUFDakIsSUFBSSxPQUFpQixFQUFFLE9BQU8sR0FBWSxFQUFFLENBQUM7QUFDN0MsSUFBSSxjQUFxQixDQUFDO0FBRTFCLG1CQUFtQixNQUFNLENBQUMsQ0FBQyxTQUFTLElBQUksT0FBTyxDQUFDLE1BQU0sSUFBSSxlQUFLLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvRixxQkFBNkIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekQ7SUFDRSxNQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNoQyxFQUFFLENBQUMsQ0FBQyxlQUFLLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQUMsS0FBSyxFQUFFLENBQUM7UUFBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBQUMsQ0FBQztJQUN6RCxJQUFJLENBQUMsQ0FBQztRQUFDLE9BQU8sRUFBRSxDQUFDO0lBQUMsQ0FBQztJQUNuQixNQUFNLENBQUMsRUFBRSxDQUFDO0FBQ1osQ0FBQztBQUNEO0lBQ0UsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDaEMsRUFBRSxDQUFDLENBQUMsZUFBSyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUFDLEtBQUssRUFB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