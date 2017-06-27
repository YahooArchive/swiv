/*
 * Copyright 2015-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from 'chai';
import '../../utils/test-utils/index';
import { Dataset } from 'swiv-plywood';
import { datasetToWritable, getMIMEType } from './download';
import { EssenceMock } from '../../../common/models/mocks';

describe.skip('Download', () => {
  describe('datasetToWritable', () => {

    it('defaults to JSON if no type specified', () => {
      var dsJS = [
        { x: 1, y: "hello", z: 2 },
        { x: 2, y: "world", z: 3 }
      ];
      var e = EssenceMock.wikiTotals();
      var ds = Dataset.fromJS(dsJS);
      expect(() => { JSON.parse((<string>datasetToWritable(e, ds))); }).to.not.throw();
      expect(JSON.parse((<string>datasetToWritable(e, ds)))).to.deep.equal(dsJS);
    });

    it('encloses set/string in brackets appropriately', () => {
      var e = EssenceMock.wikiTotals();
      var ds = Dataset.fromJS([
        { y: ["dear", "john"] },
        { y: ["from", "peter"] }
      ]);
      expect((<string>datasetToWritable(e, ds, 'csv')).indexOf("\"[dear,john\"]"), 'csv').to.not.equal(-1);
      expect((<string>datasetToWritable(e, ds, 'tsv')).indexOf("[dear,john]"), 'tsv').to.not.equal(-1);
    });
  });

  describe('getMIMEType', () => {
    it('works as expected', () => {
      expect(getMIMEType('csv'), 'csv').to.equal("text/csv");
      expect(getMIMEType('tsv'), 'tsv').to.equal("text/tsv");
      expect(getMIMEType(''), 'csv').to.equal('application/json');
      expect(getMIMEType('json'), 'csv').to.equal('application/json');
      expect(getMIMEType('invalid'), 'csv').to.equal('application/json');
    });
  });
});


