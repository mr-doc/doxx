"use strict";
const Scanner_1 = require("./Scanner");
const token_1 = require("../token");
const _1 = require("../stream/");
const location_1 = require("../location");
const Match_1 = require("../utils/Match");
const _ = require("lodash");
class CommentScanner extends Scanner_1.default {
    constructor(source, location) {
        super(source, location);
    }
    scan() {
        while (!this.ended) {
            this.lexeme = [];
            const ch = this.current();
            if (Match_1.default.isLetterOrDigit(ch) || '\'\"[].'.includes(ch)) {
                this.tokens.push(this.scanString());
            }
            else if (Match_1.default.isNullTerminator(ch)) {
                this.tokens.push(this.scanNullTerminator());
            }
            else if (ch === '@') {
                this.tokens.push(this.scanTag());
            }
            else if (ch === '-') {
                this.tokens.push(this.scanMinus());
            }
            else if (':?|&,'.includes(ch)) {
                this.tokens.push(this.scanSimpleChar());
            }
            else if (ch === '=') {
                this.tokens.push(this.scanEqualOrArrow());
            }
            else if ('()'.includes(ch)) {
                this.tokens.push(this.scanParenthesis());
            }
            else {
                this.next();
            }
        }
        return new _1.TokenStream(this.tokens);
    }
    scanSimpleChar() {
        const ch = this.current();
        const start = this.location;
        const lexeme = this.next();
        const end = this.location;
        const type = token_1.getTokenType(ch);
        return new token_1.default(lexeme, type, new location_1.Range(start, end));
    }
    scanString() {
        const start = this.location;
        const previous = this.tokens.length > 0 ?
            this.tokens[this.tokens.length - 1] :
            new token_1.default('', token_1.TokenType.None, new location_1.Range(start, null));
        const isEnd = (ch) => Match_1.default.isSpace(ch) || Match_1.default.isNullTerminator(ch);
        const filter = (type, ch) => ({
            [token_1.TokenType.Any]: !isEnd(ch) && !'&|,)-'.includes(ch),
            [token_1.TokenType.Identifier]: !isEnd(ch) && !'?:)-,'.includes(ch),
            [token_1.TokenType.Initializer]: !isEnd(ch) && !',)-'.includes(ch),
            [token_1.TokenType.Description]: !Match_1.default.isLineTerminator(ch) && !Match_1.default.isNullTerminator(ch)
        }[type]);
        const consume = (type) => {
            while (filter(type, this.current())) {
                this.lexeme.push(this.next());
            }
            const { Any, Ampersand, Pipe, Identifier, LeftParen } = token_1.TokenType;
            if (type === Identifier) {
                // Skip whitespace
                while (Match_1.default.isWhiteSpace(this.current())) {
                    this.next();
                }
                // ... =>  (... | any) || (... & any )
                if (previous && previous.type === LeftParen) {
                    if ('&|'.includes(this.current())) {
                        type = Any;
                    }
                }
                else if (previous && _.includes([Pipe, Ampersand], previous.type)) {
                    type = Any;
                }
            }
            const end = this.location;
            return new token_1.default(this.lexeme.join(''), type, new location_1.Range(start, end));
        };
        const { Tag, LeftParen, Comma } = token_1.TokenType;
        if (_.includes([Tag, LeftParen, Comma], previous.type)) {
            return consume(token_1.TokenType.Identifier);
        }
        const { Colon, Arrow, Pipe, Ampersand } = token_1.TokenType;
        if (_.includes([Colon, Arrow, Pipe, Ampersand], previous.type)) {
            return consume(token_1.TokenType.Any);
        }
        if (previous.type === token_1.TokenType.Equal) {
            return consume(token_1.TokenType.Initializer);
        }
        return consume(token_1.TokenType.Description);
    }
    scanNullTerminator() {
        const start = this.location;
        this.lexeme.push(this.next());
        const end = this.location;
        return new token_1.default(this.lexeme.join(''), token_1.TokenType.NullTerminator, new location_1.Range(start, end));
    }
    scanTag() {
        const start = this.location;
        const isEnd = (ch) => Match_1.default.isSpace(ch) || Match_1.default.isNullTerminator(ch);
        while (!isEnd(this.current()) && this.current() !== ':') {
            this.lexeme.push(this.next());
        }
        const end = this.location;
        return new token_1.default(this.lexeme.join(''), token_1.TokenType.Tag, new location_1.Range(start, end));
    }
    scanMinus() {
        const start = this.location;
        const previous = this.tokens[this.tokens.length - 1];
        const isInitializer = previous && previous.type === token_1.TokenType.Equal && this.current() === '-' && Match_1.default.isDigit(this.peek(1));
        const isMarkdown = this.current() + this.peek(1) + this.peek(2) === '---';
        let type = token_1.TokenType.None;
        if (isInitializer) {
            this.lexeme.push(this.next());
            while (Match_1.default.isDigit(this.current())) {
                this.lexeme.push(this.next());
            }
            type = token_1.TokenType.Initializer;
        }
        else if (isMarkdown) {
            type = this.scanMarkdown();
        }
        else {
            this.lexeme.push(this.next());
            type = token_1.TokenType.Minus;
        }
        const end = this.location;
        return new token_1.default(this.lexeme.join(''), type, new location_1.Range(start, end));
    }
    scanMarkdown() {
        const isMarkdownTag = (m1, m2, m3) => m1 + m2 + m3 === '---';
        const isCommentStar = (col) => (col === 0 || col === 1) && this.current() === '*';
        let starEnabled = this.peek(-1) === '*';
        // Consume the first three lexemes
        this.consume(3, this.lexeme);
        // Keep consuming the lexemes until markdown ends
        while (!isMarkdownTag(this.current(), this.peek(1), this.peek(2))) {
            if (isCommentStar(this.location.column) && starEnabled) {
                this.next();
            }
            else {
                this.lexeme.push(this.next());
            }
        }
        // Consume the last three lexemes
        if (isMarkdownTag(this.current(), this.peek(1), this.peek(2))) {
            this.consume(3, this.lexeme);
        }
        return token_1.TokenType.Markdown;
    }
    scanEqualOrArrow() {
        const start = this.location;
        const lexeme = this.peek(1) === '>' ? this.next() + this.next() : this.next();
        const end = this.location;
        return new token_1.default(lexeme, token_1.getTokenType(lexeme), new location_1.Range(start, end));
    }
    scanParenthesis() {
        const start = this.location;
        const lexeme = this.next();
        const end = this.location;
        const type = lexeme === '(' ? token_1.TokenType.LeftParen : token_1.TokenType.RightParen;
        return new token_1.default(lexeme, type, new location_1.Range(start, end));
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CommentScanner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7QUFDYix1Q0FBZ0M7QUFDaEMsb0NBQTBEO0FBQzFELGlDQUF5QztBQUN6QywwQ0FBOEM7QUFDOUMsMENBQW1DO0FBR25DLDRCQUE0QjtBQUU1QixvQkFBb0MsU0FBUSxpQkFBTztJQUNqRCxZQUFZLE1BQWUsRUFBRSxRQUFtQjtRQUM5QyxLQUFLLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzFCLENBQUM7SUFDRCxJQUFJO1FBQ0YsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNqQixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDMUIsRUFBRSxDQUFDLENBQUMsZUFBSyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7WUFDdEMsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxlQUFLLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ25DLENBQUM7WUFBQyxJ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