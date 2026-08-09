import { geoMercator, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import recordsJson from '../data/results.json';
import {
  EVENTS,
  findSlowerRecords,
  formatTime,
  getTimeFieldsForRecords,
  isEventName,
  isGender,
  timePartsToMilliseconds,
  type EventName,
  type NationalRecord,
  type RecordsData,
  type TimePart,
  type TimePartDefinition,
} from '../domain/records';

interface AppElements {
  form: HTMLFormElement;
  eventSelect: HTMLSelectElement;
  genderSelect: HTMLSelectElement;
  timeEntry: HTMLFieldSetElement;
  timeFields: HTMLElement;
  timePreview: HTMLElement;
  formError: HTMLElement;
  compareButton: HTMLButtonElement;
  results: HTMLElement;
  resultsTitle: HTMLElement;
  resultsDetail: HTMLElement;
  editTimeButton: HTMLButtonElement;
  returnTopButton: HTMLButtonElement;
  mapPanel: HTMLElement;
  worldMap: SVGSVGElement;
  mapDescription: SVGDescElement;
  mapOverviewNavigation: HTMLElement;
  mapOverviewStatus: HTMLElement;
  mapExploreButton: HTMLButtonElement;
  mapFocusNavigation: HTMLElement;
  mapPreviousButton: HTMLButtonElement;
  mapFocusStatus: HTMLElement;
  mapNextButton: HTMLButtonElement;
  mapViewAllButton: HTMLButtonElement;
  countryPanel: HTMLElement;
  countryList: HTMLOListElement;
  dataStamp: HTMLElement;
  sourceCount: HTMLElement;
}

interface MapViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const records = recordsJson as unknown as RecordsData;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const WORLD_MAP_VIEW_BOX = { x: 0, y: 0, width: 1000, height: 500 } as const;
const MAP_ZOOM_DURATION_MS = 900;
const MAP_COMPACT_VIEW_MAX_WIDTH = 650;
const MAP_FOCUSED_VIEW_MIN_WIDTH = 260;
const MAP_NUMBERED_MARKER_LIMIT = 12;
const MAP_NAME_ALIASES: Record<string, string> = {
  'Antigua and Barbuda': 'Antigua and Barb.',
  'Central African Republic': 'Central African Rep.',
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'Dominican Republic': 'Dominican Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  'Guinea Bissau': 'Guinea-Bissau',
  'Republic of Serbia': 'Serbia',
  'Republic of the Congo': 'Congo',
  'South Sudan': 'S. Sudan',
  'The Bahamas': 'Bahamas',
  Tanzania: 'United Republic of Tanzania',
};
const MAP_MARKER_COORDINATES: Record<string, [number, number]> = {
  'American Samoa': [-170.7, -14.3],
  Andorra: [1.6, 42.5],
  Anguilla: [-63.1, 18.2],
  'Antigua and Barbuda': [-61.8, 17.1],
  Aruba: [-70.0, 12.5],
  Bahrain: [50.6, 26.1],
  Barbados: [-59.5, 13.2],
  Bermuda: [-64.8, 32.3],
  Singapore: [103.8, 1.4],
  Tonga: [-175.2, -21.2],
};

export class HowFastApp {
  private readonly elements: AppElements;
  private readonly mapPaths = new Map<string, SVGGraphicsElement>();
  private readonly mapPositions = new Map<string, [number, number]>();
  private mapResultMarkerLayer: SVGGElement | undefined;
  private mapAnimationFrame = 0;
  private mapOverviewViewBox: MapViewBox = { ...WORLD_MAP_VIEW_BOX };
  private resultRecords: NationalRecord[] = [];
  private mappableResultIndices: number[] = [];
  private focusedResultIndex: number | undefined;

  constructor(private readonly document: Document = globalThis.document) {
    this.elements = this.getElements();
  }

  mount(): void {
    this.populateEvents();
    void this.renderMap();
    this.renderDataStamp();

    this.elements.eventSelect.addEventListener('change', () => this.handleEventChange());
    this.elements.genderSelect.addEventListener('change', () => this.handleGenderChange());
    this.elements.timeFields.addEventListener('input', () => this.updateFormState());
    this.elements.form.addEventListener('submit', (event) => this.compare(event));
    this.elements.editTimeButton.addEventListener('click', () => this.editTime());
    this.elements.returnTopButton.addEventListener('click', () => this.returnToTop());
    this.elements.mapExploreButton.addEventListener('click', () => this.focusFirstMapResult());
    this.elements.mapPreviousButton.addEventListener('click', () =>
      this.focusAdjacentMapResult(-1),
    );
    this.elements.mapNextButton.addEventListener('click', () => this.focusAdjacentMapResult(1));
    this.elements.mapViewAllButton.addEventListener('click', () => this.showMapOverview());
    this.elements.countryPanel.addEventListener('scroll', () => this.updateReturnTopButton(), {
      passive: true,
    });
    this.document.defaultView?.addEventListener('scroll', () => this.updateReturnTopButton(), {
      passive: true,
    });

    const restoreSelectionState = (): void => {
      this.document.defaultView?.requestAnimationFrame(() => this.restoreSelectionState());
    };
    this.document.defaultView?.addEventListener('pageshow', restoreSelectionState);
    restoreSelectionState();
  }

  private populateEvents(): void {
    for (const event of EVENTS) {
      const option = this.document.createElement('option');
      option.value = event;
      option.textContent = event;
      this.elements.eventSelect.append(option);
    }
  }

  private handleEventChange(focusTimeWheel = true): void {
    this.elements.formError.textContent = '';
    this.renderTimePicker(focusTimeWheel);
  }

  private handleGenderChange(): void {
    this.elements.formError.textContent = '';
    this.renderTimePicker(true);
  }

  private renderTimePicker(focusTimeWheel: boolean): void {
    const event = this.elements.eventSelect.value;
    const gender = this.elements.genderSelect.value;
    this.elements.timeFields.replaceChildren();
    delete this.elements.timeFields.dataset.selection;

    if (!isEventName(event)) {
      this.elements.timeEntry.disabled = true;
      this.elements.timePreview.textContent = 'Choose an event first.';
      this.updateFormState();
      return;
    }

    if (!isGender(gender)) {
      this.elements.timeEntry.disabled = true;
      this.elements.timePreview.textContent = 'Choose a category.';
      this.updateFormState();
      return;
    }

    this.elements.timeFields.dataset.selection = `${event}:${gender}`;
    for (const field of getTimeFieldsForRecords(event, records.events[event][gender])) {
      this.elements.timeFields.append(this.createTimeWheel(field));
    }

    this.elements.timeEntry.disabled = false;
    this.updateFormState();
    if (focusTimeWheel) this.focusFirstTimeWheel();
  }

  private focusFirstTimeWheel(): void {
    this.elements.timeFields.querySelector<HTMLElement>('.time-wheel')?.focus();
  }

  private restoreSelectionState(): void {
    const event = this.elements.eventSelect.value;
    const gender = this.elements.genderSelect.value;

    if (!isEventName(event) || !isGender(gender)) {
      this.elements.timeEntry.disabled = true;
      this.updateFormState();
      return;
    }

    if (this.elements.timeFields.dataset.selection !== `${event}:${gender}`) {
      this.renderTimePicker(false);
      return;
    }

    this.elements.timeEntry.disabled = false;
    this.updateFormState();
  }

  private createTimeWheel(field: TimePartDefinition): HTMLElement {
    const fieldElement = this.document.createElement('div');
    const wheel = this.document.createElement('div');
    const hiddenInput = this.document.createElement('input');
    const leadingSpacer = this.document.createElement('div');
    const trailingSpacer = this.document.createElement('div');
    const label = this.document.createElement('span');
    const options: HTMLElement[] = [];
    let animationFrame = 0;
    let preserveSelectedValue = false;

    fieldElement.className = 'time-field';
    wheel.className = 'time-wheel';
    wheel.tabIndex = 0;
    wheel.dataset.wheel = field.name;
    wheel.setAttribute('role', 'spinbutton');
    wheel.setAttribute('aria-label', field.label);
    wheel.setAttribute('aria-valuemin', '0');
    wheel.setAttribute('aria-valuemax', field.max.toString());

    hiddenInput.type = 'hidden';
    hiddenInput.name = field.name;
    hiddenInput.value = '0';
    hiddenInput.dataset.timePart = field.name;

    leadingSpacer.className = 'time-wheel-spacer';
    trailingSpacer.className = 'time-wheel-spacer';
    wheel.append(leadingSpacer);

    for (let value = 0; value <= field.max; value += 1) {
      const option = this.document.createElement('div');
      const optionContent = this.document.createElement('span');
      option.className = 'time-wheel-option';
      optionContent.className = 'time-wheel-option-content';
      option.dataset.value = value.toString();
      optionContent.textContent = value.toString().padStart(2, '0');
      option.setAttribute('aria-hidden', 'true');
      option.addEventListener('click', () => selectValue(value, 'smooth'));
      option.append(optionContent);
      options.push(option);
      wheel.append(option);
    }

    wheel.append(trailingSpacer);
    label.className = 'time-field-label';
    label.textContent = field.label;
    fieldElement.append(wheel, hiddenInput, label);

    const updateValue = (value: number): void => {
      const nextValue = Math.max(0, Math.min(field.max, value));
      const changed = hiddenInput.value !== nextValue.toString();
      hiddenInput.value = nextValue.toString();
      wheel.setAttribute('aria-valuenow', nextValue.toString());
      wheel.setAttribute('aria-valuetext', `${nextValue} ${field.label.toLowerCase()}`);
      if (changed) hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const updatePerspective = (): void => {
      animationFrame = 0;
      const rowHeight = options[0]?.offsetHeight || 48;
      const position = wheel.scrollTop / rowHeight;
      const visibleValue = Math.max(0, Math.min(field.max, Math.round(position)));

      for (const [index, option] of options.entries()) {
        const offset = index - position;
        const distance = Math.abs(offset);
        option.style.setProperty('--wheel-angle', `${offset * -24}deg`);
        option.style.setProperty('--wheel-depth', `${distance * -7}px`);
        option.style.setProperty('--wheel-scale', Math.max(0.72, 1 - distance * 0.055).toString());
        option.style.setProperty('--wheel-opacity', Math.max(0, 1 - distance * 0.2).toString());
        option.classList.toggle('time-wheel-option-selected', index === visibleValue);
      }

      if (!preserveSelectedValue) updateValue(visibleValue);
    };

    const selectValue = (value: number, behavior: ScrollBehavior): void => {
      const nextValue = Math.max(0, Math.min(field.max, value));
      const rowHeight = options[0]?.offsetHeight || 48;
      const resolvedBehavior = this.getScrollBehavior(behavior);
      preserveSelectedValue = true;
      updateValue(nextValue);

      if (resolvedBehavior === 'auto') {
        wheel.style.scrollSnapType = 'none';
        wheel.scrollTop = nextValue * rowHeight;
        updatePerspective();
        return;
      }

      wheel.style.removeProperty('scroll-snap-type');
      wheel.scrollTo({ top: nextValue * rowHeight, behavior: resolvedBehavior });
    };

    const beginDirectManipulation = (): void => {
      preserveSelectedValue = false;
      wheel.style.removeProperty('scroll-snap-type');
    };

    wheel.addEventListener('scroll', () => {
      if (animationFrame !== 0) return;
      animationFrame = requestAnimationFrame(updatePerspective);
    });
    wheel.addEventListener('pointerdown', beginDirectManipulation);
    wheel.addEventListener('wheel', beginDirectManipulation, { passive: true });

    wheel.addEventListener('keydown', (event) => {
      const currentValue = Number(hiddenInput.value);
      let nextValue: number | undefined;

      switch (event.key) {
        case 'ArrowUp':
          nextValue = currentValue - 1;
          break;
        case 'ArrowDown':
          nextValue = currentValue + 1;
          break;
        case 'PageUp':
          nextValue = currentValue - 5;
          break;
        case 'PageDown':
          nextValue = currentValue + 5;
          break;
        case 'Home':
          nextValue = 0;
          break;
        case 'End':
          nextValue = field.max;
          break;
      }

      if (nextValue === undefined) return;
      event.preventDefault();
      selectValue(nextValue, 'auto');
    });

    updateValue(0);
    updatePerspective();
    return fieldElement;
  }

  private updateFormState(): void {
    const event = this.elements.eventSelect.value;
    const gender = this.elements.genderSelect.value;
    let validTime = false;

    if (isEventName(event) && isGender(gender) && !this.elements.timeEntry.disabled) {
      try {
        const fields = getTimeFieldsForRecords(event, records.events[event][gender]);
        const milliseconds = timePartsToMilliseconds(event, this.readTimeParts(), fields);
        this.elements.timePreview.textContent = `Entered time: ${formatTime(milliseconds)}`;
        validTime = true;
      } catch {
        this.elements.timePreview.textContent = 'Enter a time greater than zero.';
      }
    }

    this.elements.compareButton.disabled = !(isEventName(event) && isGender(gender) && validTime);
  }

  private compare(submitEvent: SubmitEvent): void {
    submitEvent.preventDefault();
    this.elements.formError.textContent = '';

    const event = this.elements.eventSelect.value;
    const gender = this.elements.genderSelect.value;
    if (!isEventName(event) || !isGender(gender)) {
      this.elements.formError.textContent = 'Choose an event and category.';
      return;
    }

    let userTime: number;
    try {
      const fields = getTimeFieldsForRecords(event, records.events[event][gender]);
      userTime = timePartsToMilliseconds(event, this.readTimeParts(), fields);
    } catch (error) {
      this.elements.formError.textContent =
        error instanceof Error ? error.message : 'Enter a valid time.';
      return;
    }

    const slowerRecords = findSlowerRecords(records.events[event][gender], userTime);
    this.showResults(event, gender, userTime, slowerRecords);
  }

  private showResults(
    event: EventName,
    gender: 'women' | 'men',
    userTime: number,
    slowerRecords: NationalRecord[],
  ): void {
    const count = slowerRecords.length;
    this.elements.resultsTitle.textContent =
      count === 0
        ? 'That time does not beat a national record yet.'
        : `You’re faster than ${count} ${count === 1 ? 'country' : 'countries'}.`;
    const categoryLabel = gender === 'women' ? "women's" : "men's";
    this.elements.resultsDetail.textContent = `${formatTime(userTime)} for the ${categoryLabel} ${event}.`;
    this.resultRecords = slowerRecords;
    this.elements.countryPanel.scrollTop = 0;
    this.elements.results.hidden = false;
    this.document.body.classList.add('showing-results');
    this.elements.results.classList.remove('exploring-countries');
    this.renderCountryList(slowerRecords);
    this.highlightCountries(slowerRecords);
    this.configureResultMap(slowerRecords);
    this.elements.resultsTitle.focus({ preventScroll: true });
    this.document.defaultView?.scrollTo({ top: 0, behavior: this.getScrollBehavior('smooth') });
    this.updateReturnTopButton();
  }

  private renderCountryList(slowerRecords: NationalRecord[]): void {
    this.elements.countryList.replaceChildren();

    if (slowerRecords.length === 0) {
      const empty = this.document.createElement('li');
      empty.className = 'country-empty';
      empty.textContent = 'Keep training, then come back and try the comparison again.';
      this.elements.countryList.append(empty);
      return;
    }

    slowerRecords.forEach((record, index) => {
      const item = this.document.createElement('li');
      const number = this.document.createElement('span');
      const copy = this.document.createElement('div');
      const source = this.document.createElement('a');
      const time = this.document.createElement('strong');

      item.className = 'country-result';
      item.dataset.resultIndex = index.toString();
      number.className = 'country-result-number';
      number.textContent = (index + 1).toString();
      number.setAttribute('aria-hidden', 'true');
      copy.className = 'country-result-copy';
      source.href = record.sourceUrl;
      source.rel = 'external';
      source.textContent = record.country;
      source.setAttribute('aria-label', `${record.country} record source on Wikipedia`);
      time.textContent = formatTime(record.milliseconds);

      copy.append(source, time);
      item.append(number, copy);

      if (this.getMapCountry(record.country)) {
        const showOnMap = this.document.createElement('button');
        showOnMap.className = 'country-map-button';
        showOnMap.type = 'button';
        showOnMap.textContent = 'Show on map';
        showOnMap.dataset.mapResultIndex = index.toString();
        showOnMap.setAttribute('aria-controls', 'world-map');
        showOnMap.setAttribute('aria-label', `Show ${record.country} on map`);
        showOnMap.setAttribute('aria-pressed', 'false');
        showOnMap.addEventListener('click', () => this.focusMapResult(index, true));
        item.append(showOnMap);
      }

      this.elements.countryList.append(item);
    });
  }

  private async renderMap(): Promise<void> {
    const { default: worldData } = await import('../data/world');
    const projection = geoMercator().scale(145).translate([500, 310]);
    const pathGenerator = geoPath(projection);

    for (const feature of worldData.features) {
      const pathData = pathGenerator(feature as GeoPermissibleObjects);
      if (!pathData) continue;

      const path = this.document.createElementNS(SVG_NAMESPACE, 'path');
      const title = this.document.createElementNS(SVG_NAMESPACE, 'title');
      const countryName = feature.properties.name;
      path.setAttribute('d', pathData);
      path.setAttribute('class', 'map-country');
      path.dataset.country = countryName;
      title.textContent = countryName;
      path.append(title);
      this.elements.worldMap.append(path);
      this.mapPaths.set(countryName, path);

      const position = pathGenerator.centroid(feature as GeoPermissibleObjects);
      if (position.every(Number.isFinite)) this.mapPositions.set(countryName, position);
    }

    for (const [countryName, coordinates] of Object.entries(MAP_MARKER_COORDINATES)) {
      if (this.mapPaths.has(countryName)) continue;
      this.renderMapMarker(countryName, coordinates, projection);
    }

    this.mapResultMarkerLayer = this.document.createElementNS(SVG_NAMESPACE, 'g');
    this.mapResultMarkerLayer.classList.add('map-result-markers');
    this.mapResultMarkerLayer.setAttribute('aria-hidden', 'true');
    this.elements.worldMap.append(this.mapResultMarkerLayer);
  }

  private renderMapMarker(
    countryName: string,
    coordinates: [number, number],
    projection: GeoProjection,
  ): void {
    const position = projection(coordinates);
    if (!position) return;

    const marker = this.document.createElementNS(SVG_NAMESPACE, 'circle');
    const title = this.document.createElementNS(SVG_NAMESPACE, 'title');
    marker.setAttribute('cx', position[0].toString());
    marker.setAttribute('cy', position[1].toString());
    marker.setAttribute('r', '3');
    marker.setAttribute('class', 'map-country map-country-marker');
    marker.dataset.country = countryName;
    title.textContent = countryName;
    marker.append(title);
    this.elements.worldMap.append(marker);
    this.mapPaths.set(countryName, marker);
    this.mapPositions.set(countryName, position);
  }

  private getMapCountry(country: string): SVGGraphicsElement | undefined {
    return (
      this.mapPaths.get(country) ??
      (MAP_NAME_ALIASES[country] ? this.mapPaths.get(MAP_NAME_ALIASES[country]) : undefined)
    );
  }

  private getMapPosition(country: string): [number, number] | undefined {
    return (
      this.mapPositions.get(country) ??
      (MAP_NAME_ALIASES[country] ? this.mapPositions.get(MAP_NAME_ALIASES[country]) : undefined)
    );
  }

  private highlightCountries(slowerRecords: NationalRecord[]): void {
    for (const path of this.mapPaths.values()) {
      path.classList.remove('map-country-faster', 'map-country-focused');
    }

    for (const record of slowerRecords) {
      this.getMapCountry(record.country)?.classList.add('map-country-faster');
    }
  }

  private configureResultMap(slowerRecords: NationalRecord[]): void {
    this.focusedResultIndex = undefined;
    this.elements.worldMap.classList.remove('map-view-focused');
    for (const path of this.mapPaths.values()) path.classList.remove('map-country-focused');
    this.mappableResultIndices = slowerRecords.flatMap((record, index) =>
      this.getMapCountry(record.country) && this.getMapPosition(record.country) ? [index] : [],
    );

    const highlightedPaths = this.mappableResultIndices.flatMap((index) => {
      const path = this.getMapCountry(slowerRecords[index]?.country ?? '');
      return path ? [path] : [];
    });

    if (highlightedPaths.length === 0) {
      this.mapOverviewViewBox = { ...WORLD_MAP_VIEW_BOX };
      this.renderResultMarkers([], this.mapOverviewViewBox);
      this.elements.mapOverviewNavigation.hidden = true;
      this.elements.mapFocusNavigation.hidden = true;
      this.elements.mapDescription.textContent = 'The countries in the result are listed below.';
      this.animateMapTo(this.mapOverviewViewBox);
      return;
    }

    const fittedViewBox = this.createViewBoxForPaths(highlightedPaths);
    this.mapOverviewViewBox =
      highlightedPaths.length > 1 && fittedViewBox.width <= MAP_COMPACT_VIEW_MAX_WIDTH
        ? fittedViewBox
        : { ...WORLD_MAP_VIEW_BOX };
    this.renderResultMarkers(slowerRecords, this.mapOverviewViewBox);

    if (this.mappableResultIndices.length === 1) {
      this.focusMapResult(this.mappableResultIndices[0] ?? 0, false);
      return;
    }

    this.showMapOverview(false);
  }

  private renderResultMarkers(slowerRecords: NationalRecord[], viewBox: MapViewBox): void {
    this.mapResultMarkerLayer?.replaceChildren();
    if (
      !this.mapResultMarkerLayer ||
      slowerRecords.length === 0 ||
      slowerRecords.length > MAP_NUMBERED_MARKER_LIMIT
    ) {
      return;
    }

    const isMobile = this.document.defaultView?.matchMedia('(max-width: 959px)').matches ?? false;
    const radius = viewBox.width * (isMobile ? 0.032 : 0.012);
    const minimumDistance = radius * 2.2;
    const placedPositions: [number, number][] = [];

    slowerRecords.forEach((record, index) => {
      const origin = this.getMapPosition(record.country);
      if (!origin) return;

      const position = this.findMarkerPosition(
        origin,
        placedPositions,
        viewBox,
        radius,
        minimumDistance,
        index,
      );
      placedPositions.push(position);

      if (Math.hypot(position[0] - origin[0], position[1] - origin[1]) > radius * 0.5) {
        const leader = this.document.createElementNS(SVG_NAMESPACE, 'line');
        leader.classList.add('map-result-marker-leader');
        leader.setAttribute('x1', origin[0].toString());
        leader.setAttribute('y1', origin[1].toString());
        leader.setAttribute('x2', position[0].toString());
        leader.setAttribute('y2', position[1].toString());
        this.mapResultMarkerLayer?.append(leader);
      }

      const marker = this.document.createElementNS(SVG_NAMESPACE, 'g');
      const badge = this.document.createElementNS(SVG_NAMESPACE, 'circle');
      const label = this.document.createElementNS(SVG_NAMESPACE, 'text');
      marker.classList.add('map-result-marker');
      marker.dataset.resultIndex = index.toString();
      marker.setAttribute('transform', `translate(${position[0]} ${position[1]})`);
      badge.classList.add('map-result-marker-badge');
      badge.setAttribute('r', radius.toString());
      label.classList.add('map-result-marker-label');
      label.setAttribute('font-size', (radius * (index >= 9 ? 0.72 : 0.95)).toString());
      label.textContent = (index + 1).toString();
      marker.append(badge, label);
      this.mapResultMarkerLayer?.append(marker);
    });
  }

  private findMarkerPosition(
    origin: [number, number],
    placedPositions: [number, number][],
    viewBox: MapViewBox,
    radius: number,
    minimumDistance: number,
    markerIndex: number,
  ): [number, number] {
    const clampToViewBox = ([x, y]: [number, number]): [number, number] => [
      Math.max(viewBox.x + radius, Math.min(viewBox.x + viewBox.width - radius, x)),
      Math.max(viewBox.y + radius, Math.min(viewBox.y + viewBox.height - radius, y)),
    ];
    const isAvailable = ([x, y]: [number, number]): boolean =>
      placedPositions.every(
        ([placedX, placedY]) => Math.hypot(x - placedX, y - placedY) >= minimumDistance,
      );
    const originalCandidate = clampToViewBox(origin);
    if (isAvailable(originalCandidate)) return originalCandidate;

    for (let ring = 1; ring <= 4; ring += 1) {
      for (let step = 0; step < 12; step += 1) {
        const angle = ((step + markerIndex * 3) / 12) * Math.PI * 2;
        const distance = minimumDistance * ring;
        const candidate = clampToViewBox([
          origin[0] + Math.cos(angle) * distance,
          origin[1] + Math.sin(angle) * distance,
        ]);
        if (isAvailable(candidate)) return candidate;
      }
    }

    return originalCandidate;
  }

  private focusFirstMapResult(): void {
    const firstResultIndex = this.mappableResultIndices[0];
    if (firstResultIndex !== undefined) this.focusMapResult(firstResultIndex, false);
  }

  private focusAdjacentMapResult(offset: -1 | 1): void {
    if (this.mappableResultIndices.length === 0) return;
    const currentPosition = this.mappableResultIndices.indexOf(this.focusedResultIndex ?? -1);
    const nextPosition =
      (Math.max(0, currentPosition) + offset + this.mappableResultIndices.length) %
      this.mappableResultIndices.length;
    const nextResultIndex = this.mappableResultIndices[nextPosition] ?? 0;
    this.focusMapResult(nextResultIndex, false);
    this.scrollResultIntoView(nextResultIndex);
  }

  private scrollResultIntoView(resultIndex: number): void {
    const result = this.elements.countryList.querySelector<HTMLElement>(
      `[data-result-index="${resultIndex}"]`,
    );
    result?.scrollIntoView({
      behavior: this.getScrollBehavior('smooth'),
      block: 'center',
      inline: 'nearest',
    });
  }

  private focusMapResult(resultIndex: number, scrollToMap: boolean): void {
    const record = this.resultRecords[resultIndex];
    const path = record ? this.getMapCountry(record.country) : undefined;
    if (!record || !path || !this.mappableResultIndices.includes(resultIndex)) return;

    this.focusedResultIndex = resultIndex;
    this.elements.results.classList.add('exploring-countries');
    this.elements.worldMap.classList.add('map-view-focused');
    this.elements.mapOverviewNavigation.hidden = true;
    this.elements.mapFocusNavigation.hidden = false;
    for (const mapPath of this.mapPaths.values()) mapPath.classList.remove('map-country-focused');
    path.classList.add('map-country-focused');
    this.updateFocusedResultState();

    const navigationPosition = this.mappableResultIndices.indexOf(resultIndex);
    const hasMultipleResults = this.mappableResultIndices.length > 1;
    const previousPosition =
      (navigationPosition - 1 + this.mappableResultIndices.length) %
      this.mappableResultIndices.length;
    const nextPosition = (navigationPosition + 1) % this.mappableResultIndices.length;
    const previousRecord = this.resultRecords[this.mappableResultIndices[previousPosition] ?? 0];
    const nextRecord = this.resultRecords[this.mappableResultIndices[nextPosition] ?? 0];
    this.elements.mapPreviousButton.disabled = !hasMultipleResults;
    this.elements.mapNextButton.disabled = !hasMultipleResults;
    this.elements.mapPreviousButton.setAttribute(
      'aria-label',
      hasMultipleResults
        ? `Show ${previousRecord?.country ?? 'previous country'} on map`
        : 'Previous country',
    );
    this.elements.mapNextButton.setAttribute(
      'aria-label',
      hasMultipleResults ? `Show ${nextRecord?.country ?? 'next country'} on map` : 'Next country',
    );
    this.elements.mapFocusStatus.textContent = `${resultIndex + 1} of ${this.resultRecords.length}: ${record.country}`;
    this.elements.mapDescription.textContent = `Focused on ${record.country}, result ${resultIndex + 1} of ${this.resultRecords.length}.`;
    this.animateMapTo(this.createFocusedMapViewBox(path));

    if (scrollToMap) {
      this.elements.mapFocusStatus.focus({ preventScroll: true });
      this.scrollResultIntoView(resultIndex);
    }
  }

  private showMapOverview(animate = true): void {
    this.focusedResultIndex = undefined;
    this.elements.worldMap.classList.remove('map-view-focused');
    this.elements.mapFocusNavigation.hidden = true;
    this.elements.mapOverviewNavigation.hidden = this.mappableResultIndices.length === 0;
    for (const path of this.mapPaths.values()) path.classList.remove('map-country-focused');
    this.updateFocusedResultState();

    const count = this.resultRecords.length;
    this.elements.mapOverviewStatus.textContent = `${count} ${count === 1 ? 'country' : 'countries'} shown`;
    this.elements.mapDescription.textContent =
      count <= MAP_NUMBERED_MARKER_LIMIT
        ? 'Numbered markers correspond to the countries in the results list.'
        : 'Highlighted countries are listed below the map.';

    if (animate) this.animateMapTo(this.mapOverviewViewBox);
    else
      this.elements.worldMap.setAttribute('viewBox', this.formatViewBox(this.mapOverviewViewBox));
  }

  private updateFocusedResultState(): void {
    this.elements.countryList.querySelectorAll<HTMLElement>('.country-result').forEach((item) => {
      const index = Number(item.dataset.resultIndex);
      item.classList.toggle('country-result-focused', index === this.focusedResultIndex);
    });
    this.elements.countryList
      .querySelectorAll<HTMLButtonElement>('[data-map-result-index]')
      .forEach((button) => {
        button.setAttribute(
          'aria-pressed',
          (Number(button.dataset.mapResultIndex) === this.focusedResultIndex).toString(),
        );
      });
  }

  private createViewBoxForPaths(paths: SVGGraphicsElement[]): MapViewBox {
    const boxes = paths.map((path) => path.getBBox());
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    return this.createMapViewBox(left, top, right, bottom);
  }

  private createFocusedMapViewBox(path: SVGGraphicsElement): MapViewBox {
    const fittedViewBox = this.createViewBoxForPaths([path]);
    if (fittedViewBox.width >= MAP_FOCUSED_VIEW_MIN_WIDTH) return fittedViewBox;

    const width = MAP_FOCUSED_VIEW_MIN_WIDTH;
    const height = width / 2;
    const centreX = fittedViewBox.x + fittedViewBox.width / 2;
    const centreY = fittedViewBox.y + fittedViewBox.height / 2;
    return {
      x: Math.max(0, Math.min(WORLD_MAP_VIEW_BOX.width - width, centreX - width / 2)),
      y: Math.max(0, Math.min(WORLD_MAP_VIEW_BOX.height - height, centreY - height / 2)),
      width,
      height,
    };
  }

  private animateMapTo(target: MapViewBox): void {
    if (this.mapAnimationFrame !== 0) cancelAnimationFrame(this.mapAnimationFrame);

    const currentValues = (this.elements.worldMap.getAttribute('viewBox') ?? '')
      .split(' ')
      .map(Number);
    const start =
      currentValues.length === 4 && currentValues.every(Number.isFinite)
        ? {
            x: currentValues[0] ?? WORLD_MAP_VIEW_BOX.x,
            y: currentValues[1] ?? WORLD_MAP_VIEW_BOX.y,
            width: currentValues[2] ?? WORLD_MAP_VIEW_BOX.width,
            height: currentValues[3] ?? WORLD_MAP_VIEW_BOX.height,
          }
        : { ...WORLD_MAP_VIEW_BOX };

    if (this.getScrollBehavior('smooth') === 'auto') {
      this.elements.worldMap.setAttribute('viewBox', this.formatViewBox(target));
      return;
    }

    const startedAt = performance.now();
    const animate = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / MAP_ZOOM_DURATION_MS);
      const easedProgress = 1 - (1 - progress) ** 3;
      const current = {
        x: start.x + (target.x - start.x) * easedProgress,
        y: start.y + (target.y - start.y) * easedProgress,
        width: start.width + (target.width - start.width) * easedProgress,
        height: start.height + (target.height - start.height) * easedProgress,
      };
      this.elements.worldMap.setAttribute('viewBox', this.formatViewBox(current));

      if (progress < 1) this.mapAnimationFrame = requestAnimationFrame(animate);
      else this.mapAnimationFrame = 0;
    };
    this.mapAnimationFrame = requestAnimationFrame(animate);
  }

  private createMapViewBox(left: number, top: number, right: number, bottom: number) {
    const contentWidth = Math.max(1, right - left);
    const contentHeight = Math.max(1, bottom - top);
    const padding = Math.max(12, Math.max(contentWidth, contentHeight) * 0.18);
    let width = contentWidth + padding * 2;
    let height = contentHeight + padding * 2;

    if (width / height < 2) width = height * 2;
    else height = width / 2;

    width = Math.min(width, WORLD_MAP_VIEW_BOX.width);
    height = Math.min(height, WORLD_MAP_VIEW_BOX.height);
    const centreX = (left + right) / 2;
    const centreY = (top + bottom) / 2;
    return {
      x: Math.max(0, Math.min(WORLD_MAP_VIEW_BOX.width - width, centreX - width / 2)),
      y: Math.max(0, Math.min(WORLD_MAP_VIEW_BOX.height - height, centreY - height / 2)),
      width,
      height,
    };
  }

  private formatViewBox(box: { x: number; y: number; width: number; height: number }): string {
    return `${box.x} ${box.y} ${box.width} ${box.height}`;
  }

  private editTime(): void {
    const view = this.document.defaultView;

    this.elements.results.hidden = true;
    this.elements.countryPanel.scrollTop = 0;
    this.restoreSelectionState();
    this.document.body.classList.remove('showing-results');

    this.scrollLandingToTop();
    view?.requestAnimationFrame(() => this.scrollLandingToTop());

    this.updateReturnTopButton();
    this.elements.eventSelect.focus({ preventScroll: true });
  }

  private scrollLandingToTop(): void {
    const documentElement = this.document.documentElement;
    const previousScrollBehavior = documentElement.style.scrollBehavior;

    documentElement.style.scrollBehavior = 'auto';
    documentElement.scrollTop = 0;
    this.document.body.scrollTop = 0;
    this.document.defaultView?.scrollTo(0, 0);
    documentElement.style.scrollBehavior = previousScrollBehavior;
  }

  private returnToTop(): void {
    this.elements.resultsTitle.focus({ preventScroll: true });
    const behavior = this.getScrollBehavior('smooth');
    if (this.usesDesktopResultsLayout()) {
      this.elements.countryPanel.scrollTo({ top: 0, behavior });
    } else {
      this.document.defaultView?.scrollTo({ top: 0, behavior });
    }
  }

  private usesDesktopResultsLayout(): boolean {
    return this.document.defaultView?.matchMedia('(min-width: 960px)').matches ?? false;
  }

  private getScrollBehavior(behavior: ScrollBehavior): ScrollBehavior {
    const reducedMotion = this.document.defaultView?.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    return behavior === 'smooth' && reducedMotion ? 'auto' : behavior;
  }

  private updateReturnTopButton(): void {
    const view = this.document.defaultView;
    const visibilityThreshold = view ? Math.max(160, view.innerHeight * 0.25) : 160;
    const scrollOffset = this.usesDesktopResultsLayout()
      ? this.elements.countryPanel.scrollTop
      : (view?.scrollY ?? 0);
    const visible =
      view !== null &&
      this.document.body.classList.contains('showing-results') &&
      scrollOffset > visibilityThreshold;

    this.elements.returnTopButton.classList.toggle('result-top-button-visible', visible);
    this.elements.returnTopButton.disabled = !visible;
  }

  private renderDataStamp(): void {
    const date = new Date(records.generatedAt);
    const formattedDate = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    this.elements.sourceCount.textContent = records.sourcePageCount.toString();
    this.elements.dataStamp.textContent = `${records.sourcePageCount} source pages · Records refreshed ${formattedDate}`;
  }

  private readTimeParts(): Partial<Record<TimePart, number>> {
    const values: Partial<Record<TimePart, number>> = {};
    this.elements.timeFields
      .querySelectorAll<HTMLInputElement>('[data-time-part]')
      .forEach((input) => {
        const part = input.dataset.timePart as TimePart;
        values[part] = Number(input.value);
      });
    return values;
  }

  private getElements(): AppElements {
    return {
      form: this.requireElement<HTMLFormElement>('comparison-form'),
      eventSelect: this.requireElement<HTMLSelectElement>('event-select'),
      genderSelect: this.requireElement<HTMLSelectElement>('gender-select'),
      timeEntry: this.requireElement<HTMLFieldSetElement>('time-entry'),
      timeFields: this.requireElement('time-fields'),
      timePreview: this.requireElement('time-preview'),
      formError: this.requireElement('form-error'),
      compareButton: this.requireElement<HTMLButtonElement>('compare-button'),
      results: this.requireElement('results'),
      resultsTitle: this.requireElement('results-title'),
      resultsDetail: this.requireElement('results-detail'),
      editTimeButton: this.requireElement<HTMLButtonElement>('edit-time'),
      returnTopButton: this.requireElement<HTMLButtonElement>('return-top'),
      mapPanel: this.requireElement('map-panel'),
      worldMap: this.requireElement<SVGSVGElement>('world-map'),
      mapDescription: this.requireElement<SVGDescElement>('map-description'),
      mapOverviewNavigation: this.requireElement('map-overview-navigation'),
      mapOverviewStatus: this.requireElement('map-overview-status'),
      mapExploreButton: this.requireElement<HTMLButtonElement>('map-explore'),
      mapFocusNavigation: this.requireElement('map-focus-navigation'),
      mapPreviousButton: this.requireElement<HTMLButtonElement>('map-previous'),
      mapFocusStatus: this.requireElement('map-focus-status'),
      mapNextButton: this.requireElement<HTMLButtonElement>('map-next'),
      mapViewAllButton: this.requireElement<HTMLButtonElement>('map-view-all'),
      countryPanel: this.requireElement('country-panel'),
      countryList: this.requireElement<HTMLOListElement>('country-list'),
      dataStamp: this.requireElement('data-stamp'),
      sourceCount: this.requireElement('source-count'),
    };
  }

  private requireElement<T extends Element = HTMLElement>(id: string): T {
    const element = this.document.getElementById(id);
    if (!element) throw new Error(`Missing required element #${id}.`);
    return element as unknown as T;
  }
}
