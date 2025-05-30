import { generate } from 'random-words';
export default (num, min, max) => generate({ exactly: num, minLength: min, maxLength: max });