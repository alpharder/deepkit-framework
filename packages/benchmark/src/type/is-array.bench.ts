/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {isArray} from '@deepkit/core';
import {BenchSuite} from '../bench';

export async function main() {
    const suite = new BenchSuite('isArray', 3);

    const array = ['a', 'b', 'c'];

    suite.add('Array.isArray()', () => {
        Array.isArray(array);
    });

    const isA = isArray; //local assign needed to avoid import measurement
    suite.add('custom isA()', () => {
        isA(array);
    });

    suite.add('custom isArray()', () => {
        isArray(array);
    });

    suite.add('a instanceof Array', () => {
        let is = false;
        if (array instanceof Array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    suite.add('constructor === Array', () => {
        let is = false;
        if (array && array.constructor === Array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    suite.add('.length', () => {
        let is = false;
        if (array.length >= 0) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    suite.add('.length && slice', () => {
        let is = false;
        if (array.length >= 0 && 'function' === typeof array.slice && 'string' !== typeof array) {
            is = true;
        }
        if (!is) throw Error('invalid');
    });

    suite.add('!.length || !slice', () => {
        let is = true;
        if (array.length === undefined || 'string' === typeof array || 'function' !== typeof array.slice) {
            is = false;
        }
        if (!is) throw Error('invalid');
    });

    suite.run();
}
