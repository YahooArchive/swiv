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

require('./measures-tile.css');

import * as React from 'react';

import { STRINGS, PIN_TITLE_HEIGHT, MEASURE_HEIGHT, PIN_PADDING_BOTTOM, MAX_SEARCH_LENGTH } from '../../config/constants';
import { Clicker, Essence, DataCube, Filter, Dimension, Measure } from '../../../common/models/index';
import { classNames } from '../../utils/dom/dom';
import * as localStorage from '../../utils/local-storage/local-storage';

import { Checkbox, CheckboxType } from '../checkbox/checkbox';
import { TileHeaderIcon } from '../tile-header/tile-header';
import { HighlightString } from '../highlight-string/highlight-string';
import { SearchableTile } from '../searchable-tile/searchable-tile';
import { GlobalEventListener } from "../global-event-listener/global-event-listener";


export interface MeasuresTileProps extends React.Props<any> {
  clicker: Clicker;
  essence: Essence;
  style?: React.CSSProperties;
}

export interface MeasuresTileState {
  showSearch?: boolean;
  searchText?: string;
  highlightedValue?: any;
}

export class MeasuresTile extends React.Component<MeasuresTileProps, MeasuresTileState> {

  constructor() {
    super();
    this.state = {
      showSearch: false,
      searchText: ''
    };
  }

  measureClick(measure: Measure, e: MouseEvent) {
    if (e.altKey && typeof console !== 'undefined') {
      console.log(`Measure: ${measure.name}`);
      console.log(`expression: ${measure.expression.toString()}`);
      return;
    }
    var { clicker } = this.props;
    clicker.toggleEffectiveMeasure(measure);
  }

  toggleSearch() {
    var { showSearch } = this.state;
    this.setState({ showSearch: !showSearch });
    this.onSearchChange('');
  }

  onSearchChange(text: string) {
    var { searchText } = this.state;
    var newSearchText = text.substr(0, MAX_SEARCH_LENGTH);

    if (searchText === newSearchText) return; // nothing to do;

    this.setState({
      searchText: newSearchText
    });
  }

  toggleMultiMeasure() {
    var { clicker, essence } = this.props;
    clicker.toggleMultiMeasureMode();
    localStorage.set('is-multi-measure', !essence.getEffectiveMultiMeasureMode());
  }

  showMeasures() {
    let { essence } = this.props;
    let { searchText } = this.state;

    let shownMeasures = essence.dataCube.measures.toArray();
    if (searchText) {
      shownMeasures = shownMeasures.filter((m) => {
        return m.getTitleWithUnits().toLowerCase().indexOf(searchText.toLowerCase()) !== -1;
      });
    }
    return shownMeasures;
  }

  globalKeyDownListener(e: KeyboardEvent) {
    if (e.shiftKey && e.keyCode === 77) {
      e.preventDefault();
      this.toggleSearch();
    }
  }

  localKeyDownListener(e: KeyboardEvent) {
    let { clicker } = this.props;
    let { highlightedValue} = this.state;
    if ([38, 40, 32].some(x => x === e.keyCode)) {
      let showMeasures = this.showMeasures();
      switch (e.keyCode) {
        case(38): { // arrow up
          highlightedValue = highlightedValue ? showMeasures[showMeasures.indexOf(highlightedValue) - 1] : showMeasures[0];
          break;
        }
        case(40): { // arrow down
          highlightedValue = highlightedValue ? showMeasures[showMeasures.indexOf(highlightedValue) + 1] : showMeasures[0];
          break;
        }
        case(32): { // space
          e.preventDefault();
          clicker.toggleEffectiveMeasure(highlightedValue);
          break;
        }
      }
      this.setState({ highlightedValue });
    }
  }

  render() {
    let { essence, style } = this.props;
    let { showSearch, searchText, highlightedValue } = this.state;
    let multiMeasureMode = essence.getEffectiveMultiMeasureMode();
    let selectedMeasures = essence.getEffectiveSelectedMeasure();

    var checkboxType: CheckboxType = multiMeasureMode ? 'check' : 'radio';

    let shownMeasures = this.showMeasures();

    var rows = shownMeasures.map(measure => {
      var measureName = measure.name;
      var selected = selectedMeasures.has(measureName);
      return <div
        className={classNames('row', { selected }, {'highlighted': measure === highlightedValue})}
        key={measureName}
        onClick={this.measureClick.bind(this, measure)}
      >
        <Checkbox type={checkboxType} selected={selected}/>
        <HighlightString className="label" text={measure.getTitleWithUnits()} highlight={searchText}/>
      </div>;
    });

    var message: JSX.Element = null;
    if (searchText && !rows.length) {
      message = <div className="message">{`No ${ STRINGS.measures.toLowerCase() } for "${searchText}"`}</div>;
    }

    var icons: TileHeaderIcon[] = [];

    if (!essence.isFixedMeasureMode()) {
      icons.push({
        name: 'multi',
        onClick: this.toggleMultiMeasure.bind(this),
        svg: require('../../icons/full-multi.svg'),
        active: multiMeasureMode
      });
    }

    icons.push({
      name: 'search',
      ref: 'search',
      onClick: this.toggleSearch.bind(this),
      svg: require('../../icons/full-search.svg'),
      active: showSearch
    });

    // More icons to add later
    //{ name: 'more', onClick: null, svg: require('../../icons/full-more-mini.svg') }

    return <SearchableTile
      style={style}
      title={STRINGS.measures}
      toggleChangeFn={this.toggleSearch.bind(this)}
      onSearchChange={this.onSearchChange.bind(this)}
      searchText={searchText}
      showSearch={showSearch}
      icons={icons}
      className='measures-tile'
      onKeyDown={this.localKeyDownListener.bind(this)}
    >
      <GlobalEventListener
        keyDown={this.globalKeyDownListener.bind(this)}
      />
      <div className="rows">
        { rows }
        { message }
      </div>
    </SearchableTile>;
  };
}

