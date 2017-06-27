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

import { rollbar } from "../../utils/rollbarlog/rollbarlog";
require('./query-error.css');

import * as React from 'react';
import { STRINGS } from '../../config/constants';

export interface QueryErrorProps extends React.Props<any> {
  error: any;
}

export interface QueryErrorState {
}

export class QueryError extends React.Component<QueryErrorProps, QueryErrorState> {

  constructor() {
    super();
  }

  render() {
    let { error } = this.props;
    if (rollbar) rollbar.error(error);

    return <div className="query-error">
      <div className="whiteout"/>
      <div className="error-container">
        <div className="error">{STRINGS.queryError}</div>
        <div className="message">{error.message}</div><br/>
      </div>
    </div>;
  }
}
