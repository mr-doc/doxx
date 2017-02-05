import TokenStream from '../scanner/TokenStream';
import Token, { TokenType } from '../scanner/Token';
import Node, { NodeType } from './Node';

type TokenTypes = {
  type: TokenType,
  lexeme?: string
}

abstract class Parser {
  private stream: TokenStream;
  constructor(stream: TokenStream) { this.stream = stream; }
  protected current(): Token { return this.stream.current(); }
  protected next(): Token { return this.stream.next(); }
  protected previous(): Token { return this.stream.previous(); }
  protected peek(to: number): Token { return this.stream.peek(to); }
  protected match(type: TokenType, lexeme?: string) {
    let current = this.current();
    if (lexeme) {
      return current.type === type && current.lexeme === lexeme;
    }
    return current.type === type;
  }
  protected matchAny(matches: TokenTypes[]) {
    let results = [];
    for(let i = 0; i < matches.length; i++) {
      const type = matches[i].type;
      const lexeme = matches[i].lexeme;
      results.push(this.match.apply(this, lexeme ? [type, lexeme ] : [type]));
    }
    return results.indexOf(true) > -1;
  }
  protected matchAll(matches: TokenTypes[]) {
    let results = [];
    for(let i = 0; i < matches.length; i++) {
      const type = matches[i].type;
      const lexeme = matches[i].lexeme;
      results.push(this.match.apply(this, lexeme ? [type, lexeme ] : [type]));
    }
    return results.indexOf(false) === 0;
  }
  abstract parse(): Node;
  get ended(): boolean { return this.stream.ended; }
  get location () { return this.current().location; }
}

export default Parser;