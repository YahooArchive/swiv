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

import * as Q from 'q';
import * as filesaver from 'browser-filesaver';
import * as xlsx from 'xlsx-exporter';
import { Essence } from '../../../common/models/index';
import { formatDateWithTZ, formatValue } from '../../../common/utils/formatter/formatter';
import { Dataset, TimeRange } from 'swiv-plywood';

export type FileFormat = "csv" | "tsv" | "json" | "txt" | "xlsx";
export type Writable = string | Uint8Array;

export function getMIMEType(fileType: string) {
  switch (fileType) {
    case 'csv':
      return 'text/csv';
    case 'tsv':
      return 'text/tsv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/json';
  }
}

export function download(essence: Essence, dataset: Dataset, fileName?: string, fileFormat?: FileFormat): void {
  const type = `${getMIMEType(fileFormat)};charset=utf-8`;
  Q.fcall(datasetToWritable, essence, dataset, fileFormat)
    .then((writable: Writable) => {
      const blob = new Blob([writable], {type});
      if (!fileName) fileName = `${new Date()}-data`;
      fileName += `.${fileFormat}`;
      filesaver.saveAs(blob, fileName, true); // true == disable auto BOM
    });
}

export function datasetToWritable(essence: Essence, dataset: Dataset, fileFormat?: FileFormat): Writable | Q.Promise<Writable> {
  switch (fileFormat) {
    case 'csv':
      return datasetToSeparatedValues(essence, dataset, ',');
    case 'tsv':
      return datasetToSeparatedValues(essence, dataset, '\t');
    case 'xlsx':
      return datasetToXLSX(essence, dataset);
    default:
      return JSON.stringify(dataset.toJS(), null, 2);
  }
}

export function datasetToSeparatedValues(essence: Essence, dataset: Dataset, separator: string): string {
  return datasetToRows(essence, dataset).map((row) => {
    return row.map((value: any) => {
      let formatted: string;
      if (TimeRange.isTimeRange(value)) {
        formatted = formatDateWithTZ(value.start, essence.timezone, false);
      } else {
        formatted = formatValue(value);
      }
      return `"${formatted}"`;
    }).join(separator);
  }).join('\n');
}

export function datasetToRows(essence: Essence, dataset: Dataset): any[] {
  const rows: any[] = [];

  const segmentNames: string[] = [];
  const measureNames: string[] = [];
  const columnHeadings: string[] = [];

  essence.splits.forEach((split) => {
    const dimension = split.getDimension(essence.dataCube.dimensions);
    segmentNames.push(dimension.name);
    columnHeadings.push(dimension.title);
  });

  essence.getEffectiveMeasures().toArray().forEach((measure) => {
    measureNames.push(measure.name);
    columnHeadings.push(measure.title);
  });

  rows.push(columnHeadings);

  dataset.flatten().forEach((row) => {
    const values: any[] = [];
    for (const segment of segmentNames) {
      values.push(row[segment]);
    }
    for (const measure of measureNames) {
      values.push(row[measure]);
    }
    rows.push(values);
  });

  return rows;
}

export function datasetToXLSX(essence: Essence, dataset: Dataset): Q.Promise<Writable> {
  const workbook = new xlsx.Workbook();

  const data = datasetToRows(essence, dataset).map((row) => {
    return row.map((value: any) => {
      if (TimeRange.isTimeRange(value)) {
        return formatDateWithTZ(value.start, essence.timezone, false);
      }
      return value;
    });
  });

  const worksheet = new xlsx.Worksheet(data);
  workbook.addWorksheet(worksheet);

  return workbook.save();
}

export function makeFileName(...args: Array<string>): string {
  var nameComponents: string[] = [];
  args.forEach((arg) => {
    if (arg) nameComponents.push(arg.toLowerCase());
  });
  var nameString = nameComponents.join("_");
  return nameString.length < 200 ? nameString : nameString.substr(0, 200);
}

